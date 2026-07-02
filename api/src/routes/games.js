const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const {
  requireAuth,
  requireAdmin
} = require('../utils/helpers');

// ─── GET /api/games ➔ Listar configuraciones de juegos ─────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await getDB();
    const [rows] = await db.query('SELECT * FROM game_configs');

    // Indexar por lottery_id tal como lo hacía PHP
    const configs = {};
    for (const row of rows) {
      configs[row.lottery_id] = row;
    }

    res.json({ configs });
  } catch (err) {
    console.error('Error en GET /api/games:', err.message);
    res.status(500).json({ error: 'No se pudieron recuperar los juegos.' });
  }
});

// ─── PUT /api/games ➔ Crear o actualizar un juego (Admin) ───────
router.put('/', requireAdmin, async (req, res) => {
  const id = req.query.id || req.body.id || '';
  if (!id) {
    return res.status(400).json({ error: 'lottery_id requerido.' });
  }

  const b = req.body;
  const db = await getDB();

  try {
    const enabled = b.enabled !== undefined ? (b.enabled ? 1 : 0) : 1;
    const name = b.name ?? null;
    const description = b.description ?? null;
    const default_price = b.defaultPrice !== undefined ? Number(b.defaultPrice) : null;
    const price_label = b.priceLabel ?? null;
    const emoji = b.emoji ?? '';
    const payout_multiplier = b.payoutMultiplier !== undefined ? Number(b.payoutMultiplier) : 80.00;
    const number_digits = b.numberDigits !== undefined ? Number(b.numberDigits) : 2;
    const min_number = b.minNumber !== undefined ? Number(b.minNumber) : 0;
    const max_number = b.maxNumber !== undefined ? Number(b.maxNumber) : 99;
    const is_custom = b.isCustom !== undefined ? (b.isCustom ? 1 : 0) : 0;
    const allow_series = b.allowSeries !== undefined ? (b.allowSeries ? 1 : 0) : 0;
    const draw_hours = b.drawHours ?? '12:00,15:00,18:00,21:00';
    const max_sales_per_number = b.maxSalesPerNumber !== undefined ? Number(b.maxSalesPerNumber) : 0.00;
    const allow_multi_draw = b.allowMultiDraw !== undefined ? (b.allowMultiDraw ? 1 : 0) : 0;

    await db.query(
      `INSERT INTO game_configs 
        (lottery_id, enabled, name, description, default_price, price_label, emoji, payout_multiplier, number_digits, min_number, max_number, is_custom, allow_series, draw_hours, max_sales_per_number, allow_multi_draw)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          enabled           = VALUES(enabled),
          name              = VALUES(name),
          description       = VALUES(description),
          default_price     = VALUES(default_price),
          price_label       = VALUES(price_label),
          emoji             = VALUES(emoji),
          payout_multiplier = VALUES(payout_multiplier),
          number_digits     = VALUES(number_digits),
          min_number        = VALUES(min_number),
          max_number        = VALUES(max_number),
          is_custom         = VALUES(is_custom),
          allow_series      = VALUES(allow_series),
          draw_hours        = VALUES(draw_hours),
          max_sales_per_number = VALUES(max_sales_per_number),
          allow_multi_draw  = VALUES(allow_multi_draw)`,
      [
        id,
        enabled,
        name,
        description,
        default_price,
        price_label,
        emoji,
        payout_multiplier,
        number_digits,
        min_number,
        max_number,
        is_custom,
        allow_series,
        draw_hours,
        max_sales_per_number,
        allow_multi_draw
      ]
    );

    const [updatedRows] = await db.query('SELECT * FROM game_configs WHERE lottery_id = ?', [id]);
    res.json({ config: updatedRows[0] || null });

  } catch (err) {
    console.error('Error en PUT /api/games:', err.message);
    res.status(500).json({ error: 'No se pudo guardar la configuración del juego.' });
  }
});

// ─── DELETE /api/games ➔ Eliminar un juego personalizado (Admin) ──
router.delete('/', requireAdmin, async (req, res) => {
  const id = req.query.id || '';
  if (!id) {
    return res.status(400).json({ error: 'lottery_id requerido.' });
  }

  const db = await getDB();

  try {
    // Solo permite eliminar juegos personalizados (is_custom = 1)
    const [result] = await db.query(
      'DELETE FROM game_configs WHERE lottery_id = ? AND is_custom = 1',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        error: 'No se encontró el juego personalizado o es un juego base del sistema que no puede eliminarse.'
      });
    }

    // Limpiar bloqueos del juego
    await db.query('DELETE FROM blocked_numbers WHERE lottery_id = ?', [id]);

    res.json({ message: 'Juego personalizado eliminado.' });
  } catch (err) {
    console.error('Error en DELETE /api/games:', err.message);
    res.status(500).json({ error: 'Error al intentar eliminar el juego.' });
  }
});

module.exports = router;
