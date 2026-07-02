<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/helpers.php';

$user = requireAuth();
if ($user['role'] !== 'admin' && $user['role'] !== 'root') {
    fail('Acceso denegado.', 403);
}

$db = getDB();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Obtener notificaciones no leídas
    $st = $db->prepare("SELECT * FROM notifications WHERE read_status = 0 ORDER BY id ASC");
    $st->execute();
    $notifs = $st->fetchAll();

    if (!empty($notifs)) {
        // Marcar como leídas
        $ids = array_column($notifs, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("UPDATE notifications SET read_status = 1 WHERE id IN ($placeholders)")->execute($ids);
    }

    ok(['notifications' => $notifs]);
}
