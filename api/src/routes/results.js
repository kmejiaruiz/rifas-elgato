const express = require('express');
const router = express.Router();
const { getDB } = require('../config/db');
const {
  requireAuth,
  requireAdmin,
  normalizeResult
} = require('../utils/helpers');

// ─── GET /api/results ➔ Listar resultados / Ganadores del vendedor ─
router.get('/', requireAuth, async (req, res) => {
  const user = req.user;
  const db = await getDB();

  try {
    // 1. Check: ¿tiene el vendedor jugadas ganadoras?
    if (req.query.check !== undefined) {
      // Buscar resultados de las últimas 72 horas
      const [results] = await db.query(
        `SELECT * FROM lottery_results
         WHERE announced_at >= DATE_SUB(NOW(), INTERVAL 72 HOUR)
         ORDER BY announced_at DESC`
      );

      const winners = [];
      for (const r of results) {
        // Buscar jugadas activas del vendedor que coincidan
        const [matches] = await db.query(
          `SELECT sl.*, s.comprador, s.seller_name, s.seller_id, s.id as sale_id,
                  COALESCE(gc.payout_multiplier, 80.00) as payout_multiplier
           FROM sale_lines sl
           JOIN sales s ON s.id = sl.sale_id
           LEFT JOIN game_configs gc ON gc.lottery_id = sl.lottery_id
           WHERE sl.lottery_id = ?
             AND sl.numero = ?
             AND sl.status IN ('active', 'winner')
             AND s.status = 'active'
             AND s.seller_id = ?
             AND s.hora_sorteo = ?
             AND sl.fecha = ?`,
          [r.lottery_id, r.numero_ganador, user.id, r.hora_sorteo, r.fecha_sorteo]
        );

        for (const m of matches) {
          winners.push({
            resultId: Number(r.id),
            lotteryId: r.lottery_id,
            fechaSorteo: r.fecha_sorteo,
            numeroGanador: r.numero_ganador,
            horaSorteo: r.hora_sorteo,
            announcedAt: r.announced_at,
            saleId: m.sale_id,
            lineId: Number(m.id),
            comprador: m.comprador,
            sellerName: m.seller_name,
            monto: Number(m.monto),
            prize: Number(m.monto) * Number(m.payout_multiplier)
          });
        }
      }

      return res.json({ winners });
    }

    // 2. Listar todos los resultados (últimos 30 días)
    const [resultsRows] = await db.query(
      'SELECT * FROM lottery_results ORDER BY announced_at DESC LIMIT 100'
    );

    const results = [];
    for (const r of resultsRows) {
      results.push(await normalizeResult(r));
    }

    // Para admin: incluir conteo de boletos ganadores por resultado
    if (user.role === 'admin') {
      for (const resItem of results) {
        const [cqRows] = await db.query(
          `SELECT COUNT(*) as cnt FROM sale_lines sl
           JOIN sales s ON s.id = sl.sale_id
           WHERE sl.lottery_id = ? AND sl.numero = ? AND sl.status = 'active' AND s.status = 'active'
             AND s.hora_sorteo = ? AND sl.fecha = ?`,
          [resItem.lotteryId, resItem.numeroGanador, resItem.horaSorteo, resItem.fechaSorteo]
        );
        resItem.winnersCount = Number(cqRows[0].cnt || 0);
      }
    }

    res.json({ results });

  } catch (err) {
    console.error('Error en GET /api/results:', err.message);
    res.status(500).json({ error: 'No se pudieron recuperar los resultados.' });
  }
});

// ─── POST /api/results ➔ Anunciar resultado del sorteo (Admin) ───
router.post('/', requireAdmin, async (req, res) => {
  const b = req.body;
  const lotteryId = String(b.lotteryId || '').trim();
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Managua' });
  const fechaSorteo = String(b.fechaSorteo || todayStr).trim();
  const numeroGanador = String(b.numeroGanador !== undefined ? b.numeroGanador : '').trim();
  const horaSorteo = String(b.horaSorteo || '12:00').trim();

  if (!lotteryId) {
    return res.status(400).json({ error: 'lotteryId es requerido.' });
  }
  if (numeroGanador === '') {
    return res.status(400).json({ error: 'El número ganador es requerido.' });
  }

  const db = await getDB();

  try {
    // Insertar resultado
    const [insResult] = await db.query(
      'INSERT INTO lottery_results (lottery_id, fecha_sorteo, numero_ganador, announced_by, hora_sorteo) VALUES (?, ?, ?, ?, ?)',
      [lotteryId, fechaSorteo, numeroGanador, req.user.name, horaSorteo]
    );
    const resultId = insResult.insertId;

    // Buscar boletos que ganaron
    const [matches] = await db.query(
      `SELECT sl.*, s.comprador, s.seller_name, s.seller_id, s.id as sale_id,
              COALESCE(gc.payout_multiplier, 80.00) as payout_multiplier
       FROM sale_lines sl
       JOIN sales s ON s.id = sl.sale_id
       LEFT JOIN game_configs gc ON gc.lottery_id = sl.lottery_id
       WHERE sl.lottery_id = ?
         AND sl.numero = ?
         AND sl.status = 'active'
         AND s.status = 'active'
         AND s.hora_sorteo = ?
         AND sl.fecha = ?`,
      [lotteryId, numeroGanador, horaSorteo, fechaSorteo]
    );

    // Marcar jugadas como ganadoras
    if (matches.length > 0) {
      for (const m of matches) {
        await db.query("UPDATE sale_lines SET status = 'winner' WHERE id = ?", [m.id]);
      }
    }

    const winners = matches.map(m => ({
      saleId: m.sale_id,
      lineId: Number(m.id),
      numero: m.numero,
      monto: Number(m.monto),
      prize: Number(m.monto) * Number(m.payout_multiplier),
      comprador: m.comprador,
      sellerName: m.seller_name
    }));

    const finalResult = await normalizeResult({
      id: resultId,
      lottery_id: lotteryId,
      fecha_sorteo: fechaSorteo,
      numero_ganador: numeroGanador,
      announced_by: req.user.name,
      announced_at: new Date(),
      hora_sorteo: horaSorteo
    });

    res.status(201).json({
      result: finalResult,
      winners
    });

  } catch (err) {
    console.error('Error en POST /api/results:', err.message);
    res.status(500).json({ error: 'No se pudo registrar el resultado.' });
  }
});

// ─── DELETE /api/results ➔ Eliminar resultado anunciado (Admin) ───
router.delete('/', requireAdmin, async (req, res) => {
  const id = req.query.id || '';
  if (!id) {
    return res.status(400).json({ error: 'ID requerido.' });
  }

  const db = await getDB();

  try {
    // Buscar info del resultado antes de borrarlo para poder revertir las líneas
    const [resultRows] = await db.query('SELECT * FROM lottery_results WHERE id = ?', [id]);
    const r = resultRows[0];

    if (r) {
      // Revertir jugadas ganadoras asociadas a este resultado de vuelta a 'active'
      await db.query(
        "UPDATE sale_lines SET status = 'active' WHERE lottery_id = ? AND numero = ? AND status = 'winner'",
        [r.lottery_id, r.numero_ganador]
      );
    }

    await db.query('DELETE FROM lottery_results WHERE id = ?', [id]);
    res.json({ message: 'Resultado eliminado.' });

  } catch (err) {
    console.error('Error en DELETE /api/results:', err.message);
    res.status(500).json({ error: 'No se pudo eliminar el resultado.' });
  }
});

module.exports = router;
