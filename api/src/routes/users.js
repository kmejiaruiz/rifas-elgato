const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDB } = require('../config/db');
const {
  requireAdmin,
  safeUser
} = require('../utils/helpers');

// Helpers internos para generación de Username único en JS
async function usernameExists(db, username) {
  const [rows] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
  return rows.length > 0;
}

async function generateUniqueUsername(db, fullName) {
  // Quitar acentos y diacríticos nativamente en JS
  let normalized = fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Quitar caracteres especiales, dejar solo letras, números y espacios
  normalized = normalized.replace(/[^a-z0-9\s]/g, '');
  const parts = normalized.split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    return 'user_' + Math.floor(Date.now() / 1000);
  }

  const firstName = parts[0];
  let lastName = '';
  const cnt = parts.length;
  if (cnt === 2) {
    lastName = parts[1];
  } else if (cnt === 3) {
    lastName = parts[1]; // primer apellido
  } else {
    lastName = parts[2]; // primer apellido asumiendo 2 nombres
  }

  // 1. Primera letra del nombre + apellido
  let candidate = firstName.substring(0, 1) + lastName;
  if (!(await usernameExists(db, candidate))) return candidate;

  // 2. Dos letras del nombre + apellido
  if (firstName.length >= 2) {
    candidate = firstName.substring(0, 2) + lastName;
    if (!(await usernameExists(db, candidate))) return candidate;
  }

  // 3. Dos letras del nombre + punto + apellido
  if (firstName.length >= 2) {
    candidate = firstName.substring(0, 2) + '.' + lastName;
    if (!(await usernameExists(db, candidate))) return candidate;
  }

  // 4. Si todo falla, alternar con números secuenciales
  let i = 1;
  while (true) {
    candidate = firstName.substring(0, 2) + '.' + lastName + i;
    if (!(await usernameExists(db, candidate))) return candidate;
    i++;
  }
}

// ─── GET /api/users ➔ Listar o Reporte de Ventas/Pagos (Admin) ─
router.get('/', requireAdmin, async (req, res) => {
  const db = await getDB();

  try {
    if (req.query.report !== undefined) {
      // Formato YYYY-MM-DD
      const todayStr = new Date().toISOString().substring(0, 10);
      const startDate = req.query.start_date || todayStr;
      const endDate = req.query.end_date || todayStr;

      const sql = `
        SELECT
          u.id, u.username, u.name, u.role, u.active, u.salary_type, u.salary_value, u.salary_period,
          COALESCE(sales_range.total_sold, 0.00) as total_sold,
          COALESCE(sales_range.tickets_sold_count, 0) as tickets_sold_count,
          COALESCE(sales_range.days_active, 0) as days_active,
          COALESCE(prizes_range.prizes_count, 0) as prizes_count,
          COALESCE(prizes_range.prizes_total, 0.00) as prizes_total,
          COALESCE(cancelled_range.cancelled_count, 0) as cancelled_count,
          COALESCE(cancelled_range.cancelled_total, 0.00) as cancelled_total
        FROM users u
        LEFT JOIN (
          SELECT
            seller_id,
            SUM(monto) as total_sold,
            COUNT(*) as tickets_sold_count,
            COUNT(DISTINCT DATE(created_at)) as days_active
          FROM sales
          WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'active'
          GROUP BY seller_id
        ) sales_range ON sales_range.seller_id = u.id
        LEFT JOIN (
          SELECT
            s.seller_id,
            COUNT(sl.id) as prizes_count,
            SUM(sl.monto * COALESCE(gc.payout_multiplier, 80.00)) as prizes_total
          FROM sale_lines sl
          JOIN sales s ON s.id = sl.sale_id
          LEFT JOIN game_configs gc ON gc.lottery_id = sl.lottery_id
          WHERE DATE(s.created_at) BETWEEN ? AND ? AND sl.status = 'winner' AND s.status = 'active' AND s.prize_paid = 1
          GROUP BY s.seller_id
        ) prizes_range ON prizes_range.seller_id = u.id
        LEFT JOIN (
          SELECT
            seller_id,
            SUM(monto) as cancelled_total,
            COUNT(*) as cancelled_count
          FROM sales
          WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'cancelled'
          GROUP BY seller_id
        ) cancelled_range ON cancelled_range.seller_id = u.id
        WHERE u.role != 'root'
        ORDER BY u.role DESC, u.name
      `;

      const [reportRows] = await db.query(sql, [
        startDate, endDate,
        startDate, endDate,
        startDate, endDate
      ]);

      // Consultar historial de pagos de salarios
      const [paymentRows] = await db.query(
        'SELECT id, seller_id, start_date, end_date, total_sold, prizes_total, commission_amount, net_salary, paid_at FROM salary_payments ORDER BY paid_at DESC'
      );

      res.json({
        report: reportRows,
        payments: paymentRows,
        start_date: startDate,
        end_date: endDate
      });

    } else {
      // Listar usuarios normales
      const [rows] = await db.query(
        "SELECT id, username, name, role, active, salary_type, salary_value, salary_period, created_at, updated_at FROM users WHERE role != 'root' ORDER BY role DESC, name"
      );
      res.json({ users: rows });
    }
  } catch (err) {
    console.error('Error en GET /api/users:', err.message);
    res.status(500).json({ error: 'Error al consultar los usuarios.' });
  }
});

