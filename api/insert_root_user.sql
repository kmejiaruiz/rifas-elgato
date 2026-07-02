-- ============================================================
-- Script para crear el usuario ROOT de la aplicación Rifas
-- ============================================================
-- INSTRUCCIONES:
--   1. Abre phpMyAdmin (o cualquier cliente MySQL)
--   2. Selecciona la base de datos: rifas_db
--   3. Ejecuta SOLO las sentencias de este archivo
--   4. Cambia la contraseña por una segura antes de ejecutar
--
-- NOTA: El hash bcrypt ya está generado para la contraseña
--       indicada abajo. Si cambias la contraseña, debes
--       regenerar el hash ejecutando en PHP:
--       echo password_hash('TU_NUEVA_CONTRASEÑA', PASSWORD_BCRYPT);
-- ============================================================

-- Contraseña de ejemplo: Root@2024! (CÁMBIALA antes de usar)
-- Hash bcrypt generado para: Root@2024!
SET @root_password_hash = '$2y$10$3TvL17.q8yqdg97nnmBW7OCFkik9mm493h2YdFWBxzpy0Ybc.bgxe';

-- UUID v4 generado (puedes usar otro si lo prefieres)
SET @root_id = UUID();

-- Verificar que el ENUM ya fue migrado antes de insertar
-- (La app debe haber corrido al menos una vez después del despliegue)
INSERT INTO `users` (
    `id`,
    `username`,
    `password_hash`,
    `name`,
    `role`,
    `active`,
    `salary_type`,
    `salary_value`
)
VALUES (
    @root_id,
    'root',
    @root_password_hash,
    'Administrador Root',
    'root',
    1,
    'percentage',
    0.00
)
ON DUPLICATE KEY UPDATE
    `role` = 'root',
    `active` = 1;

-- ============================================================
-- IMPORTANTE: Cambia la contraseña de inmediato
-- Para generar un nuevo hash bcrypt seguro, usa:
--   php -r "echo password_hash('TU_CONTRASEÑA', PASSWORD_BCRYPT);"
-- ============================================================
SELECT 
    id, 
    username, 
    name, 
    role, 
    active,
    created_at
FROM `users` 
WHERE `username` = 'root';
