// ============================================================
// gameService — Consultas de juegos, bloqueos y estado
// Espejo del gameService de la app web React
// ============================================================
import { api } from './apiService';
import { storage } from './storageService';

/**
 * Retorna la lista de números bloqueados para un juego dado.
 * @param {string} lotteryId
 * @returns {Promise<string[]>}
 */
export const getBlockedNumbers = async (lotteryId) => {
  if (!lotteryId) return [];
  const storageKey = `blocked_numbers_${lotteryId}`;
  try {
    const res = await api.get(`/blocked?lottery_id=${encodeURIComponent(lotteryId)}`);
    const blocked = res.blocked || [];
    // Guardar localmente
    await storage.set(storageKey, blocked);
    return blocked;
  } catch {
    // Si falla (ej. sin conexión), intentar leer del almacenamiento local
    const cached = await storage.get(storageKey);
    return cached || [];
  }
};

/**
 * Retorna la lista de IDs de juegos que están deshabilitados.
 * @returns {Promise<string[]>}
 */
export const getDisabledGames = async () => {
  try {
    const res = await api.get('/games');
    const configs = res.configs || {};
    return Object.entries(configs)
      .filter(([, cfg]) => Number(cfg.enabled) === 0)
      .map(([id]) => id);
  } catch {
    return [];
  }
};

/**
 * Calcula el próximo sorteo disponible (análogo al de la app web).
 * Devuelve { date: 'YYYY-MM-DD', hour: 'HH:MM' }
 * @param {number} closeMinutes
 * @param {string[]} drawHoursArray
 */
export const getNextAvailableDraw = (closeMinutes = 10, drawHoursArray = ['12:00', '15:00', '18:00', '21:00']) => {
  const now = new Date();

  for (const hStr of drawHoursArray) {
    const [h, m] = hStr.split(':').map(Number);
    const drawTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    const limitTime = new Date(drawTime.getTime() - closeMinutes * 60 * 1000);
    if (now.getTime() < limitTime.getTime()) {
      return {
        date: now.toLocaleDateString('sv-SE'),
        hour: hStr,
      };
    }
  }

  // Si no hay sorteo hoy, usar el primero de mañana
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return {
    date: tomorrow.toLocaleDateString('sv-SE'),
    hour: drawHoursArray[0] || '12:00',
  };
};

/**
 * Indica si un sorteo dado está abierto (no ha cerrado la ventana de venta).
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} hourStr HH:MM
 * @param {number} closeMinutes
 */
export const isDrawOpen = (dateStr, hourStr, closeMinutes = 10) => {
  if (!dateStr || !hourStr) return false;
  const now = new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hh, mm] = hourStr.split(':').map(Number);
  const drawTime = new Date(year, month - 1, day, hh, mm, 0, 0);
  const limitTime = new Date(drawTime.getTime() - closeMinutes * 60 * 1000);
  return now.getTime() < limitTime.getTime();
};

/**
 * Formatea hora en formato AM/PM legible.
 * @param {string} hourStr HH:MM
 */
export const formatHourAmPm = (hourStr) => {
  if (!hourStr) return '';
  let str = String(hourStr).trim().toLowerCase();
  str = str.replace(/(hrs|horas|hr|h)/g, '').trim();
  
  let h = 0;
  let m = 0;
  if (str.includes(':')) {
    const parts = str.split(':');
    h = Number(parts[0]);
    m = Number(parts[1]);
  } else {
    h = Number(str);
    m = 0;
  }
  if (isNaN(h) || isNaN(m)) return hourStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  const displayM = String(m).padStart(2, '0');
  return `${displayH}:${displayM} ${ampm}`;
};
