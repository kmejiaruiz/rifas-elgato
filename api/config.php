<?php
// ─── Configuración de base de datos ──────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'rifas_db');
define('DB_USER', 'root');
define('DB_PASS', '');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    // Crear DB si no existe
    try {
        $tmp = new PDO("mysql:host=".DB_HOST.";charset=utf8mb4", DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $tmp->exec("CREATE DATABASE IF NOT EXISTS `".DB_NAME."` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    } catch (PDOException $e) {
        error_log('Database connection error: ' . $e->getMessage());
        http_response_code(500);
        die(json_encode(['error' => 'No se pudo conectar a la base de datos. Por favor, verifica el servidor.']));
    }

    $pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);

    initSchema($pdo);
    return $pdo;
}

function initSchema(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role ENUM('admin','vendedor') NOT NULL DEFAULT 'vendedor',
        active TINYINT(1) NOT NULL DEFAULT 1,
        salary_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'percentage',
        salary_value DECIMAL(10,2) NOT NULL DEFAULT 10.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS auth_tokens (
        token VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR(64) PRIMARY KEY,
        lottery_id VARCHAR(50) NOT NULL,
        comprador VARCHAR(100),
        monto DECIMAL(10,2) NOT NULL DEFAULT 0,
        status ENUM('active','cancelled') NOT NULL DEFAULT 'active',
        seller_id VARCHAR(36),
        seller_name VARCHAR(100),
        prize_paid TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cancelled_at TIMESTAMP NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Jugadas individuales dentro de un boleto
    $db->exec("CREATE TABLE IF NOT EXISTS sale_lines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id VARCHAR(64) NOT NULL,
        lottery_id VARCHAR(50) NOT NULL,
        numero VARCHAR(20) NOT NULL,
        monto DECIMAL(10,2) NOT NULL DEFAULT 0,
        fecha VARCHAR(20),
        modalidad VARCHAR(50),
        serie VARCHAR(20),
        fraccion INT,
        status ENUM('active','winner','cancelled') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Resultados anunciados por el admin
    $db->exec("CREATE TABLE IF NOT EXISTS lottery_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lottery_id VARCHAR(50) NOT NULL,
        fecha_sorteo VARCHAR(20) NOT NULL,
        numero_ganador VARCHAR(20) NOT NULL,
        announced_by VARCHAR(100),
        announced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notified TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS game_configs (
        lottery_id VARCHAR(50) PRIMARY KEY,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        name VARCHAR(100),
        description VARCHAR(255),
        default_price DECIMAL(10,2),
        price_label VARCHAR(5),
        emoji VARCHAR(20) DEFAULT '',
        payout_multiplier DECIMAL(10,2) NOT NULL DEFAULT 80.00,
        number_digits INT NOT NULL DEFAULT 2,
        min_number INT NOT NULL DEFAULT 0,
        max_number INT NOT NULL DEFAULT 99,
        is_custom TINYINT(1) NOT NULL DEFAULT 0,
        allow_series TINYINT(1) NOT NULL DEFAULT 0,
        draw_hours VARCHAR(255) DEFAULT '12:00,15:00,18:00,21:00',
        max_sales_per_number DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS blocked_numbers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lottery_id VARCHAR(50) NOT NULL,
        numero VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_block (lottery_id, numero)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS app_settings (
        `key` VARCHAR(50) PRIMARY KEY,
        `value` TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS login_attempts (
        ip_address VARCHAR(45) NOT NULL,
        attempts INT NOT NULL DEFAULT 1,
        last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (ip_address)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Usuarios por defecto
    $count = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    if ($count == 0) {
        $s = $db->prepare("INSERT INTO users (id, username, password_hash, name, role, active) VALUES (?,?,?,?,?,1)");
        $s->execute([genUUID(), 'admin',    password_hash('admin123', PASSWORD_BCRYPT), 'Administrador', 'admin']);
        $s->execute([genUUID(), 'vendedor', password_hash('1234',     PASSWORD_BCRYPT), 'Vendedor',       'vendedor']);
    }

    // Settings por defecto
    $db->exec("INSERT IGNORE INTO app_settings (`key`,`value`) VALUES
        ('businessName','Rifas Express'),
        ('currency','NIO'),
        ('autoprint','true'),
        ('drawCloseMinutes','10')
    ");

    // Migrar esquemas anteriores
    migrateOldSales($db);
    migrateBlockedNumbers($db);
    migrateUsersActive($db);
    migrateGameConfigsSchema($db);
    migrateSalesCancelledBy($db);
    migrateUsersSalarySchema($db);
    migrateSalesPrizePaid($db);
    migrateSalesHoraSorteo($db);
    migrateResultsHoraSorteo($db);
}

/**
 * Agrega la columna cancelled_by_name a la tabla sales si no existe.
 */
function migrateSalesCancelledBy(PDO $db): void {
    try {
        $cols = array_column($db->query("SHOW COLUMNS FROM sales")->fetchAll(), 'Field');
        if (!in_array('cancelled_by_name', $cols)) {
            $db->exec("ALTER TABLE sales ADD COLUMN cancelled_by_name VARCHAR(100) NULL");
        }
    } catch (\Exception $e) { /* Silencioso */ }
}

/**
 * Agrega columnas de salario a la tabla users si no existen.
 */
function migrateUsersSalarySchema(PDO $db): void {
    try {
        $cols = array_column($db->query("SHOW COLUMNS FROM users")->fetchAll(), 'Field');
        if (!in_array('salary_type', $cols)) {
            $db->exec("ALTER TABLE users ADD COLUMN salary_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'percentage'");
        }
        if (!in_array('salary_value', $cols)) {
            $db->exec("ALTER TABLE users ADD COLUMN salary_value DECIMAL(10,2) NOT NULL DEFAULT 10.00");
        }
    } catch (\Exception $e) { /* Silencioso */ }
}

/**
 * Agrega la columna prize_paid a la tabla sales si no existe.
 */
function migrateSalesPrizePaid(PDO $db): void {
    try {
        $cols = array_column($db->query("SHOW COLUMNS FROM sales")->fetchAll(), 'Field');
        if (!in_array('prize_paid', $cols)) {
            $db->exec("ALTER TABLE sales ADD COLUMN prize_paid TINYINT(1) NOT NULL DEFAULT 0");
        }
    } catch (\Exception $e) { /* Silencioso */ }
}

/**
 * Migra ventas del esquema anterior (campos planos) al nuevo (sale_lines).
 * Solo corre si existen columnas 'numero' en sales pero no hay líneas migradas.
 */
function migrateOldSales(PDO $db): void {
    // Verificar si la columna 'numero' aún existe en sales (esquema viejo)
    $cols = $db->query("SHOW COLUMNS FROM sales LIKE 'numero'")->fetchAll();
    if (empty($cols)) return; // Ya migrado

    // Migrar ventas que no tienen sale_lines aún
    $sales = $db->query("SELECT id, lottery_id, numero, monto, fecha, sorteo, modalidad, serie, fraccion
                          FROM sales
                          WHERE numero IS NOT NULL
                          AND id NOT IN (SELECT DISTINCT sale_id FROM sale_lines)")->fetchAll();

    if (!empty($sales)) {
        $ins = $db->prepare("INSERT IGNORE INTO sale_lines
            (sale_id, lottery_id, numero, monto, fecha, modalidad, serie, fraccion)
            VALUES (?,?,?,?,?,?,?,?)");
        foreach ($sales as $s) {
            $ins->execute([
                $s['id'], $s['lottery_id'], $s['numero'] ?? '0',
                $s['monto'] ?? 0, $s['fecha'] ?? null,
                $s['sorteo'] ?? null, // guardamos el sorteo como modalidad durante la migración
                $s['serie'] ?? null, isset($s['fraccion']) ? (int)$s['fraccion'] : null,
            ]);
        }
    }

    // Eliminar columnas antiguas de sales (solo si la migración fue exitosa)
    try {
        $db->exec("ALTER TABLE sales
            DROP COLUMN IF EXISTS numero,
            DROP COLUMN IF EXISTS fecha,
            DROP COLUMN IF EXISTS sorteo,
            DROP COLUMN IF EXISTS modalidad,
            DROP COLUMN IF EXISTS serie,
            DROP COLUMN IF EXISTS fraccion
        ");
    } catch (\Exception $e) {
        // MySQL < 8.0 no soporta DROP COLUMN IF EXISTS — ignoramos
    }
}

/**
 * Elimina la columna 'sorteo' de blocked_numbers si aún existe.
 */
function migrateBlockedNumbers(PDO $db): void {
    $cols = $db->query("SHOW COLUMNS FROM blocked_numbers LIKE 'sorteo'")->fetchAll();
    if (empty($cols)) return;
    try {
        // Intentar quitar el índice viejo que incluía sorteo
        try { $db->exec("ALTER TABLE blocked_numbers DROP INDEX uniq_block"); } catch (\Exception $ignore) {}
        $db->exec("ALTER TABLE blocked_numbers DROP COLUMN sorteo");
        // Recrear índice único solo por lottery_id + numero
        try { $db->exec("ALTER TABLE blocked_numbers ADD UNIQUE KEY uniq_block (lottery_id, numero)"); } catch (\Exception $ignore) {}
    } catch (\Exception $e) { /* Silencioso */ }
}

/**
 * Garantiza que la columna 'active' en users tenga DEFAULT 1.
 * Activa usuarios que quedaron con active=0 por falta de DEFAULT en esquema antiguo.
 */
function migrateUsersActive(PDO $db): void {
    try {
        // Asegurar DEFAULT 1 en la columna
        $db->exec("ALTER TABLE users MODIFY active TINYINT(1) NOT NULL DEFAULT 1");
        // Activar usuarios donde active=0 y updated_at == created_at
        // (nunca fueron desactivados manualmente; tuvieron active=0 por falta de DEFAULT)
        $db->exec("UPDATE users SET active = 1
                   WHERE active = 0
                   AND ABS(TIMESTAMPDIFF(SECOND, created_at, updated_at)) < 5");
    } catch (\Exception $e) { /* Silencioso */ }
}

/**
 * Migra la tabla game_configs para añadir nuevos campos de parametrización y juegos personalizados
 */
function migrateGameConfigsSchema(PDO $db): void {
    try {
        $cols = array_column($db->query("SHOW COLUMNS FROM game_configs")->fetchAll(), 'Field');
        
        if (!in_array('emoji', $cols)) {
            $db->exec("ALTER TABLE game_configs ADD COLUMN emoji VARCHAR(20) DEFAULT ''");
        }
        if (!in_array('payout_multiplier', $cols)) {
            $db->exec("ALTER TABLE game_configs ADD COLUMN payout_multiplier DECIMAL(10,2) NOT NULL DEFAULT 80.00");
        }
        if (!in_array('number_digits', $cols)) {
            $db->exec("ALTER TABLE game_configs ADD COLUMN number_digits INT NOT NULL DEFAULT 2");
        }
        if (!in_array('min_number', $cols)) {
            $db->exec("ALTER TABLE game_configs ADD COLUMN min_number INT NOT NULL DEFAULT 0");
        }
        if (!in_array('max_number', $cols)) {
            $db->exec("ALTER TABLE game_configs ADD COLUMN max_number INT NOT NULL DEFAULT 99");
        }
        if (!in_array('is_custom', $cols)) {
            $db->exec("ALTER TABLE game_configs ADD COLUMN is_custom TINYINT(1) NOT NULL DEFAULT 0");
        }
        if (!in_array('allow_series', $cols)) {
            $db->exec("ALTER TABLE game_configs ADD COLUMN allow_series TINYINT(1) NOT NULL DEFAULT 0");
        }
        if (!in_array('draw_hours', $cols)) {
            $db->exec("ALTER TABLE game_configs ADD COLUMN draw_hours VARCHAR(255) DEFAULT '12:00,15:00,18:00,21:00'");
        }
        if (!in_array('max_sales_per_number', $cols)) {
            $db->exec("ALTER TABLE game_configs ADD COLUMN max_sales_per_number DECIMAL(10,2) NOT NULL DEFAULT 0.00");
        }
    } catch (\Exception $e) { /* Silencioso */ }
}

function genUUID(): string {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff),
        mt_rand(0,0x0fff)|0x4000, mt_rand(0,0x3fff)|0x8000,
        mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff));
}

/**
 * Agrega la columna hora_sorteo a la tabla sales si no existe.
 */
function migrateSalesHoraSorteo(PDO $db): void {
    try {
        $cols = array_column($db->query("SHOW COLUMNS FROM sales")->fetchAll(), 'Field');
        if (!in_array('hora_sorteo', $cols)) {
            $db->exec("ALTER TABLE sales ADD COLUMN hora_sorteo VARCHAR(10) NOT NULL DEFAULT '12:00'");
        }
    } catch (\Exception $e) { /* Silencioso */ }
}

/**
 * Agrega la columna hora_sorteo a la tabla lottery_results si no existe.
 */
function migrateResultsHoraSorteo(PDO $db): void {
    try {
        $cols = array_column($db->query("SHOW COLUMNS FROM lottery_results")->fetchAll(), 'Field');
        if (!in_array('hora_sorteo', $cols)) {
            $db->exec("ALTER TABLE lottery_results ADD COLUMN hora_sorteo VARCHAR(10) NOT NULL DEFAULT '12:00'");
        }
    } catch (\Exception $e) { /* Silencioso */ }
}
