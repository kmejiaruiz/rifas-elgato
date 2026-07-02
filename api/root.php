<?php
// GET  /api/root.php          → leer estado de disponibilidad de la app (solo root)
// PUT  /api/root.php          → actualizar estado de disponibilidad (solo root)
// POST /api/root.php          → verificar credenciales y retornar rol (sin crear sesión)
require_once __DIR__ . '/helpers.php';
cors();

$method = $_SERVER['REQUEST_METHOD'];

// ─── Verificar credenciales (sin crear token) ─────────────────────────
if ($method === 'POST') {
    requireAuth();
    $b        = body();
    $username = trim($b['username'] ?? '');
    $password = $b['password']  ?? '';

    if (!$username || !$password) fail('Usuario y contraseña son requeridos.');

    $db = getDB();
    $st = $db->prepare("SELECT * FROM users WHERE username = ? AND active = 1");
    $st->execute([$username]);
    $user = $st->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        fail('Usuario o contraseña incorrectos.', 401);
    }

    // Solo devuelve el rol — sin crear token ni afectar la sesión actual
    ok(['role' => $user['role'], 'name' => $user['name']]);
}

// ─── Leer estado ──────────────────────────────────────────────
if ($method === 'GET') {
    requireRoot();
    $appStatus = getAppStatus();
    ok(['appControl' => $appStatus]);
}

// ─── Actualizar estado ────────────────────────────────────────
if ($method === 'PUT') {
    $rootUser = requireRoot();
    $db  = getDB();
    $b   = body();

    $action = $b['action'] ?? '';

    if ($action === 'disable') {
        // Desactivar inmediatamente
        $db->prepare("UPDATE app_settings SET `value`='disabled' WHERE `key`='appStatus'")->execute();
        $db->prepare("UPDATE app_settings SET `value`='never' WHERE `key`='appDisableAt'")->execute();
        auditLog('app_disabled', $rootUser['id'], ['action' => 'disable']);
        ok(['message' => 'Aplicación desactivada.', 'appControl' => getAppStatus()]);

    } elseif ($action === 'schedule') {
        // Programar desactivación en X minutos
        $minutes = isset($b['minutes']) ? (int)$b['minutes'] : 0;
        if ($minutes <= 0) fail('Los minutos deben ser un número positivo.');

        $disableAt = date('Y-m-d H:i:s', time() + ($minutes * 60));
        $db->prepare("UPDATE app_settings SET `value`='active' WHERE `key`='appStatus'")->execute();
        $db->prepare("UPDATE app_settings SET `value`=? WHERE `key`='appDisableAt'")->execute([$disableAt]);
        auditLog('app_scheduled', $rootUser['id'], ['minutes' => $minutes, 'disableAt' => $disableAt]);
        ok(['message' => "Aplicación se desactivará en {$minutes} minuto(s).", 'appControl' => getAppStatus()]);

    } elseif ($action === 'restore') {
        // Reactivar: volver a estado normal
        $db->prepare("UPDATE app_settings SET `value`='active' WHERE `key`='appStatus'")->execute();
        $db->prepare("UPDATE app_settings SET `value`='never' WHERE `key`='appDisableAt'")->execute();
        auditLog('app_restored', $rootUser['id'], ['action' => 'restore']);
        ok(['message' => 'Aplicación reactivada correctamente.', 'appControl' => getAppStatus()]);

    } else {
        fail("Acción no válida. Use: 'disable', 'schedule' o 'restore'.");
    }
}

fail('Método no permitido.', 405);
