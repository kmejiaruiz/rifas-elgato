// ============================================================
// Contexto de impresora Bluetooth
// ============================================================
import { createContext, useContext, useReducer, useCallback } from 'react';
import {
  connectPrinter,
  disconnectPrinter,
  printTicket,
  printTestPage,
  isPrinterConnected,
  getConnectedDevice,
} from '../services/printerService';
import toast from 'react-hot-toast';

const initialState = {
  connected: false,
  device: null,        // { name, id }
  connecting: false,
  printing: false,
  error: null,
  lastPrinted: null,   // ID de última venta impresa
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'CONNECTING':
      return { ...state, connecting: true, error: null };
    case 'CONNECTED':
      return { ...state, connecting: false, connected: true, device: action.payload, error: null };
    case 'DISCONNECTED':
      return { ...state, connected: false, device: null, connecting: false };
    case 'CONNECT_ERROR':
      return { ...state, connecting: false, connected: false, error: action.payload };
    case 'PRINTING':
      return { ...state, printing: true };
    case 'PRINT_DONE':
      return { ...state, printing: false, lastPrinted: action.payload };
    case 'PRINT_ERROR':
      return { ...state, printing: false, error: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
};

const PrinterContext = createContext(null);

export const PrinterProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    connected: isPrinterConnected(),
    device: getConnectedDevice(),
  });

  const connect = useCallback(async () => {
    dispatch({ type: 'CONNECTING' });
    try {
      const device = await connectPrinter();
      dispatch({ type: 'CONNECTED', payload: device });
      toast.success(`Conectado a ${device.name}`);
      return device;
    } catch (err) {
      dispatch({ type: 'CONNECT_ERROR', payload: err.message });
      toast.error(err.message);
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectPrinter();
    dispatch({ type: 'DISCONNECTED' });
    toast.error('Impresora desconectada');
  }, []);

  const print = useCallback(async (sale, businessName) => {
    dispatch({ type: 'PRINTING' });
    try {
      await printTicket(sale, businessName);
      dispatch({ type: 'PRINT_DONE', payload: sale.id });
      toast.success('¡Boleto impreso!');
    } catch (err) {
      dispatch({ type: 'PRINT_ERROR', payload: err.message });
      toast.error(`Error al imprimir: ${err.message}`);
      throw err;
    }
  }, []);

  const testPrint = useCallback(async () => {
    dispatch({ type: 'PRINTING' });
    try {
      await printTestPage();
      dispatch({ type: 'PRINT_DONE', payload: 'test' });
      toast.success('Página de prueba enviada');
    } catch (err) {
      dispatch({ type: 'PRINT_ERROR', payload: err.message });
      toast.error(err.message);
    }
  }, []);

  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), []);

  return (
    <PrinterContext.Provider value={{ ...state, connect, disconnect, print, testPrint, clearError }}>
      {children}
    </PrinterContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePrinter = () => {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error('usePrinter debe usarse dentro de PrinterProvider');
  return ctx;
};
