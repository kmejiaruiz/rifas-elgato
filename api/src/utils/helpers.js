const { getDB } = require('../config/db');

function getAuthHeader(req) {
  const auth = req.headers['authorization'] || '';
  if (auth) return auth;

  // Fallback para FastCGI (InfinityFree elimina Authorization)
  const xToken = req.headers['x-auth-token'];
  if (xToken) return `Bearer ${xToken}`;

  return '';
}

async function authUser(req) {
  const h = getAuthHeader(req);
  if (!h.startsWith('Bearer ')) return null;
  const token = h.substring(7);

  try {
    const db = await getDB();
    const [rows] = await db.query(
      `SELECT u.* FROM users u
       JOIN auth_tokens t ON t.user_id = u.id
       WHERE t.token = ? AND t.expires_at > NOW() AND u.active = 1`,
      [token]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('Error in authUser helper:', err.message);
    return null;
  }
}

async function requireAuth(req, res, next) {
  const u = await authUser(req);
  if (!u) {
    return res.status(401).json({ error: 'No autenticado. Inicia sesión.' });
  }
  req.user = u;
  next();
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'root') {
      return res.status(403).json({ error: 'Acceso denegado: se requiere rol admin.' });
    }
    next();
  });
}

async function requireRoot(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.user.role !== 'root') {
      return res.status(403).json({ error: 'Acceso denegado: se requiere rol root.' });
    }
    next();
  });
}

async function auditLog(action, userId = null, data = {}, req = null) {
  try {
    const db = await getDB();
    let ip = null;
    let ua = null;
    if (req) {
      ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      ua = req.headers['user-agent'];
    }
    await db.query(
      'INSERT INTO audit_log (user_id, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [
        userId || null,
        action,
        data ? JSON.stringify(data) : null,
        ip ? String(ip).substring(0, 45) : null,
        ua ? String(ua).substring(0, 255) : null
      ]
    );
  } catch (err) {
    // Silencioso
  }
}

function sanitizeInput(val, maxLen = 255) {
  if (typeof val !== 'string') return '';
  const clean = val.replace(/<[^>]*>?/gm, '').trim();
  return clean.substring(0, maxLen);
}

async function getAppStatus() {
  try {
    const db = await getDB();
    const [rows] = await db.query(
      "SELECT `key`, `value` FROM app_settings WHERE `key` IN ('appStatus', 'appDisableAt')"
    );

    const map = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }

    let status = map.appStatus || 'active';
    let disableAt = map.appDisableAt || 'never';
    let isBlocked = false;

    if (status === 'disabled') {
      isBlocked = true;
    } else if (disableAt !== 'never') {
      const ts = Date.parse(disableAt);
      if (!isNaN(ts) && Date.now() >= ts) {
        isBlocked = true;
        // Auto-marcar como disabled en la BD
        await db.query("UPDATE app_settings SET `value`='disabled' WHERE `key`='appStatus'");
        await db.query("UPDATE app_settings SET `value`='never' WHERE `key`='appDisableAt'");
        status = 'disabled';
        disableAt = 'never';
      }
    }

    return { status, disableAt, isBlocked };
  } catch (err) {
    return { status: 'active', disableAt: 'never', isBlocked: false };
  }
}

function safeUser(u) {
  const safe = { ...u };
  delete safe.password_hash;
  return safe;
}

function normalizeLine(l) {
  return {
    id: Number(l.id),
    saleId: l.sale_id,
    lotteryId: l.lottery_id,
    numero: l.numero,
    monto: Number(l.monto),
    fecha: l.fecha || null,
    modalidad: l.modalidad || null,
    serie: l.serie || null,
    fraccion: l.fraccion !== undefined && l.fraccion !== null ? Number(l.fraccion) : null,
    status: l.status
  };
}

function normalizeSale(s, lines = []) {
  return {
    id: s.id,
    lotteryId: s.lottery_id,
    comprador: s.comprador,
    monto: Number(s.monto),
    status: s.status,
    sellerId: s.seller_id,
    sellerName: s.seller_name,
    prizePaid: Boolean(s.prize_paid ?? 0),
    horaSorteo: s.hora_sorteo ?? '12:00',
    createdAt: s.created_at,
    cancelledAt: s.cancelled_at ?? null,
    cancelledByName: s.cancelled_by_name ?? null,
    multiSaleId: s.multi_sale_id ?? null,
    lines: Array.isArray(lines) ? lines.map(normalizeLine) : []
  };
}

async function normalizeResult(r) {
  let lotteryName = r.lottery_id || '';
  try {
    const db = await getDB();
    const [gcRows] = await db.query('SELECT name FROM game_configs WHERE lottery_id = ?', [
      r.lottery_id || ''
    ]);
    if (gcRows[0] && gcRows[0].name) {
      lotteryName = gcRows[0].name;
    }
  } catch (err) {
    // Silencioso
  }

  return {
    id: Number(r.id),
    lotteryId: r.lottery_id,
    lotteryName,
    fechaSorteo: r.fecha_sorteo,
    numeroGanador: r.numero_ganador,
    horaSorteo: r.hora_sorteo ?? '12:00',
    announcedBy: r.announced_by,
    announcedAt: r.announced_at
  };
}

async function loadLines(db, saleIds) {
  if (!Array.isArray(saleIds) || saleIds.length === 0) return {};
  const placeholders = saleIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT * FROM sale_lines WHERE sale_id IN (${placeholders}) ORDER BY id ASC`,
    saleIds
  );

  const map = {};
  for (const line of rows) {
    if (!map[line.sale_id]) {
      map[line.sale_id] = [];
    }
    map[line.sale_id].push(line);
  }
  return map;
}

module.exports = {
  getAuthHeader,
  authUser,
  requireAuth,
  requireAdmin,
  requireRoot,
  auditLog,
  sanitizeInput,
  getAppStatus,
  safeUser,
  normalizeLine,
  normalizeSale,
  normalizeResult,
  loadLines
};
