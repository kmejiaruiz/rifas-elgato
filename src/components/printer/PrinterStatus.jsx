// ─── Componente: PrinterStatus (widget header) ───────────────
import { useState, useEffect } from 'react';
import { usePrinter } from '../../context/PrinterContext';
import { Printer, Bluetooth, BluetoothOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PrinterStatus = () => {
  const { connected, connecting, device } = usePrinter();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Expand when connection status or device changes
    setIsExpanded(true);
    const timer = setTimeout(() => {
      setIsExpanded(false);
    }, 4000); // Collapse after 4 seconds

    return () => clearTimeout(timer);
  }, [connected, connecting, device?.name]);

  const showText = isExpanded || isHovered;
  const statusColor = connected ? 'var(--neon-green)' : 'var(--neon-yellow)';

  return (
    <button
      className={`printer-status ${showText ? 'expanded' : 'minimized'}`}
      onClick={() => navigate('/settings')}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Estado de impresora"
      id="printer-status-btn"
      style={{ color: '#ffffff' }}
    >
      <span className={`printer-dot ${connecting ? 'connecting' : connected ? 'connected' : 'disconnected'}`} />
      {connected ? (
        <Bluetooth size={14} color={statusColor} />
      ) : (
        <BluetoothOff size={14} color={statusColor} />
      )}
      <span className="printer-status-text" style={{ color: '#ffffff' }}>
        {connecting ? 'Conectando...' : connected ? (device?.name || 'Conectada') : 'Sin impresora'}
      </span>
    </button>
  );
};

// ─── Componente: PrinterConnect (panel en Settings) ──────────
export const PrinterConnect = () => {
  const { connected, connecting, device, connect, disconnect, testPrint, printing, error } = usePrinter();

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '12px',
          background: connected ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Printer size={24} color={connected ? '#34d399' : '#f87171'} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>
            {connected ? device?.name || 'Impresora conectada' : 'Sin impresora'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            {connected ? 'Bluetooth activo' : 'No hay dispositivo vinculado'}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: '0.82rem', color: '#f87171', background: 'rgba(248,113,113,0.1)', borderRadius: 8, padding: '0.6rem 0.8rem' }}>
          Error: {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {!connected ? (
          <button
            className="btn btn-primary btn-full"
            onClick={connect}
            disabled={connecting}
            id="connect-printer-btn"
          >
            {connecting
              ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Buscando...</>
              : <><Bluetooth size={16} /> Conectar Impresora</>
            }
          </button>
        ) : (
          <>
            <button
              className="btn btn-secondary btn-full"
              onClick={testPrint}
              disabled={printing}
              id="test-print-btn"
            >
              {printing ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Printer size={16} />}
              Prueba de impresión
            </button>
            <button
              className="btn btn-danger"
              onClick={disconnect}
              id="disconnect-printer-btn"
              style={{ flexShrink: 0 }}
            >
              <BluetoothOff size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
