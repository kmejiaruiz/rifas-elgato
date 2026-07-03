// ============================================================
// gameService — ahora usa MySQL vía API PHP
// Sin sorteos: los números bloqueados son por juego únicamente
// ============================================================
import { api } from './apiService';

// ─── Configuración y estado de juegos ────────────────────────

/** Retorna map { lottery_id → config } de la BD */
export const getGameConfigs = async () => {
  try {
    const { configs } = await api.get('/games');
    return configs || {};
  } catch {
    return {};
  }
};

/** Habilita o deshabilita un juego */
export const setGameEnabled = async (lotteryId, enabled) => {
  await api.put(`/games?id=${lotteryId}`, { enabled });
};

/** Verifica si un juego está habilitado */
export const isGameEnabled = async (lotteryId) => {
  const configs = await getGameConfigs();
  const cfg = configs[lotteryId];
  return cfg ? Boolean(cfg.enabled) : true;
};

/** Guarda configuración personalizada de un juego */
export const saveGameConfig = async (lotteryId, config) => {
  await api.put(`/games?id=${lotteryId}`, config);
};

/** Elimina un juego personalizado */
export const deleteGameConfig = async (lotteryId) => {
  await api.delete(`/games?id=${lotteryId}`);
};

/** Retorna los juegos deshabilitados como array de IDs */
export const getDisabledGames = async () => {
  const configs = await getGameConfigs();
  return Object.entries(configs)
    .filter(([, cfg]) => !cfg.enabled)
    .map(([id]) => id);
};

/**
 * Combina la lista estática de rifas con la config de la BD.
 */
export const getAllGameStates = async (lotteryList) => {
  const configs = await getGameConfigs();
  return lotteryList.map((lottery) => {
    const cfg = configs[lottery.id];
    if (!cfg) return {
      ...lottery,
      enabled: true,
      allowSeries: lottery.allowSeries || false,
      drawHours: lottery.drawHours || '12:00,15:00,18:00,21:00',
      maxSalesPerNumber: lottery.maxSalesPerNumber || 0.00
    };
    return {
      ...lottery,
      name:         cfg.name         || lottery.name,
      description:  cfg.description  || lottery.description,
      defaultPrice: cfg.default_price !== null ? parseFloat(cfg.default_price) : lottery.defaultPrice,
      priceLabel:   cfg.price_label   || lottery.priceLabel,
      enabled:      Boolean(Number(cfg.enabled)),
      allowSeries:  Boolean(Number(cfg.allow_series ?? 0)),
      drawHours:    cfg.draw_hours    || '12:00,15:00,18:00,21:00',
      maxSalesPerNumber: cfg.max_sales_per_number !== null ? parseFloat(cfg.max_sales_per_number) : 0.00,
    };
  });
};

// ─── Números bloqueados (sin sorteo) ─────────────────────────

export const getBlockedNumbers = async (lotteryId) => {
  try {
    const { blocked } = await api.get(`/blocked?lottery_id=${lotteryId}`);
    return blocked || [];
  } catch {
    return [];
  }
};

export const blockNumber = async (lotteryId, number) => {
  await api.post('/blocked', { lottery_id: lotteryId, numero: String(number) });
};

export const unblockNumber = async (lotteryId, number) => {
  await api.delete(`/blocked?lottery_id=${lotteryId}&numero=${encodeURIComponent(number)}`);
};

export const clearBlockedNumbers = async (lotteryId) => {
  await api.delete(`/blocked?lottery_id=${lotteryId}&all=1`);
};

export const isNumberBlocked = async (lotteryId, number) => {
  const blocked = await getBlockedNumbers(lotteryId);
  return blocked.includes(String(number));
};
