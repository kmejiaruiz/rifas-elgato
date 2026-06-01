// ─── Modal de Confirmación de Venta ──────────────────────────
// Se muestra antes de confirmar cualquier boleto
import { getLotteryById, formatLotteryNumber } from '../../data/lotteryTypes';
import { CheckCircle2, X } from 'lucide-react';

export const ConfirmSaleModal = ({ ticketData, onConfirm, onCancel, loading }) => {
  if (!ticketData) return null;

  const lottery = getLotteryById(ticketData.lotteryId);
  if (!lottery) return null;

  const rows = [
    lottery.draws?.length && ticketData.sorteo && {
      label: 'Sorteo',
      value: lottery.draws.find((d) => d.value === ticketData.sorteo)?.label || ticketData.sorteo,
    },
    ticketData.numero !== undefined && ticketData.numero !== '' && {
      label: 'Número',
      value: formatLotteryNumber(ticketData.lotteryId, ticketData.numero),
      highlight: true,
    },
    ticketData.fecha && { label: 'Fecha', value: ticketData.fecha, highlight: true },
    ticketData.modalidad && { label: 'Modalidad', value: ticketData.modalidad.toUpperCase() },
    ticketData.serie && { label: 'Serie', value: ticketData.serie },
    ticketData.fraccion && { label: 'Fracción', value: ticketData.fraccion },
    ticketData.comprador && { label: 'Comprador', value: ticketData.comprador },
    {
      label: 'MONTO',
      value: `${lottery.priceLabel}${parseFloat(ticketData.monto || 0).toFixed(2)}`,
      highlight: true,
      big: true,
    },
  ].filter(Boolean);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar venta"
    >
      <div className="modal-sheet" style={{ maxHeight: '80dvh' }}>
        <div className="modal-handle" />

        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: lottery.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', flexShrink: 0,
          }}>
            {lottery.emoji}
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
              Confirmar venta
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{lottery.name}</h2>
          </div>
        </div>

        {/* Detalles del boleto */}
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          marginBottom: '1.25rem',
        }}>
          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: row.big ? '0.9rem 1rem' : '0.65rem 1rem',
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                background: row.big ? 'rgba(52,211,153,0.05)' : 'transparent',
              }}
            >
              <span style={{
                fontSize: row.big ? '0.85rem' : '0.82rem',
                fontWeight: row.big ? 700 : 500,
                color: row.big ? 'var(--text-primary)' : 'var(--text-secondary)',
                textTransform: row.big ? 'uppercase' : 'none',
                letterSpacing: row.big ? '0.05em' : 0,
              }}>
                {row.label}
              </span>
              <span style={{
                fontWeight: row.highlight ? 800 : 600,
                fontSize: row.big ? '1.3rem' : row.highlight ? '1.1rem' : '0.95rem',
                color: row.big
                  ? 'var(--neon-green)'
                  : row.highlight
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)',
                fontFamily: row.highlight ? "'Outfit', monospace" : undefined,
                letterSpacing: row.highlight ? '0.08em' : 0,
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Pregunta */}
        <p style={{
          textAlign: 'center',
          fontSize: '0.95rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.25rem',
        }}>
          ¿Deseas aplicar esta venta?
        </p>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary btn-full"
            onClick={onCancel}
            disabled={loading}
            id="cancel-sale-btn"
            style={{ padding: '0.9rem', fontSize: '0.95rem' }}
          >
            <X size={18} /> Cancelar
          </button>
          <button
            className="btn btn-primary btn-full"
            onClick={onConfirm}
            disabled={loading}
            id="confirm-sale-btn"
            style={{ padding: '0.9rem', fontSize: '0.95rem' }}
          >
            {loading
              ? <span className="spinner" style={{ width: 18, height: 18 }} />
              : <><CheckCircle2 size={18} /> Aplicar</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};
