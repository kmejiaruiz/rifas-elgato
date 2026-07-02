const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const {
  DB_HOST = '127.0.0.1',
  DB_USER = 'root',
  DB_PASS = '',
  DB_NAME = 'rifas_db',
  DB_PORT = 3306
} = process.env;

let pool = null;

async function getDB() {
  if (pool !== null) return pool;

  // Intentar crear la base de datos si no existe
  try {
    const conn = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASS,
      port: Number(DB_PORT)
    });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.end();
  } catch (err) {
    console.error('Error al intentar asegurar la existencia de la base de datos:', err.message);
  }

  // Crear pool de conexiones con soporte de promesas
  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    port: Number(DB_PORT),
    waitForConnections: true,
    connectionLimit: 100, // alto límite para concurrencia
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    dateStrings: true
  });

  // Inicializar esquema
  await initSchema(pool);

  return pool;
}

async function initSchema(dbPool) {
  try {
    // 1. users
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role ENUM('admin','vendedor','root') NOT NULL DEFAULT 'vendedor',
        active TINYINT(1) NOT NULL DEFAULT 1,
        salary_type ENUM('fixed', 'percentage') NOT NULL DEFAULT 'percentage',
        salary_value DECIMAL(10,2) NOT NULL DEFAULT 10.00,
        salary_period ENUM('daily', 'weekly', 'fortnightly', 'monthly') NOT NULL DEFAULT 'daily',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 2. auth_tokens
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        token VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 3. sales
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS sales (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 4. sale_lines
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS sale_lines (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 5. lottery_results
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS lottery_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lottery_id VARCHAR(50) NOT NULL,
        fecha_sorteo VARCHAR(20) NOT NULL,
        numero_ganador VARCHAR(20) NOT NULL,
        announced_by VARCHAR(100),
        announced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notified TINYINT(1) NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 6. notifications
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NULL,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        read_status TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 7. game_configs
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS game_configs (
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
        allow_multi_draw TINYINT(1) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 8. blocked_numbers
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS blocked_numbers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lottery_id VARCHAR(50) NOT NULL,
        numero VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_block (lottery_id, numero)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 9. app_settings
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        \`key\` VARCHAR(50) PRIMARY KEY,
        \`value\` TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 10. login_attempts
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        ip_address VARCHAR(45) NOT NULL,
        attempts INT NOT NULL DEFAULT 1,
        last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (ip_address)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 11. audit_log
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36),
        action VARCHAR(100) NOT NULL,
        details JSON,
        ip_address VARCHAR(45),
        user_agent VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_action (action),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 12. salary_payments
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS salary_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seller_id VARCHAR(36) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_sold DECIMAL(10,2) NOT NULL,
        prizes_total DECIMAL(10,2) NOT NULL,
        commission_amount DECIMAL(10,2) NOT NULL,
        net_salary DECIMAL(10,2) NOT NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Insertar usuarios por defecto si la tabla está vacía
    const [userRows] = await dbPool.query('SELECT COUNT(*) AS cnt FROM users');
    if (userRows[0].cnt === 0) {
      const hashAdmin = await bcrypt.hash('admin123', 10);
      const hashVendedor = await bcrypt.hash('1234', 10);

      await dbPool.query(
        'INSERT INTO users (id, username, password_hash, name, role, active) VALUES (?, ?, ?, ?, ?, 1)',
        [crypto.randomUUID(), 'admin', hashAdmin, 'Administrador', 'admin']
      );
      await dbPool.query(
        'INSERT INTO users (id, username, password_hash, name, role, active) VALUES (?, ?, ?, ?, ?, 1)',
        [crypto.randomUUID(), 'vendedor', hashVendedor, 'Vendedor', 'vendedor']
      );
      console.log('Usuarios por defecto insertados.');
    }

    // Insertar configuraciones por defecto si no existen
    await dbPool.query("INSERT IGNORE INTO app_settings (`key`,`value`) VALUES ('businessName','Amaranto')");
    await dbPool.query("INSERT IGNORE INTO app_settings (`key`,`value`) VALUES ('currency','NIO')");
    await dbPool.query("INSERT IGNORE INTO app_settings (`key`,`value`) VALUES ('autoprint','true')");
    await dbPool.query("INSERT IGNORE INTO app_settings (`key`,`value`) VALUES ('drawCloseMinutes','10')");
    await dbPool.query("INSERT IGNORE INTO app_settings (`key`,`value`) VALUES ('appStatus','active')");
    await dbPool.query("INSERT IGNORE INTO app_settings (`key`,`value`) VALUES ('appDisableAt','never')");

  } catch (error) {
    console.error('Error al inicializar la base de datos:', error.message);
  }
}

module.exports = {
  getDB
};
