<?php
// Configurar zona horaria local de Centroamérica (Nicaragua/Costa Rica/Honduras/El Salvador)
date_default_timezone_set('America/Managua');

// Deshabilitar visualización de errores directos en pantalla para evitar filtración de rutas/datos
ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';

function cors(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin) {
        $host = parse_url($origin, PHP_URL_HOST);
        $serverHost = $_SERVER['HTTP_HOST'] ?? '';
        // Obtener el nombre del host del servidor omitiendo el puerto si existe (ej: api.midominio.com:80 -> api.midominio.com)
        $serverHostName = explode(':', $serverHost)[0];

        // Permitir si es localhost, 127.0.0.1, si coincide con el host del propio servidor (producción) o si es IP local (LAN)
        $isAllowed = ($host === 'localhost' || $host === '127.0.0.1' || 
                      $host === $serverHostName ||
                      filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false);
        if ($isAllowed) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
        } else {
            // Denegar CORS devolviendo el host local por defecto
            header('Access-Control-Allow-Origin: http://localhost');
        }
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Content-Type: application/json; charset=utf-8');
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
    // Apache puede pasar el header de varias formas
    if (!empty($_SERVER['HTTP_AUTHORIZATION']))          return $_SERVER['HTTP_AUTHORIZATION'];
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        // Case-insensitive search
        foreach ($headers as $k => $v) {
            if (strtolower($k) === 'authorization') return $v;
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
    return [
        'id'            => (int)$r['id'],
        'lotteryId'     => $r['lottery_id'],
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
