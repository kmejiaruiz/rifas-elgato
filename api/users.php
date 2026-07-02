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
        $startDate = $_GET['start_date'] ?? date('Y-m-d');
        $endDate   = $_GET['end_date'] ?? date('Y-m-d');

        // Consultar estadísticas de ventas y pagos por usuario del rango de fechas
        $sql = "SELECT
                    u.id, u.username, u.name, u.role, u.active, u.salary_type, u.salary_value, u.salary_period,
                    COALESCE(sales_range.total_sold, 0.00) as total_sold,
                    COALESCE(sales_range.tickets_sold_count, 0) as tickets_sold_count,
                    COALESCE(sales_range.days_active, 0) as days_active,
                    COALESCE(prizes_range.prizes_count, 0) as prizes_count,
                    COALESCE(prizes_range.prizes_total, 0.00) as prizes_total,
                    COALESCE(cancelled_range.cancelled_count, 0) as cancelled_count,
                    COALESCE(cancelled_range.cancelled_total, 0.00) as cancelled_total
                FROM users u
                LEFT JOIN (
                    SELECT
                        seller_id,
                        SUM(monto) as total_sold,
                        COUNT(*) as tickets_sold_count,
                        COUNT(DISTINCT DATE(created_at)) as days_active
                    FROM sales
                    WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'active'
                    GROUP BY seller_id
                ) sales_range ON sales_range.seller_id = u.id
                LEFT JOIN (
                    SELECT
                        s.seller_id,
                        COUNT(sl.id) as prizes_count,
                        SUM(sl.monto * COALESCE(gc.payout_multiplier, 80.00)) as prizes_total
                    FROM sale_lines sl
                    JOIN sales s ON s.id = sl.sale_id
                    LEFT JOIN game_configs gc ON gc.lottery_id = sl.lottery_id
                    WHERE DATE(s.created_at) BETWEEN ? AND ? AND sl.status = 'winner' AND s.status = 'active' AND s.prize_paid = 1
                    GROUP BY s.seller_id
                ) prizes_range ON prizes_range.seller_id = u.id
                LEFT JOIN (
                    SELECT
                        seller_id,
                        SUM(monto) as cancelled_total,
                        COUNT(*) as cancelled_count
                    FROM sales
                    WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'cancelled'
                    GROUP BY seller_id
                ) cancelled_range ON cancelled_range.seller_id = u.id
                WHERE u.role != 'root'
                ORDER BY u.role DESC, u.name";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([$startDate, $endDate, $startDate, $endDate, $startDate, $endDate]);
        $rows = $stmt->fetchAll();

        // Obtener historial de todos los pagos de salarios registrados
        $payments = $db->query("SELECT id, seller_id, start_date, end_date, total_sold, prizes_total, commission_amount, net_salary, paid_at FROM salary_payments ORDER BY paid_at DESC")->fetchAll();

        ok([
            'report' => $rows,
            'payments' => $payments,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);
    } else {
        $rows = $db->query("SELECT id, username, name, role, active, salary_type, salary_value, salary_period, created_at, updated_at FROM users WHERE role != 'root' ORDER BY role DESC, name")->fetchAll();
        ok(['users' => $rows]);
    }
}

// ─── Helpers para Autogeneración de Usuario ──────────────────
function usernameExists($db, $username) {
    $st = $db->prepare("SELECT id FROM users WHERE username = ?");
    $st->execute([$username]);
    return (bool)$st->fetch();
}

function generateUniqueUsername($db, $fullName) {
    // Normalizar a minúsculas y quitar acentos de forma segura
    $normalized = strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $fullName));
    $normalized = preg_replace('/[^a-z0-9\s]/', '', $normalized);
    $parts = array_values(array_filter(explode(' ', $normalized)));
    
    if (count($parts) < 2) {
        return 'user_' . time();
    }
    
    $firstName = $parts[0];
    $lastName = '';
    $cnt = count($parts);
    if ($cnt === 2) {
        $lastName = $parts[1];
    } else if ($cnt === 3) {
        $lastName = $parts[1]; // primer apellido
    } else {
        $lastName = $parts[2]; // primer apellido asumiendo 2 nombres
    }
    
    $firstName = trim($firstName);
    $lastName = trim($lastName);
    
    // 1. Primera letra del nombre + apellido
    $candidate = substr($firstName, 0, 1) . $lastName;
    if (!usernameExists($db, $candidate)) {
        return $candidate;
    }
    
    // 2. Dos letras del nombre + apellido
    if (strlen($firstName) >= 2) {
        $candidate = substr($firstName, 0, 2) . $lastName;
        if (!usernameExists($db, $candidate)) {
            return $candidate;
        }
    }
    
    // 3. Alternar entre dos letras del nombre + punto + apellido
    if (strlen($firstName) >= 2) {
        $candidate = substr($firstName, 0, 2) . '.' . $lastName;
        if (!usernameExists($db, $candidate)) {
            return $candidate;
        }
    }
    
    // 4. Si todo falla, alternar con números secuenciales
    $i = 1;
    while (true) {
        $candidate = substr($firstName, 0, 2) . '.' . $lastName . $i;
        if (!usernameExists($db, $candidate)) {
            return $candidate;
        }
        $i++;
    }
}

