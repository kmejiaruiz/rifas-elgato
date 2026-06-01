<?php
// GET  /api/results.php               → listar resultados anunciados
// GET  /api/results.php?check=1       → boletos ganadores del vendedor actual
// POST /api/results.php               → admin anuncia resultado
// DELETE /api/results.php?id=X        → admin elimina resultado
require_once __DIR__ . '/helpers.php';
cors();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ─── Listar resultados / Check ganadores ──────────────────────
if ($method === 'GET') {
    $user = requireAuth();

    // Check: ¿tiene el vendedor jugadas ganadoras?
    if (isset($_GET['check'])) {
        // Buscar resultados de las últimas 72 horas
        $results = $db->prepare("SELECT * FROM lottery_results
            WHERE announced_at >= DATE_SUB(NOW(), INTERVAL 72 HOUR)
            ORDER BY announced_at DESC");
        $results->execute();
        $allResults = $results->fetchAll();

        $winners = [];
        foreach ($allResults as $r) {
            // Buscar jugadas activas del vendedor que coincidan
            $st = $db->prepare("SELECT sl.*, s.comprador, s.seller_name, s.seller_id, s.id as sale_id,
                COALESCE(gc.payout_multiplier, 80.00) as payout_multiplier
                FROM sale_lines sl
                JOIN sales s ON s.id = sl.sale_id
                LEFT JOIN game_configs gc ON gc.lottery_id = sl.lottery_id
                WHERE sl.lottery_id = ?
                AND sl.numero = ?
                AND sl.status IN ('active', 'winner')
                AND s.status = 'active'
                AND s.seller_id = ?
                AND s.hora_sorteo = ?
                AND sl.fecha = ?");
            $st->execute([$r['lottery_id'], $r['numero_ganador'], $user['id'], $r['hora_sorteo'], $r['fecha_sorteo']]);
            $matches = $st->fetchAll();

            foreach ($matches as $m) {
                $winners[] = [
                    'resultId'      => (int)$r['id'],
                    'lotteryId'     => $r['lottery_id'],
                    'fechaSorteo'   => $r['fecha_sorteo'],
                    'numeroGanador' => $r['numero_ganador'],
                    'horaSorteo'    => $r['hora_sorteo'],
                    'announcedAt'   => $r['announced_at'],
                    'saleId'        => $m['sale_id'],
                    'lineId'        => (int)$m['id'],
                    'comprador'     => $m['comprador'],
                    'sellerName'    => $m['seller_name'],
                    'monto'         => (float)$m['monto'],
                    'prize'         => (float)$m['monto'] * (float)$m['payout_multiplier'],
                ];
            }
        }

        ok(['winners' => $winners]);
    }

    // Listar todos los resultados (últimos 30 días)
    $st = $db->prepare("SELECT * FROM lottery_results
        ORDER BY announced_at DESC LIMIT 100");
    $st->execute();
    $results = array_map('normalizeResult', $st->fetchAll());

    // Para admin: incluir conteo de boletos ganadores por resultado
    if ($user['role'] === 'admin') {
        foreach ($results as &$res) {
            $cq = $db->prepare("SELECT COUNT(*) FROM sale_lines sl
                JOIN sales s ON s.id = sl.sale_id
                WHERE sl.lottery_id = ? AND sl.numero = ? AND sl.status = 'active' AND s.status = 'active'
                AND s.hora_sorteo = ? AND sl.fecha = ?");
            $cq->execute([$res['lotteryId'], $res['numeroGanador'], $res['horaSorteo'], $res['fechaSorteo']]);
            $res['winnersCount'] = (int)$cq->fetchColumn();
        }
    }

    ok(['results' => $results]);
}

// ─── Anunciar resultado ───────────────────────────────────────
if ($method === 'POST') {
    $user = requireAdmin();
    $b    = body();

    $lotteryId     = trim($b['lotteryId']     ?? '');
    $fechaSorteo   = trim($b['fechaSorteo']   ?? date('Y-m-d'));
    $numeroGanador = trim($b['numeroGanador'] ?? '');
    $horaSorteo    = trim($b['horaSorteo']    ?? '12:00');

    if (!$lotteryId)     fail('lotteryId es requerido.');
    if ($numeroGanador === '') fail('El número ganador es requerido.');

    // Insertar resultado
    $ins = $db->prepare("INSERT INTO lottery_results
        (lottery_id, fecha_sorteo, numero_ganador, announced_by, hora_sorteo)
        VALUES (?,?,?,?,?)");
    $ins->execute([$lotteryId, $fechaSorteo, $numeroGanador, $user['name'], $horaSorteo]);
    $resultId = $db->lastInsertId();

    // Buscar boletos ganadores
    $st = $db->prepare("SELECT sl.*, s.comprador, s.seller_name, s.seller_id, s.id as sale_id,
        COALESCE(gc.payout_multiplier, 80.00) as payout_multiplier
        FROM sale_lines sl
        JOIN sales s ON s.id = sl.sale_id
        LEFT JOIN game_configs gc ON gc.lottery_id = sl.lottery_id
        WHERE sl.lottery_id = ?
        AND sl.numero = ?
        AND sl.status = 'active'
        AND s.status = 'active'
        AND s.hora_sorteo = ?
        AND sl.fecha = ?");
    $st->execute([$lotteryId, $numeroGanador, $horaSorteo, $fechaSorteo]);
    $matches = $st->fetchAll();

    // Marcar jugadas como ganadoras
    if (!empty($matches)) {
        $upd = $db->prepare("UPDATE sale_lines SET status = 'winner' WHERE id = ?");
        foreach ($matches as $m) {
            $upd->execute([$m['id']]);
        }
    }

    $winners = array_map(fn($m) => [
        'saleId'    => $m['sale_id'],
        'lineId'    => (int)$m['id'],
        'numero'    => $m['numero'],
        'monto'     => (float)$m['monto'],
        'prize'     => (float)$m['monto'] * (float)$m['payout_multiplier'],
        'comprador' => $m['comprador'],
        'sellerName'=> $m['seller_name'],
    ], $matches);

    ok([
        'result'  => normalizeResult(['id'=>$resultId,'lottery_id'=>$lotteryId,
                        'fecha_sorteo'=>$fechaSorteo,'numero_ganador'=>$numeroGanador,
                        'announced_by'=>$user['name'],'announced_at'=>date('Y-m-d H:i:s'), 'hora_sorteo'=>$horaSorteo]),
        'winners' => $winners,
    ], 201);
}

// ─── Eliminar resultado ───────────────────────────────────────
if ($method === 'DELETE') {
    requireAdmin();
    $id = $_GET['id'] ?? '';
    if (!$id) fail('ID requerido.');

    // Revertir jugadas ganadoras de este resultado
    $res = $db->prepare("SELECT * FROM lottery_results WHERE id = ?");
    $res->execute([$id]);
    $r = $res->fetch();
    if ($r) {
        $db->prepare("UPDATE sale_lines SET status = 'active'
            WHERE lottery_id = ? AND numero = ? AND status = 'winner'")
           ->execute([$r['lottery_id'], $r['numero_ganador']]);
    }

    $db->prepare("DELETE FROM lottery_results WHERE id = ?")->execute([$id]);
    ok(['message' => 'Resultado eliminado.']);
}

fail('Método no permitido.', 405);
