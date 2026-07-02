const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const { requireAuth } = require('../utils/helpers');

// ─── GET /api/notifications ➔ Consultar y vaciar notificaciones no leídas 
router.get('/', requireAuth, async (req, res) => {
  const user = req.user;

  // Solo administradores y root pueden ver notificaciones de ventas/anulaciones
  if (user.role !== 'admin' && user.role !== 'root') {
    return res.status(403).json({ error: 'Acceso denegado.' });
  }

  const db = await getDB();

  try {
    // Obtener notificaciones no leídas
    const [notifs] = await db.query(
      'SELECT * FROM notifications WHERE read_status = 0 ORDER BY id ASC'
    );

    // Si hay notificaciones, marcarlas como leídas para que no vuelvan a aparecer
    if (notifs.length > 0) {
      const ids = notifs.map(n => n.id);
      const placeholders = ids.map(() => '?').join(',');
      await db.query(
        `UPDATE notifications SET read_status = 1 WHERE id IN (${placeholders})`,
        ids
      );
    }

    res.json({ notifications: notifs });

  } catch (err) {
    console.error('Error en GET /api/notifications:', err.message);
    res.status(500).json({ error: 'Error al consultar las notificaciones.' });
  }
});

module.exports = router;