// ─── Crear / Registrar Pago ───────────────────────────────────
if ($method === 'POST') {
    requireAdmin();
    
    if (isset($_GET['pay'])) {
        $b = body();
        $sellerId         = $b['seller_id'] ?? '';
        $startDate        = $b['start_date'] ?? '';
        $endDate          = $b['end_date'] ?? '';
        $totalSold        = (float)($b['total_sold'] ?? 0);
        $prizesTotal      = (float)($b['prizes_total'] ?? 0);
        $commissionAmount = (float)($b['commission_amount'] ?? 0);
        $netSalary        = (float)($b['net_salary'] ?? 0);

        if (!$sellerId || !$startDate || !$endDate) {
            fail('Datos incompletos para registrar el pago.');
        }

        // Verificar superposición
        $chk = $db->prepare("SELECT id FROM salary_payments WHERE seller_id = ? AND NOT (end_date < ? OR start_date > ?)");
        $chk->execute([$sellerId, $startDate, $endDate]);
        if ($chk->fetch()) {
            fail('Este periodo (o parte de él) ya ha sido registrado como pagado.');
        }

        // Registrar el pago
        $ins = $db->prepare("INSERT INTO salary_payments (seller_id, start_date, end_date, total_sold, prizes_total, commission_amount, net_salary) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $ins->execute([$sellerId, $startDate, $endDate, $totalSold, $prizesTotal, $commissionAmount, $netSalary]);

        // Retornar historial actualizado tras insertar el pago
        $payments = $db->query("SELECT id, seller_id, start_date, end_date, total_sold, prizes_total, commission_amount, net_salary, paid_at FROM salary_payments ORDER BY paid_at DESC")->fetchAll();
        ok(['message' => 'Pago registrado con éxito.', 'payments' => $payments]);
    } else {
        $b = body();
        $password = $b['password'] ?? '';
        $name     = trim($b['name'] ?? '');
        $role     = in_array($b['role'] ?? '', ['admin','vendedor']) ? $b['role'] : 'vendedor';
        $salary_type   = in_array($b['salary_type'] ?? '', ['fixed','percentage']) ? $b['salary_type'] : 'percentage';
        $salary_value  = isset($b['salary_value']) ? (float)$b['salary_value'] : 10.00;
        $salary_period = in_array($b['salary_period'] ?? '', ['daily', 'weekly', 'fortnightly', 'monthly']) ? $b['salary_period'] : 'daily';

        if (!$password || !$name) fail('Nombre y contraseña son requeridos.');
        if (strlen($password) < 6) fail('La contraseña debe tener al menos 6 caracteres.');

        // Validar que se haya ingresado al menos un apellido (mínimo dos palabras)
        $parts = array_values(array_filter(explode(' ', $name)));
        if (count($parts) < 2) {
            fail('Debe ingresar nombre y al menos un apellido.');
        }

        // Autogenerar usuario único
        $username = generateUniqueUsername($db, $name);

        if (strtolower($password) === strtolower($username)) fail('La contraseña no puede ser igual al nombre de usuario.');

        $id = genUUID();
        $db->prepare("INSERT INTO users (id, username, password_hash, name, role, active, salary_type, salary_value, salary_period) VALUES (?,?,?,?,?,1,?,?,?)")
           ->execute([$id, $username, password_hash($password, PASSWORD_BCRYPT), $name, $role, $salary_type, $salary_value, $salary_period]);

        $user = $db->prepare("SELECT id, username, name, role, active, salary_type, salary_value, salary_period, created_at FROM users WHERE id = ?");
        $user->execute([$id]);
        ok(['user' => $user->fetch()], 201);
    }
}

// ─── Actualizar ───────────────────────────────────────────────
if ($method === 'PUT') {
    $admin = requireAdmin();
    $id = $_GET['id'] ?? '';
    if (!$id) fail('ID requerido.');

    // Obtener información actual del usuario para validaciones
    $userQ = $db->prepare("SELECT username, role FROM users WHERE id = ?");
    $userQ->execute([$id]);
    $targetUser = $userQ->fetch();
    if (!$targetUser) fail('Usuario no encontrado.', 404);
    if ($targetUser['role'] === 'root') fail('Acceso denegado.', 403);

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
    if (isset($b['salary_period']) && in_array($b['salary_period'], ['daily', 'weekly', 'fortnightly', 'monthly'])) {
                                 $fields[] = 'salary_period = ?'; $vals[] = $b['salary_period']; }
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

    $st = $db->prepare("SELECT id, username, name, role, active, salary_type, salary_value, salary_period, updated_at FROM users WHERE id = ?");
    $st->execute([$id]);
    ok(['user' => $st->fetch()]);
}

// ─── Eliminar ─────────────────────────────────────────────────
if ($method === 'DELETE') {
    $admin = requireAdmin();
    $id = $_GET['id'] ?? '';
    if (!$id) fail('ID requerido.');
    if ($id === $admin['id']) fail('No puedes eliminar tu propio usuario.');

    // No permitir eliminar al usuario root
    $userQ = $db->prepare("SELECT role FROM users WHERE id = ?");
    $userQ->execute([$id]);
    $targetUser = $userQ->fetch();
    if ($targetUser && $targetUser['role'] === 'root') fail('Acceso denegado.', 403);

    $db->prepare("DELETE FROM users WHERE id = ?")->execute([$id]);
    ok(['message' => 'Usuario eliminado']);
}

fail('Método no permitido.', 405);
