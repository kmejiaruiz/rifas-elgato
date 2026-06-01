// ─── Componente: TicketForm ───────────────────────────────────
// Formulario dinámico que se adapta al tipo de rifa seleccionado
import { useState, useEffect } from 'react';
import { getLotteryById, validateTicket } from '../../data/lotteryTypes';

const EMPTY_FORM = {};

export const TicketForm = ({ lotteryId, onSubmit, loading }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [sorteo, setSorteo] = useState('');
  const [errors, setErrors] = useState([]);

  const lottery = getLotteryById(lotteryId);

  // Reiniciar formulario cuando cambia el tipo de rifa
  useEffect(() => {
    setFormData({});
    setSorteo(lottery?.draws?.[0]?.value || '');
    setErrors([]);
  }, [lotteryId, lottery]);

  if (!lottery) return null;

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors.length) setErrors([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, monto: parseFloat(formData.monto || lottery.defaultPrice) };
    const errs = validateTicket(lotteryId, data);
    if (errs.length) { setErrors(errs); return; }
    onSubmit({ ...data, sorteo, lotteryId });
  };

  return (
    <form onSubmit={handleSubmit} id="ticket-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Sorteo */}
      {lottery.draws && lottery.draws.length > 1 && (
        <div className="form-group">
          <label htmlFor="sorteo-select">Sorteo</label>
          <select
            id="sorteo-select"
            className="form-control"
            value={sorteo}
            onChange={(e) => setSorteo(e.target.value)}
          >
            {lottery.draws.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Campos dinámicos por tipo de rifa */}
      {lottery.fields.map((field) => (
        <DynamicField
          key={field.key}
          field={field}
          value={formData[field.key] ?? ''}
          onChange={(val) => handleChange(field.key, val)}
        />
      ))}

      {/* Errores */}
      {errors.length > 0 && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '0.75rem', color: '#f87171', fontSize: '0.85rem' }}>
          {errors.map((e, i) => <div key={i}>• {e}</div>)}
        </div>
      )}

      {/* Botón */}
      <button
        type="submit"
        className="btn btn-primary btn-full"
        disabled={loading}
        id="sell-ticket-btn"
        style={{ marginTop: '0.5rem', padding: '1rem', fontSize: '1.05rem' }}
      >
        {loading
          ? <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }} />Guardando...</>
          : <>Vender Boleto</>
        }
      </button>
    </form>
  );
};

// ─── Campo dinámico ──────────────────────────────────────────
const DynamicField = ({ field, value, onChange }) => {
  const inputId = `field-${field.key}`;

  if (field.type === 'select') {
    return (
      <div className="form-group">
        <label htmlFor={inputId}>{field.label}{field.required ? ' *' : ''}</label>
        <select
          id={inputId}
          className="form-control"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        >
          <option value="">-- Seleccionar --</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="form-group">
      <label htmlFor={inputId}>{field.label}{field.required ? ' *' : ''}</label>
      <input
        id={inputId}
        className="form-control"
        type={field.type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        placeholder={field.placeholder || ''}
        min={field.type === 'number' ? 0 : undefined}
        inputMode={field.type === 'number' ? 'numeric' : 'text'}
        style={field.key === 'numero' ? { fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', letterSpacing: '0.1em' } : {}}
      />
    </div>
  );
};
