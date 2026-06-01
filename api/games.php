<?php
// GET /api/games.php            → listar juegos con config
// PUT /api/games.php?id=X       → actualizar config de un juego (admin)
require_once __DIR__ . '/helpers.php';
cors();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

if ($method === 'GET') {
    requireAuth();
    $rows = $db->query("SELECT * FROM game_configs")->fetchAll();
    // Indexar por lottery_id para fácil acceso
    $configs = [];
    foreach ($rows as $r) $configs[$r['lottery_id']] = $r;
    ok(['configs' => $configs]);
}

if ($method === 'PUT') {
    requireAdmin();
    $id = $_GET['id'] ?? '';
    if (!$id) fail('lottery_id requerido.');

    $b = body();

    // Upsert
    $db->prepare("INSERT INTO game_configs 
        (lottery_id, enabled, name, description, default_price, price_label, emoji, payout_multiplier, number_digits, min_number, max_number, is_custom, allow_series, draw_hours, max_sales_per_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            enabled           = VALUES(enabled),
            name              = VALUES(name),
            description       = VALUES(description),
            default_price     = VALUES(default_price),
            price_label       = VALUES(price_label),
            emoji             = VALUES(emoji),
            payout_multiplier = VALUES(payout_multiplier),
            number_digits     = VALUES(number_digits),
            min_number        = VALUES(min_number),
            max_number        = VALUES(max_number),
            is_custom         = VALUES(is_custom),
            allow_series      = VALUES(allow_series),
            draw_hours        = VALUES(draw_hours),
            max_sales_per_number = VALUES(max_sales_per_number)")
       ->execute([
           $id,
           isset($b['enabled']) ? ($b['enabled'] ? 1 : 0) : 1,
           $b['name']          ?? null,
           $b['description']   ?? null,
           isset($b['defaultPrice']) ? (float)$b['defaultPrice'] : null,
           $b['priceLabel']    ?? null,
           $b['emoji']         ?? '',
           isset($b['payoutMultiplier']) ? (float)$b['payoutMultiplier'] : 80.00,
           isset($b['numberDigits']) ? (int)$b['numberDigits'] : 2,
           isset($b['minNumber']) ? (int)$b['minNumber'] : 0,
           isset($b['maxNumber']) ? (int)$b['maxNumber'] : 99,
           isset($b['isCustom']) ? ($b['isCustom'] ? 1 : 0) : 0,
           isset($b['allowSeries']) ? ($b['allowSeries'] ? 1 : 0) : 0,
           $b['drawHours']     ?? '12:00,15:00,18:00,21:00',
           isset($b['maxSalesPerNumber']) ? (float)$b['maxSalesPerNumber'] : 0.00,
       ]);

    $st = $db->prepare("SELECT * FROM game_configs WHERE lottery_id = ?");
    $st->execute([$id]);
    ok(['config' => $st->fetch()]);
}

if ($method === 'DELETE') {
    requireAdmin();
    $id = $_GET['id'] ?? '';
    if (!$id) fail('lottery_id requerido.');

    $db->prepare("DELETE FROM game_configs WHERE lottery_id = ? AND is_custom = 1")->execute([$id]);
    
    // También borrar números bloqueados asociados a este juego
    $db->prepare("DELETE FROM blocked_numbers WHERE lottery_id = ?")->execute([$id]);

    ok(['message' => 'Juego personalizado eliminado.']);
}

fail('Método no permitido.', 405);
