import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { getLotteryById, formatLotteryNumber } from '../../data/lotteryTypes';
import { checkWinners, getResults } from '../../services/storageService';
import { Trophy, X, Bell, Ticket } from 'lucide-react';

const SEEN_KEY = 'rifas_seen_results';

const getSeenIds = () => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); }
  catch { return []; }
};
const markSeen = (ids) => {
  const prev = getSeenIds();
  localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...prev, ...ids])]));
};

export const WinnerNotification = () => {
  const { user } = useAuth();
  const { settings } = useApp();
  const [winners, setWinners] = useState([]);
  const [visible, setVisible] = useState(false);

  const requestNotifPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  const sendBrowserNotif = useCallback((winner) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const lottery = getLotteryById(winner.lotteryId);
    const currencySymbol = lottery?.priceLabel || (settings?.currency ? `${settings.currency} ` : 'NIO ');
    new Notification('¡Boleto Ganador!', {
      body: `${lottery?.name ?? winner.lotteryId} · Número ${winner.numeroGanador}\nComprador: ${winner.comprador || 'Sin nombre'} · ${currencySymbol}${winner.monto}`,
      icon: '/favicon.ico',
      tag: `winner-${winner.resultId}-${winner.lineId}`,
    });
  }, [settings?.currency]);

  useEffect(() => {
    if (!user) return;
    requestNotifPermission();

    const check = async () => {
      try {
        const data = await checkWinners();
        if (!data?.length) return;

        const seen = getSeenIds();
        const unseen = data.filter((w) => !seen.includes(`${w.resultId}-${w.lineId}`));
        if (!unseen.length) return;

        setWinners(unseen);
        setVisible(true);
        // Enviar notificación del navegador
        unseen.forEach(sendBrowserNotif);
      } catch { /* silencioso */ }
    };

    check();
    // Re-verificar cada 15 segundos para notificaciones cuasi-instantáneas
    const interval = setInterval(check, 15 * 1000);
    return () => clearInterval(interval);
  }, [user, requestNotifPermission, sendBrowserNotif]);

  // Polling de notificaciones de resultados para vendedores
  useEffect(() => {
    if (!user || user.role !== 'vendedor') return;

    const checkAnnouncements = async () => {
      try {
        const results = await getResults();
        if (!results || !results.length) return;

        // Cargar vistos de localStorage
        const seenAnnouncements = JSON.parse(localStorage.getItem('seen_result_announcements') || '[]');
        
        // Si es la primera vez que se carga y no hay nada en localStorage, inicializar con todos para evitar spam de notificaciones antiguas
        if (seenAnnouncements.length === 0) {
          const allIds = results.map(r => r.id);
          localStorage.setItem('seen_result_announcements', JSON.stringify(allIds));
          return;
        }

        const unseen = results.filter(r => !seenAnnouncements.includes(r.id));
        if (!unseen.length) return;

        // Mostrar notificación de navegador para cada nuevo resultado
        if ('Notification' in window && Notification.permission === 'granted') {
          unseen.forEach(r => {
            const formatFecheaDate = (val) => {
              if (!val) return '';
              const parts = val.split('/');
              if (parts.length === 2) {
                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                const mIdx = parseInt(parts[1], 10) - 1;
                return `${parts[0]} de ${months[mIdx] || parts[1]}`;
              }
              return val;
            };

            const displayNum = r.lotteryId === 'fechea' ? formatFecheaDate(r.numeroGanador) : `#${r.numeroGanador}`;
            
            // Obtener el nombre legible de la lotería
            const lottery = getLotteryById(r.lotteryId);
            const lotteryName = lottery?.name || r.lotteryId;

            // Formatear fecha del sorteo a dd/mm/yyyy
            let displayDrawDate = r.fechaSorteo;
            const dateParts = (r.fechaSorteo || '').split('-');
            if (dateParts.length === 3) {
              displayDrawDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
            }

            const ampmFormat = (hourStr) => {
              if (!hourStr) return '';
              let str = String(hourStr).trim().toLowerCase();
              str = str.replace(/(hrs|horas|hr|h)/g, '').trim();
              let h = 0, m = 0;
              if (str.includes(':')) {
                const parts = str.split(':');
                h = Number(parts[0]);
                m = Number(parts[1]);
              } else {
                h = Number(str);
                m = 0;
              }
              if (isNaN(h) || isNaN(m)) return hourStr;
              const ampm = h >= 12 ? 'PM' : 'AM';
              const displayH = h % 12 || 12;
              const displayM = String(m).padStart(2, '0');
              return `${displayH}:${displayM} ${ampm}`;
            };

            new Notification('📢 Nuevo Resultado Anunciado', {
              body: `${lotteryName} · Número ${displayNum}\nSorteo: ${displayDrawDate} (${ampmFormat(r.horaSorteo)})`,
              icon: '/favicon.ico',
              tag: `result-${r.id}`,
            });
          });
        }

        // Marcar como vistos
        const updated = [...new Set([...seenAnnouncements, ...unseen.map(r => r.id)])];
        localStorage.setItem('seen_result_announcements', JSON.stringify(updated));
      } catch (err) {
        console.warn('Error checking result announcements:', err);
      }
    };

    checkAnnouncements();
    const interval = setInterval(checkAnnouncements, 12000);
    return () => clearInterval(interval);
  }, [user]);

  const dismiss = () => {
    markSeen(winners.map((w) => `${w.resultId}-${w.lineId}`));
    setVisible(false);
    setWinners([]);
  };

  if (!visible || !winners.length) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{
        background: 'rgba(30, 27, 75, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '2px solid rgba(251,191,36,0.6)',
        borderRadius: 24, padding: '1.5rem', 
        maxWidth: 480, width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(251,191,36,0.25)',
        animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
      }}>
        {/* Cerrar */}
        <button onClick={dismiss} style={{ position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
          padding: '6px 10px', color: 'var(--text-secondary)', cursor: 'pointer', zIndex: 10 }}>
          <X size={18} />
        </button>

        {/* Cabecera / Trofeo animado */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem', flexShrink: 0 }}>
          <div style={{ display: 'inline-block', color: '#fbbf24', animation: 'pulse 1.5s infinite' }}>
            <Trophy size={56} />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24',
            textShadow: '0 0 20px rgba(251,191,36,0.8)', marginTop: '0.5rem' }}>
            {winners.length > 1 
              ? `¡${winners.length} Boletos Ganadores!`
              : '¡Boleto Ganador Detectado!'
            }
          </div>
          {winners.length > 1 && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Varios boletos de tus clientes han resultado ganadores.
            </p>
          )}
        </div>

        {/* Contenido / Listado de ganadores */}
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          paddingRight: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '1.25rem'
        }} className="custom-scrollbar">
          {winners.map((w, idx) => {
            const lottery = getLotteryById(w.lotteryId);
            const currencySymbol = lottery?.priceLabel || (settings?.currency ? `${settings.currency} ` : 'NIO ');
            const prizeAmount = parseFloat(w.prize || (w.monto * (lottery?.payoutMultiplier || 80))).toFixed(2);

            return (
              <div 
                key={`${w.resultId}-${w.lineId}-${idx}`} 
                style={{ 
                  background: 'rgba(251,191,36,0.06)', 
                  border: '1px solid rgba(251,191,36,0.2)',
                  borderRadius: 16, 
                  padding: '1rem',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Decoración del borde izquierdo */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  background: 'linear-gradient(to bottom, #fbbf24, #d97706)'
                }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                  <Ticket size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lottery?.name || w.lotteryId}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Fecha: {w.fechaSorteo}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.75rem' }}>
                  <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: '0.5rem' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
                      Número
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fbbf24' }}>
                      {formatLotteryNumber(w.lotteryId, w.numeroGanador)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: '0.5rem' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
                      Premio
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--neon-green)' }}>
                      {currencySymbol}{prizeAmount}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Inversión: <strong style={{ color: 'var(--text-primary)' }}>{currencySymbol}{parseFloat(w.monto).toFixed(2)}</strong>
                  </span>
                  {w.comprador && (
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>
                      Cliente: {w.comprador}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Botones de acción */}
        <div style={{ flexShrink: 0 }}>
          <button
            className="btn btn-full"
            onClick={dismiss}
            style={{ 
              background: 'linear-gradient(135deg, #d97706, #fbbf24)',
              color: '#000', 
              fontWeight: 800,
              padding: '0.9rem',
              borderRadius: 12,
              fontSize: '0.95rem'
            }}
          >
            <Trophy size={16} /> Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Botón para solicitar permisos de notificación ────────────
export const NotificationPermissionBanner = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const request = async () => {
    const perm = await Notification.requestPermission();
    if (perm !== 'default') setShow(false);
  };

  return (
    <div style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)',
      borderRadius: 'var(--radius-md)', padding: '0.65rem 1rem', margin: '0 1rem 0.75rem',
      display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem' }}>
      <Bell size={14} color="var(--neon-blue)" />
      <span style={{ flex: 1, color: 'var(--text-secondary)' }}>
        Activa las notificaciones para recibir alertas de ganadores
      </span>
      <button className="btn btn-secondary" onClick={request}
        style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem' }}>
        Activar
      </button>
      <button onClick={() => setShow(false)} style={{ color: 'var(--text-muted)', padding: '2px' }}>
        <X size={14} />
      </button>
    </div>
  );
};
