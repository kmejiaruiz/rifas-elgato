// ============================================================
// Sistema de diálogos premium — reemplaza alert/confirm/prompt
// Uso: const { dialog } = useDialog();
//      await dialog.alert('Mensaje')
//      const ok = await dialog.confirm('¿Continuar?')
//      const val = await dialog.prompt('Nueva contraseña:')
// ============================================================
import { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, X, Info } from 'lucide-react';

const DialogContext = createContext(null);

// ─── Íconos y colores por tipo ────────────────────────────────
const TYPE_CONFIG = {
  info:    { Icon: Info,          color: 'var(--neon-blue)',   bg: 'rgba(96,165,250,0.12)'  },
  warning: { Icon: AlertTriangle, color: 'var(--neon-yellow)', bg: 'rgba(251,191,36,0.12)'  },
  danger:  { Icon: AlertTriangle, color: 'var(--neon-red)',    bg: 'rgba(248,113,113,0.12)' },
  success: { Icon: CheckCircle2,  color: 'var(--neon-green)',  bg: 'rgba(52,211,153,0.12)'  },
};

// ─── Componente de modal de diálogo ──────────────────────────
const DialogModal = ({
  type = 'info', title, message, mode,
  confirmLabel = 'Aceptar', cancelLabel = 'Cancelar',
  placeholder = '', onResolve,
}) => {
  const [inputValue, setInputValue] = useState('');
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const { Icon } = cfg;

  const handleConfirm = () => {
    if (mode === 'prompt') onResolve(inputValue);
    else onResolve(true);
  };
  const handleCancel = () => onResolve(mode === 'prompt' ? null : false);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && mode === 'alert' && onResolve(true)}
      style={{ zIndex: 1100 }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-sheet" style={{ maxWidth: 420 }}>
        <div className="modal-handle" />

        {/* Ícono + Título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={24} color={cfg.color} />
          </div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{title}</h2>
        </div>

        {/* Mensaje */}
        <p style={{
          fontSize: '0.92rem', color: 'var(--text-secondary)',
          lineHeight: 1.55, marginBottom: '1.25rem',
        }}>
          {message}
        </p>

        {/* Input para prompt */}
        {mode === 'prompt' && (
          <input
            className="form-control"
            type="password"
            autoFocus
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder || 'Escribe aquí...'}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            style={{ marginBottom: '1.25rem', fontSize: '1rem' }}
            id="dialog-prompt-input"
          />
        )}

        {/* Botones */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {mode !== 'alert' && (
            <button
              className="btn btn-secondary btn-full"
              onClick={handleCancel}
              id="dialog-cancel-btn"
              style={{ padding: '0.85rem' }}
            >
              <X size={16} /> {cancelLabel}
            </button>
          )}
          <button
            className={`btn btn-full ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirm}
            autoFocus={mode !== 'prompt'}
            id="dialog-confirm-btn"
            style={{ padding: '0.85rem' }}
          >
            <CheckCircle2 size={16} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Provider principal ───────────────────────────────────────
export const DialogProvider = ({ children }) => {
  const [dialogs, setDialogs] = useState([]);

  const open = useCallback((config) => {
    return new Promise((resolve) => {
      const id = Date.now();
      setDialogs((d) => [...d, { ...config, id, resolve }]);
    });
  }, []);

  const dialog = {
    alert: (message, { title = 'Aviso', type = 'info' } = {}) =>
      open({ type, title, message, mode: 'alert' }),
    confirm: (message, { title = '¿Confirmar?', type = 'warning', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' } = {}) =>
      open({ type, title, message, mode: 'confirm', confirmLabel, cancelLabel }),
    prompt: (message, { title = 'Ingresa un valor', placeholder = '', type = 'info', confirmLabel = 'Aceptar' } = {}) =>
      open({ type, title, message, mode: 'prompt', placeholder, confirmLabel }),
    danger: (message, options = {}) =>
      open({ type: 'danger', title: '¿Estás seguro?', confirmLabel: 'Eliminar', cancelLabel: 'Cancelar', ...options, message, mode: 'confirm' }),
  };

  return (
    <DialogContext.Provider value={{ dialog }}>
      {children}
      {dialogs.map((dlg) => (
        <DialogModal
          key={dlg.id}
          {...dlg}
          onResolve={(val) => {
            dlg.resolve(val);
            setDialogs((d) => d.filter((x) => x.id !== dlg.id));
          }}
        />
      ))}
    </DialogContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog debe usarse dentro de DialogProvider');
  return ctx;
};
