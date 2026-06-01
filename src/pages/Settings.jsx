// ─── Página: Configuración ────────────────────────────────────
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PrinterConnect } from '../components/printer/PrinterStatus';
import { Settings as SettingsIcon, Store, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDialog } from '../components/ui/DialogProvider';
import { useAuth } from '../context/AuthContext';

export const Settings = () => {
  const { settings, updateSettings } = useApp();
  const [form, setForm] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const { dialog } = useDialog();
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="page-content">
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.5rem' }}>
          Configuración de Impresora
        </h1>

        {/* Impresora Bluetooth */}
        <p className="section-title">Impresora Bluetooth</p>
        <PrinterConnect />

        <div style={{ height: '2rem' }} />
      </div>
    );
  }

  const handleSave = async () => {
    await updateSettings(form);
    setSaved(true);
    toast.success('Configuración guardada');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearData = async () => {
    const ok = await dialog.danger(
      'Se eliminarán TODOS los registros de ventas de la base de datos. Esta acción es irreversible.',
      { title: 'Borrar todos los datos', confirmLabel: 'Sí, eliminar todo' }
    );
    if (!ok) return;
    try {
      const { api } = await import('../services/apiService');
      await api.delete('/sales.php');
      toast.success('Todos los datos eliminados');
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error('No se pudo eliminar. Verifica permisos.');
    }
  };

  return (
    <div className="page-content">
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.5rem' }}>
        Configuración
      </h1>

      {/* Impresora Bluetooth */}
      <p className="section-title">Impresora Bluetooth</p>
      <PrinterConnect />

      <div className="divider" style={{ margin: '1.5rem 0' }} />

      {/* Negocio */}
      <p className="section-title">Datos del negocio</p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label htmlFor="business-name-input">
            <Store size={12} style={{ display: 'inline', marginRight: 4 }} />
            Nombre del negocio
          </label>
          <input
            id="business-name-input"
            className="form-control"
            value={form.businessName}
            onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            placeholder="Ej: Rifas Express"
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Aparece en el encabezado del boleto impreso
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="currency-input">Símbolo de moneda</label>
          <input
            id="currency-input"
            className="form-control"
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            placeholder="₡ / L / $ "
            style={{ maxWidth: 120 }}
          />
        </div>
      </div>

      <div className="divider" style={{ margin: '1.5rem 0' }} />

      {/* Preferencias */}
      <p className="section-title">Preferencias</p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setForm((f) => ({ ...f, autoprint: !f.autoprint }))}
          id="autoprint-toggle"
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Imprimir automáticamente</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Imprime el boleto al confirmar la venta
            </div>
          </div>
          {form.autoprint
            ? <ToggleRight size={36} color="var(--accent-light)" />
            : <ToggleLeft size={36} color="var(--text-muted)" />
          }
        </div>

        <div className="divider" style={{ margin: '0.25rem 0' }} />

        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="close-minutes-input">Minutos de cierre antes del sorteo</label>
          <input
            id="close-minutes-input"
            className="form-control"
            type="number"
            min="0"
            max="120"
            value={form.drawCloseMinutes ?? 10}
            onChange={(e) => setForm((f) => ({ ...f, drawCloseMinutes: parseInt(e.target.value, 10) || 0 }))}
            placeholder="10"
            style={{ maxWidth: 120 }}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Tiempo límite en minutos para desactivar la venta antes de cada hora de sorteo
          </span>
        </div>
      </div>

      <div className="divider" style={{ margin: '1.5rem 0' }} />

      {/* Guardar */}
      <button
        className="btn btn-primary btn-full"
        onClick={handleSave}
        id="save-settings-btn"
        style={{ padding: '1rem', marginBottom: '1rem' }}
      >
        <SettingsIcon size={16} />
        {saved ? 'Guardado' : 'Guardar configuración'}
      </button>

      {/* Peligro */}
      <div style={{ marginTop: '1rem' }}>
        <p className="section-title" style={{ color: 'var(--neon-red)' }}>Zona de peligro</p>
        <div className="card" style={{ borderColor: 'rgba(248,113,113,0.3)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Elimina todos los registros de ventas guardados localmente en este dispositivo.
          </p>
          <button
            className="btn btn-danger btn-full"
            onClick={handleClearData}
            id="clear-data-btn"
          >
            <Trash2 size={16} /> Borrar todos los datos
          </button>
        </div>
      </div>

      <div style={{ height: '2rem' }} />
    </div>
  );
};
