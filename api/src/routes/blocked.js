const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const {
  requireAuth,
  requireAdmin
} = require('../utils/helpers');

// ─── GET /api/blocked ➔ Listar números bloqueados para un juego ─
router.get('/', requireAuth, async (req, res) => {
  const lid = req.query.lottery_id || '';
  if (!lid) {
    return res.status(400).json({ error: 'lottery_id requerido.' });
  }

  try {
    const db = await getDB();
    const [rows] = await db.query(
      'SELECT numero FROM blocked_numbers WHERE lottery_id = ? ORDER BY numero',
      [lid]
    );

    // Mapear a un array de strings (como array_column en PHP)
    const blocked = rows.map(r => r.numero);
    res.json({ blocked });
  } catch (err) {
    console.error('Error en GET /api/blocked:', err.message);
    res.status(500).json({ error: 'No se pudieron recuperar los números bloqueados.' });
  }
});

// ─── POST /api/blocked ➔ Bloquear un número (Admin) ───────────
router.post('/', requireAdmin, async (req, res) => {
  const lid = req.body.lottery_id || '';
  const numero = req.body.numero !== undefined ? String(req.body.numero).trim() : '';

  if (!lid || numero === '') {
    return res.status(400).json({ error: 'lottery_id y numero son requeridos.' });
  }

  try {
    const db = await getDB();
    await db.query(
      'INSERT IGNORE INTO blocked_numbers (lottery_id, numero) VALUES (?, ?)',
      [lid, numero]
    );
    res.json({ message: `Número ${numero} bloqueado.` });
  } catch (err) {
    console.error('Error en POST /api/blocked:', err.message);
    res.status(500).json({ error: 'No se pudo bloquear el número.' });
  }
});

// ─── DELETE /api/blocked ➔ Desbloquear número(s) (Admin) ────────
router.delete('/', requireAdmin, async (req, res) => {
  const lid = req.query.lottery_id || '';
  if (!lid) {
    return res.status(400).json({ error: 'lottery_id requerido.' });
  }

  const db = await getDB();

  try {
    // Si se pasa el parámetro "all", desbloquear todos los números de ese juego
    if (req.query.all === '1' || req.query.all === 'true') {
      await db.query('DELETE FROM blocked_numbers WHERE lottery_id = ?', [lid]);
      return res.json({ message: 'Todos los números desbloqueados.' });
    }

    const numero = req.query.numero !== undefined ? String(req.query.numero).trim() : '';
    if (numero === '') {
      return res.status(400).json({ error: 'numero requerido.' });
    }

    await db.query(
      'DELETE FROM blocked_numbers WHERE lottery_id = ? AND numero = ?',
      [lid, numero]
    );
    res.json({ message: `Número ${numero} desbloqueado.` });

  } catch (err) {
    console.error('Error en DELETE /api/blocked:', err.message);
    res.status(500).json({ error: 'No se pudo desbloquear el número.' });
  }
});

module.exports = router;
