<?php
// GET    /api/users.php         → listar usuarios (admin) o reporte de ventas y salarios (?report=1)
// POST   /api/users.php         → crear usuario (admin)
// PUT    /api/users.php?id=X    → actualizar usuario (admin)
// DELETE /api/users.php?id=X    → eliminar usuario (admin)
require_once __DIR__ . '/helpers.php';
cors();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ─── Listar / Reporte ──────────────────────────────────────────
if ($method === 'GET') {
    requireAdmin();
    
    if (isset($_GET['report'])) {
        // Consultar estadísticas de ventas y pagos por usuario del día de hoy
        $sql = "SELECT
                    u.id, u.username, u.name, u.role, u.active, u.salary_type, u.salary_value,
                    COALESCE(sales_today.total_sold, 0.00) as total_sold,
                    COALESCE(sales_today.tickets_sold_count, 0) as tickets_sold_count,
                    COALESCE(prizes_today.prizes_count, 0) as prizes_count,
                    COALESCE(prizes_today.prizes_total, 0.00) as prizes_total
                FROM users u
                LEFT JOIN (
                    SELECT
                        seller_id,
                        SUM(monto) as total_sold,
                        COUNT(*) as tickets_sold_count
                    FROM sales
                    WHERE DATE(created_at) = CURRENT_DATE() AND status = 'active'
                    GROUP BY seller_id
                ) sales_today ON sales_today.seller_id = u.id
                LEFT JOIN (
                    SELECT
                        s.seller_id,
                        COUNT(sl.id) as prizes_count,
                        SUM(sl.monto * COALESCE(gc.payout_multiplier, 80.00)) as prizes_total
                    FROM sale_lines sl
                    JOIN sales s ON s.id = sl.sale_id
                    LEFT JOIN game_configs gc ON gc.lottery_id = sl.lottery_id
                    WHERE DATE(s.created_at) = CURRENT_DATE() AND sl.status = 'winner' AND s.status = 'active' AND s.prize_paid = 1
                    GROUP BY s.seller_id
                ) prizes_today ON prizes_today.seller_id = u.id
                ORDER BY u.role DESC, u.name";
        $rows = $db->query($sql)->fetchAll();
        ok(['report' => $rows]);
    } else {
        $rows = $db->query("SELECT id, username, name, role, active, salary_type, salary_value, created_at, updated_at FROM users ORDER BY role DESC, name")->fetchAll();
        ok(['users' => $rows]);
    }
}

// ─── Crear ────────────────────────────────────────────────────
if ($method === 'POST') {
    requireAdmin();
    $b = body();
    $username = trim($b['username'] ?? '');
    $password = $b['password'] ?? '';
    $name     = trim($b['name'] ?? '');
    $role     = in_array($b['role'] ?? '', ['admin','vendedor']) ? $b['role'] : 'vendedor';
    $salary_type  = in_array($b['salary_type'] ?? '', ['fixed','percentage']) ? $b['salary_type'] : 'percentage';
    $salary_value = isset($b['salary_value']) ? (float)$b['salary_value'] : 10.00;

    if (!$username || !$password || !$name) fail('Nombre, usuario y contraseña son requeridos.');
    if (strlen($password) < 6) fail('La contraseña debe tener al menos 6 caracteres.');
    if (strtolower($password) === strtolower($username)) fail('La contraseña no puede ser igual al nombre de usuario.');

    // Verificar duplicado
    $dup = $db->prepare("SELECT id FROM users WHERE username = ?");
    $dup->execute([$username]);
    if ($dup->fetch()) fail('El nombre de usuario ya existe.');

    $id = genUUID();
    $db->prepare("INSERT INTO users (id, username, password_hash, name, role, active, salary_type, salary_value) VALUES (?,?,?,?,?,1,?,?)")
       ->execute([$id, $username, password_hash($password, PASSWORD_BCRYPT), $name, $role, $salary_type, $salary_value]);

    $user = $db->prepare("SELECT id, username, name, role, active, salary_type, salary_value, created_at FROM users WHERE id = ?");
    $user->execute([$id]);
    ok(['user' => $user->fetch()], 201);
}

// ─── Actualizar ───────────────────────────────────────────────
if ($method === 'PUT') {
    $admin = requireAdmin();
    $id = $_GET['id'] ?? '';
    if (!$id) fail('ID requerido.');

    // Obtener información actual del usuario para validaciones
    $userQ = $db->prepare("SELECT username FROM users WHERE id = ?");
    $userQ->execute([$id]);
    $targetUser = $userQ->fetch();
    if (!$targetUser) fail('Usuario no encontrado.', 404);

    $b = body();
    $fields = [];
    $vals   = [];

    if (isset($b['name']))     { $fields[] = 'name = ?';     $vals[] = trim($b['name']); }
    if (isset($b['role']) && in_array($b['role'], ['admin','vendedor'])) {
                                 $fields[] = 'role = ?';     $vals[] = $b['role']; }
    if (isset($b['active']))   { $fields[] = 'active = ?';   $vals[] = $b['active'] ? 1 : 0; }
    if (isset($b['salary_type']) && in_array($b['salary_type'], ['fixed', 'percentage'])) {
                                 $fields[] = 'salary_type = ?'; $vals[] = $b['salary_type']; }
    if (isset($b['salary_value'])) {
                                 $fields[] = 'salary_value = ?'; $vals[] = (float)$b['salary_value']; }
    if (!empty($b['password'])) {
        if (strlen($b['password']) < 6) fail('La contraseña debe tener al menos 6 caracteres.');
        if (strtolower($b['password']) === strtolower($targetUser['username'])) {
            fail('La contraseña no puede ser igual al nombre de usuario.');
        }
        $fields[] = 'password_hash = ?';
        $vals[]   = password_hash($b['password'], PASSWORD_BCRYPT);
    }

    if (empty($fields)) fail('Nada que actualizar.');

    // Evitar que el admin se desactive a sí mismo
    if (isset($b['active']) && !$b['active'] && $id === $admin['id']) {
        fail('No puedes desactivarte a ti mismo.');
    }

    $vals[] = $id;
    $db->prepare("UPDATE users SET ".implode(', ', $fields)." WHERE id = ?")->execute($vals);

    $st = $db->prepare("SELECT id, username, name, role, active, salary_type, salary_value, updated_at FROM users WHERE id = ?");
    $st->execute([$id]);
    ok(['user' => $st->fetch()]);
}

// ─── Eliminar ─────────────────────────────────────────────────
if ($method === 'DELETE') {
    $admin = requireAdmin();
    $id = $_GET['id'] ?? '';
    if (!$id) fail('ID requerido.');
    if ($id === $admin['id']) fail('No puedes eliminar tu propio usuario.');

    $db->prepare("DELETE FROM users WHERE id = ?")->execute([$id]);
    ok(['message' => 'Usuario eliminado']);
}

fail('Método no permitido.', 405);
