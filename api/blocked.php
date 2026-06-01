<?php
// GET    /api/blocked.php?lottery_id=X  → listar números bloqueados
// POST   /api/blocked.php               → bloquear número (admin)
// DELETE /api/blocked.php?lottery_id=X&numero=N → desbloquear
// DELETE /api/blocked.php?lottery_id=X&all=1    → desbloquear todos
require_once __DIR__ . '/helpers.php';
cors();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

if ($method === 'GET') {
    requireAuth();
    $lid = $_GET['lottery_id'] ?? '';
    if (!$lid) fail('lottery_id requerido.');
    $st = $db->prepare("SELECT numero FROM blocked_numbers WHERE lottery_id = ? ORDER BY numero");
    $st->execute([$lid]);
    ok(['blocked' => array_column($st->fetchAll(), 'numero')]);
}

if ($method === 'POST') {
    requireAdmin();
    $b      = body();
    $lid    = $b['lottery_id'] ?? '';
    $numero = (string)($b['numero'] ?? '');
    if (!$lid || $numero === '') fail('lottery_id y numero son requeridos.');
    $db->prepare("INSERT IGNORE INTO blocked_numbers (lottery_id, numero) VALUES (?,?)")
       ->execute([$lid, $numero]);
    ok(['message' => "Número $numero bloqueado."]);
}

if ($method === 'DELETE') {
    requireAdmin();
    $lid = $_GET['lottery_id'] ?? '';
    if (!$lid) fail('lottery_id requerido.');

    if (!empty($_GET['all'])) {
        $db->prepare("DELETE FROM blocked_numbers WHERE lottery_id = ?")->execute([$lid]);
        ok(['message' => 'Todos los números desbloqueados.']);
    }

    $numero = $_GET['numero'] ?? '';
    if ($numero === '') fail('numero requerido.');
    $db->prepare("DELETE FROM blocked_numbers WHERE lottery_id = ? AND numero = ?")
       ->execute([$lid, $numero]);
    ok(['message' => "Número $numero desbloqueado."]);
}

fail('Método no permitido.', 405);
