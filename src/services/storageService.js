// ============================================================
// storageService — ahora usa MySQL vía API PHP
// Mantiene la misma interfaz que la versión IndexedDB
// ============================================================
import { api } from './apiService';

// ─── Ventas ──────────────────────────────────────────────────

export const saveSale = async (saleData) => {
  const { sale } = await api.post('/sales.php', saleData);
  return sale;
};

export const getAllSales = async () => {
  const { sales } = await api.get('/sales.php');
  return sales;
};

export const getTodaySales = async () => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const { sales } = await api.get(`/sales.php?date=${today}`);
  return sales;
};

export const getSalesByFilter = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.date)       params.set('date',       filters.date);
  if (filters.lotteryId)  params.set('lottery_id', filters.lotteryId);
  if (filters.status)     params.set('status',     filters.status);
  if (filters.search)     params.set('search',     filters.search);
  if (filters.sellerId)   params.set('seller_id',  filters.sellerId);
  const { sales } = await api.get(`/sales.php?${params.toString()}`);
  return sales;
};

export const cancelSale = async (id, adminCreds = null) => {
  const { sale } = await api.put(`/sales.php?id=${encodeURIComponent(id)}`, adminCreds);
  return sale;
};

export const paySalePrize = async (id) => {
  const { sale } = await api.put(`/sales.php?id=${encodeURIComponent(id)}&pay_prize=1`);
  return sale;
};

export const getSaleById = async (id) => {
  const { sales } = await api.get(`/sales.php?search=${encodeURIComponent(id)}`);
  return sales.find((s) => s.id === id) || null;
};

export const getDailySummary = async () => {
  return await api.get('/sales.php?summary=1');
};

// ─── Configuración de la app ──────────────────────────────────

export const getSettings = async () => {
  try {
    const { settings } = await api.get('/settings.php');
    return {
      businessName: settings.businessName || 'Rifas Express',
      currency:     settings.currency     || 'NIO',
      autoprint:    settings.autoprint === 'true',
      drawCloseMinutes: Number(settings.drawCloseMinutes || 10),
    };
  } catch {
    // Fallback si la API no está disponible
    return { businessName: 'Rifas Express', currency: 'NIO', autoprint: true, drawCloseMinutes: 10 };
  }
};

export const saveSettings = async (settings) => {
  // autoprint se convierte a string para la BD
  const payload = {
    ...settings,
    autoprint: String(settings.autoprint ?? true),
    drawCloseMinutes: String(settings.drawCloseMinutes ?? 10),
  };
  await api.put('/settings.php', payload);
};

// ─── Resultados / Ganadores ───────────────────────────────────

export const getResults = async () => {
  const { results } = await api.get('/results.php');
  return results;
};

export const announceResult = async (payload) => {
  return await api.post('/results.php', payload);
};

export const deleteResult = async (id) => {
  return await api.delete(`/results.php?id=${id}`);
};

export const checkWinners = async () => {
  const { winners } = await api.get('/results.php?check=1');
  return winners;
};
