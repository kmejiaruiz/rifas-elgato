const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDB } = require('../config/db');
const {
  requireAuth,
  requireRoot,
  getAppStatus,
  auditLog
} = require('../utils/helpers');

// Helper para formatear Date a YYYY-MM-DD HH:mm:ss local
function formatMySQLDate(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ─── POST /api/root ➔ Verificar credenciales de un usuario secundario ──
router.post('/', requireAuth, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  const trimmedUsername = String(username).trim();
  const db = await getDB();

  try {
    const [userRows] = await db.query('SELECT * FROM users WHERE username = ? AND active = 1', [
      trimmedUsername
    ]);
    const user = userRows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    // Solo devuelve el rol (sin crear token ni sesión nueva)
    res.json({ role: user.role, name: user.name });

  } catch (err) {
    console.error('Error en POST /api/root:', err.message);
    res.status(500).json({ error: 'Error al verificar credenciales.' });
  }
});

// ─── GET /api/root ➔ Leer estado de bloqueo/disponibilidad (Root) ─────
router.get('/', requireRoot, async (req, res) => {
  try {
    const appControl = await getAppStatus();
    res.json({ appControl });
  } catch (err) {
    console.error('Error en GET /api/root:', err.message);
    res.status(500).json({ error: 'Error al leer el estado de la aplicación.' });
  }
});

// ─── PUT /api/root ➔ Modificar disponibilidad (disable/schedule/restore)
router.put('/', requireRoot, async (req, res) => {
  const rootUser = req.user;
  const { action, minutes } = req.body;
  const db = await getDB();

  try {
    if (action === 'disable') {
      // Desactivar aplicación inmediatamente
      await db.query("UPDATE app_settings SET `value`='disabled' WHERE `key`='appStatus'");
      await db.query("UPDATE app_settings SET `value`='never' WHERE `key`='appDisableAt'");
      await auditLog('app_disabled', rootUser.id, { action: 'disable' }, req);

      const appControl = await getAppStatus();
      res.json({ message: 'Aplicación desactivada.', appControl });

    } else if (action === 'schedule') {
      // Programar desactivación en X minutos
      const mins = Number(minutes);
      if (isNaN(mins) || mins <= 0) {
        return res.status(400).json({ error: 'Los minutos deben ser un número positivo.' });
      }

      // Calcular timestamp futuro
      const futureDate = new Date(Date.now() + mins * 60 * 1000);
      const disableAt = formatMySQLDate(futureDate);

      await db.query("UPDATE app_settings SET `value`='active' WHERE `key`='appStatus'");
      await db.query('UPDATE app_settings SET `value` = ? WHERE `key` = "appDisableAt"', [disableAt]);
      await auditLog('app_scheduled', rootUser.id, { minutes: mins, disableAt }, req);

      const appControl = await getAppStatus();
      res.json({
        message: `Aplicación se desactivará en ${mins} minuto(s).`,
        appControl
      });

    } else if (action === 'restore') {
      // Reactivar aplicación
      await db.query("UPDATE app_settings SET `value`='active' WHERE `key`='appStatus'");
      await db.query("UPDATE app_settings SET `value`='never' WHERE `key`='appDisableAt'");
      await auditLog('app_restored', rootUser.id, { action: 'restore' }, req);

      const appControl = await getAppStatus();
      res.json({ message: 'Aplicación reactivada correctamente.', appControl });

    } else {
      res.status(400).json({ error: "Acción no válida. Use: 'disable', 'schedule' o 'restore'." });
    }

  } catch (err) {
    console.error('Error en PUT /api/root:', err.message);
    res.status(500).json({ error: 'Error al modificar el estado de la aplicación.' });
  }
});

module.exports = router;
