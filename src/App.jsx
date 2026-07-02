// ─── App principal con autenticación y rutas por rol ─────────
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

NProgress.configure({ showSpinner: false });
import toast, { Toaster } from 'react-hot-toast';
import { api } from './services/apiService';
import { AppProvider, useApp } from './context/AppContext';
import { PrinterProvider } from './context/PrinterContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppStatusProvider, useAppStatus } from './context/AppStatusContext';
import { can } from './utils/permissions';
import { PrinterStatus } from './components/printer/PrinterStatus';
import { AppBlockedModal } from './components/ui/AppBlockedModal';
import { Dashboard } from './pages/Dashboard';
import { SellTicket } from './pages/SellTicket';
import { SalesHistory } from './pages/SalesHistory';
import { Settings } from './pages/Settings';
import { AdminPanel } from './pages/AdminPanel';
import { LoginPage } from './pages/LoginPage';
import { RootPanel } from './pages/RootPanel';
import { DialogProvider } from './components/ui/DialogProvider';
import { WinnerNotification, NotificationPermissionBanner } from './components/ui/WinnerNotification';
import {
  LayoutDashboard, Ticket, ClipboardList,
  Settings as SettingsIcon, Shield, LogOut,
} from 'lucide-react';

// ─── Reloj en tiempo real (solo PC) ─────────────────────────
const HeaderClock = () => {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  });

  useEffect(() => {
    const tick = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  return (
    <span className="header-clock-badge" title="Hora actual">
      {time}
    </span>
  );
};

// ─── Ruta protegida ──────────────────────────────────────────
const ProtectedRoute = ({ children, requiredPermission }) => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      NProgress.start();
    } else {
      NProgress.done();
    }
    return () => {
      NProgress.done();
    };
  }, [loading]);

  if (loading) return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)',
    }}>
      <span className="loading-text">Cargando...</span>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  // Root nunca accede a rutas normales — solo a /root
  if (user.role === 'root') return <Navigate to="/root" replace />;
  if (requiredPermission && !can(user, requiredPermission)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// ─── Shell de la app (post-login, usuarios normales) ─────────
const AppShell = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isBlocked } = useAppStatus();
  const isAdmin = user?.role === 'admin';

  const NAV_ITEMS = [
    { path: '/', label: 'Inicio', Icon: LayoutDashboard, exact: true },
    { path: '/sell', label: 'Vender', Icon: Ticket },
    { path: '/history', label: 'Historial', Icon: ClipboardList },
    ...(isAdmin ? [{ path: '/admin', label: 'Admin', Icon: Shield }] : []),
    ...(can(user, 'settings') ? [{ path: '/settings', label: 'Config', Icon: SettingsIcon }] : []),
  ];

  const pageTitles = {
    '/': 'Inicio',
    '/sell': 'Vender Boleto',
    '/history': 'Historial',
    '/admin': 'Panel Admin',
    '/settings': 'Configuración',
  };

  const pageTitle = pageTitles[location.pathname] || 'Rifas';

  return (
    <div className="app-shell">
      <PendingPaymentsAlert />
      {/* Navigation (Sidebar on PC, Bottom Nav on Mobile) */}
      <nav className="bottom-nav" role="navigation" aria-label="Navegación principal">
        {/* Brand — only visible on desktop sidebar */}
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">🎫</span>
          <span className="sidebar-brand-name">Amaranto</span>
        </div>

        {/* Nav divider label — only on desktop */}
        <span className="sidebar-section-label">Menú</span>

        {NAV_ITEMS.map(({ path, label, Icon, exact }) => (
          <NavLink
            key={path}
            to={path}
            end={exact}
            title={label}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
            id={`nav-${label.toLowerCase().replace(' ', '-')}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Main Content Wrapper */}
      <div className="main-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        {/* Header */}
        <header className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>{pageTitle}</span>
            {user && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                borderRadius: '99px', textTransform: 'uppercase', letterSpacing: '0.06em',
                background: user.role === 'admin' ? 'rgba(168,85,247,0.15)' : 'rgba(96,165,250,0.1)',
                color: user.role === 'admin' ? 'var(--neon-purple)' : 'var(--neon-blue)',
                border: `1px solid ${user.role === 'admin' ? 'rgba(168,85,247,0.3)' : 'rgba(96,165,250,0.2)'}`,
              }}>
                {user.role === 'admin' ? '[Admin]' : '[Vendedor]'} {user.name}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <HeaderClock />
            <PrinterStatus />
            <button
              className="btn btn-ghost btn-icon"
              onClick={logout}
              title="Cerrar sesión"
              id="logout-btn"
              style={{ padding: '0.5rem' }}
            >
              <LogOut size={18} color="var(--text-muted)" />
            </button>
          </div>
        </header>

        {/* Banner de permisos de notificación */}
        <NotificationPermissionBanner />

        {/* Contenido */}
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/sell" element={<ProtectedRoute requiredPermission="sell"><SellTicket /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute requiredPermission="viewHistory"><SalesHistory /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requiredPermission="manageGames"><AdminPanel /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredPermission="settings"><Settings /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1f2444',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 600,
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#1f2444' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#1f2444' } },
        }}
      />
      {/* Notificaciones de boleto ganador */}
      <WinnerNotification />

      {/* Modal de bloqueo — se superpone sobre todo cuando root desactiva la app */}
      {isBlocked && <AppBlockedModal />}
    </div>
  );
};

// ─── Router raíz con lógica de auth ──────────────────────────
const AuthRouter = () => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      NProgress.start();
    } else {
      NProgress.done();
    }
    return () => {
      NProgress.done();
    };
  }, [loading]);

  if (loading) return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <span className="loading-text">Cargando...</span>
      </div>
    </div>
  );

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user
            ? (user.role === 'root' ? <Navigate to="/root" replace /> : <Navigate to="/" replace />)
            : <LoginPage />
        }
      />
      {/* Ruta exclusiva root */}
      <Route
        path="/root"
        element={
          !user ? <Navigate to="/login" replace /> :
          user.role !== 'root' ? <Navigate to="/" replace /> :
          <RootPanel />
        }
      />
      <Route
        path="/*"
        element={
          user
            ? (user.role === 'root' ? <Navigate to="/root" replace /> : <AppShell />)
            : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
};

// ─── AppLoader: carga datos completos cuando el usuario se autentica ─
const AppLoader = ({ children }) => {
  const { user } = useAuth();
  const { loadAllData } = useApp();

  // Cargar ventas, resumen y settings completos tras cada login (solo usuarios normales)
  useEffect(() => {
    if (user && user.role !== 'root') loadAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Polling de notificaciones para administrador (pagos de boletos)
  useEffect(() => {
    let intervalId = null;

    const checkNotifications = async () => {
      try {
        const res = await api.get('/notifications.php');
        if (res && res.notifications && res.notifications.length > 0) {
          res.notifications.forEach((n) => {
            toast(n.message, {
              icon: '💰',
              duration: 8000,
            });
          });
        }
      } catch (err) {
        console.warn('Error fetching notifications:', err.message);
      }
    };

    if (user && user.role === 'admin') {
      checkNotifications();
      intervalId = setInterval(checkNotifications, 12000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  return children;
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppProvider>
        <AppStatusProvider>
          <PrinterProvider>
            <DialogProvider>
              <AppLoader>
                <AuthRouter />
              </AppLoader>
            </DialogProvider>
          </PrinterProvider>
        </AppStatusProvider>
      </AppProvider>
    </AuthProvider>
  </BrowserRouter>
);

const PendingPaymentsAlert = () => {
  const { user } = useAuth();
  const [pending, setPending] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'vendedor') return;

    const checkPending = async () => {
      try {
        const res = await api.get('/users.php?pending_pay=1');
        if (res && res.pendingPayments && res.pendingPayments.length > 0) {
          setPending(res.pendingPayments[0]);
        } else {
          setPending(null);
        }
      } catch (err) {
        console.warn('Error checking pending payments:', err.message);
      }
    };

    checkPending();
    const interval = setInterval(checkPending, 15000);
    return () => clearInterval(interval);
  }, [user]);

  if (!pending) return null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await api.post('/users.php?confirm_pay=1', { paymentId: pending.id });
      toast.success('Pago de salario confirmado y registrado con éxito.');
      setPending(null);
    } catch (err) {
      toast.error(err.message || 'No se pudo confirmar el pago.');
    } finally {
      setConfirming(false);
    }
  };

  const formatDrawDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 99999,
      backdropFilter: 'blur(8px)', padding: '1rem'
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '16px', maxWidth: '450px', width: '100%',
        padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        position: 'relative'
      }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>💸</span> Confirmación de Pago
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          El administrador ha solicitado registrar un pago de nómina para tu usuario. Por favor, verifica y confirma el recibido.
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '0.85rem 1rem', fontSize: '0.78rem',
          display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Solicitado por:</span>
            <span style={{ fontWeight: 700, color: '#fff' }}>{pending.created_by_name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Período:</span>
            <span style={{ fontWeight: 700, color: '#fff' }}>{formatDrawDate(pending.start_date)} al {formatDrawDate(pending.end_date)}</span>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Ventas Totales:</span>
            <span style={{ fontWeight: 700 }}>NIO {Number(pending.total_sold).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Premios Pagados:</span>
            <span style={{ fontWeight: 700, color: pending.prizes_total > 0 ? '#f59e0b' : 'var(--text-base)' }}>NIO {Number(pending.prizes_total).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Comisión:</span>
            <span style={{ fontWeight: 700, color: 'var(--neon-blue)' }}>NIO {Number(pending.commission_amount).toFixed(2)}</span>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span style={{ fontWeight: 800, color: '#fff' }}>Neto a Recibir:</span>
            <span style={{ fontWeight: 800, color: 'var(--neon-green)' }}>NIO {Number(pending.net_salary).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span>Solicitud creada:</span>
            <span>{new Date(pending.paid_at).toLocaleString('es-NI')}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setPending(null)}
            disabled={confirming}
            style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}
          >
            Aún no
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={confirming}
            style={{ padding: '0.5rem 1.2rem', fontSize: '0.75rem' }}
          >
            {confirming ? 'Confirmando...' : 'Confirmar Recibido'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
