<?php
// POST /api/auth.php          → login
// GET  /api/auth.php          → me (perfil del token actual)
// DELETE /api/auth.php        → logout
require_once __DIR__ . '/helpers.php';
cors();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ─── Login ────────────────────────────────────────────────────
if ($method === 'POST') {
    $b = body();
    $username = trim($b['username'] ?? '');
    $password = $b['password'] ?? '';

    if (!$username || !$password) fail('Usuario y contraseña son requeridos.');

    // Rastrear IP del cliente para Rate Limiting
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if ($ip) {
        $chkLock = $db->prepare("SELECT attempts, UNIX_TIMESTAMP(last_attempt) as last_ts FROM login_attempts WHERE ip_address = ?");
        $chkLock->execute([$ip]);
        $lock = $chkLock->fetch();
        if ($lock && $lock['attempts'] >= 5) {
            $timePassed = time() - $lock['last_ts'];
            if ($timePassed < 900) { // 15 minutos (900 segundos)
                $timeLeft = ceil((900 - $timePassed) / 60);
                fail("Demasiados intentos fallidos. Por seguridad, tu dirección IP ha sido bloqueada temporalmente. Inténtalo de nuevo en $timeLeft minuto(s).", 429);
            } else {
                // Si ya expiró el tiempo de bloqueo, limpiar el registro para permitir reintentar
                $db->prepare("DELETE FROM login_attempts WHERE ip_address = ?")->execute([$ip]);
            }
        }
    }

    $st = $db->prepare("SELECT * FROM users WHERE username = ? AND active = 1");
    $st->execute([$username]);
    $user = $st->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        if ($ip) {
            $db->prepare("INSERT INTO login_attempts (ip_address, attempts) VALUES (?, 1)
                ON DUPLICATE KEY UPDATE attempts = attempts + 1, last_attempt = NOW()")->execute([$ip]);
        }
        fail('Usuario o contraseña incorrectos.', 401);
    }

    // Limpiar intentos fallidos si el inicio de sesión es correcto
    if ($ip) {
        $db->prepare("DELETE FROM login_attempts WHERE ip_address = ?")->execute([$ip]);
    }

    // Limpiar solo tokens EXPIRADOS del usuario (no todos)
    $db->prepare("DELETE FROM auth_tokens WHERE user_id = ? AND expires_at <= NOW()")->execute([$user['id']]);

    // Crear token (24 h)
    $token = bin2hex(random_bytes(32));
    $db->prepare("INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))")
       ->execute([$token, $user['id']]);

    ok(['token' => $token, 'user' => safeUser($user)]);
}

// ─── Me ───────────────────────────────────────────────────────
if ($method === 'GET') {
    $user = requireAuth();
    ok(['user' => safeUser($user)]);
}

// ─── Logout ───────────────────────────────────────────────────
if ($method === 'DELETE') {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($h, 'Bearer ')) {
        $token = substr($h, 7);
        $db->prepare("DELETE FROM auth_tokens WHERE token = ?")->execute([$token]);
    }
    ok(['message' => 'Sesión cerrada']);
}

fail('Método no permitido.', 405);
