// ============================================================
// AppContext — Contexto Global de Datos para Móvil
// Sincroniza todos los datos del API: settings, juegos, ventas, resumen
// ============================================================
import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { api } from '../services/apiService';
import { storage } from '../services/storageService';
import { useAuth } from './AuthContext';
import { LOTTERY_LIST, setDynamicLotteries } from '../data/lotteryTypes';
import {
  connectPrinter as svcConnect,
  disconnectPrinter as svcDisconnect,
  isPrinterConnected as svcIsConnected,
  getConnectedDevice as svcGetDevice,
  printTestPage as svcTestPrint,
  printTicket as svcPrintTicket,
} from '../services/printerService';

// ─── Estado inicial ───────────────────────────────────────────
const initialState = {
  sales: [],
  dailySummary: { total: 0, count: 0, byType: {}, cancelled: 0 },
  settings: {
    businessName: 'Amaranto',
    currency: 'NIO',
    autoprint: true,
    drawCloseMinutes: 10,
    appStatus: 'active',
    appDisableAt: 'never',
    isBlocked: false,
  },
  loading: true,
  selectedLotteryId: null,
  lotteries: LOTTERY_LIST,
};

// ─── Reducer ──────────────────────────────────────────────────
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

// ─── Parseador de settings del API ───────────────────────────
const parseSettings = (raw = {}) => ({
  businessName:     raw.businessName     || 'Amaranto',
  currency:         raw.currency         || 'NIO',
  autoprint:        raw.autoprint === 'true' || raw.autoprint === true,
  drawCloseMinutes: Number(raw.drawCloseMinutes || 10),
  appStatus:        raw.appStatus        ?? 'active',
  appDisableAt:     raw.appDisableAt     ?? 'never',
  isBlocked:        raw.isBlocked === true || raw.isBlocked === 'true',
  carousel_images:  raw.carousel_images  || '[]',
  bypassCode:       raw.bypassCode       || '1005199611712301977',
});

