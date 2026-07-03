// ============================================================
// storageService — Almacenamiento local para Móvil
// Usa AsyncStorage para datos generales.
// Para tokens: SecureStore en nativo (iOS/Android),
//              AsyncStorage con prefijo en Web (fallback).
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from './apiService';

// En web, expo-secure-store no funciona. Usamos AsyncStorage con un prefijo.
const SECURE_PREFIX = '__secure_';

const isWeb = Platform.OS === 'web';

export const storage = {
  // ── General (AsyncStorage) ────────────────────────────────
  get: async (key) => {
    try {
      const val = await AsyncStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },

  set: async (key, val) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch {
      return false;
    }
  },

  remove: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  // ── Seguro: SecureStore (nativo) o AsyncStorage (web) ────
  getSecure: async (key) => {
    try {
      if (isWeb) {
        // En web usamos AsyncStorage con prefijo para simular secure storage
        const val = await AsyncStorage.getItem(SECURE_PREFIX + key);
        return val; // Devuelve string directo (sin JSON.parse), igual que SecureStore
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  setSecure: async (key, val) => {
    try {
      if (isWeb) {
        await AsyncStorage.setItem(SECURE_PREFIX + key, String(val));
        return true;
      }
      await SecureStore.setItemAsync(key, String(val));
      return true;
    } catch {
      return false;
    }
  },

  removeSecure: async (key) => {
    try {
      if (isWeb) {
        await AsyncStorage.removeItem(SECURE_PREFIX + key);
        return true;
      }
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Consulta el servidor de ventas con filtros opcionales.
 * @param {{ date?: string, lotteryId?: string, status?: string, search?: string, sellerId?: string }} filters
 * @returns {Promise<Array>}
 */
export const getSalesByFilter = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.date)      params.append('date',       filters.date);
  if (filters.lotteryId) params.append('lottery_id', filters.lotteryId);
  if (filters.status)    params.append('status',     filters.status);
  if (filters.search)    params.append('search',     filters.search);
  if (filters.sellerId)  params.append('seller_id',  filters.sellerId);

  const qs = params.toString();
  const res = await api.get(`/sales${qs ? `?${qs}` : ''}`);
  return res.sales || [];
};

/**
 * Obtiene los resultados/ganadores registrados.
 * @returns {Promise<Array>}
 */
export const getResults = async () => {
  try {
    const res = await api.get('/results');
    return res.results || [];
  } catch {
    return [];
  }
};
