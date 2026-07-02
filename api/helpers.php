<?php
// Configurar zona horaria local de Centroamérica (Nicaragua/Costa Rica/Honduras/El Salvador)
date_default_timezone_set('America/Managua');

// Deshabilitar visualización de errores directos en pantalla para evitar filtración de rutas/datos
ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';

function cors(): void {
    // Access-Control-Allow-Origin, Allow-Methods y Allow-Headers
    // se envían tanto en .htaccess como aquí en PHP como respaldo robusto.
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-CSRF-Token, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
    header('Content-Type: application/json; charset=utf-8');
    // ─── Security Headers ──────────────────────────────────────────────
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}


function ok(mixed $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input');
    $d   = json_decode($raw ?: '{}', true);
    return is_array($d) ? $d : [];
}

function getAuthHeader(): string {
    // 1. Header estándar — Apache normal
    if (!empty($_SERVER['HTTP_AUTHORIZATION']))           return $_SERVER['HTTP_AUTHORIZATION'];
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    // 2. Header alternativo X-Auth-Token — para FastCGI/InfinityFree que eliminan Authorization
    if (!empty($_SERVER['HTTP_X_AUTH_TOKEN']))            return 'Bearer ' . $_SERVER['HTTP_X_AUTH_TOKEN'];
    // 3. getallheaders() — búsqueda case-insensitive
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            $kl = strtolower($k);
            if ($kl === 'authorization')  return $v;
            if ($kl === 'x-auth-token')  return 'Bearer ' . $v;
        }
    }
    return '';
}