// ─── Contexto ─────────────────────────────────────────────────
const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const { user } = useAuth();
  const [isServerConnected, setIsServerConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Pinger para verificar el estado de conexión
  useEffect(() => {
    if (!user) return;

    let timer = null;

    const ping = async () => {
      try {
        await api.get('/settings.php');
        if (!isServerConnected) {
          setIsServerConnected(true);
        }
      } catch (err) {
        const isNetError = err.message && (
          err.message.includes('No se pudo establecer conexión') ||
          err.message.includes('Network') ||
          err.message.includes('network') ||
          err.message.includes('timeout')
        );
        if (isNetError) {
          setIsServerConnected(false);
        }
      }
    };

    timer = setInterval(ping, 10000); // Ping cada 10s
    return () => clearInterval(timer);
  }, [user, isServerConnected]);

  // Sync Engine: detecta el cambio de isServerConnected de false -> true
  useEffect(() => {
    if (!isServerConnected || isSyncing) return;

    const runSync = async () => {
      const queue = await storage.get('offline_sales_queue') || [];
      if (queue.length === 0) return;

      setIsSyncing(true);

      // Alerta de inicio de sincronización
      Alert.alert(
        'Conexión restablecida',
        'Sincronizando documentos pendientes en el servidor, favor espere...'
      );

      let syncedCount = 0;
      let totalSyncedMonto = 0;
      const remainingQueue = [];

      for (const item of queue) {
        try {
          const res = await api.post('/sales.php', item.data);
          const sale = res.sales ? res.sales[0] : res.sale;
          syncedCount++;
          totalSyncedMonto += parseFloat(sale.monto || 0);

          // Actualizar estado local
          dispatch({ type: 'UPDATE_SALE', payload: sale });
        } catch (err) {
          console.warn('[Mobile Sync] Error al sincronizar venta:', err.message);
          remainingQueue.push(item);
        }
      }

      await storage.set('offline_sales_queue', remainingQueue);
      setIsSyncing(false);

      if (syncedCount > 0) {
        // Alerta de éxito
        Alert.alert(
          'Sincronización Completada',
          `${syncedCount} ventas sincronizadas con un total de NIO ${totalSyncedMonto.toFixed(2)} en el servidor.`
        );
        // Recargar datos
        loadAllData();
      }
    };

    runSync();
  }, [isServerConnected]);

  const handleOfflineSale = async (saleData) => {
    const tempId = `temp_sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const totalMonto = saleData.jugadas.reduce((sum, j) => sum + parseFloat(j.monto || 0), 0);

    const mockSale = {
      id: tempId,
      lotteryId: saleData.lotteryId,
      comprador: saleData.comprador || '',
      monto: totalMonto,
      sellerId: user?.id || '0',
      sellerName: user?.name || 'Vendedor Offline',
      horaSorteo: saleData.horaSorteo || '12:00',
      status: 'active',
      createdAt: new Date().toISOString(),
      prizePaid: 0,
      isOffline: true,
      lines: saleData.jugadas.map((j, idx) => ({
        id: `temp_line_${Date.now()}_${idx}`,
        saleId: tempId,
        lotteryId: saleData.lotteryId,
        numero: saleData.lotteryId === 'fechea' ? (j.fecha || '') : (j.numero || ''),
        monto: parseFloat(j.monto || 0),
        fecha: j.fecha || new Date().toISOString().split('T')[0],
        status: 'active'
      }))
    };

    // Agregar localmente a ventas en memoria
    dispatch({ type: 'ADD_SALE', payload: mockSale });

    // Guardar en cola local
    const queue = await storage.get('offline_sales_queue') || [];
    queue.push({ id: tempId, data: saleData });
    await storage.set('offline_sales_queue', queue);

    // Alerta al usuario
    Alert.alert(
      'Conexión caída',
      'Conexión caída. Trabajando de forma local.'
    );

    return mockSale;
  };

  // ─── Refresco del resumen diario ──────────────────────────
  const refreshSummary = useCallback(async () => {
    try {
      const summary = await api.get('/sales.php?summary=1');
      dispatch({ type: 'SET_DAILY_SUMMARY', payload: summary });
    } catch {}
  }, []);

  // ─── Carga completa: settings + juegos + ventas + resumen ─
  const loadAllData = useCallback(async (onProgress = null) => {
    const token = await storage.getSecure('rifas_token');
    if (!token) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });

    let completed = 0;
    const total = 4;
    const tick = (stepName) => {
      completed++;
      if (typeof onProgress === 'function') {
        onProgress(Math.round((completed / total) * 100), `Cargando ${stepName}...`);
      }
    };

    try {
      const pSales = api.get('/sales.php').then(res => { tick('ventas'); return res; });
      const pSummary = api.get('/sales.php?summary=1').then(res => { tick('resumen'); return res; });
      const pSettings = api.get('/settings.php').then(res => { tick('ajustes'); return res; });
      const pGames = api.get('/games.php').then(res => { tick('juegos'); return res; });

      const [salesRes, summaryRes, settingsRes, gamesRes] = await Promise.all([
        pSales,
        pSummary,
        pSettings,
        pGames,
      ]);

      // ── Juegos: aplicar configuraciones del servidor sobre los preset
      const gameConfigs = gamesRes.configs || {};
      setDynamicLotteries(gameConfigs);

      // ── Ventas
      dispatch({ type: 'LOAD_SALES', payload: salesRes.sales || [] });

      // ── Resumen
      dispatch({ type: 'SET_DAILY_SUMMARY', payload: summaryRes });

      // ── Settings: parsear todos los campos incluyendo appStatus/isBlocked
      const rawSettings = settingsRes.settings || {};
      dispatch({ type: 'SET_SETTINGS', payload: parseSettings(rawSettings) });

      // ── Loterías actualizadas tras setDynamicLotteries
      dispatch({ type: 'LOAD_LOTTERIES', payload: [...LOTTERY_LIST] });

      // Guardar settings en caché local por si la app va offline
      await storage.set('cached_settings', parseSettings(rawSettings));
    } catch (err) {
      console.warn('[AppContext] loadAllData error:', err.message);
      // Intentar cargar desde caché local si hay error de red
      const cached = await storage.get('cached_settings');
      if (cached) dispatch({ type: 'SET_SETTINGS', payload: cached });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // ─── Carga inicial al montar ──────────────────────────────
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ─── Auto-refresco cuando la app vuelve al primer plano ───
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadAllData();
      }
    });
    return () => sub.remove();
  }, [loadAllData]);

  // ─── Agregar venta ────────────────────────────────────────
  const addSale = useCallback(async (saleData) => {
    if (!isServerConnected) {
      return await handleOfflineSale(saleData);
    }

    try {
      const res = await api.post('/sales.php', saleData);
      setIsServerConnected(true);
      if (res.sales && Array.isArray(res.sales)) {
        res.sales.forEach(s => {
          dispatch({ type: 'ADD_SALE', payload: s });
        });
        await refreshSummary();
        return res;
      } else {
        const sale = res.sale;
        dispatch({ type: 'ADD_SALE', payload: sale });
        await refreshSummary();
        return sale;
      }
    } catch (err) {
      const isNetError = err.message && (
        err.message.includes('No se pudo establecer conexión') ||
        err.message.includes('Network') ||
        err.message.includes('network') ||
        err.message.includes('timeout')
      );
      if (isNetError) {
        setIsServerConnected(false);
        return await handleOfflineSale(saleData);
      } else {
        Alert.alert('Error de Venta', err.message);
        throw err;
      }
    }
  }, [refreshSummary, isServerConnected, user]);

  // ─── Anular venta ─────────────────────────────────────────
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

  // ─── Pagar premio ─────────────────────────────────────────
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

  // ─── Guardar ajustes ──────────────────────────────────────
  const updateSettings = useCallback(async (newSettings) => {
    try {
      const payload = {
        ...newSettings,
        autoprint:        String(newSettings.autoprint ?? true),
        drawCloseMinutes: String(newSettings.drawCloseMinutes ?? 10),
      };
      await api.put('/settings.php', payload);
      dispatch({ type: 'SET_SETTINGS', payload: newSettings });
      await storage.set('cached_settings', newSettings);
      Alert.alert('Ajustes Guardados', 'Los parámetros se actualizaron en el servidor.');
    } catch (err) {
      Alert.alert('Error al Guardar Ajustes', err.message);
    }
  }, []);

  // ─── Seleccionar lotería ──────────────────────────────────
  const selectLottery = useCallback((id) => {
    dispatch({ type: 'SELECT_LOTTERY', payload: id });
  }, []);

  // ─── Impresora Bluetooth ──────────────────────────────────
  const [printerDevice, setPrinterDevice] = useState(null);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerConnecting, setPrinterConnecting] = useState(false);

  const connectPrinter = useCallback(async () => {
    setPrinterConnecting(true);
    try {
      const dev = await svcConnect();
      setPrinterDevice(dev);
      setPrinterConnected(true);
      return dev;
    } catch (err) {
      setPrinterConnected(false);
      setPrinterDevice(null);
      throw err;
    } finally {
      setPrinterConnecting(false);
    }
  }, []);

  const disconnectPrinter = useCallback(() => {
    svcDisconnect();
    setPrinterConnected(false);
    setPrinterDevice(null);
  }, []);

  const printTicket = useCallback(async (sale) => {
    try {
      await svcPrintTicket(sale, state.settings);
    } catch (err) {
      Alert.alert('Error de Impresión', err.message);
      throw err;
    }
  }, [state.settings]);

  const printTestPage = useCallback(async () => {
    try {
      await svcTestPrint();
    } catch (err) {
      Alert.alert('Error de Impresión', err.message);
    }
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
        printerDevice,
        printerConnected,
        printerConnecting,
        connectPrinter,
        disconnectPrinter,
        printTicket,
        printTestPage,
        isServerConnected,
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