// ─── POST /api/users ➔ Crear usuario o Registrar Pago (Admin) ──
router.post('/', requireAdmin, async (req, res) => {
  const db = await getDB();

  try {
    if (req.query.pay !== undefined) {
      // Registrar un Pago de Salario
      const b = req.body;
      const sellerId = b.seller_id || '';
      const startDate = b.start_date || '';
      const endDate = b.end_date || '';
      const totalSold = Number(b.total_sold || 0);
      const prizesTotal = Number(b.prizes_total || 0);
      const commissionAmount = Number(b.commission_amount || 0);
      const netSalary = Number(b.net_salary || 0);

      if (!sellerId || !startDate || !endDate) {
        return res.status(400).json({ error: 'Datos incompletos para registrar el pago.' });
      }

      // Verificar superposición de fechas
      const [chkRows] = await db.query(
        'SELECT id FROM salary_payments WHERE seller_id = ? AND NOT (end_date < ? OR start_date > ?)',
        [sellerId, startDate, endDate]
      );
      if (chkRows.length > 0) {
        return res.status(400).json({ error: 'Este periodo (o parte de él) ya ha sido registrado como pagado.' });
      }

      // Insertar el pago
      await db.query(
        'INSERT INTO salary_payments (seller_id, start_date, end_date, total_sold, prizes_total, commission_amount, net_salary) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [sellerId, startDate, endDate, totalSold, prizesTotal, commissionAmount, netSalary]
      );

      // Retornar historial actualizado
      const [paymentRows] = await db.query(
        'SELECT id, seller_id, start_date, end_date, total_sold, prizes_total, commission_amount, net_salary, paid_at FROM salary_payments ORDER BY paid_at DESC'
      );

      res.json({ message: 'Pago registrado con éxito.', payments: paymentRows });

    } else {
      // Crear un Usuario Nuevo
      const b = req.body;
      const password = b.password || '';
      const name = b.name ? String(b.name).trim() : '';
      const role = ['admin', 'vendedor'].includes(b.role) ? b.role : 'vendedor';
      const salary_type = ['fixed', 'percentage'].includes(b.salary_type) ? b.salary_type : 'percentage';
      const salary_value = b.salary_value !== undefined ? Number(b.salary_value) : 10.00;
      const salary_period = ['daily', 'weekly', 'fortnightly', 'monthly'].includes(b.salary_period) ? b.salary_period : 'daily';

      if (!password || !name) {
        return res.status(400).json({ error: 'Nombre y contraseña son requeridos.' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      }

      // Validar que tenga al menos nombre y apellido
      const nameParts = name.split(/\s+/).filter(Boolean);
      if (nameParts.length < 2) {
        return res.status(400).json({ error: 'Debe ingresar nombre y al menos un apellido.' });
      }

      // Autogenerar username único
      const username = await generateUniqueUsername(db, name);

      if (password.toLowerCase() === username.toLowerCase()) {
        return res.status(400).json({ error: 'La contraseña no puede ser igual al nombre de usuario.' });
      }

      const id = crypto.randomUUID();
      const hash = await bcrypt.hash(password, 10);

      await db.query(
        'INSERT INTO users (id, username, password_hash, name, role, active, salary_type, salary_value, salary_period) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)',
        [id, username, hash, name, role, salary_type, salary_value, salary_period]
      );

      const [userRows] = await db.query(
        'SELECT id, username, name, role, active, salary_type, salary_value, salary_period, created_at FROM users WHERE id = ?',
        [id]
      );

      res.status(201).json({ user: userRows[0] });
    }
  } catch (err) {
    console.error('Error en POST /api/users:', err.message);
    res.status(500).json({ error: 'Error al registrar el usuario o el pago.' });
  }
});

// ─── PUT /api/users/:id ➔ Actualizar datos del usuario (Admin) ───
router.put('/', requireAdmin, async (req, res) => {
  const id = req.query.id || req.body.id || '';
  if (!id) {
    return res.status(400).json({ error: 'ID requerido.' });
  }

  const admin = req.user;
  const db = await getDB();

  try {
    // Obtener info actual del objetivo
    const [targetRows] = await db.query('SELECT username, role FROM users WHERE id = ?', [id]);
    const targetUser = targetRows[0];

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (targetUser.role === 'root') {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const b = req.body;
    const fields = [];
    const vals = [];

    if (b.name !== undefined) {
      fields.push('name = ?');
      vals.push(String(b.name).trim());
    }
    if (b.role !== undefined && ['admin', 'vendedor'].includes(b.role)) {
      fields.push('role = ?');
      vals.push(b.role);
    }
    if (b.active !== undefined) {
      fields.push('active = ?');
      fields.push('active = ?');
      vals.push(b.active ? 1 : 0);
    }
    if (b.salary_type !== undefined && ['fixed', 'percentage'].includes(b.salary_type)) {
      fields.push('salary_type = ?');
      vals.push(b.salary_type);
    }
    if (b.salary_value !== undefined) {
      fields.push('salary_value = ?');
      vals.push(Number(b.salary_value));
    }
    if (b.salary_period !== undefined && ['daily', 'weekly', 'fortnightly', 'monthly'].includes(b.salary_period)) {
      fields.push('salary_period = ?');
      vals.push(b.salary_period);
    }

    if (b.password) {
      if (b.password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      }
      if (b.password.toLowerCase() === targetUser.username.toLowerCase()) {
        return res.status(400).json({ error: 'La contraseña no puede ser igual al nombre de usuario.' });
      }
      const hash = await bcrypt.hash(b.password, 10);
      fields.push('password_hash = ?');
      vals.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar.' });
    }

    // Evitar que el admin se desactive a sí mismo
    if (b.active !== undefined && !b.active && id === admin.id) {
      return res.status(400).json({ error: 'No puedes desactivarte a ti mismo.' });
    }

    vals.push(id);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);

    const [updatedRows] = await db.query(
      'SELECT id, username, name, role, active, salary_type, salary_value, salary_period, updated_at FROM users WHERE id = ?',
      [id]
    );

    res.json({ user: updatedRows[0] });

  } catch (err) {
    console.error('Error en PUT /api/users:', err.message);
    res.status(500).json({ error: 'Error al intentar actualizar el usuario.' });
  }
});

// ─── DELETE /api/users ➔ Eliminar usuario (Admin) ──────────────
router.delete('/', requireAdmin, async (req, res) => {
  const id = req.query.id || '';
  if (!id) {
    return res.status(400).json({ error: 'ID requerido.' });
  }

  const admin = req.user;
  if (id === admin.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
  }

  const db = await getDB();

  try {
    const [targetRows] = await db.query('SELECT role FROM users WHERE id = ?', [id]);
    const targetUser = targetRows[0];

    if (targetUser && targetUser.role === 'root') {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Usuario eliminado' });

  } catch (err) {
    console.error('Error en DELETE /api/users:', err.message);
    res.status(500).json({ error: 'No se pudo eliminar el usuario.' });
  }
});

module.exports = router;
