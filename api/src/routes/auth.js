const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDB } = require('../config/db');
const {
  requireAuth,
  safeUser,
  getAuthHeader,
  auditLog
} = require('../utils/helpers');

// ─── Login (POST) ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  const trimmedUsername = String(username).trim();
  const db = await getDB();
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

  try {
    // Rate Limiting por IP
    if (ip) {
      const [lockRows] = await db.query(
        'SELECT attempts, UNIX_TIMESTAMP(last_attempt) as last_ts FROM login_attempts WHERE ip_address = ?',
        [ip]
      );
      const lock = lockRows[0];

      if (lock && lock.attempts >= 5) {
        const timePassed = Math.floor(Date.now() / 1000) - lock.last_ts;
        if (timePassed < 900) { // 15 minutos (900 segs)
          const timeLeft = Math.ceil((900 - timePassed) / 60);
          return res.status(429).json({
            error: `Demasiados intentos fallidos. Por seguridad, tu dirección IP ha sido bloqueada temporalmente. Inténtalo de nuevo en ${timeLeft} minuto(s).`
          });
        } else {
          // Expiró el bloqueo, limpiar intentos
          await db.query('DELETE FROM login_attempts WHERE ip_address = ?', [ip]);
        }
      }
    }

    // Buscar usuario
    const [userRows] = await db.query('SELECT * FROM users WHERE username = ? AND active = 1', [
      trimmedUsername
    ]);
    const user = userRows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      // Incrementar intentos fallidos
      if (ip) {
        await db.query(
          `INSERT INTO login_attempts (ip_address, attempts) VALUES (?, 1)
           ON DUPLICATE KEY UPDATE attempts = attempts + 1, last_attempt = NOW()`,
          [ip]
        );
      }
      await auditLog('login_failed', null, { username: trimmedUsername }, req);
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    // Login exitoso: Limpiar intentos fallidos
    if (ip) {
      await db.query('DELETE FROM login_attempts WHERE ip_address = ?', [ip]);
    }

    // Limpiar tokens expirados del usuario
    await db.query('DELETE FROM auth_tokens WHERE user_id = ? AND expires_at <= NOW()', [
      user.id
    ]);

    // Generar token seguro de 64 caracteres
    const token = crypto.randomBytes(32).toString('hex');
    // Registrar token por 24 horas
    await db.query(
      'INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
      [token, user.id]
    );

    await auditLog('login_success', user.id, { username: user.username, role: user.role }, req);
    res.json({ token, user: safeUser(user) });

  } catch (err) {
    console.error('Error en Login Route:', err.message);
    res.status(500).json({ error: 'Error interno en el servidor durante el inicio de sesión.' });
  }
});

// ─── Me (GET) ➔ Obtener perfil del usuario actual ─────────────
router.get('/', requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// ─── Logout (DELETE) ➔ Cerrar sesión ──────────────────────────
router.delete('/', async (req, res) => {
  const h = getAuthHeader(req);
  if (h.startsWith('Bearer ')) {
    const token = h.substring(7);
    try {
      const db = await getDB();
      await db.query('DELETE FROM auth_tokens WHERE token = ?', [token]);
    } catch (err) {
      console.error('Error en Logout Route:', err.message);
    }
  }
  res.json({ message: 'Sesión cerrada' });
});

module.exports = router;
