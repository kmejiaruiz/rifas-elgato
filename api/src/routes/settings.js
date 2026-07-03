const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const {
  requireAuth,
  requireAdmin,
  getAppStatus
} = require('../utils/helpers');

// ─── GET /api/settings ➔ Leer configuraciones generales de la app ─
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const [rows] = await db.query('SELECT `key`, `value` FROM app_settings');

    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }

    // Verificar estado de bloqueo dinámico por timer
    const appStatusData = await getAppStatus();
    settings.appStatus = appStatusData.status;
    settings.appDisableAt = appStatusData.disableAt;
    settings.isBlocked = appStatusData.isBlocked;

    res.json({ settings });
  } catch (err) {
    console.error('Error en GET /api/settings:', err.message);
    res.status(500).json({ error: 'No se pudieron recuperar las configuraciones.' });
  }
});

// ─── PUT /api/settings ➔ Guardar configuraciones generales (Admin) 
router.put('/', requireAdmin, async (req, res) => {
  const b = req.body;
  const db = await getDB();

  // Lista blanca de llaves permitidas para evitar contaminación
  const allowedKeys = ['businessName', 'currency', 'autoprint', 'drawCloseMinutes', 'carousel_images', 'bypassCode'];

  try {
    for (const [key, value] of Object.entries(b)) {
      if (!allowedKeys.includes(key)) {
        continue; // Ignorar claves no permitidas
      }

      await db.query(
        'INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
        [key, String(value)]
      );
    }

    res.json({ message: 'Configuración guardada.' });
  } catch (err) {
    console.error('Error en PUT /api/settings:', err.message);
    res.status(500).json({ error: 'No se pudo guardar la configuración.' });
  }
});

module.exports = router;