function authUser(): ?array {
    $h = getAuthHeader();
    if (!str_starts_with($h, 'Bearer ')) return null;
    $token = substr($h, 7);
    $db = getDB();
    $st = $db->prepare("SELECT u.* FROM users u
        JOIN auth_tokens t ON t.user_id = u.id
        WHERE t.token = ? AND t.expires_at > NOW() AND u.active = 1");
    $st->execute([$token]);
    return $st->fetch() ?: null;
}

function requireAuth(): array {
    $u = authUser();
    if (!$u) fail('No autenticado. Inicia sesión.', 401);
    return $u;
}

function requireAdmin(): array {
    $u = requireAuth();
    if ($u['role'] !== 'admin') fail('Acceso denegado: se requiere rol admin.', 403);
    return $u;
}

function requireRoot(): array {
    $u = requireAuth();
    if ($u['role'] !== 'root') fail('Acceso denegado: se requiere rol root.', 403);
    return $u;
}

// ============================================================
// ─── SEGURIDAD: Audit, Sanitización ──────────────────────────
// ============================================================

/**
 * Registra una acción sensible en el audit_log.
 * Silencioso en caso de error (no interrumpe el flujo principal).
 */
function auditLog(string $action, string $userId = '', array $data = []): void {
    try {
        $db = getDB();
        $db->prepare(
            "INSERT INTO audit_log (user_id, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)"
        )->execute([
            $userId ?: null,
            $action,
            !empty($data) ? json_encode($data, JSON_UNESCAPED_UNICODE) : null,
            $_SERVER['REMOTE_ADDR'] ?? null,
            substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
        ]);
    } catch (\Exception $e) { /* Silencioso */ }
}

/**
 * Sanitiza y limita la longitud de un string de entrada.
 */
function sanitizeInput(string $val, int $maxLen = 255): string {
    return substr(trim(strip_tags($val)), 0, $maxLen);
}

/**
 * Obtiene el estado actual de disponibilidad de la app desde app_settings.
 * Retorna un array con:
 *   - status: 'active' | 'disabled'
 *   - disableAt: string ISO o 'never'
 *   - isBlocked: bool (true si la app está desactivada o el timer expi ró)
 */
function getAppStatus(): array {
    try {
        $db = getDB();
        $rows = $db->query("SELECT `key`, `value` FROM app_settings WHERE `key` IN ('appStatus','appDisableAt')")->fetchAll();
        $map = [];
        foreach ($rows as $r) $map[$r['key']] = $r['value'];

        $status    = $map['appStatus']   ?? 'active';
        $disableAt = $map['appDisableAt'] ?? 'never';

        $isBlocked = false;
        if ($status === 'disabled') {
            $isBlocked = true;
        } elseif ($disableAt !== 'never') {
            // Verificar si el timer ya expiró
            $ts = strtotime($disableAt);
            if ($ts !== false && time() >= $ts) {
                $isBlocked = true;
                // Auto-marcar como disabled en la BD
                $db->prepare("UPDATE app_settings SET `value`='disabled' WHERE `key`='appStatus'")->execute();
                $db->prepare("UPDATE app_settings SET `value`='never' WHERE `key`='appDisableAt'")->execute();
            }
        }

        return [
            'status'    => $status,
            'disableAt' => $disableAt,
            'isBlocked' => $isBlocked,
        ];
    } catch (\Exception $e) {
        return ['status' => 'active', 'disableAt' => 'never', 'isBlocked' => false];
    }
}

function safeUser(array $u): array {
    unset($u['password_hash']);
    return $u;
}

/**
 * Convierte los campos snake_case de una venta (MySQL) a camelCase (JavaScript).
 * Las jugadas (sale_lines) se incluyen como array 'lines'.
 */
function normalizeSale(array $s, array $lines = []): array {
    return [
        'id'              => $s['id'],
        'lotteryId'       => $s['lottery_id'],
        'comprador'       => $s['comprador'],
        'monto'           => (float)$s['monto'],
        'status'          => $s['status'],
        'sellerId'        => $s['seller_id'],
        'sellerName'      => $s['seller_name'],
        'prizePaid'       => (bool)($s['prize_paid'] ?? 0),
        'horaSorteo'      => $s['hora_sorteo'] ?? '12:00',
        'createdAt'       => $s['created_at'],
        'cancelledAt'     => $s['cancelled_at'] ?? null,
        'cancelledByName' => $s['cancelled_by_name'] ?? null,
        'multiSaleId'     => $s['multi_sale_id'] ?? null,
        'lines'           => array_map('normalizeLine', $lines),
    ];
}

function normalizeLine(array $l): array {
    return [
        'id'        => (int)$l['id'],
        'saleId'    => $l['sale_id'],
        'lotteryId' => $l['lottery_id'],
        'numero'    => $l['numero'],
        'monto'     => (float)$l['monto'],
        'fecha'     => $l['fecha'] ?? null,
        'modalidad' => $l['modalidad'] ?? null,
        'serie'     => $l['serie'] ?? null,
        'fraccion'  => isset($l['fraccion']) ? (int)$l['fraccion'] : null,
        'status'    => $l['status'],
    ];
}

function normalizeResult(array $r): array {
    // Intentar obtener el nombre legible de la lotería desde game_configs
    $lotteryName = $r['lottery_id'] ?? '';
    try {
        $db = getDB();
        $gc = $db->prepare("SELECT name FROM game_configs WHERE lottery_id = ?");
        $gc->execute([$r['lottery_id'] ?? '']);
        $gcRow = $gc->fetch();
        if ($gcRow && !empty($gcRow['name'])) $lotteryName = $gcRow['name'];
    } catch (\Exception $e) { /* Silencioso */ }

    return [
        'id'            => (int)$r['id'],
        'lotteryId'     => $r['lottery_id'],
        'lotteryName'   => $lotteryName,
        'fechaSorteo'   => $r['fecha_sorteo'],
        'numeroGanador' => $r['numero_ganador'],
        'horaSorteo'    => $r['hora_sorteo'] ?? '12:00',
        'announcedBy'   => $r['announced_by'],
        'announcedAt'   => $r['announced_at'],
    ];
}


/**
 * Carga las jugadas de uno o varios boletos.
 * Retorna un mapa { sale_id => [lines...] }
 */
function loadLines(PDO $db, array $saleIds): array {
    if (empty($saleIds)) return [];
    $in = implode(',', array_fill(0, count($saleIds), '?'));
    $st = $db->prepare("SELECT * FROM sale_lines WHERE sale_id IN ($in) ORDER BY id ASC");
    $st->execute($saleIds);
    $map = [];
    foreach ($st->fetchAll() as $line) {
        $map[$line['sale_id']][] = $line;
    }
    return $map;
}
