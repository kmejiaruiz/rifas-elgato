// ============================================================
// AppContext — Contexto Global de Datos para Móvil
// ============================================================
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { api } from '../services/apiService';
import { storage } from '../services/storageService';
import { LOTTERY_LIST, setDynamicLotteries } from '../data/lotteryTypes';

const initialState = {
  sales: [],
  dailySummary: { total: 0, count: 0, byType: {}, cancelled: 0 },
  settings: {
    businessName: 'Rifas Express',
    currency: 'NIO',
    autoprint: true,
    drawCloseMinutes: 10,
  },
  loading: true,
  selectedLotteryId: null,
  lotteries: LOTTERY_LIST,
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_SALES':
      return { ...state, sales: action.payload, loading: false };
    case 'ADD_SALE':
      return { ...state, sales: [action.payload, ...state.sales] };
    case 'UPDATE_SALE':
      return {
        ...state,
        sales: state.sales.map((s) => (s.id === action.payload.id ? action.payload : s)),
      };
    case 'SET_DAILY_SUMMARY':
      return { ...state, dailySummary: action.payload };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SELECT_LOTTERY':
      return { ...state, selectedLotteryId: action.payload };
    case 'LOAD_LOTTERIES':
      return { ...state, lotteries: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const refreshSummary = useCallback(async () => {
    try {
      const summary = await api.get('/sales.php?summary=1');
      dispatch({ type: 'SET_DAILY_SUMMARY', payload: summary });
    } catch {}
  }, []);

  const loadAllData = useCallback(async () => {
    const token = await storage.getSecure('rifas_token');
    if (!token) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const [salesRes, summaryRes, settingsRes, gamesRes] = await Promise.all([
        api.get('/sales.php'),
        api.get('/sales.php?summary=1'),
        api.get('/settings.php'),
        api.get('/games.php'),
      ]);

      const gameConfigs = gamesRes.configs || {};
      setDynamicLotteries(gameConfigs);

      dispatch({ type: 'LOAD_SALES', payload: salesRes.sales || [] });
      dispatch({ type: 'SET_DAILY_SUMMARY', payload: summaryRes });
      
      const setts = settingsRes.settings || {};
      dispatch({
        type: 'SET_SETTINGS',
        payload: {
          businessName: setts.businessName || 'Rifas Express',
          currency:     setts.currency     || 'NIO',
          autoprint:    setts.autoprint === 'true',
          drawCloseMinutes: Number(setts.drawCloseMinutes || 10),
        },
      });
      dispatch({ type: 'LOAD_LOTTERIES', payload: [...LOTTERY_LIST] });
    } catch (err) {
      console.warn('[AppContext] loadAllData:', err.message);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const addSale = useCallback(async (saleData) => {
    try {
      const { sale } = await api.post('/sales.php', saleData);
      dispatch({ type: 'ADD_SALE', payload: sale });
      await refreshSummary();
      return sale;
    } catch (err) {
      Alert.alert('Error de Venta', err.message);
      throw err;
    }
  }, [refreshSummary]);

  const annulSale = useCallback(async (id, adminCreds = null) => {
    try {
      const { sale } = await api.put(`/sales.php?id=${encodeURIComponent(id)}`, adminCreds);
      dispatch({ type: 'UPDATE_SALE', payload: sale });
      await refreshSummary();
      Alert.alert('Éxito', 'Venta anulada correctamente');
      return sale;
    } catch (err) {
      Alert.alert('Error al Anular', err.message);
      throw err;
    }
  }, [refreshSummary]);

  const paySalePrize = useCallback(async (id) => {
    try {
      const { sale } = await api.put(`/sales.php?id=${encodeURIComponent(id)}&pay_prize=1`);
      dispatch({ type: 'UPDATE_SALE', payload: sale });
      await refreshSummary();
      Alert.alert('Éxito', 'Premio marcado como pagado');
      return sale;
    } catch (err) {
      Alert.alert('Error al Pagar', err.message);
      throw err;
    }
  }, [refreshSummary]);

  const updateSettings = useCallback(async (newSettings) => {
    try {
      const payload = {
        ...newSettings,
        autoprint: String(newSettings.autoprint ?? true),
        drawCloseMinutes: String(newSettings.drawCloseMinutes ?? 10),
      };
      await api.put('/settings.php', payload);
      dispatch({ type: 'SET_SETTINGS', payload: newSettings });
      Alert.alert('Ajustes Guardados', 'Los parámetros se actualizaron en el servidor.');
    } catch (err) {
      Alert.alert('Error al Guardar Ajustes', err.message);
    }
  }, []);

  const selectLottery = useCallback((id) => {
    dispatch({ type: 'SELECT_LOTTERY', payload: id });
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        addSale,
        annulSale,
        paySalePrize,
        updateSettings,
        selectLottery,
        refreshSummary,
        loadAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
};
