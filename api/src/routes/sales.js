const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDB } = require('../config/db');
const {
  requireAuth,
  requireAdmin,
  loadLines,
  normalizeSale,
  auditLog
} = require('../utils/helpers');

async function fillMultiHours(db, sales) {
  if (!sales || sales.length === 0) return sales;
  const multiSaleIds = [...new Set(sales.map(s => s.multiSaleId).filter(Boolean))];
  if (multiSaleIds.length > 0) {
    const [hoursRows] = await db.query(
      'SELECT multi_sale_id, hora_sorteo FROM sales WHERE multi_sale_id IN (?)',
      [multiSaleIds]
    );
    const multiHoursMap = {};
    hoursRows.forEach(row => {
      const mid = row.multi_sale_id;
      if (!multiHoursMap[mid]) {
        multiHoursMap[mid] = [];
      }
      if (!multiHoursMap[mid].includes(row.hora_sorteo)) {
        multiHoursMap[mid].push(row.hora_sorteo);
      }
    });
    sales.forEach(s => {
      if (s.multiSaleId && multiHoursMap[s.multiSaleId]) {
        s.multiHours = multiHoursMap[s.multiSaleId];
      }
    });
  }
  return sales;
}

// ─── GET /api/sales ➔ Listar o Resumen Diario de ventas ──────────
router.get('/', requireAuth, async (req, res) => {
  const user = req.user;
  const db = await getDB();
  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Managua' }); // YYYY-MM-DD local in Managua

  try {
    // 1. Resumen diario (summary)
    if (req.query.summary !== undefined) {
      let sqlRows = `
        SELECT s.status, sl.monto
        FROM sales s
        JOIN sale_lines sl ON sl.sale_id = s.id
        WHERE DATE(s.created_at) = ?`;
      const paramsRows = [todayStr];

      if (user.role !== 'admin') {
        sqlRows += ' AND s.seller_id = ?';
        paramsRows.push(user.id);
      }

      const [allRows] = await db.query(sqlRows, paramsRows);

      let total = 0;
      for (const row of allRows) {
        if (row.status === 'active') {
          total += Number(row.monto);
        }
      }

      // Contar boletos activos únicos por tipo (lottery_id)
      let sqlBc = `
        SELECT lottery_id, COUNT(*) as cnt 
        FROM sales 
        WHERE DATE(created_at) = ? AND status = 'active'`;
      const paramsBc = [todayStr];

      if (user.role !== 'admin') {
        sqlBc += ' AND seller_id = ?';
        paramsBc.push(user.id);
      }
      sqlBc += ' GROUP BY lottery_id';

      const [bcRows] = await db.query(sqlBc, paramsBc);
      const byType = {};
      for (const r of bcRows) {
        byType[r.lottery_id] = { count: Number(r.cnt), total: 0 };
      }

      // Total acumulado por tipo
      let sqlBt = `
        SELECT s.lottery_id, SUM(sl.monto) as tot
        FROM sales s 
        JOIN sale_lines sl ON sl.sale_id = s.id
        WHERE DATE(s.created_at) = ? AND s.status = 'active'`;
      const paramsBt = [todayStr];

      if (user.role !== 'admin') {
        sqlBt += ' AND s.seller_id = ?';
        paramsBt.push(user.id);
      }
      sqlBt += ' GROUP BY s.lottery_id';

      const [btRows] = await db.query(sqlBt, paramsBt);
      for (const r of btRows) {
        if (byType[r.lottery_id]) {
          byType[r.lottery_id].total = Number(r.tot);
        }
      }

      const count = Object.values(byType).reduce((sum, item) => sum + item.count, 0);

      // Boletos anulados
      let sqlCan = `SELECT COUNT(*) as cnt FROM sales WHERE DATE(created_at) = ? AND status = 'cancelled'`;
      const paramsCan = [todayStr];

      if (user.role !== 'admin') {
        sqlCan += ' AND seller_id = ?';
        paramsCan.push(user.id);
      }

      const [canRows] = await db.query(sqlCan, paramsCan);
      const cancelled = Number(canRows[0].cnt || 0);

      return res.json({ total, count, cancelled, byType });
    }

    // 2. Listar boletos con filtros
    const where = ['1=1'];
    const params = [];

    if (user.role !== 'admin') {
      where.push('s.seller_id = ?');
      params.push(user.id);
    } else {
      if (req.query.seller_id) {
        where.push('s.seller_id = ?');
        params.push(req.query.seller_id);
      }
    }

    if (req.query.date) {
      where.push('DATE(s.created_at) = ?');
      params.push(req.query.date);
    }
    if (req.query.lottery_id) {
      where.push('s.lottery_id = ?');
      params.push(req.query.lottery_id);
    }

    if (req.query.status) {
      if (req.query.status === 'winner') {
        where.push("EXISTS (SELECT 1 FROM sale_lines sl2 WHERE sl2.sale_id = s.id AND sl2.status = 'winner')");
      } else {
        where.push('s.status = ?');
        params.push(req.query.status);
      }
    }

    if (req.query.search) {
      const q = `%${req.query.search}%`;
      where.push('(s.comprador LIKE ? OR sl.numero LIKE ?)');
      params.push(q, q);
    }

    const sql = `
      SELECT DISTINCT s.* 
      FROM sales s
      LEFT JOIN sale_lines sl ON sl.sale_id = s.id
      WHERE ${where.join(' AND ')}
      ORDER BY s.created_at DESC 
      LIMIT 200
    `;

    const [sales] = await db.query(sql, params);

    // Cargar las líneas de cada boleto
    const ids = sales.map(s => s.id);
    const linesMap = await loadLines(db, ids);
    const result = sales.map(s => normalizeSale(s, linesMap[s.id] || []));
    await fillMultiHours(db, result);

    res.json({ sales: result });

  } catch (err) {
    console.error('Error en GET /api/sales:', err.message);
    res.status(500).json({ error: 'Error al consultar las ventas.' });
  }
});

