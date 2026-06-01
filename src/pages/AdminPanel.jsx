// ─── Panel de Administración ──────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import NProgress from 'nprogress';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { LOTTERY_LIST } from '../data/lotteryTypes';
import {
  getBlockedNumbers, blockNumber, unblockNumber, clearBlockedNumbers,
  getDisabledGames, setGameEnabled, getAllGameStates, saveGameConfig,
  deleteGameConfig,
} from '../services/gameService';
import {
  Shield, Users, Gamepad2, Hash, UserPlus, Trash2,
  ToggleLeft, ToggleRight, Lock, Unlock, Plus, X, Eye, EyeOff,
  Edit3, Save, ChevronDown, ChevronUp, Trophy, CheckCircle2,
  DollarSign, RefreshCw, Settings2, Ticket, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useDialog } from '../components/ui/DialogProvider';
import { getLotteryById } from '../data/lotteryTypes';
import { getResults, announceResult, deleteResult } from '../services/storageService';
import { api } from '../services/apiService';
import { DRAW_HOURS } from './SellTicket';
import { formatFecheaDate } from '../utils/dateUtils';

// ─── Tabs del panel ──────────────────────────────────────────
const TABS = [
  { id: 'games',    label: 'Juegos',           Icon: Gamepad2 },
  { id: 'numbers',  label: 'Números',          Icon: Hash },
  { id: 'results',  label: 'Resultados',       Icon: Trophy },
  { id: 'users',    label: 'Usuarios',         Icon: Users },
  { id: 'salaries', label: 'Cierre y Salarios', Icon: DollarSign },
];

export const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('games');

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <Shield size={22} color="var(--accent-light)" />
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Panel Admin</h1>
      </div>

      {/* Tab bar */}
      <div className="admin-tab-bar">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            id={`admin-tab-${id}`}
            onClick={() => setActiveTab(id)}
            className="admin-tab-btn"
            style={{
              background: activeTab === id ? 'linear-gradient(135deg, var(--accent), var(--accent-light))' : 'transparent',
              color: activeTab === id ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'games'    && <GamesTab />}
      {activeTab === 'numbers'  && <NumbersTab />}
      {activeTab === 'results'  && <ResultsTab />}
      {activeTab === 'users'    && <UsersTab />}
      {activeTab === 'salaries' && <SalariesTab />}
    </div>
  );
};

