<?php
// ============================================================
// PLANTILLA DE CONFIGURACIÓN — Rifas Express
// ============================================================
// Copia este archivo como  api/.env.php  y rellena tus valores.
// El archivo .env.php es ignorado por Git automáticamente.
// ⚠️  ESTE ARCHIVO NO debe tener credenciales reales.
// ============================================================

// ─── Base de datos ───────────────────────────────────────────────
define('ENV_DB_HOST', 'localhost');              // En InfinityFree: sql310.infinityfree.com
define('ENV_DB_NAME', 'rifas_db');              // En InfinityFree: if0_XXXXXX_rifas
define('ENV_DB_USER', 'root');                  // En InfinityFree: if0_XXXXXX
define('ENV_DB_PASS', '');                      // En InfinityFree: tu password MySQL

// ─── CSRF Secret ───────────────────────────────────────────────
// Genera uno con: php -r "echo bin2hex(random_bytes(32));"
define('ENV_CSRF_SECRET', 'REEMPLAZA_CON_TU_SECRET_DE_64_CARACTERES_HEX');

// ─── Entorno ('local' | 'production') ──────────────────────────────────
define('ENV_NAME', 'local');                    // Cambia a 'production' en el servidor
