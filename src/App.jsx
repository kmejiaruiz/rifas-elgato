// ─── App principal con autenticación y rutas por rol ─────────
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

NProgress.configure({ showSpinner: false });
import { Toaster } from 'react-hot-toast';
import { AppProvider, useApp } from './context/AppContext';
import { PrinterProvider } from './context/PrinterContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { can } from './utils/permissions';
import { PrinterStatus } from './components/printer/PrinterStatus';
import { Dashboard } from './pages/Dashboard';
import { SellTicket } from './pages/SellTicket';
import { SalesHistory } from './pages/SalesHistory';
import { Settings } from './pages/Settings';
import { AdminPanel } from './pages/AdminPanel';
import { LoginPage } from './pages/LoginPage';
import { DialogProvider } from './components/ui/DialogProvider';
import { WinnerNotification, NotificationPermissionBanner } from './components/ui/WinnerNotification';
import {
  LayoutDashboard, Ticket, ClipboardList,
  Settings as SettingsIcon, Shield, LogOut,
} from 'lucide-react';

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
  if (requiredPermission && !can(user, requiredPermission)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// ─── Shell de la app (post-login) ────────────────────────────
const AppShell = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
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
      {/* Header */}
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{pageTitle}</span>
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

      {/* Bottom Nav */}
      <nav className="bottom-nav" role="navigation" aria-label="Navegación principal">
        {NAV_ITEMS.map(({ path, label, Icon, exact }) => (
          <NavLink
            key={path}
            to={path}
            end={exact}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
            id={`nav-${label.toLowerCase().replace(' ', '-')}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

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
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/*" element={user ? <AppShell /> : <Navigate to="/login" replace />} />
    </Routes>
  );
};

// ─── AppLoader: carga datos completos cuando el usuario se autentica ─
const AppLoader = ({ children }) => {
  const { user } = useAuth();
  const { loadAllData } = useApp();

  // Cargar ventas, resumen y settings completos tras cada login
  useEffect(() => {
    if (user) loadAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return children;
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppProvider>
        <PrinterProvider>
          <DialogProvider>
            <AppLoader>
              <AuthRouter />
            </AppLoader>
          </DialogProvider>
        </PrinterProvider>
      </AppProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
