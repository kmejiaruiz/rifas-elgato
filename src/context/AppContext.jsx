// ============================================================
// Contexto global de la app — ventas, resumen del día, settings
// ============================================================
import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import {
  getAllSales,
  saveSale,
  cancelSale,
  paySalePrize as apiPaySalePrize,
  getDailySummary,
  getSettings,
  saveSettings,
} from '../services/storageService';
import toast from 'react-hot-toast';
import { LOTTERY_LIST, setDynamicLotteries } from '../data/lotteryTypes';
import { getGameConfigs } from '../services/gameService';

// ─── Estado inicial ──────────────────────────────────────────
const initialState = {
  sales: [],
  dailySummary: { total: 0, count: 0, byType: {}, cancelled: 0 },
  settings: {
    businessName: 'Rifas Express',
    printerName: null,
    currency: '₡',
    autoprint: true,
    drawCloseMinutes: 10,
  },
  loading: true,
  selectedLotteryId: null,
  lotteries: LOTTERY_LIST,
};

// ─── Reducer ─────────────────────────────────────────────────
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
    case 'REMOVE_SALE':
      return { ...state, sales: state.sales.filter((s) => s.id !== action.payload) };
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

// ─── Contexto ────────────────────────────────────────────────
const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Carga inicial — solo cuando hay sesión activa
  useEffect(() => {
    const init = async () => {
      const { getToken } = await import('../services/apiService');
      if (!getToken()) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      try {
        const [sales, summary, settings, gameConfigs] = await Promise.all([
          getAllSales(),
          getDailySummary(),
          getSettings(),
          getGameConfigs(),
        ]);
        setDynamicLotteries(gameConfigs);
        dispatch({ type: 'LOAD_SALES', payload: sales });
        dispatch({ type: 'SET_DAILY_SUMMARY', payload: summary });
        dispatch({ type: 'SET_SETTINGS', payload: settings });
        dispatch({ type: 'LOAD_LOTTERIES', payload: [...LOTTERY_LIST] });
      } catch (err) {
        // Los errores 401 ya son manejados por apiService (evento session-expired)
        // Solo logueamos errores que no sean de auth
        if (!err.message?.includes('expirada') && !err.message?.includes('autenticado')) {
          console.error('[AppContext] Error al cargar datos:', err);
        }
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    init();
  }, []);

  // Refresca el resumen del día — solo si hay token activo
  const refreshSummary = useCallback(async () => {
    const { getToken } = await import('../services/apiService');
    if (!getToken()) return;
    try {
      const summary = await getDailySummary();
      dispatch({ type: 'SET_DAILY_SUMMARY', payload: summary });
    } catch { /* Silencioso: el auth context ya maneja 401 */ }
  }, []);

  // Carga completa de datos (llamado desde AppLoader tras login)
  const loadAllData = useCallback(async () => {
    const { getToken } = await import('../services/apiService');
    if (!getToken()) return;
    try {
      const [sales, summary, settings, gameConfigs] = await Promise.all([
        getAllSales(), getDailySummary(), getSettings(), getGameConfigs(),
      ]);
      setDynamicLotteries(gameConfigs);
      dispatch({ type: 'LOAD_SALES', payload: sales });
      dispatch({ type: 'SET_DAILY_SUMMARY', payload: summary });
      dispatch({ type: 'SET_SETTINGS', payload: settings });
      dispatch({ type: 'LOAD_LOTTERIES', payload: [...LOTTERY_LIST] });
    } catch (err) {
      console.error('[AppContext] loadAllData:', err);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Acciones
  const addSale = useCallback(async (saleData) => {
    try {
      const saved = await saveSale(saleData);
      dispatch({ type: 'ADD_SALE', payload: saved });
      refreshSummary();
      return saved;
    } catch (err) {
      throw err;
    }
  }, [refreshSummary]);

  const annulSale = useCallback(async (id, adminCreds = null) => {
    try {
      const updated = await cancelSale(id, adminCreds);
      dispatch({ type: 'UPDATE_SALE', payload: updated });
      await refreshSummary();
      toast.success('Venta anulada');
      return updated;
    } catch (err) {
      toast.error(err.message || 'Error al anular la venta');
      throw err;
    }
  }, [refreshSummary]);

  // En la API MySQL no se eliminan ventas, solo se anulan
  const removeSale = useCallback(async (id) => {
    try {
      const updated = await cancelSale(id);
      dispatch({ type: 'UPDATE_SALE', payload: updated });
      await refreshSummary();
      toast.success('Venta anulada');
    } catch (err) {
      toast.error(err.message || 'Error al anular la venta');
      throw err;
    }
  }, [refreshSummary]);

  const paySalePrize = useCallback(async (id) => {
    try {
      const updated = await apiPaySalePrize(id);
      dispatch({ type: 'UPDATE_SALE', payload: updated });
      await refreshSummary();
      toast.success('Premio pagado');
      return updated;
    } catch (err) {
      toast.error(err.message || 'Error al pagar el premio');
      throw err;
    }
  }, [refreshSummary]);

  const updateSettings = useCallback(async (newSettings) => {
    await saveSettings(newSettings);
    dispatch({ type: 'SET_SETTINGS', payload: newSettings });
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
        removeSale,
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

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
};
