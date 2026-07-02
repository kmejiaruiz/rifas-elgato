// ============================================================
// AppBlockedModal — modal que bloquea la app a usuarios normales.
// Mensaje único, estático y profesional. No se puede cerrar.
// ============================================================
import { AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AppBlockedModal = () => {
  const { logout } = useAuth();
  return (
    <>
      <div
        id="app-blocked-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(10, 11, 20, 0.93)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          pointerEvents: 'all',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 380,
            background: 'linear-gradient(145deg, #12131f, #1a1b2e)',
            border: '1px solid rgba(239,68,68,0.28)',
            borderRadius: '20px',
            padding: '2.5rem 2rem',
            boxShadow: '0 0 60px rgba(239,68,68,0.1), 0 24px 48px rgba(0,0,0,0.6)',
            textAlign: 'center',
            userSelect: 'none',
            animation: 'blockModalIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275)',
            position: 'relative',
          }}
        >
          {/* Código de referencia — esquina superior derecha */}
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1.1rem',
            fontSize: '0.62rem',
            fontWeight: 700,
            color: 'rgba(248,113,113,0.5)',
            letterSpacing: '0.08em',
            fontFamily: '"Courier New", monospace',
          }}>
            [ERR-PARAM]
          </div>

          {/* Icono */}
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(239,68,68,0.1)',
            border: '2px solid rgba(239,68,68,0.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            animation: 'blockPulse 3s ease-in-out infinite',
          }}>
            <AlertTriangle size={32} color="#ef4444" />
          </div>

          {/* Título */}
          <h2 style={{
            fontSize: '1.2rem',
            fontWeight: 800,
            color: '#f1f5f9',
            marginBottom: '0.75rem',
            fontFamily: 'Outfit, sans-serif',
            letterSpacing: '-0.01em',
          }}>
            Error de Parametrización
          </h2>

          {/* Mensaje */}
          <p style={{
            fontSize: '0.88rem',
            color: 'rgba(241,245,249,0.5)',
            lineHeight: 1.7,
            marginBottom: '1.75rem',
          }}>
            La aplicación no está disponible en este momento.
            <br />
            Contacte al administrador del sistema para restablecer el servicio.
          </p>

          {/* Separador */}
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.25), transparent)',
            marginBottom: '1.25rem',
          }} />

          {/* Estado — estático */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '99px',
            padding: '0.4rem 1rem',
            fontSize: '0.72rem',
            color: '#f87171',
            fontWeight: 600,
            letterSpacing: '0.05em',
            marginBottom: '1.25rem',
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#ef4444',
              flexShrink: 0,
              animation: 'blockDot 2s ease-in-out infinite',
            }} />
            Servicio no disponible
          </div>

          {/* Separador inferior */}
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
            marginBottom: '1rem',
          }} />

          {/* Botón de cerrar sesión */}
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              color: 'rgba(241, 245, 249, 0.7)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = 'rgba(241, 245, 249, 0.7)';
            }}
          >
            <LogOut size={15} />
            Cerrar Sesión
          </button>
        </div>
      </div>

      <style>{`
        @keyframes blockModalIn {
          from { opacity: 0; transform: scale(0.88) translateY(18px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);     }
        }
        @keyframes blockPulse {
          0%, 100% { box-shadow: 0 0 0   0   rgba(239,68,68,0);    }
          50%       { box-shadow: 0 0 22px 6px rgba(239,68,68,0.15); }
        }
        @keyframes blockDot {
          0%, 100% { opacity: 1;   transform: scale(1);   }
          50%       { opacity: 0.3; transform: scale(0.65); }
        }
      `}</style>
    </>
  );
};
