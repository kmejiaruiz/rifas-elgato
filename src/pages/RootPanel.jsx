// ============================================================
// RootPanel — Panel de control exclusivo para el usuario root
// Permite gestionar la disponibilidad de la aplicación.
// La acción "Reactivar" requiere confirmar credenciales root.
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppStatus } from '../context/AppStatusContext';
import { api } from '../services/apiService';
import {
  ShieldAlert, Power, Clock, CheckCircle2,
  AlertTriangle, RefreshCw, LogOut, Activity,
  Eye, EyeOff, User, Lock, XCircle, Server, Wifi, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Modal de confirmación de credenciales root ───────────────
const RootCredentialsModal = ({ onConfirm, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [insufficientPerms, setInsufficientPerms] = useState(false);
  const usernameRef = useRef(null);

  useEffect(() => {
    setTimeout(() => usernameRef.current?.focus(), 80);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Ingresa usuario y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Verifica credenciales sin crear sesión — POST /root.php
      const { role } = await api.post('/root.php', { username, password });
      if (role !== 'root') {
        // Credenciales válidas pero NO son root
        setInsufficientPerms(true);
        setLoading(false);
        return;
      }
      // Credenciales root correctas → proceder
      onConfirm();
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas.');
      setLoading(false);
    }
  };

  // Modal "Permisos insuficientes" (cuando se ingresan credenciales de otro rol)
  if (insufficientPerms) {
    return (
      <div style={overlayStyle}>
        <div style={{ ...modalStyle, borderColor: 'rgba(251,191,36,0.35)', boxShadow: '0 0 50px rgba(251,191,36,0.1), 0 20px 40px rgba(0,0,0,0.6)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(251,191,36,0.1)',
              border: '2px solid rgba(251,191,36,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}>
              <ShieldAlert size={28} color="#fbbf24" />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.6rem' }}>
              Permisos Insuficientes
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(241,245,249,0.55)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Las credenciales ingresadas pertenecen a un rol sin autorización para realizar esta operación.
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
              borderRadius: '8px', padding: '0.45rem 0.85rem',
              fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700,
              letterSpacing: '0.06em', marginBottom: '1.5rem',
              fontFamily: '"Courier New", monospace',
            }}>
              [ERR-AUTH-403] ROLE_INSUFFICIENT
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                id="perm-close-btn"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                id="perm-retry-btn"
                className="btn"
                style={{
                  flex: 1,
                  background: 'rgba(251,191,36,0.1)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  color: '#fbbf24', fontWeight: 700,
                }}
                onClick={() => { setInsufficientPerms(false); setUsername(''); setPassword(''); }}
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '10px',
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock size={16} color="#34d399" />
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f1f5f9' }}>Confirmar Identidad</p>
              <p style={{ fontSize: '0.72rem', color: 'rgba(241,245,249,0.4)', marginTop: '1px' }}>
                Se requieren credenciales root
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            id="root-creds-close-btn"
            style={{ padding: '0.35rem' }}
          >
            <XCircle size={18} color="var(--text-muted)" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Usuario */}
          <div className="form-group">
            <label htmlFor="root-confirm-user">Usuario root</label>
            <div style={{ position: 'relative' }}>
              <User size={14} color="var(--text-muted)" style={{
                position: 'absolute', left: '0.75rem', top: '50%',
                transform: 'translateY(-50%)', pointerEvents: 'none',
              }} />
              <input
                id="root-confirm-user"
                ref={usernameRef}
                className="form-control"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="root"
                autoComplete="username"
                style={{ paddingLeft: '2.25rem', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          {/* Contraseña */}
          <div className="form-group">
            <label htmlFor="root-confirm-pass">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={14} color="var(--text-muted)" style={{
                position: 'absolute', left: '0.75rem', top: '50%',
                transform: 'translateY(-50%)', pointerEvents: 'none',
              }} />
              <input
                id="root-confirm-pass"
                className="form-control"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ paddingLeft: '2.25rem', paddingRight: '2.75rem', fontSize: '0.9rem' }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setShowPass((v) => !v)}
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', padding: '0.35rem' }}
                aria-label="Ver contraseña"
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: '10px', padding: '0.6rem 0.85rem',
              color: '#f87171', fontSize: '0.8rem',
              display: 'flex', alignItems: 'center', gap: '0.45rem',
            }}>
              <AlertTriangle size={13} />
              {error}
            </div>
          )}

          {/* Botones */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              id="root-confirm-submit-btn"
              type="submit"
              className="btn"
              disabled={loading}
              style={{
                flex: 1,
                background: loading ? 'rgba(52,211,153,0.05)' : 'rgba(52,211,153,0.1)',
                border: '1px solid rgba(52,211,153,0.3)',
                color: '#34d399', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? <><span className="spinner" style={{ width: 15, height: 15, borderTopColor: '#34d399', borderColor: 'rgba(52,211,153,0.2)' }} /> Verificando...</> : <><CheckCircle2 size={16} /> Confirmar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 10000,
  background: 'rgba(10,11,20,0.75)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1.5rem',
  animation: 'rootModalFadeIn 0.2s ease',
};

const modalStyle = {
  width: '100%', maxWidth: 360,
  background: 'linear-gradient(145deg, #12131f, #1a1b2e)',
  border: '1px solid rgba(52,211,153,0.25)',
  borderRadius: '18px',
  padding: '1.75rem 1.5rem',
  boxShadow: '0 0 50px rgba(52,211,153,0.08), 0 20px 40px rgba(0,0,0,0.6)',
  animation: 'rootModalSlideIn 0.3s cubic-bezier(0.175,0.885,0.32,1.275)',
};

// ─── Panel Principal ──────────────────────────────────────────
export const RootPanel = () => {
  const { user, logout } = useAuth();
  const { status, disableAt, isBlocked, minutesRemaining, refreshStatus } = useAppStatus();
  const [minutes, setMinutes] = useState('');
  const [loading, setLoading] = useState(false);
  const [localTime, setLocalTime] = useState(new Date());
  const [showCredModal, setShowCredModal] = useState(false);

  // Estados añadidos
  const [activeTab, setActiveTab] = useState('status'); // 'status' | 'server' | 'security'
  const [bypassCode, setBypassCode] = useState('');

  // Reloj en tiempo real
  useEffect(() => {
    const iv = setInterval(() => setLocalTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Cargar configuraciones de bypassCode
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get('/settings.php');
        if (res && res.settings) {
          setBypassCode(res.settings.bypassCode || '1005199611712301977');
        }
      } catch (err) {
        console.error('Error al cargar ajustes en panel root:', err);
      }
    };
    loadSettings();
  }, []);

  const handleSaveBypassCode = async (e) => {
    e.preventDefault();
    if (!bypassCode.trim()) {
      toast.error('Ingresa un código de recuperación válido.');
      return;
    }
    setLoading(true);
    try {
      await api.put('/settings.php', { bypassCode: bypassCode.trim() });
      toast.success('Código de recuperación actualizado.');
    } catch (err) {
      toast.error('Error al guardar el código: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const doAction = async (action, extraData = {}) => {
    setLoading(true);
    try {
      await api.put('/root.php', { action, ...extraData });
      await refreshStatus();
      const messages = {
        disable:  'Aplicación desactivada correctamente.',
        restore:  'Aplicación reactivada correctamente.',
        schedule: `Desactivación programada en ${extraData.minutes} minuto(s).`,
      };
      toast.success(messages[action] || 'Operación realizada.');
    } catch (err) {
      toast.error(err.message || 'Error al actualizar el estado.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = () => {
    // Abrir modal de confirmación de credenciales
    setShowCredModal(true);
  };

  const handleRestoreConfirmed = () => {
    setShowCredModal(false);
    doAction('restore');
  };

  const handleSchedule = () => {
    const mins = parseInt(minutes, 10);
    if (!mins || mins <= 0) {
      toast.error('Ingresa un número de minutos válido (mayor a 0).');
      return;
    }
    doAction('schedule', { minutes: mins });
    setMinutes('');
  };

  // Colores y etiquetas según estado
  const statusConfig = {
    active: {
      color: '#34d399', bg: 'rgba(52,211,153,0.1)',
      border: 'rgba(52,211,153,0.25)', label: 'Activa', icon: <CheckCircle2 size={16} />,
    },
    disabled: {
      color: '#f87171', bg: 'rgba(248,113,113,0.1)',
      border: 'rgba(248,113,113,0.25)', label: 'Desactivada', icon: <AlertTriangle size={16} />,
    },
  };

  const sc = statusConfig[isBlocked ? 'disabled' : status] ?? statusConfig.active;
  const hasTimer = disableAt !== 'never' && !isBlocked;

  const formatDisableAt = (dt) => {
    if (!dt || dt === 'never') return null;
    try {
      return new Date(dt).toLocaleString('es-NI', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return dt; }
  };

  return (
    <>
      {/* Animaciones del modal de credenciales */}
      <style>{`
        @keyframes rootModalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes rootModalSlideIn {
          from { opacity: 0; transform: scale(0.88) translateY(16px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);     }
        }

        /* Grid del Panel Root en PC */
        .root-grid-container {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.25rem;
          width: 100%;
        }
        @media (min-width: 768px) {
          .root-grid-container {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

      <div style={{
        minHeight: '100dvh',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Outfit, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Fondo decorativo */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-15%',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', left: '-10%',
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <header style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(18,19,31,0.8)',
          backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldAlert size={20} color="#ef4444" />
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#f1f5f9' }}>
              Panel Root
            </span>
            <span style={{
              fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.5rem',
              borderRadius: '99px', textTransform: 'uppercase',
              background: 'rgba(239,68,68,0.12)', color: '#f87171',
              border: '1px solid rgba(239,68,68,0.25)',
            }}>
              {user?.name}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {localTime.toLocaleTimeString('es-NI')}
            </span>
            <button
              className="btn btn-ghost btn-icon"
              onClick={logout}
              title="Cerrar sesión"
              id="root-logout-btn"
              style={{ padding: '0.5rem' }}
            >
              <LogOut size={18} color="var(--text-muted)" />
            </button>
          </div>
        </header>

        {/* Selector de pestañas */}
        <div style={{
          display: 'flex',
          gap: '0.25rem',
          maxWidth: activeTab === 'security' ? 480 : 800,
          margin: '1.5rem auto 0',
          width: '100%',
          padding: '0 1.25rem',
          borderBottom: '1px solid var(--border)',
          justifyContent: 'flex-start',
          zIndex: 10,
        }}>
          {[
            { id: 'status', label: 'Estado' },
            { id: 'server', label: 'Servidor' },
            { id: 'security', label: 'Seguridad' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: `2.5px solid ${activeTab === t.id ? 'var(--primary)' : 'transparent'}`,
                padding: '0.75rem 1.25rem',
                color: activeTab === t.id ? 'var(--primary-light)' : 'var(--text-muted)',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <main style={{ flex: 1, padding: '1.5rem 1.25rem', maxWidth: activeTab === 'security' ? 480 : 800, margin: '0 auto', width: '100%' }}>

          {/* ─── PESTAÑA: ESTADO DE LA APP ───────────────────────── */}
          {activeTab === 'status' && (
            <div className="root-grid-container">
              {/* Columna Izquierda: Estado actual */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <section style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${sc.border}`,
                  borderRadius: '16px', padding: '1.5rem',
                  boxShadow: `0 0 30px ${sc.bg}`, transition: 'all 0.4s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Activity size={16} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Estado de la Aplicación
                      </span>
                    </div>
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={refreshStatus}
                      title="Actualizar estado"
                      id="root-refresh-btn"
                      style={{ padding: '0.35rem' }}
                    >
                      <RefreshCw size={14} color="var(--text-muted)" />
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: sc.bg, border: `2px solid ${sc.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{ color: sc.color, display: 'flex' }}>{sc.icon}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: '1.4rem', fontWeight: 900, color: sc.color, lineHeight: 1 }}>
                        {sc.label}
                      </p>
                      {hasTimer && (
                        <p style={{ fontSize: '0.78rem', color: '#fbbf24', marginTop: '0.3rem', fontWeight: 600 }}>
                          ⏱ Se desactivará: {formatDisableAt(disableAt)}
                          {minutesRemaining !== null && ` (~${minutesRemaining} min)`}
                        </p>
                      )}
                      {!hasTimer && !isBlocked && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                          Sin restricciones de tiempo
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                {/* Aviso cuando está desactivada */}
                {isBlocked && (
                  <div style={{
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '12px', padding: '1rem', fontSize: '0.82rem', color: '#f87171',
                    lineHeight: 1.6, textAlign: 'center',
                  }}>
                    <AlertTriangle size={16} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
                    Todos los usuarios ven el modal de error. La app se reactivará solo cuando
                    presiones <strong>«Reactivar aplicación»</strong> y confirmes tus credenciales root.
                  </div>
                )}
              </div>

              {/* Columna Derecha: Acciones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <section style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: '16px', padding: '1.5rem',
                }}>
                  <h3 style={{
                    fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.25rem',
                  }}>
                    Control de Disponibilidad
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {!isBlocked && (
                      <button
                        id="root-disable-btn"
                        className="btn"
                        disabled={loading}
                        onClick={() => doAction('disable')}
                        style={{
                          padding: '0.85rem 1rem',
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: '12px', color: '#f87171', fontWeight: 700, fontSize: '0.9rem',
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                        }}
                      >
                        <Power size={18} />
                        Desactivar aplicación ahora
                      </button>
                    )}

                    {isBlocked && (
                      <button
                        id="root-restore-btn"
                        className="btn"
                        disabled={loading}
                        onClick={handleRestore}
                        style={{
                          padding: '0.85rem 1rem',
                          background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)',
                          borderRadius: '12px', color: '#34d399', fontWeight: 700, fontSize: '0.9rem',
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                        }}
                      >
                        <CheckCircle2 size={18} />
                        Reactivar aplicación
                        <span style={{ fontSize: '0.68rem', opacity: 0.7, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Lock size={11} /> requiere credenciales
                        </span>
                      </button>
                    )}

                    {hasTimer && (
                      <button
                        id="root-cancel-timer-btn"
                        className="btn"
                        disabled={loading}
                        onClick={handleRestore}
                        style={{
                          padding: '0.85rem 1rem',
                          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
                          borderRadius: '12px', color: '#fbbf24', fontWeight: 700, fontSize: '0.9rem',
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <RefreshCw size={18} />
                        Cancelar temporizador
                        <span style={{ fontSize: '0.68rem', opacity: 0.7, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Lock size={11} /> requiere credenciales
                        </span>
                      </button>
                    )}
                  </div>
                </section>

                {!isBlocked && (
                  <section style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: '16px', padding: '1.5rem',
                  }}>
                    <h3 style={{
                      fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem',
                    }}>
                      Programar Desactivación
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                      La app seguirá funcionando hasta que expire el tiempo. Al vencer, los usuarios verán una notificación de error y no podrán operar.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label htmlFor="root-minutes-input" style={{ fontSize: '0.78rem' }}>
                          Minutos antes de desactivar
                        </label>
                        <div style={{ position: 'relative' }}>
                          <Clock size={14} color="var(--text-muted)" style={{
                            position: 'absolute', left: '0.75rem', top: '50%',
                            transform: 'translateY(-50%)', pointerEvents: 'none',
                          }} />
                          <input
                            id="root-minutes-input"
                            className="form-control"
                            type="number"
                            min="1"
                            max="9999"
                            value={minutes}
                            onChange={(e) => setMinutes(e.target.value)}
                            placeholder="ej: 30"
                            style={{ paddingLeft: '2.25rem', fontSize: '0.9rem' }}
                            onKeyDown={(e) => e.key === 'Enter' && handleSchedule()}
                          />
                        </div>
                      </div>
                      <button
                        id="root-schedule-btn"
                        className="btn"
                        disabled={loading || !minutes}
                        onClick={handleSchedule}
                        style={{
                          padding: '0.75rem 1.1rem',
                          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                          borderRadius: '12px', color: '#fbbf24', fontWeight: 700, fontSize: '0.85rem',
                          whiteSpace: 'nowrap', cursor: (loading || !minutes) ? 'not-allowed' : 'pointer',
                          flexShrink: 0, marginBottom: 0, alignSelf: 'flex-end',
                        }}
                      >
                        Programar
                      </button>
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}

          {/* ─── PESTAÑA: CONFIGURACIÓN DEL SERVIDOR API ─────────── */}
          {activeTab === 'server' && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <Server size={18} color="var(--primary-light)" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase', margin: 0 }}>
                  Servidor de API Detectado
                </h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                En la plataforma web, el backend y el frontend se ejecutan bajo el mismo dominio de forma automática e integrada.
              </p>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Origen de la API</label>
                <input
                  className="form-control"
                  type="text"
                  value={window.location.origin + '/api'}
                  readOnly
                  style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--primary-light)', cursor: 'default', fontWeight: 700 }}
                />
              </div>
            </div>
          )}

          {/* ─── PESTAÑA: CÓDIGO DE RECUPERACIÓN ─────────────────── */}
          {activeTab === 'security' && (
            <form onSubmit={handleSaveBypassCode} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <Lock size={18} color="var(--primary-light)" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase', margin: 0 }}>
                  Código de Recuperación
                </h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                Código secreto utilizado para desbloquear la configuración de red en la pantalla de inicio de sesión de la aplicación móvil.
              </p>

              <div className="form-group">
                <label htmlFor="root-bypass-code">Código Secreto</label>
                <input
                  id="root-bypass-code"
                  className="form-control"
                  type="text"
                  value={bypassCode}
                  onChange={(e) => setBypassCode(e.target.value)}
                  placeholder="1005199611712301977"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn"
                disabled={loading}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  background: 'var(--primary)',
                  border: '1px solid var(--primary-light)',
                  color: '#fff',
                  borderRadius: '12px',
                  fontWeight: 700,
                  marginTop: '0.5rem',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                <Save size={16} />
                {loading ? 'Guardando...' : 'Guardar Código'}
              </button>
            </form>
          )}
        </main>
      </div>

      {/* Modal de credenciales root */}
      {showCredModal && (
        <RootCredentialsModal
          onConfirm={handleRestoreConfirmed}
          onClose={() => setShowCredModal(false)}
        />
      )}
    </>
  );
};