// ─── Tab: Juegos ─────────────────────────────────────────────
const GamesTab = () => {
  const { lotteries, loadAllData } = useApp();
  const [gameStates, setGameStates] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);
  const { dialog } = useDialog();

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

  // Crear juego personalizado
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    defaultPrice: 100,
    priceLabel: 'NIO ',
    payoutMultiplier: 80.00,
    emoji: '',
    numberDigits: 2,
    minNumber: 0,
    maxNumber: 99,
    allowSeries: false,
    drawHours: '12:00,15:00,18:00,21:00',
    maxSalesPerNumber: 0.00,
  });

  const loadGames = useCallback(async () => {
    const states = await getAllGameStates(lotteries);
    setGameStates(states);
    setLoading(false);
  }, [lotteries]);

  useEffect(() => { loadGames(); }, [loadGames]);

  const toggleGame = async (lotteryId, currentEnabled) => {
    await setGameEnabled(lotteryId, !currentEnabled);
    toast.success(`Juego ${!currentEnabled ? 'habilitado' : 'deshabilitado'}`);
    await loadAllData();
  };

  const startEdit = (game) => {
    setEditingId(game.id);
    setEditForm({
      name:             game.name || '',
      description:      game.description || '',
      defaultPrice:     game.defaultPrice || 100,
      priceLabel:       game.priceLabel || 'NIO ',
      payoutMultiplier: game.payoutMultiplier !== undefined ? game.payoutMultiplier : 80.00,
      emoji:            game.emoji || '',
      numberDigits:     game.numberDigits !== undefined ? game.numberDigits : 2,
      minNumber:        game.numberRange?.min !== undefined ? game.numberRange.min : 0,
      maxNumber:        game.numberRange?.max !== undefined ? game.numberRange.max : 99,
      isCustom:         game.isCustom || false,
      allowSeries:      game.allowSeries || false,
      drawHours:        game.drawHours || '12:00,15:00,18:00,21:00',
      maxSalesPerNumber: game.maxSalesPerNumber !== undefined ? game.maxSalesPerNumber : 0.00,
    });
  };

  const saveEdit = async (lotteryId) => {
    await saveGameConfig(lotteryId, {
      name:             editForm.name,
      description:      editForm.description,
      defaultPrice:     editForm.defaultPrice,
      priceLabel:       editForm.priceLabel,
      payoutMultiplier: editForm.payoutMultiplier,
      emoji:            editForm.emoji,
      numberDigits:     editForm.numberDigits,
      minNumber:        editForm.minNumber,
      maxNumber:        editForm.maxNumber,
      isCustom:         editForm.isCustom,
      allowSeries:      editForm.allowSeries,
      drawHours:        editForm.drawHours,
      maxSalesPerNumber: editForm.maxSalesPerNumber,
    });
    toast.success('Configuración guardada');
    setEditingId(null);
    await loadAllData();
  };

  const deleteGame = async (lotteryId, name) => {
    const ok = await dialog.danger(`¿Eliminar el juego personalizado "${name}"? Se borrará su configuración y todos sus números bloqueados de forma permanente.`, {
      title: 'Eliminar juego',
      confirmLabel: 'Sí, eliminar',
    });
    if (!ok) return;
    try {
      await deleteGameConfig(lotteryId);
      toast.success('Juego personalizado eliminado');
      await loadAllData();
    } catch (err) {
      toast.error('Error al eliminar juego: ' + err.message);
    }
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) { toast.error('Ingresa el nombre del juego'); return; }

    const lotteryId = createForm.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/__+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!lotteryId) { toast.error('Nombre de juego no válido'); return; }

    if (gameStates.some((g) => g.id === lotteryId)) {
      toast.error('Ya existe un juego con este nombre o identificador');
      return;
    }

    try {
      await saveGameConfig(lotteryId, {
        ...createForm,
        isCustom: true,
      });
      toast.success('¡Juego personalizado creado con éxito!');
      setCreateForm({
        name: '',
        description: '',
        defaultPrice: 100,
        priceLabel: 'NIO ',
        payoutMultiplier: 80.00,
        emoji: '',
        numberDigits: 2,
        minNumber: 0,
        maxNumber: 99,
        allowSeries: false,
        drawHours: '12:00,15:00,18:00,21:00',
        maxSalesPerNumber: 0.00,
      });
      setShowCreateForm(false);
      await loadAllData();
    } catch (err) {
      toast.error('Error al crear juego: ' + err.message);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}><span className="loading-text">Cargando...</span></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
        Habilita o deshabilita juegos, parametriza sus premios multiplicadores y edita sus parámetros.
      </p>

      {gameStates.map((game) => (
        <div key={game.id} className="card" style={{
          borderColor: game.enabled ? 'var(--border)' : 'rgba(248,113,113,0.3)',
          opacity: game.enabled ? 1 : 0.7,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0,
              background: game.gradient || `${game.color}22`,
            }}>
              {game.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{game.name}</span>
                {game.isCustom && <span className="badge badge-active" style={{ fontSize: '0.62rem', background: 'rgba(124,58,237,0.15)', color: '#c084fc', border: '1px solid rgba(124,58,237,0.3)' }}>Personalizado</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{game.description}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Precio base: {game.priceLabel}{game.defaultPrice} · Premio: <span style={{ color: 'var(--neon-green)', fontWeight: 700 }}>{game.payoutMultiplier || 80}x</span>
                {!game.isFechea && game.numberRange && ` · Rango: ${game.numberRange.min}-${game.numberRange.max}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', flexShrink: 0 }}>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => editingId === game.id ? setEditingId(null) : startEdit(game)}
                id={`edit-game-${game.id}`}
              >
                <Edit3 size={16} color="var(--text-secondary)" />
              </button>
              {game.isCustom && (
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => deleteGame(game.id, game.name)}
                  style={{ color: 'var(--neon-red)' }}
                  title="Eliminar juego personalizado"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={() => toggleGame(game.id, game.enabled)}
                style={{ background: 'none', padding: '4px' }}
                id={`toggle-game-${game.id}`}
                aria-label={game.enabled ? 'Deshabilitar juego' : 'Habilitar juego'}
              >
                {game.enabled
                  ? <ToggleRight size={36} color="var(--neon-green)" />
                  : <ToggleLeft size={36} color="var(--text-muted)" />
                }
              </button>
            </div>
          </div>

          {/* Formulario de edición inline */}
          {editingId === game.id && (
            <div style={{
              marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
              animation: 'fadeIn 0.2s ease',
            }}>
              <div className="responsive-grid-2col">
                <div className="form-group">
                  <label>Nombre</label>
                  <input className="form-control" value={editForm.name || ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Símbolo moneda</label>
                  <input className="form-control" value={editForm.priceLabel || ''} onChange={(e) => setEditForm((f) => ({ ...f, priceLabel: e.target.value }))} style={{ maxWidth: 80 }} />
                </div>
                <div className="form-group">
                  <label>Precio base</label>
                  <input className="form-control" type="number" value={editForm.defaultPrice || ''} onChange={(e) => setEditForm((f) => ({ ...f, defaultPrice: parseFloat(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label>Multiplicador de Premio (x monto)</label>
                  <input className="form-control" type="number" step="0.1" value={editForm.payoutMultiplier || ''} onChange={(e) => setEditForm((f) => ({ ...f, payoutMultiplier: parseFloat(e.target.value) }))} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Horas de sorteo (Separadas por comas)</label>
                  <input className="form-control" value={editForm.drawHours || ''} onChange={(e) => setEditForm((f) => ({ ...f, drawHours: e.target.value }))} placeholder="Ej: 12:00,15:00,18:00,21:00" />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', marginTop: 2 }}>
                    Define las horas del sorteo en formato de 24 horas (HH:MM), separadas por comas.
                  </small>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Límite acumulado por número (0.00 para ilimitado)</label>
                  <input className="form-control" type="number" step="0.01" min="0" value={editForm.maxSalesPerNumber ?? 0.00} onChange={(e) => setEditForm((f) => ({ ...f, maxSalesPerNumber: parseFloat(e.target.value) || 0.00 }))} />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', marginTop: 2 }}>
                    Tope máximo de ventas activas en total acumulado para un mismo número/fecha/hora de sorteo.
                  </small>
                </div>
                {editForm.isCustom && (
                  <>
                    <div className="form-group">
                      <label>Emoji del juego</label>
                      <input className="form-control" value={editForm.emoji || ''} onChange={(e) => setEditForm((f) => ({ ...f, emoji: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Número de dígitos</label>
                      <input className="form-control" type="number" min="1" max="5" value={editForm.numberDigits || 2} onChange={(e) => {
                        const digits = parseInt(e.target.value, 10) || 2;
                        const maxVal = Math.pow(10, digits) - 1;
                        setEditForm((f) => ({ ...f, numberDigits: digits, maxNumber: maxVal }));
                      }} />
                    </div>
                    <div className="form-group">
                      <label>Número mínimo</label>
                      <input className="form-control" type="number" value={editForm.minNumber ?? 0} onChange={(e) => setEditForm((f) => ({ ...f, minNumber: parseInt(e.target.value, 10) ?? 0 }))} />
                    </div>
                    <div className="form-group">
                      <label>Número máximo</label>
                      <input className="form-control" type="number" value={editForm.maxNumber ?? 99} onChange={(e) => setEditForm((f) => ({ ...f, maxNumber: parseInt(e.target.value, 10) ?? 99 }))} />
                    </div>
                  </>
                )}
                <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                  <input
                    type="checkbox"
                    id={`edit-allow-series-${game.id}`}
                    checked={editForm.allowSeries || false}
                    onChange={(e) => setEditForm((f) => ({ ...f, allowSeries: e.target.checked }))}
                    style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <label htmlFor={`edit-allow-series-${game.id}`} style={{ margin: 0, userSelect: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    Permitir venta por rango (ej: serie del 00 al 99)
                  </label>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Descripción</label>
                  <input className="form-control" value={editForm.description || ''} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={() => saveEdit(game.id)} id={`save-game-${game.id}`} style={{ flex: 1 }}>
                  <Save size={14} /> Guardar
                </button>
                <button className="btn btn-secondary" onClick={() => setEditingId(null)} style={{ flex: 1 }}>
                  <X size={14} /> Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Botón y Sección para Crear Juego Personalizado */}
      <div style={{ marginTop: '0.5rem' }}>
        <button
          className="btn btn-secondary btn-full"
          onClick={() => setShowCreateForm((v) => !v)}
          style={{ padding: '0.75rem', gap: '0.5rem', background: 'rgba(124,58,237,0.1)', border: '1px dashed rgba(124,58,237,0.4)', color: '#c084fc' }}
        >
          {showCreateForm ? <><X size={16} /> Cancelar creación</> : <><Plus size={16} /> Crear Nuevo Juego</>}
        </button>

        {showCreateForm && (
          <div className="card" style={{ marginTop: '0.75rem', animation: 'slideUp 0.2s ease', border: '1px solid rgba(124,58,237,0.3)', background: 'linear-gradient(135deg, rgba(30,16,60,0.4), rgba(13,15,26,0.5))' }}>
            <form onSubmit={handleCreateGame} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p className="section-title" style={{ color: '#c084fc', marginBottom: '0.25rem' }}>Nuevo Juego Personalizado</p>
              <div className="responsive-grid-2col">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Nombre del Juego</label>
                  <input className="form-control" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Ej: Diaria Millonaria" />
                </div>
                <div className="form-group">
                  <label>Símbolo Moneda / Prefijo</label>
                  <input className="form-control" value={createForm.priceLabel} onChange={(e) => setCreateForm((f) => ({ ...f, priceLabel: e.target.value }))} required placeholder="NIO " />
                </div>
                <div className="form-group">
                  <label>Precio por Defecto</label>
                  <input className="form-control" type="number" value={createForm.defaultPrice} onChange={(e) => setCreateForm((f) => ({ ...f, defaultPrice: parseFloat(e.target.value) || 0 }))} required min={1} />
                </div>
                <div className="form-group">
                  <label>Premio Multiplicador (x monto)</label>
                  <input className="form-control" type="number" step="0.1" value={createForm.payoutMultiplier} onChange={(e) => setCreateForm((f) => ({ ...f, payoutMultiplier: parseFloat(e.target.value) || 0 }))} required min={1} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Horas de Sorteo (Separadas por comas)</label>
                  <input className="form-control" value={createForm.drawHours} onChange={(e) => setCreateForm((f) => ({ ...f, drawHours: e.target.value }))} required placeholder="Ej: 12:00,15:00,18:00,21:00" />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', marginTop: 2 }}>
                    Define las horas de sorteo en formato 24 horas (HH:MM), separadas por comas.
                  </small>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Límite Acumulado por Número (0.00 para ilimitado)</label>
                  <input className="form-control" type="number" step="0.01" min="0" value={createForm.maxSalesPerNumber} onChange={(e) => setCreateForm((f) => ({ ...f, maxSalesPerNumber: parseFloat(e.target.value) || 0.00 }))} required />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', marginTop: 2 }}>
                    Tope máximo de ventas activas en total acumulado para un mismo número/fecha/hora de sorteo.
                  </small>
                </div>
                <div className="form-group">
                  <label>Número de Dígitos</label>
                  <input className="form-control" type="number" min={1} max={5} value={createForm.numberDigits} onChange={(e) => {
                    const digits = parseInt(e.target.value, 10) || 2;
                    const maxVal = Math.pow(10, digits) - 1;
                    setCreateForm((f) => ({ ...f, numberDigits: digits, maxNumber: maxVal }));
                  }} required />
                </div>
                <div className="form-group">
                  <label>Número Mínimo</label>
                  <input className="form-control" type="number" value={createForm.minNumber} onChange={(e) => setCreateForm((f) => ({ ...f, minNumber: parseInt(e.target.value, 10) ?? 0 }))} required />
                </div>
                <div className="form-group">
                  <label>Número Máximo</label>
                  <input className="form-control" type="number" value={createForm.maxNumber} onChange={(e) => setCreateForm((f) => ({ ...f, maxNumber: parseInt(e.target.value, 10) ?? 99 }))} required />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                  <input
                    type="checkbox"
                    id="create-allow-series"
                    checked={createForm.allowSeries || false}
                    onChange={(e) => setCreateForm((f) => ({ ...f, allowSeries: e.target.checked }))}
                    style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <label htmlFor="create-allow-series" style={{ margin: 0, userSelect: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                    Permitir venta por rango (ej: serie del 00 al 99)
                  </label>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Descripción</label>
                  <input className="form-control" value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} placeholder="Sorteo diario personalizado de 2 dígitos" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-full" style={{ padding: '0.8rem', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
                <Plus size={16} /> Crear Juego
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Números bloqueados ──────────────────────────────────
const NumbersTab = () => {
  const { lotteries } = useApp();
  const [selectedLottery, setSelectedLottery] = useState(lotteries[0]?.id || 'la_tica');
  const [blockedNums, setBlockedNums] = useState([]);
  const [newNumber, setNewNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const { dialog } = useDialog();

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

  const lottery = lotteries.find((l) => l.id === selectedLottery);

  const loadBlocked = useCallback(async () => {
    setLoading(true);
    const blocked = await getBlockedNumbers(selectedLottery);
    setBlockedNums(blocked);
    setLoading(false);
  }, [selectedLottery]);

  useEffect(() => { loadBlocked(); }, [loadBlocked]);

  const handleBlock = async () => {
    if (!newNumber.trim()) return;
    await blockNumber(selectedLottery, newNumber.trim());
    toast.success(`Número ${newNumber} bloqueado`);
    setNewNumber('');
    await loadBlocked();
  };

  const handleUnblock = async (num) => {
    await unblockNumber(selectedLottery, num);
    toast.success(`Número ${num} desbloqueado`);
    await loadBlocked();
  };

  const handleClearAll = async () => {
    const ok = await dialog.confirm('Se desbloquearán todos los números cerrados para este juego.', {
      title: '¿Desbloquear todos?',
      type: 'warning',
      confirmLabel: 'Sí, desbloquear',
    });
    if (!ok) return;
    await clearBlockedNumbers(selectedLottery);
    toast.success('Todos los números desbloqueados');
    await loadBlocked();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Cierra números para que no puedan venderse en un juego específico.
      </p>

      {/* Selector de juego */}
      <div className="form-group">
        <label>Tipo de rifa</label>
        <select className="form-control" value={selectedLottery} onChange={(e) => setSelectedLottery(e.target.value)} id="block-lottery-select">
          {lotteries.map((l) => (
            <option key={l.id} value={l.id}>{l.emoji} {l.name}</option>
          ))}
        </select>
      </div>

      {/* Sin selector de sorteo — se eliminó el concepto */}

      {/* Agregar número */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          className="form-control"
          type="number"
          value={newNumber}
          onChange={(e) => setNewNumber(e.target.value)}
          placeholder={lottery?.numberRange ? `Ej: ${lottery.numberRange.min}–${lottery.numberRange.max}` : 'Número'}
          id="block-number-input"
          onKeyDown={(e) => e.key === 'Enter' && handleBlock()}
          style={{ flex: 1, fontSize: '1.1rem', textAlign: 'center', fontWeight: 700 }}
        />
        <button className="btn btn-primary" onClick={handleBlock} id="block-number-btn" style={{ flexShrink: 0 }}>
          <Lock size={16} /> Cerrar
        </button>
      </div>

      {/* Lista de bloqueados */}
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            Números cerrados ({blockedNums.length})
          </span>
          {blockedNums.length > 0 && (
            <button className="btn btn-ghost" onClick={handleClearAll} id="clear-all-blocks-btn" style={{ fontSize: '0.75rem', color: 'var(--neon-red)' }}>
              <Unlock size={13} /> Desbloquear todos
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}><span className="loading-text">Cargando...</span></div>
        ) : blockedNums.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem 0' }}>
            No hay números cerrados
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {blockedNums.map((num) => (
              <div
                key={num}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)',
                  borderRadius: 8, padding: '0.3rem 0.6rem',
                  fontSize: '0.85rem', fontWeight: 700, color: '#f87171',
                }}
              >
                {num}
                <button onClick={() => handleUnblock(num)} style={{ background: 'none', color: '#f87171', lineHeight: 1, padding: '1px' }} aria-label={`Desbloquear ${num}`}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Usuarios ────────────────────────────────────────────
const UsersTab = () => {
  const navigate = useNavigate();
  const { getUsers, createUser, updateUser, deleteUser, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'vendedor' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const { dialog } = useDialog();

  const loadUsers = useCallback(async () => {
    const list = await getUsers();
    setUsers(list);
  }, [getUsers]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createUser(form);
      toast.success('Usuario creado');
      setForm({ username: '', password: '', name: '', role: 'vendedor' });
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user) => {
    if (user.id === currentUser?.id) { toast.error('No puedes desactivarte a ti mismo'); return; }
    const isActive = Number(user.active) === 1;
    await updateUser(user.id, { active: isActive ? 0 : 1 });
    toast.success(isActive ? 'Usuario desactivado' : 'Usuario activado');
    await loadUsers();
  };

  const handleDelete = async (id, username) => {
    const ok = await dialog.danger(`¿Eliminar al usuario "${username}"? Esta acción no se puede deshacer y perderá todos sus datos.`, {
      title: 'Eliminar usuario',
      confirmLabel: 'Sí, eliminar',
    });
    if (!ok) return;
    try {
      await deleteUser(id);
      toast.success('Usuario eliminado');
      await loadUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleChangePassword = async (id) => {
    const newPass = await dialog.prompt('Nueva contraseña:', {
      title: 'Cambiar contraseña',
      placeholder: 'Mínimo 4 caracteres',
      confirmLabel: 'Guardar',
      type: 'info',
    });
    if (!newPass || newPass.length < 4) {
      if (newPass !== null) toast.error('Contraseña muy corta (mínimo 4 caracteres)');
      return;
    }
    await updateUser(id, { password: newPass });
    toast.success('Contraseña actualizada');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Botón agregar */}
      <button
        className="btn btn-primary btn-full"
        onClick={() => setShowForm((v) => !v)}
        id="add-user-btn"
        style={{ padding: '0.75rem' }}
      >
        {showForm ? <><X size={16} /> Cancelar</> : <><UserPlus size={16} /> Agregar usuario</>}
      </button>

      {/* Formulario de creación */}
      {showForm && (
        <div className="card" style={{ animation: 'slideUp 0.2s ease' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>Nuevo usuario</h3>
            <div className="responsive-grid-2col">
              <div className="form-group">
                <label>Nombre completo</label>
                <input className="form-control" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Ej: María García" />
              </div>
              <div className="form-group">
                <label>Usuario</label>
                <input className="form-control" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required placeholder="usuario123" autoComplete="off" />
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-control" type={showPass ? 'text' : 'password'} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={4} placeholder="••••" style={{ paddingRight: '2.25rem' }} autoComplete="new-password" />
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowPass((v) => !v)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}>
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Rol</label>
                <select className="form-control" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="vendedor">Vendedor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading} id="create-user-submit-btn">
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <><UserPlus size={15} /> Crear usuario</>}
            </button>
          </form>
        </div>
      )}

      {/* Lista de usuarios */}
      {users.map((u) => (
        <div key={u.id} className="card" style={{ opacity: u.active ? 1 : 0.6, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: u.role === 'admin' ? 'rgba(168,85,247,0.15)' : 'rgba(96,165,250,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: u.role === 'admin' ? 'var(--neon-purple)' : 'var(--neon-blue)',
            }}>
              {u.role === 'admin' ? <Shield size={18} /> : <Users size={18} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{u.name}</span>
                {u.id === currentUser?.id && <span className="badge badge-active" style={{ fontSize: '0.6rem' }}>Tú</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                @{u.username} · {u.role === 'admin' ? 'Administrador' : 'Vendedor'}
                {!u.active && <span style={{ color: 'var(--neon-red)' }}> · Inactivo</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
              <button className="btn btn-ghost btn-icon" onClick={() => handleChangePassword(u.id)} title="Cambiar contraseña" id={`change-pass-${u.id}`}>
                <Edit3 size={15} color="var(--text-muted)" />
              </button>
              <button onClick={() => handleToggleActive(u)} style={{ background: 'none', padding: '4px' }} id={`toggle-user-${u.id}`}>
                {u.active
                  ? <ToggleRight size={32} color="var(--neon-green)" />
                  : <ToggleLeft size={32} color="var(--text-muted)" />
                }
              </button>
              {u.id !== currentUser?.id && (
                <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(u.id, u.username)} id={`delete-user-${u.id}`}>
                  <Trash2 size={15} color="var(--neon-red)" />
                </button>
              )}
            </div>
          </div>
          
          {/* Accesos rápidos para administrar ventas del usuario */}
          <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: '0.75rem', padding: '0.45rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
              onClick={() => navigate(`/history?sellerId=${u.id}`)}
              id={`view-sales-${u.id}`}
            >
              <Ticket size={13} /> Ver Ventas
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, fontSize: '0.75rem', padding: '0.45rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: 'var(--neon-red)', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}
              onClick={() => navigate(`/history?sellerId=${u.id}&status=cancelled`)}
              id={`view-cancelled-${u.id}`}
            >
              <XCircle size={13} /> Ver Anulados
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Tab: Resultados / Ganadores ─────────────────────────────
const formatHourAmPm = (hourStr) => {
  if (!hourStr) return '';
  const [h, m] = hourStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  const displayM = String(m).padStart(2, '0');
  return `${displayH}:${displayM} ${ampm}`;
};

const ResultsTab = () => {
  const { lotteries } = useApp();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [announcing, setAnnouncing] = useState(false);
  const [lastWinners, setLastWinners] = useState(null);
  const [form, setForm] = useState({
    lotteryId: lotteries[0]?.id || 'la_tica',
    fechaSorteo: new Date().toISOString().split('T')[0],
    numeroGanador: '',
    horaSorteo: '12:00',
  });
  const { dialog } = useDialog();

  const isPast5PM = new Date().getHours() >= 17;

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

  const loadResults = useCallback(async () => {
    setLoading(true);
    try { setResults(await getResults()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadResults(); }, [loadResults]);

  useEffect(() => {
    const selectedGame = lotteries.find((l) => l.id === form.lotteryId) || getLotteryById(form.lotteryId);
    const hours = selectedGame?.drawHours
      ? selectedGame.drawHours.split(',').map(h => h.trim()).filter(Boolean)
      : ['12:00', '15:00', '18:00', '21:00'];
    if (hours.length > 0) {
      setForm((f) => ({ ...f, horaSorteo: hours[0] }));
    }
  }, [form.lotteryId, lotteries]);

  const handleAnnounce = async () => {
    if (!form.numeroGanador.trim()) {
      toast.error(form.lotteryId === 'fechea' ? 'Selecciona la fecha ganadora' : 'Ingresa el número ganador');
      return;
    }
    const lt = getLotteryById(form.lotteryId);
    const displayNum = form.lotteryId === 'fechea' ? formatFecheaDate(form.numeroGanador) : form.numeroGanador;
    const confirmed = await dialog.confirm(
      `Anunciar ${form.lotteryId === 'fechea' ? 'fecha' : 'número'} ${displayNum} como ganador en ${lt?.name} para el ${form.fechaSorteo} a las ${formatHourAmPm(form.horaSorteo)}.`,
      { title: 'Anunciar resultado', type: 'warning', confirmLabel: 'Anunciar' }
    );
    if (!confirmed) return;
    setAnnouncing(true);
    try {
      const res = await announceResult(form);
      setLastWinners(res.winners || []);
      setForm((f) => ({ ...f, numeroGanador: '', horaSorteo: '12:00' }));
      toast.success(res.winners?.length > 0
        ? `¡${res.winners.length} boleto(s) ganador(es)!`
        : 'Resultado anunciado. Sin boletos ganadores.');
      await loadResults();
    } catch (err) { toast.error(err.message); }
    finally { setAnnouncing(false); }
  };

  const handleDelete = async (id) => {
    const confirmed = await dialog.danger(
      'Se eliminará este resultado y los boletos ganadores vuelven a estado activo.',
      { title: 'Eliminar resultado', confirmLabel: 'Sí, eliminar' }
    );
    if (!confirmed) return;
    await deleteResult(id);
    toast.success('Resultado eliminado');
    setLastWinners(null);
    await loadResults();
  };

  const lt = lotteries.find((l) => l.id === form.lotteryId) || getLotteryById(form.lotteryId);

  const lotteryDrawHours = lt?.drawHours
    ? lt.drawHours.split(',').map(h => h.trim()).filter(Boolean)
    : ['12:00', '15:00', '18:00', '21:00'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Anuncia el número ganador. El sistema busca automáticamente boletos vendidos que coincidan y notifica a los vendedores.
      </p>

      {/* Formulario */}
      <div className="card">
        <p className="section-title">Anunciar resultado</p>
        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
          <label>Juego</label>
          <select className="form-control" value={form.lotteryId}
            onChange={(e) => setForm((f) => ({ ...f, lotteryId: e.target.value }))} id="result-lottery-select">
            {lotteries.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="responsive-flex-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Fecha del sorteo</label>
            <div
              onClick={() => {
                if (!isPast5PM) {
                  dialog.alert("La fecha del sorteo está bloqueada para evitar errores de registro en el sistema.");
                }
              }}
              style={{ cursor: !isPast5PM ? 'not-allowed' : 'default', width: '100%' }}
            >
              <input 
                className="form-control" 
                type="date" 
                value={form.fechaSorteo}
                onChange={(e) => isPast5PM && setForm((f) => ({ ...f, fechaSorteo: e.target.value }))} 
                id="result-date-input"
                disabled={!isPast5PM}
                style={{
                  pointerEvents: !isPast5PM ? 'none' : 'auto',
                  opacity: !isPast5PM ? 0.65 : 1
                }}
              />
            </div>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Hora del sorteo</label>
            <select
              className="form-control"
              value={form.horaSorteo}
              onChange={(e) => setForm((f) => ({ ...f, horaSorteo: e.target.value }))}
              id="result-hour-select"
            >
              {lotteryDrawHours.map((dh) => (
                <option key={dh} value={dh}>
                  {formatHourAmPm(dh)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>{form.lotteryId === 'fechea' ? 'Fecha ganadora' : 'Número ganador'}</label>
            {form.lotteryId === 'fechea' ? (
              (() => {
                const parts = (form.numeroGanador || '').split('/');
                const currentDay = parts[0] || '';
                const currentMonth = parts[1] || '';

                const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
                const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

                const handleDayChange = (e) => {
                  const newDay = e.target.value;
                  const newMonth = currentMonth || '01';
                  setForm((f) => ({ ...f, numeroGanador: newDay ? `${newDay}/${newMonth}` : '' }));
                };

                const handleMonthChange = (e) => {
                  const newDay = currentDay || '01';
                  const newMonth = e.target.value;
                  setForm((f) => ({ ...f, numeroGanador: newMonth ? `${newDay}/${newMonth}` : '' }));
                };

                return (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <select
                      className="form-control"
                      value={currentDay}
                      onChange={handleDayChange}
                      style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '0.95rem', padding: '0.35rem 0.2rem' }}
                      id="result-fechea-day-select"
                    >
                      <option value="">Día</option>
                      {days.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <select
                      className="form-control"
                      value={currentMonth}
                      onChange={handleMonthChange}
                      style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '0.95rem', padding: '0.35rem 0.2rem' }}
                      id="result-fechea-month-select"
                    >
                      <option value="">Mes</option>
                      {months.map((label, idx) => {
                        const mVal = String(idx + 1).padStart(2, '0');
                        return (
                          <option key={mVal} value={mVal}>{label}</option>
                        );
                      })}
                    </select>
                  </div>
                );
              })()
            ) : (
              <input className="form-control" type="number" value={form.numeroGanador}
                onChange={(e) => setForm((f) => ({ ...f, numeroGanador: e.target.value }))}
                placeholder={lt?.numberRange ? `${lt.numberRange.min}–${lt.numberRange.max}` : '0'}
                style={{ fontWeight: 900, fontSize: '1.1rem', textAlign: 'center' }}
                onKeyDown={(e) => e.key === 'Enter' && handleAnnounce()} id="result-number-input" />
            )}
          </div>
        </div>
        <button className="btn btn-primary btn-full" onClick={handleAnnounce} disabled={announcing}
          id="announce-result-btn" style={{ padding: '0.85rem' }}>
          {announcing
            ? <span className="spinner" style={{ width: 18, height: 18 }} />
            : <><Trophy size={16} /> Anunciar ganador</>}
        </button>
      </div>

      {/* Ganadores del último anuncio */}
      {lastWinners !== null && (
        <div className="card" style={{ borderColor: lastWinners.length > 0 ? 'rgba(251,191,36,0.4)' : 'var(--border)' }}>
          <p className="section-title" style={{ color: lastWinners.length > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
            {lastWinners.length > 0 ? `${lastWinners.length} boleto(s) ganador(es)` : 'Sin boletos ganadores'}
          </p>
          {lastWinners.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {lastWinners.map((w, i) => (
                <div key={i} style={{
                  background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                  borderRadius: 'var(--radius-md)', padding: '0.75rem',
                }}>
                  <div style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{form.lotteryId === 'fechea' ? formatFecheaDate(w.numero) : `#${w.numero}`}</span>
                    <span style={{ color: 'var(--neon-green)' }}>{lt?.priceLabel}{parseFloat(w.monto).toFixed(2)}</span>
                  </div>
                  {w.comprador && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>Comprador: {w.comprador}</div>}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Vendedor: {w.sellerName}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ningún boleto coincide con este número.</p>
          )}
        </div>
      )}

      {/* Historial de resultados */}
      <div>
        <p className="section-title">Historial de resultados</p>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}><span className="loading-text">Cargando...</span></div>
        ) : results.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay resultados anunciados aún</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {results.map((r) => {
              const rlt = lotteries.find((l) => l.id === r.lotteryId) || getLotteryById(r.lotteryId);
              return (
                <div key={r.id} className="card"
                  style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neon-purple)', flexShrink: 0 }}>
                    <Gamepad2 size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{rlt?.name}</span>
                      <span style={{ fontWeight: 900, color: '#fbbf24', fontSize: '1.05rem' }}>
                        {r.lotteryId === 'fechea' ? formatFecheaDate(r.numeroGanador) : `#${r.numeroGanador}`}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {r.fechaSorteo} {r.horaSorteo && `(${formatHourAmPm(r.horaSorteo)})`} · {r.announcedBy}
                      {r.winnersCount > 0 && (
                        <span style={{ marginLeft: 8, color: '#fbbf24', fontWeight: 700 }}>
                          {r.winnersCount} ganador{r.winnersCount !== 1 ? 'es' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(r.id)}
                    style={{ color: 'var(--neon-red)', flexShrink: 0 }} id={`delete-result-${r.id}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Cierre Diario y Salarios ───────────────────────────
const SalariesTab = () => {
  const { updateUser } = useAuth();
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSalary, setEditingSalary] = useState({}); // stores user_id -> { type, value }
  const [savingId, setSavingId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const fetchReport = useCallback(async (showToast = false) => {
    setLoading(true);
    NProgress.start();
    try {
      const res = await api.get('/users.php?report=1');
      const rData = res.report || [];
      setReport(rData);

      // Auto-select first user if none is selected or the selected user is no longer in the report
      setSelectedUserId((prev) => {
        if (prev && rData.some(u => u.id === prev)) {
          return prev;
        }
        return rData.length > 0 ? rData[0].id : null;
      });

      if (showToast) toast.success('Reporte diario actualizado');
    } catch (err) {
      toast.error('Error al cargar reporte: ' + err.message);
    } finally {
      setLoading(false);
      NProgress.done();
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSaveSalary = async (userId) => {
    const editData = editingSalary[userId];
    if (!editData) return;
    if (editData.value === undefined || editData.value === null || editData.value === '' || editData.value < 0) {
      toast.error('Ingresa un valor válido para el salario (mínimo 0)');
      return;
    }
    setSavingId(userId);
    NProgress.start();
    try {
      await updateUser(userId, {
        salary_type: editData.type,
        salary_value: parseFloat(editData.value)
      });
      toast.success('Salario actualizado con éxito');
      setEditingSalary((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
      await fetchReport();
    } catch (err) {
      toast.error('Error al actualizar salario: ' + err.message);
    } finally {
      setSavingId(null);
      NProgress.done();
    }
  };

  const handleCancelEdit = (userId) => {
    setEditingSalary((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
  };

  const startEdit = (user) => {
    setEditingSalary((prev) => ({
      ...prev,
      [user.id]: {
        type: user.salary_type || 'percentage',
        value: parseFloat(user.salary_value !== undefined ? user.salary_value : 10.00)
      }
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.2s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          Supervisa las ventas del día, premios liquidados, comisiones/salarios y el balance de efectivo neto de cada vendedor.
        </p>
        <button
          className="btn btn-secondary"
          onClick={() => fetchReport(true)}
          disabled={loading}
          style={{ padding: '0.45rem 0.75rem', gap: '0.4rem', fontSize: '0.75rem', flexShrink: 0 }}
          id="refresh-report-btn"
        >
          <RefreshCw size={12} className={loading ? "spinner" : ""} /> Refrescar
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <p className="loading-text" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cargando datos del reporte...</p>
        </div>
      ) : report.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
          No hay usuarios registrados
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Ocultar scrollbar horizontal en slider */}
          <style>{`
            .sellers-slider::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          {/* Sliding horizontal navbar */}
          <div 
            className="sellers-slider"
            style={{
              display: 'flex',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '5px',
              gap: '6px',
              border: '1px solid var(--border)',
              scrollBehavior: 'smooth',
              scrollbarWidth: 'none', /* Firefox */
              msOverflowStyle: 'none', /* IE 10+ */
              marginBottom: '0.25rem',
            }}
          >
            {report.map((usr) => {
              const isSelected = selectedUserId === usr.id;
              return (
                <button
                  key={usr.id}
                  onClick={() => setSelectedUserId(usr.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.5rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    transition: 'all 0.2s ease',
                    background: isSelected ? 'linear-gradient(135deg, var(--accent), var(--accent-light))' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: isSelected ? '0 2px 10px rgba(124, 58, 237, 0.3)' : 'none',
                  }}
                >
                  {usr.role === 'admin' ? (
                    <Shield size={13} style={{ color: isSelected ? '#fff' : 'var(--neon-purple)' }} />
                  ) : (
                    <Users size={13} style={{ color: isSelected ? '#fff' : 'var(--neon-blue)' }} />
                  )}
                  <span>{usr.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Seller Card */}
          {(() => {
            const u = report.find((x) => x.id === selectedUserId) || report[0];
            if (!u) return null;

            const totalSold = parseFloat(u.total_sold || 0);
            const ticketsSold = parseInt(u.tickets_sold_count || 0);
            const prizesTotal = parseFloat(u.prizes_total || 0);
            const prizesCount = parseInt(u.prizes_count || 0);

            // Calcular salario
            let dailySalary = 0;
            if (u.salary_type === 'fixed') {
              dailySalary = parseFloat(u.salary_value || 0);
            } else {
              dailySalary = totalSold * (parseFloat(u.salary_value || 0) / 100);
            }

            // Total a entregar (caja) = Venta Total - Total Premios + Ajuste (0)
            const adjustment = 0.00;
            const totalToDeliver = totalSold - prizesTotal + adjustment;

            // Total a entregar descontando salario
            const totalToDeliverMinusSalary = totalToDeliver - dailySalary;

            const formatNIO = (val) => {
              const absVal = Math.abs(val);
              const formatted = absVal.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              return val < 0 ? `-NIO ${formatted}` : `NIO ${formatted}`;
            };

            const isNegative = totalToDeliver < 0;
            const isNegativeMinusSalary = totalToDeliverMinusSalary < 0;

            const formattedToDeliver = formatNIO(totalToDeliver);
            const formattedToDeliverMinusSalary = formatNIO(totalToDeliverMinusSalary);

            const editState = editingSalary[u.id];
            const isEditing = editState !== undefined;

            return (
              <div key={u.id} className="card" style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                opacity: u.active ? 1 : 0.6,
                transition: 'all 0.3s ease',
                animation: 'fadeIn 0.25s ease'
              }}>
                {/* Header de la tarjeta */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: u.role === 'admin' ? 'rgba(168,85,247,0.15)' : 'rgba(96,165,250,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: u.role === 'admin' ? 'var(--neon-purple)' : 'var(--neon-blue)',
                    }}>
                      {u.role === 'admin' ? <Shield size={18} /> : <Users size={18} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{u.name}</span>
                        {!u.active && <span className="badge" style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--neon-red)', border: '1px solid rgba(248,113,113,0.3)', fontSize: '0.6rem' }}>Inactivo</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        @{u.username} · {u.role === 'admin' ? 'Administrador' : 'Vendedor'}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (!u.active) {
                        toast.error('Este usuario está deshabilitado, no se puede editar');
                        return;
                      }
                      isEditing ? handleCancelEdit(u.id) : startEdit(u);
                    }}
                    disabled={savingId === u.id}
                    style={{
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.7rem',
                      borderRadius: '6px',
                      background: isEditing ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)',
                      border: isEditing ? '1px solid rgba(248,113,113,0.3)' : '1px solid var(--border)',
                      color: isEditing ? 'var(--neon-red)' : 'var(--text-secondary)',
                      gap: '0.3rem'
                    }}
                  >
                    <Settings2 size={12} /> {isEditing ? 'Cancelar' : 'Establecer Salario'}
                  </button>
                </div>

                {/* Formulario de Configuración de Salario (Edición Inline) */}
                {isEditing && (
                  <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    animation: 'slideUp 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Settings2 size={13} /> Configuración de Salario para {u.name}
                    </div>

                    <div className="responsive-grid-2col">
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.7rem', marginBottom: 2 }}>Tipo de Salario</label>
                        <div style={{
                          display: 'flex',
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: 2
                        }}>
                          <button
                            type="button"
                            onClick={() => setEditingSalary(prev => ({
                              ...prev,
                              [u.id]: { ...prev[u.id], type: 'percentage' }
                            }))}
                            style={{
                              flex: 1,
                              padding: '0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: editState.type === 'percentage' ? 'linear-gradient(135deg, var(--accent), var(--accent-light))' : 'transparent',
                              color: editState.type === 'percentage' ? '#fff' : 'var(--text-muted)',
                              transition: 'all 0.2s',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            Porcentaje
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSalary(prev => ({
                              ...prev,
                              [u.id]: { ...prev[u.id], type: 'fixed' }
                            }))}
                            style={{
                              flex: 1,
                              padding: '0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: editState.type === 'fixed' ? 'linear-gradient(135deg, var(--accent), var(--accent-light))' : 'transparent',
                              color: editState.type === 'fixed' ? '#fff' : 'var(--text-muted)',
                              transition: 'all 0.2s',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            Fijo
                          </button>
                        </div>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '0.7rem', marginBottom: 2 }}>
                          {editState.type === 'fixed' ? 'Monto Diario (NIO)' : 'Comisión de Ventas (%)'}
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          {editState.type === 'fixed' && <span style={{ position: 'absolute', left: 8, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>NIO</span>}
                          <input
                            className="form-control"
                            type="number"
                            step="0.01"
                            min="0"
                            value={editState.value}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                              setEditingSalary(prev => ({
                                ...prev,
                                [u.id]: { ...prev[u.id], value: val }
                              }));
                            }}
                            placeholder="0.00"
                            style={{
                              paddingLeft: editState.type === 'fixed' ? '2.1rem' : '0.6rem',
                              paddingRight: editState.type === 'percentage' ? '1.5rem' : '0.6rem',
                              textAlign: 'right',
                              fontSize: '0.82rem',
                              fontWeight: 700
                            }}
                          />
                          {editState.type === 'percentage' && <span style={{ position: 'absolute', right: 8, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>%</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSaveSalary(u.id)}
                        disabled={savingId === u.id}
                        style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem' }}
                      >
                        {savingId === u.id ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Guardar Salario'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleCancelEdit(u.id)}
                        disabled={savingId === u.id}
                        style={{ flex: 1, padding: '0.45rem', fontSize: '0.75rem' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Métricas Principales (Grid) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.6rem'
                }}>
                  {/* Venta Total */}
                  <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.8rem'
                  }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Venta Total</span>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: 2, color: '#fff' }}>
                      {formatNIO(totalSold)}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: 1 }}>
                      {ticketsSold} boleto{ticketsSold !== 1 ? 's' : ''} vendido{ticketsSold !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Ajuste pago premios */}
                  <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.8rem'
                  }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Ajuste Pago Premios</span>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: 2, color: 'var(--text-secondary)' }}>
                      NIO 0.00
                    </div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--accent-light)', marginTop: 1, fontStyle: 'italic', fontWeight: 500 }}>
                      * Se parametrizará más adelante
                    </div>
                  </div>

                  {/* Total Premios */}
                  <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.8rem'
                  }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Premios</span>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: 2, color: prizesTotal > 0 ? '#fbbf24' : '#fff' }}>
                      {formatNIO(prizesTotal)}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: 1 }}>
                      {prizesCount} boleto{prizesCount !== 1 ? 's' : ''} premiado{prizesCount !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Salario Establecido */}
                  <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.6rem 0.8rem'
                  }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Salario del Día</span>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: 2, color: 'var(--accent-light)' }}>
                      {formatNIO(dailySalary)}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: 1 }}>
                      {u.salary_type === 'fixed'
                        ? `${formatNIO(u.salary_value)} fijo`
                        : `${parseFloat(u.salary_value)}% de ventas`}
                    </div>
                  </div>
                </div>

                {/* Resultados de Balance (Efectivo Neto / Caja) */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  marginTop: '0.2rem'
                }}>
                  {/* Total a entregar (Caja) */}
                  <div style={{
                    background: isNegative ? 'rgba(248,113,113,0.05)' : 'rgba(52,211,153,0.05)',
                    border: isNegative ? '1px solid rgba(248,113,113,0.2)' : '1px solid rgba(52,211,153,0.2)',
                    borderRadius: '10px',
                    padding: '0.85rem 1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    transition: 'all 0.3s ease'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>Total a Entregar (Caja)</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 1 }}>
                        Efectivo recaudado de ventas menos premios liquidados
                      </div>
                    </div>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: 900,
                      color: isNegative ? 'var(--neon-red)' : 'var(--neon-green)',
                      textShadow: isNegative ? '0 0 10px rgba(248,113,113,0.15)' : '0 0 10px rgba(52,211,153,0.15)',
                      fontFamily: 'Outfit, monospace',
                      whiteSpace: 'nowrap'
                    }}>
                      {formattedToDeliver}
                    </div>
                  </div>

                  {/* Total a entregar (Descontando Salario) */}
                  <div style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px dashed var(--border)',
                    borderRadius: '10px',
                    padding: '0.6rem 1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Neto Descontando Salario</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                        Balance si el vendedor se paga su salario de la caja recolectada
                      </div>
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      color: isNegativeMinusSalary ? '#f87171' : '#34d399',
                      fontFamily: 'Outfit, monospace',
                      whiteSpace: 'nowrap'
                    }}>
                      {formattedToDeliverMinusSalary}
                    </div>
                  </div>
                </div>

              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