// ─── POST /api/sales ➔ Crear boleto con jugadas ────────────────
router.post('/', requireAuth, async (req, res) => {
  const user = req.user;
  const b = req.body;
  const db = await getDB();

  const lotteryId = String(b.lotteryId || '').trim();
  const jugadas = b.jugadas || [];
  const comprador = String(b.comprador || '').trim();
  const horaSorteo = String(b.horaSorteo || '12:00').trim();

  if (!lotteryId) {
    return res.status(400).json({ error: 'lotteryId es requerido.' });
  }
  if (jugadas.length === 0) {
    return res.status(400).json({ error: 'Debe incluir al menos una jugada.' });
  }

  try {
    // 1. Obtener configuraciones del juego
    const [cfgRows] = await db.query(
      'SELECT enabled, draw_hours, max_sales_per_number, price_label, number_digits, min_number, max_number FROM game_configs WHERE lottery_id = ?',
      [lotteryId]
    );
    const cfg = cfgRows[0];

    if (cfg) {
      if (!cfg.enabled) {
        return res.status(400).json({ error: 'Este juego está deshabilitado.' });
      }

      // Validar hora permitida
      const allowedHours = String(cfg.draw_hours || '12:00,15:00,18:00,21:00').split(',').map(h => h.trim());
      if (!allowedHours.includes(horaSorteo)) {
        return res.status(400).json({ error: `La hora de sorteo ${horaSorteo} no está permitida para este juego.` });
      }
    }

    // 2. Cargar minutos de cierre
    const [settRows] = await db.query("SELECT value FROM app_settings WHERE `key` = 'drawCloseMinutes'");
    const drawCloseMinutes = settRows[0] ? Number(settRows[0].value) : 10;

    let drawDate = String(b.drawDate || '').trim();
    if (!drawDate) {
      drawDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Managua' });
      if (lotteryId !== 'fechea') {
        for (const j of jugadas) {
          if (j.fecha) {
            drawDate = j.fecha;
            break;
          }
        }
      }
    }

    // Validar hora de cierre del sorteo usando el offset de Nicaragua (UTC-6)
    const drawDateTimeStr = `${drawDate}T${horaSorteo}:00-06:00`;
    const drawTime = new Date(drawDateTimeStr).getTime();
    const currentTime = Date.now();
    const closeLimitTime = drawTime - (drawCloseMinutes * 60 * 1000);

    if (currentTime >= closeLimitTime) {
      const parts = horaSorteo.split(':');
      let hourNum = Number(parts[0]);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      hourNum = hourNum % 12 || 12;
      const formattedTime = `${hourNum}:${parts[1]} ${ampm}`;
      return res.status(400).json({ error: `La venta para el sorteo de las ${formattedTime} está desactivada por sorteo.` });
    }

    // 3. Obtener números bloqueados
    const [blockedRows] = await db.query('SELECT numero FROM blocked_numbers WHERE lottery_id = ?', [lotteryId]);
    const blocked = blockedRows.map(r => r.numero);

    // Presets de validación heredados
    const presetDigits = { la_tica: 2, la_hondurena: 2, juega3: 3, pega4: 4 };
    const presetMin = { la_tica: 0, la_hondurena: 0, juega3: 0, pega4: 0 };
    const presetMax = { la_tica: 99, la_hondurena: 99, juega3: 999, pega4: 9999 };

    let digitsLimit = cfg ? cfg.number_digits : null;
    let minNum = cfg ? cfg.min_number : null;
    let maxNum = cfg ? cfg.max_number : null;

    if (digitsLimit === null) digitsLimit = presetDigits[lotteryId] || null;
    if (minNum === null) minNum = presetMin[lotteryId] || null;
    if (maxNum === null) maxNum = presetMax[lotteryId] || null;

    // Validar cada jugada
    for (const j of jugadas) {
      const num = String(j.numero !== undefined ? j.numero : '').trim();

      if (lotteryId !== 'fechea') {
        if (num === '') {
          return res.status(400).json({ error: 'El número es requerido.' });
        }
        if (digitsLimit !== null && num.length > digitsLimit) {
          return res.status(400).json({ error: `El número ${num} excede la cantidad máxima de dígitos permitida (${digitsLimit}).` });
        }
        if (minNum !== null && maxNum !== null) {
          if (!/^\d+$/.test(num)) {
            return res.status(400).json({ error: `El número ${num} debe contener únicamente dígitos decimales.` });
          }
          const val = Number(num);
          if (val < minNum || val > maxNum) {
            return res.status(400).json({ error: `El número ${num} está fuera del rango permitido (${minNum}-${maxNum}).` });
          }
        }
      }

      if (num !== '' && blocked.includes(num)) {
        return res.status(400).json({ error: `El número ${num} está cerrado para este juego.` });
      }

      if (j.monto === undefined || Number(j.monto) <= 0) {
        return res.status(400).json({ error: 'Cada jugada debe tener un monto mayor a 0.' });
      }
    }

    // Acumular importes por número en esta petición
    const reqAmounts = {};
    for (const j of jugadas) {
      const isFechea = (lotteryId === 'fechea');
      const key = isFechea ? String(j.fecha || '') : String(j.numero || '');
      if (!reqAmounts[key]) reqAmounts[key] = 0;
      reqAmounts[key] += Number(j.monto || 0);
    }

    // Verificar límites de venta acumulados
    const maxLimit = cfg ? Number(cfg.max_sales_per_number) : 0.00;
    if (maxLimit > 0) {
      for (const [num, reqMonto] of Object.entries(reqAmounts)) {
        const [sumRows] = await db.query(
          `SELECT COALESCE(SUM(sl.monto), 0) as tot
           FROM sale_lines sl
           JOIN sales s ON sl.sale_id = s.id
           WHERE sl.lottery_id = ? AND sl.numero = ? AND sl.fecha = ? AND s.hora_sorteo = ? AND s.status = 'active'`,
          [lotteryId, num, drawDate, horaSorteo]
        );
        const currentAccumulated = Number(sumRows[0].tot || 0);

        if (currentAccumulated + reqMonto > maxLimit) {
          const available = Math.max(0, maxLimit - currentAccumulated);
          const priceLabel = (cfg && cfg.price_label) ? cfg.price_label : 'NIO ';

          if (lotteryId === 'fechea') {
            const parts = num.split('/');
            let formattedNum = num;
            if (parts.length >= 2) {
              const months = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
              formattedNum = `${parts[0]} ${months[Number(parts[1])] || ''}`;
            }
            return res.status(400).json({ error: `El límite de venta para la fecha ${formattedNum} en este sorteo ha sido alcanzado. Disponible: ${priceLabel}${available.toFixed(2)}` });
          } else {
            return res.status(400).json({ error: `El límite de venta para el número ${num} en este sorteo ha sido alcanzado. Disponible: ${priceLabel}${available.toFixed(2)}` });
          }
        }
      }
    }

    const totalMonto = jugadas.reduce((sum, j) => sum + Number(j.monto), 0);

    // Multi-sorteo
    const multiHours = b.multiHours && Array.isArray(b.multiHours) && b.multiHours.length > 1
      ? b.multiHours.map(h => String(h).trim())
      : null;

    const horasToProcess = multiHours || [horaSorteo];
    const multiSaleId = multiHours ? `multi_${Date.now()}_${crypto.randomBytes(4).toString('hex')}` : null;

    const createdIds = [];

    for (const hora of horasToProcess) {
      // Validar si la hora ya cerró usando el offset de Nicaragua (UTC-6)
      const drawDateTimeStr2 = `${drawDate}T${hora}:00-06:00`;
      const drawTime2 = new Date(drawDateTimeStr2).getTime();
      const closeLimitTime2 = drawTime2 - (drawCloseMinutes * 60 * 1000);

      if (Date.now() >= closeLimitTime2) continue; // Salta si ya cerró

      const saleId = `sale_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      // Registrar venta cabecera
      await db.query(
        'INSERT INTO sales (id, lottery_id, comprador, monto, seller_id, seller_name, hora_sorteo, multi_sale_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [saleId, lotteryId, comprador || null, totalMonto, user.id, user.name, hora, multiSaleId]
      );

      // Registrar líneas de la venta
      for (const j of jugadas) {
        const isFechea = (lotteryId === 'fechea');
        const fecha = isFechea ? drawDate : (j.fecha || drawDate);
        const numero = isFechea ? String(j.fecha || '') : String(j.numero || '');

        await db.query(
          'INSERT INTO sale_lines (sale_id, lottery_id, numero, monto, fecha, modalidad, serie, fraccion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            saleId,
            lotteryId,
            numero,
            Number(j.monto),
            fecha,
            j.modalidad || null,
            j.serie || null,
            j.fraccion !== undefined && j.fraccion !== null ? Number(j.fraccion) : null
          ]
        );
      }

      createdIds.push(saleId);
    }

    if (createdIds.length === 0) {
      return res.status(400).json({ error: 'Todos los sorteos seleccionados ya están cerrados.' });
    }

    // Recuperar e indexar datos finales
    const placeholders = createdIds.map(() => '?').join(',');
    const [sales] = await db.query(`SELECT * FROM sales WHERE id IN (${placeholders})`, createdIds);
    const linesMap = await loadLines(db, createdIds);
    const result = sales.map(s => normalizeSale(s, linesMap[s.id] || []));
    await fillMultiHours(db, result);

    if (!multiSaleId) {
      res.status(201).json({ sale: result[0] });
    } else {
      res.status(201).json({ sales: result, multiSaleId });
    }

  } catch (err) {
    console.error('Error en POST /api/sales:', err.message);
    res.status(500).json({ error: 'Error al registrar la venta.' });
  }
});

// ─── PUT /api/sales ➔ Anular boleto o Pagar Premio ──────────────
router.put('/', requireAuth, async (req, res) => {
  const user = req.user;
  const id = req.query.id || req.body.id || '';
  if (!id) {
    return res.status(400).json({ error: 'ID requerido.' });
  }

  const db = await getDB();

  try {
    const [saleRows] = await db.query('SELECT * FROM sales WHERE id = ?', [id]);
    const sale = saleRows[0];

    if (!sale) {
      return res.status(404).json({ error: 'Boleto no encontrado.' });
    }

    if (user.role !== 'admin' && user.role !== 'root' && sale.seller_id !== user.id) {
      return res.status(403).json({ error: 'No tienes permiso para interactuar con esta venta.' });
    }

    // Caso A: Pagar Premio
    if (req.query.pay_prize !== undefined) {
      if (sale.status === 'cancelled') {
        return res.status(400).json({ error: 'No se puede pagar un boleto anulado.' });
      }
      if (sale.prize_paid === 1) {
        return res.status(400).json({ error: 'El premio de este boleto ya ha sido pagado.' });
      }

      // Validar si tiene líneas ganadoras
      const [winnerCountRows] = await db.query(
        "SELECT COUNT(*) as cnt FROM sale_lines WHERE sale_id = ? AND status = 'winner'",
        [id]
      );
      if (Number(winnerCountRows[0].cnt || 0) === 0) {
        return res.status(400).json({ error: 'Este boleto no contiene jugadas ganadoras.' });
      }

      await db.query('UPDATE sales SET prize_paid = 1 WHERE id = ?', [id]);

      // Notificación automática
      try {
        const linesMap = await loadLines(db, [id]);
        const lineList = linesMap[id] || [];

        const [lotConfigRows] = await db.query(
          'SELECT name, payout_multiplier FROM game_configs WHERE lottery_id = ?',
          [sale.lottery_id]
        );
        const lotConfig = lotConfigRows[0];
        const payoutMultiplier = Number(lotConfig ? lotConfig.payout_multiplier : 80.00);
        const lotteryName = (lotConfig && lotConfig.name) ? lotConfig.name : sale.lottery_id;

        let totalPrize = 0;
        for (const l of lineList) {
          if (l.status === 'winner') {
            totalPrize += Number(l.monto) * payoutMultiplier;
          }
        }

        const [currencyRows] = await db.query("SELECT value FROM app_settings WHERE `key` = 'currency'");
        const currency = (currencyRows[0] ? currencyRows[0].value : 'NIO') + ' ';

        const whoPaid = `${user.name} (${user.role === 'admin' ? 'Admin' : 'Vendedor'})`;
        const cleanId = String(id).substring(id.length - 6).toUpperCase();
        const msg = `El boleto #${cleanId} (${lotteryName}) fue pagado por ${whoPaid}. Monto pagado: ${currency}${totalPrize.toFixed(2)}`;

        await db.query("INSERT INTO notifications (user_id, title, message) VALUES (NULL, 'Premio Pagado', ?)", [msg]);
      } catch (err) {
        // Silencioso
      }

      const [updatedSaleRows] = await db.query('SELECT * FROM sales WHERE id = ?', [id]);
      const updatedLinesMap = await loadLines(db, [id]);
      const normSale = normalizeSale(updatedSaleRows[0], updatedLinesMap[id] || []);
      const [finalSale] = await fillMultiHours(db, [normSale]);
      return res.json({ sale: finalSale });
    }

    // Caso B: Anular Boleto
    const b = req.body;
    const adminUsername = String(b.adminUsername || '').trim();
    const adminPassword = b.adminPassword || '';

    if (sale.status === 'cancelled') {
      return res.status(400).json({ error: 'El boleto ya está anulado.' });
    }

    // Validar si el sorteo ya fue anunciado
    const [saleLines] = await db.query('SELECT lottery_id, fecha FROM sale_lines WHERE sale_id = ?', [id]);
    let blockedAnnulment = false;
    let hasAnnouncedDraw = false;

    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Managua' });

    for (const line of saleLines) {
      const fechaSorteo = line.fecha || todayStr;
      const [results] = await db.query(
        'SELECT announced_at FROM lottery_results WHERE lottery_id = ? AND fecha_sorteo = ? AND hora_sorteo = ? ORDER BY announced_at ASC LIMIT 1',
        [line.lottery_id, fechaSorteo, sale.hora_sorteo]
      );
      const resVal = results[0];

      if (resVal) {
        hasAnnouncedDraw = true;
        // Si el boleto se creó antes o al mismo tiempo que el anuncio, se bloquea la anulación
        if (new Date(sale.created_at).getTime() <= new Date(resVal.announced_at).getTime()) {
          blockedAnnulment = true;
        }
      }
    }

    if (blockedAnnulment) {
      return res.status(403).json({ error: 'No se puede realizar la acción: este boleto pertenece a un sorteo que ya fue anunciado.' });
    }

    const requiresAdmin = (user.role !== 'admin' && user.role !== 'root') || hasAnnouncedDraw;
    let cancelledByName = user.name;

    if (requiresAdmin) {
      if (!adminUsername || !adminPassword) {
        return res.status(403).json({ error: 'Para realizar esta acción se requieren credenciales de administrador.' });
      }

      const [admRows] = await db.query('SELECT * FROM users WHERE username = ? AND role IN ("admin", "root") AND active = 1', [
        adminUsername
      ]);
      const admUser = admRows[0];

      if (!admUser || !(await bcrypt.compare(adminPassword, admUser.password_hash))) {
        return res.status(401).json({ error: 'Credenciales de administrador incorrectas.' });
      }

      cancelledByName = admUser.name;
    }

    // Ejecutar anulación
    await db.query('UPDATE sales SET status = "cancelled", cancelled_at = NOW(), cancelled_by_name = ? WHERE id = ?', [
      cancelledByName,
      id
    ]);
    await db.query('UPDATE sale_lines SET status = "cancelled" WHERE sale_id = ?', [id]);

    // Notificar anulación
    try {
      const [lotConfigRows] = await db.query('SELECT name FROM game_configs WHERE lottery_id = ?', [sale.lottery_id]);
      const lotteryName = (lotConfigRows[0] && lotConfigRows[0].name) ? lotConfigRows[0].name : sale.lottery_id;

      const [currencyRows] = await db.query("SELECT value FROM app_settings WHERE `key` = 'currency'");
      const currency = (currencyRows[0] ? currencyRows[0].value : 'NIO') + ' ';

      const cleanId = String(id).substring(id.length - 6).toUpperCase();
      const msg = `El boleto #${cleanId} (${lotteryName}) por ${currency}${Number(sale.monto).toFixed(2)} fue anulado por ${cancelledByName}.`;

      await db.query("INSERT INTO notifications (user_id, title, message) VALUES (NULL, 'Boleto Anulado', ?)", [msg]);
    } catch (err) {
      // Silencioso
    }

    const [updatedSaleRows] = await db.query('SELECT * FROM sales WHERE id = ?', [id]);
    const updatedLinesMap = await loadLines(db, [id]);
    const normSale = normalizeSale(updatedSaleRows[0], updatedLinesMap[id] || []);
    const [finalSale] = await fillMultiHours(db, [normSale]);
    res.json({ sale: finalSale });

  } catch (err) {
    console.error('Error en PUT /api/sales:', err.message);
    res.status(500).json({ error: 'Error al intentar anular el boleto.' });
  }
});

// ─── DELETE /api/sales ➔ Vaciar todo el historial (Admin) ─────────
router.delete('/', requireAdmin, async (req, res) => {
  const db = await getDB();
  try {
    await db.query('DELETE FROM sale_lines');
    await db.query('DELETE FROM sales');
    res.json({ message: 'Todas las ventas han sido eliminadas.' });
  } catch (err) {
    console.error('Error en DELETE /api/sales:', err.message);
    res.status(500).json({ error: 'No se pudieron eliminar las ventas.' });
  }
});

module.exports = router;
