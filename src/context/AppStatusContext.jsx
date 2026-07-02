// ============================================================
// AppStatusContext — estado de disponibilidad de la app
// Pollea cada 30s para detectar cambios del usuario root
// ============================================================
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, getToken } from '../services/apiService';

const AppStatusContext = createContext(null);

const POLL_INTERVAL_MS = 30_000; // 30 segundos

export const AppStatusProvider = ({ children }) => {
  const [appStatus, setAppStatus] = useState({
    status: 'active',
    disableAt: 'never',
    isBlocked: false,
    loading: true,
  });

  const timerRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    if (!getToken()) {
      setAppStatus((s) => ({ ...s, loading: false }));
      return;
    }
    try {
      // Usamos settings.php público (accesible a todos los roles autenticados)
      const { settings } = await api.get('/settings.php');
      const status    = settings.appStatus    ?? 'active';
      const disableAt = settings.appDisableAt ?? 'never';

      // Calcular si está bloqueada por timer expirado
      let isBlocked = status === 'disabled';
      if (!isBlocked && disableAt !== 'never') {
        const ts = new Date(disableAt).getTime();
        if (!isNaN(ts) && Date.now() >= ts) {
          isBlocked = true;
        }
      }

      setAppStatus({ status, disableAt, isBlocked, loading: false });
    } catch {
      // Si no se puede contactar la API, no bloqueamos
      setAppStatus((s) => ({ ...s, loading: false }));
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling periódico
  useEffect(() => {
    timerRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchStatus]);

  // Actualización inmediata de estado (usada por RootPanel tras guardar)
  const refreshStatus = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  // Expone también minutosRestantes si hay timer activo
  const minutesRemaining = (() => {
    if (appStatus.disableAt === 'never' || appStatus.status === 'disabled') return null;
    const ts = new Date(appStatus.disableAt).getTime();
    if (isNaN(ts)) return null;
    const diff = Math.ceil((ts - Date.now()) / 60_000);
    return diff > 0 ? diff : 0;
  })();

  return (
    <AppStatusContext.Provider value={{ ...appStatus, minutesRemaining, refreshStatus }}>
      {children}
    </AppStatusContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppStatus = () => {
  const ctx = useContext(AppStatusContext);
  if (!ctx) throw new Error('useAppStatus debe usarse dentro de AppStatusProvider');
  return ctx;
};
