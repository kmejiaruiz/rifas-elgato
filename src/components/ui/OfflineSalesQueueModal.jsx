import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, X, Calendar, Clock, Save, RefreshCw, AlertTriangle, ShieldAlert, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { getOfflineSalesQueue, updateOfflineSale, deleteOfflineSale, syncOfflineData } from '../../services/storageService';
import { LOTTERY_LIST } from '../../data/lotteryTypes';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/apiService';

export const OfflineSalesQueueModal = ({ isOpen, onClose }) => {
  const { dispatch, isServerConnected } = useApp();
  const [queue, setQueue] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editHour, setEditHour] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQueue(getOfflineSalesQueue());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDiscard = (id) => {
    const confirm = window.confirm('¿Estás seguro de descartar este boleto? Se eliminará de la cola local de sincronización y no se registrará en el servidor.');
    if (!confirm) return;

    const updated = deleteOfflineSale(id);
    setQueue(updated);
    toast.success('Boleto descartado con éxito.');
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditDate(item.data.drawDate || new Date().toLocaleDateString('sv-SE'));
    setEditHour(item.data.horaSorteo || '12:00');
  };

  const handleSaveEdit = (id) => {
    if (!editDate || !editHour) {
      toast.error('Por favor selecciona una fecha y hora válidas.');
      return;
    }

    const item = queue.find(q => q.id === id);
    if (!item) return;

    const updatedJugadas = (item.data.jugadas || []).map(j => ({
      ...j,
      fecha: editDate,
    }));

    const updatedData = {
      drawDate: editDate,
      horaSorteo: editHour,
      jugadas: updatedJugadas,
    };

    const ok = updateOfflineSale(id, updatedData);
    if (ok) {
      toast.success('Boleto reprogramado con éxito. Se reintentará sincronizar.');
      setEditingId(null);
      const updatedQueue = getOfflineSalesQueue();
      setQueue(updatedQueue);

      if (isServerConnected) {
        triggerSync();
      }
    } else {
      toast.error('Error al actualizar el boleto.');
    }
  };

  const handleForceSync = async (item) => {
    if (!isServerConnected) {
      toast.error('El servidor está desconectado.');
      return;
    }

    const toastId = toast.loading('Forzando sincronización de boleto...');
    try {
      const payload = { ...item.data, bypassClosedLimit: true };
      const res = await api.post('/sales', payload);
      const sale = res.sales ? res.sales[0] : res.sale;

      dispatch({ type: 'SYNC_SALE', payload: { tempId: item.id, realSale: sale } });

      const updated = deleteOfflineSale(item.id);
      setQueue(updated);
      toast.success('Boleto sincronizado a la fuerza con éxito.', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error al sincronizar a la fuerza', { id: toastId });
      updateOfflineSale(item.id, { error: err.message || 'Error en sincronización forzada' });
      setQueue(getOfflineSalesQueue());
    }
  };

  const triggerSync = async () => {
    if (!isServerConnected) {
      toast.error('El servidor está desconectado. Espera a recuperar conexión.');
      return;
    }

    setSyncing(true);
    try {
      await syncOfflineData(dispatch);
      setQueue(getOfflineSalesQueue());
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const getLotteryName = (lotteryId) => {
    const lot = LOTTERY_LIST.find(l => l.id === lotteryId);
    return lot ? lot.name : lotteryId;
  };

  const getValidHoursForLottery = (lotteryId) => {
    const lot = LOTTERY_LIST.find(l => l.id === lotteryId);
    return lot && lot.drawHours
      ? lot.drawHours.split(',').map(h => h.trim())
      : ['12:00', '15:00', '18:00', '21:00'];
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(7, 9, 21, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '1rem',
      animation: 'rootModalFadeIn 0.25s ease-out'
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '24px', padding: '1.75rem', width: '100%', maxWidth: '580px',
        maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
        animation: 'rootModalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
              Ventas Pendientes ({queue.length})
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Boletos guardados offline que no se han subido al servidor.
            </span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ padding: '0.4rem' }}>
            <X size={18} color="var(--text-muted)" />
          </button>
        </div>

        {/* Content list */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
          {queue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-secondary)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(52,211,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Clock size={20} color="#34d399" />
              </div>
              <p style={{ fontWeight: 700, margin: '0 0 0.25rem' }}>¡Cola limpia!</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>No hay ninguna venta pendiente de sincronizar.</p>
            </div>
          ) : (
            queue.map((item) => {
              const data = item.data || {};
              const isEditing = editingId === item.id;
              const formattedDate = data.drawDate ? data.drawDate.split('-').reverse().join('/') : '';

              // Lógica de cálculo de tiempo transcurrido desde el sorteo
              const drawDateTimeStr = `${data.drawDate || ''}T${data.horaSorteo || '12:00'}:00-06:00`;
              const drawTime = new Date(drawDateTimeStr).getTime();
              const currentTime = Date.now();
              const isWithin24h = (currentTime - drawTime) <= 24 * 60 * 60 * 1000;
              const hasPassed = currentTime >= drawTime;

              return (
                <div key={item.id} style={{
                  border: '1px solid var(--border)', borderRadius: '16px',
                  padding: '1rem', background: 'rgba(30,41,59,0.2)',
                  display: 'flex', flexDirection: 'column', gap: '0.6rem'
                }}>
                  {/* Info Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-light)' }}>
                        {getLotteryName(data.lotteryId)}
                      </span>
                      {data.comprador && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                          (Cliente: {data.comprador})
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f1f5f9' }}>
                      NIO {Number((data.jugadas || []).reduce((sum, j) => sum + parseFloat(j.monto || 0), 0)).toFixed(2)}
                    </span>
                  </div>

                  {/* Detalle de Jugadas */}
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', background: 'rgba(15,23,42,0.3)', padding: '0.4rem 0.75rem', borderRadius: '8px' }}>
                    <strong>Números:</strong> {(data.jugadas || []).map(j => `${j.numero} (x${Number(j.monto).toFixed(0)})`).join(', ')}
                  </div>

                  {/* Sorteo actual */}
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.76rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                      <Calendar size={12} />
                      <span>{formattedDate}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                      <Clock size={12} />
                      <span>{data.horaSorteo}</span>
                    </div>
                  </div>

                  {/* Estado de tiempo de sorteo */}
                  {hasPassed && (
                    <div style={{
                      display: 'flex', gap: '0.4rem', alignItems: 'center',
                      background: isWithin24h ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)',
                      border: `1px solid ${isWithin24h ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)'}`,
                      borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.72rem',
                      color: isWithin24h ? '#fbbf24' : '#f87171', fontWeight: 600
                    }}>
                      <ShieldAlert size={14} style={{ flexShrink: 0 }} />
                      <span>
                        {isWithin24h 
                          ? '⚠️ Sorteo cerrado. Forzar sincronización disponible (Menos de 24h).' 
                          : '🚫 Excedió el límite de 24h. Obligatorio reprogramar sorteo o descartar.'}
                      </span>
                    </div>
                  )}

                  {/* Alerta de Error */}
                  {item.error && !isEditing && (
                    <div style={{
                      display: 'flex', gap: '0.4rem', alignItems: 'flex-start',
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
                      borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.72rem', color: '#f87171'
                    }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                      <div>
                        <strong>Último error:</strong> {item.error}
                      </div>
                    </div>
                  )}

                  {/* Formulario de Edición */}
                  {isEditing && (
                    <div style={{
                      background: 'rgba(15,23,42,0.4)', padding: '0.75rem', borderRadius: '12px',
                      border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.25rem'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Reprogramar sorteo del boleto:
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Nueva Fecha</label>
                          <input
                            type="date"
                            className="form-control"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Nueva Hora</label>
                          <select
                            className="form-control"
                            value={editHour}
                            onChange={(e) => setEditHour(e.target.value)}
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem', height: 'auto' }}
                          >
                            {getValidHoursForLottery(data.lotteryId).map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                        <button className="btn btn-ghost" onClick={() => setEditingId(null)} style={{ padding: '0.3rem 0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Cancelar
                        </button>
                        <button className="btn btn-primary" onClick={() => handleSaveEdit(item.id)} style={{ padding: '0.3rem 0.75rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Save size={12} />
                          Guardar y Reintentar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Acciones */}
                  {!isEditing && (
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                      <button className="btn btn-ghost" onClick={() => handleDiscard(item.id)} style={{ padding: '0.3rem 0.75rem', fontSize: '0.72rem', color: 'var(--neon-red)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Trash2 size={12} />
                        Descartar
                      </button>
                      <button className="btn btn-ghost" onClick={() => startEditing(item)} style={{ padding: '0.3rem 0.75rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                        <Edit2 size={12} />
                        Cambiar Sorteo
                      </button>
                      {hasPassed && isWithin24h && (
                        <button className="btn btn-primary" onClick={() => handleForceSync(item)} disabled={!isServerConnected} style={{ padding: '0.3rem 0.75rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Check size={12} />
                          Forzar Sincro
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '0.6rem 1.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Cerrar
          </button>
          {queue.length > 0 && (
            <button
              className="btn btn-primary"
              onClick={triggerSync}
              disabled={syncing || !isServerConnected}
              style={{
                padding: '0.6rem 1.2rem', fontSize: '0.8rem',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                cursor: isServerConnected && !syncing ? 'pointer' : 'not-allowed',
                opacity: isServerConnected && !syncing ? 1 : 0.4
              }}
            >
              <RefreshCw size={14} className={syncing ? "spin" : ""} />
              {syncing ? 'Sincronizando...' : 'Reintentar Todo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
