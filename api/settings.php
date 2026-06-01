<?php
// GET /api/settings.php        → leer todas las settings
// PUT /api/settings.php        → actualizar settings (admin)
require_once __DIR__ . '/helpers.php';
cors();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

if ($method === 'GET') {
    requireAuth();
    $rows = $db->query("SELECT `key`, `value` FROM app_settings")->fetchAll();
    $settings = [];
    foreach ($rows as $r) $settings[$r['key']] = $r['value'];
    ok(['settings' => $settings]);
}

if ($method === 'PUT') {
    requireAdmin();
    $b = body();
    
    // Lista blanca de configuraciones válidas para evitar contaminación o inserciones maliciosas
    $allowedKeys = ['businessName', 'currency', 'autoprint', 'drawCloseMinutes'];
    
    $st = $db->prepare("INSERT INTO app_settings (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
    foreach ($b as $key => $value) {
        if (!in_array($key, $allowedKeys, true)) {
            continue; // Ignorar claves que no estén en la lista blanca
        }
        $st->execute([$key, (string)$value]);
    }
    ok(['message' => 'Configuración guardada.']);
}

fail('Método no permitido.', 405);
