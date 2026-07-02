// ─── Página: Vender Boleto con múltiples jugadas ──────────────
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { usePrinter } from '../context/PrinterContext';
import { useAuth } from '../context/AuthContext';
import { LotteryTypeGrid } from '../components/lottery/LotteryTypeCard';
import { getLotteryById, formatLotteryNumber, validateJugada } from '../data/lotteryTypes';
import { getTicketPreviewText } from '../services/printerService';
import { getBlockedNumbers, getDisabledGames } from '../services/gameService';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Printer, Eye, EyeOff, CheckCircle2, AlertTriangle, Lock, ShoppingCart, Sparkles, X } from 'lucide-react';
import { useDialog } from '../components/ui/DialogProvider';
import toast from 'react-hot-toast';
import { TicketVoucher } from '../components/ticket/TicketVoucher';
import { formatFecheaDate, getFecheaPlayValue } from '../utils/dateUtils';

export const DRAW_HOURS = [
  { value: '12:00', label: '12:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '21:00', label: '9:00 PM' },
];

const formatHourAmPm = (hourStr) => {
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

export const getNextAvailableDraw = (closeMinutes = 10, drawHoursArray = ['12:00', '15:00', '18:00', '21:00']) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  const hoursToCheck = drawHoursArray.map(hStr => {
    const [h, m] = hStr.split(':').map(Number);
    return { value: hStr, h: h || 0, m: m || 0 };
  });

  for (const item of hoursToCheck) {
    const drawTime = new Date(currentYear, currentMonth, currentDate, item.h, item.m, 0, 0);
    const limitTime = new Date(drawTime.getTime() - closeMinutes * 60 * 1000);
    if (now.getTime() < limitTime.getTime()) {
      return {
        date: now.toLocaleDateString('sv-SE'),
        hour: item.value
      };
    }
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return {
    date: tomorrow.toLocaleDateString('sv-SE'),
    hour: drawHoursArray[0] || '12:00'
  };
};

export const isDrawOpen = (dateStr, hourStr, closeMinutes = 10) => {
  if (!dateStr || !hourStr) return false;
  const now = new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hh, mm] = hourStr.split(':').map(Number);
  const drawTime = new Date(year, month - 1, day, hh, mm, 0, 0);
  const limitTime = new Date(drawTime.getTime() - closeMinutes * 60 * 1000);
  return now.getTime() < limitTime.getTime();
};

// ─── Jugada vacía por defecto ─────────────────────────────────
const emptyJugada = (lotteryId, price) => ({
  _id: Date.now() + Math.random(),
  numero: '',
  monto: price || '',
  fecha: '',
  modalidad: '',
  serie: '',
  fraccion: '',
});

// ─── Componente editor de jugadas ─────────────────────────────
const JugadasEditor = ({ lotteryId, jugadas, onChange, blockedNums }) => {
  const lottery = getLotteryById(lotteryId);
  if (!lottery) return null;

  const isFechea = lotteryId === 'fechea';

  const update = (idx, field, val) => {
    const next = jugadas.map((j, i) => i === idx ? { ...j, [field]: val } : j);
    onChange(next);
  };

  const remove = (idx) => {
    onChange(jugadas.filter((_, i) => i !== idx));
  };

  const add = () => {
    onChange([...jugadas, emptyJugada(lotteryId, lottery.defaultPrice)]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {jugadas.map((j, idx) => {
        const isBlocked = isFechea
          ? (j.fecha && blockedNums.includes(j.fecha))
          : (j.numero !== '' && blockedNums.includes(String(j.numero)));
        return (
          <div key={j._id} style={{
            background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
            padding: '0.75rem', border: `1.5px solid ${isBlocked ? 'var(--neon-red)' : 'var(--border)'}`,
            position: 'relative',
          }}>
            {isBlocked && (
              <div style={{ fontSize: '0.72rem', color: 'var(--neon-red)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: '0.4rem' }}>
                <Lock size={11} /> Número cerrado
              </div>
            )}

            {/* Fila principal: número + monto */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {/* Número o Fecha */}
              {isFechea ? (
                (() => {
                  const parts = (j.fecha || '').split('/');
                  const currentDay = parts[0] || '';
                  const currentMonth = parts[1] || '';

                  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
                  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

                  const handleDayChange = (e) => {
                    const newDay = e.target.value;
                    const newMonth = currentMonth || '01';
                    update(idx, 'fecha', newDay ? `${newDay}/${newMonth}` : '');
                  };

                  const handleMonthChange = (e) => {
                    const newDay = currentDay || '01';
                    const newMonth = e.target.value;
                    update(idx, 'fecha', newMonth ? `${newDay}/${newMonth}` : '');
                  };

                  return (
                    <div style={{ display: 'flex', gap: '0.25rem', flex: 2 }}>
                      <select
                        className="form-control"
                        value={currentDay}
                        onChange={handleDayChange}
                        style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', padding: '0.2rem' }}
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
                        style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', padding: '0.2rem' }}
                      >
                        <option value="">Mes</option>
                        {["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"].map((label, idx) => {
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
                <div style={{ position: 'relative', flex: 2 }}>
                <input
                  className="form-control"
                  type="number"
                  placeholder={`${lottery.numberRange?.min ?? 0}–${lottery.numberRange?.max ?? 99}`}
                  value={j.numero}
                  onChange={(e) => update(idx, 'numero', e.target.value)}
                  min={lottery.numberRange?.min}
                  max={lottery.numberRange?.max}
                  style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.2rem',
                    color: isBlocked ? 'var(--neon-red)' : 'var(--text-primary)' }}
                  autoFocus={idx === 0}
                />
                </div>
              )}

              {/* Monto */}
              <div style={{ position: 'relative', flex: 2 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  {lottery.priceLabel}
                </span>
                <input
                  className="form-control"
                  type="number"
                  placeholder="0"
                  value={j.monto}
                  onChange={(e) => update(idx, 'monto', e.target.value)}
                  min={1}
                  style={{ paddingLeft: `${Math.max(1.6, 0.6 + lottery.priceLabel.length * 0.65)}rem`, fontWeight: 800 }}
                />
              </div>

              {/* Eliminar */}
              {jugadas.length > 1 && (
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => remove(idx)}
                  style={{ flexShrink: 0, color: 'var(--neon-red)' }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {/* Campos extra (modalidad, serie, fracción) */}
            {lottery.extraFields?.length > 0 && (
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {lottery.extraFields.map((f) =>
                  f.type === 'select' ? (
                    <select
                      key={f.key}
                      className="form-control"
                      value={j[f.key] || ''}
                      onChange={(e) => update(idx, f.key, e.target.value)}
                      style={{ flex: 1, fontSize: '0.82rem' }}
                    >
                      <option value="">{f.label}...</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      key={f.key}
                      className="form-control"
                      placeholder={f.label}
                      value={j[f.key] || ''}
                      onChange={(e) => update(idx, f.key, e.target.value)}
                      style={{ flex: 1, fontSize: '0.82rem' }}
                    />
                  )
                )}
              </div>
            )}

            {/* Badge línea */}
            <div style={{ position: 'absolute', top: 6, right: jugadas.length > 1 ? 36 : 8,
              fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              Jugada {idx + 1}
            </div>
          </div>
        );
      })}

      <button className="btn btn-secondary btn-full" onClick={add} style={{ gap: '0.5rem', fontSize: '0.9rem' }}>
        <Plus size={16} /> Agregar número
      </button>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────
export const SellTicket = () => {
  const { addSale, settings } = useApp();
  const { print, connected, printing } = usePrinter();
  const { user } = useAuth();
  const { dialog } = useDialog();
  const [searchParams] = useSearchParams();

  const isPast5PM = new Date().getHours() >= 17;

  const [selectedType, setSelectedType] = useState(searchParams.get('type') || '');
  const [comprador, setComprador] = useState('');
  const [jugadas, setJugadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [blockedNums, setBlockedNums] = useState([]);
  const [disabledGames, setDisabledGames] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showVoucher, setShowVoucher] = useState(false);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedHour, setSelectedHour] = useState('');
  const [selectedHours, setSelectedHours] = useState([]); // multi-sorteo

  // Estados para venta por rango
  const [saleMode, setSaleMode] = useState('single'); // 'single' o 'range'
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [rangeMonto, setRangeMonto] = useState('');

  // Inicializar sorteo disponible
  useEffect(() => {
    const closeMinutes = settings?.drawCloseMinutes ?? 10;
    const lt = getLotteryById(selectedType);
    const hours = lt?.drawHours
      ? lt.drawHours.split(',').map(h => h.trim()).filter(Boolean)
      : ['12:00', '15:00', '18:00', '21:00'];
    const nextDraw = getNextAvailableDraw(closeMinutes, hours);
    setSelectedDate(nextDraw.date);
    setSelectedHour(nextDraw.hour);
    setSelectedHours([nextDraw.hour]); // reset multi-draw
  }, [settings?.drawCloseMinutes, selectedType]);

  const lottery = getLotteryById(selectedType);
  const isGameDisabled = disabledGames.includes(selectedType);
  const activeHoursCount = (lottery?.allowMultiDraw && selectedHours.length > 1) ? selectedHours.length : 1;
  const totalMonto = jugadas.reduce((s, j) => s + (parseFloat(j.monto) || 0), 0) * activeHoursCount;

  const lotteryDrawHours = lottery?.drawHours
    ? lottery.drawHours.split(',').map(h => h.trim()).filter(Boolean)
    : ['12:00', '15:00', '18:00', '21:00'];

  // Cargar juegos deshabilitados
  useEffect(() => {
    getDisabledGames().then(setDisabledGames);
  }, []);

  // Al cambiar tipo de rifa, resetear jugadas y cargar bloqueados
  useEffect(() => {
    if (!selectedType) { setJugadas([]); setBlockedNums([]); return; }
    const lt = getLotteryById(selectedType);
    setJugadas([emptyJugada(selectedType, lt?.defaultPrice || 0)]);
    getBlockedNumbers(selectedType).then(setBlockedNums);
    setSaleMode('single');
    setRangeFrom('');
    setRangeTo('');
    setRangeMonto(lt?.defaultPrice ? String(lt.defaultPrice) : '');

    const closeMinutes = settings?.drawCloseMinutes ?? 10;
    const hours = lt?.drawHours
      ? lt.drawHours.split(',').map(h => h.trim()).filter(Boolean)
      : ['12:00', '15:00', '18:00', '21:00'];
    const nextDraw = getNextAvailableDraw(closeMinutes, hours);
    setSelectedDate(nextDraw.date);
    setSelectedHour(nextDraw.hour);
  }, [selectedType, settings?.drawCloseMinutes]);

  // Vista previa cuando hay lastSale
  useEffect(() => {
    if (lastSale) setPreviewText(getTicketPreviewText(lastSale, settings.businessName));
  }, [lastSale, settings.businessName]);

  const handleAddRange = async () => {
    if (!lottery) return;
    const desdeVal = parseInt(rangeFrom, 10);
    const hastaVal = parseInt(rangeTo, 10);
    const montoVal = parseFloat(rangeMonto) || 0;

    if (isNaN(desdeVal) || isNaN(hastaVal)) {
      await dialog.alert('Debe ingresar un rango numérico válido ("Desde" y "Hasta").', { title: 'Datos inválidos', type: 'warning' });
      return;
    }
    if (montoVal <= 0) {
      await dialog.alert('El monto debe ser mayor a 0.', { title: 'Datos inválidos', type: 'warning' });
      return;
    }

    const minLimit = lottery.numberRange?.min ?? 0;
    const maxLimit = lottery.numberRange?.max ?? 99;

    if (desdeVal < minLimit || desdeVal > maxLimit || hastaVal < minLimit || hastaVal > maxLimit) {
      await dialog.alert(`El rango debe estar dentro de los límites del juego (${minLimit} - ${maxLimit}).`, { title: 'Límite superado', type: 'warning' });
      return;
    }

    const start = Math.min(desdeVal, hastaVal);
    const end = Math.max(desdeVal, hastaVal);
    
    const count = end - start + 1;
    if (count > 200) {
      await dialog.alert('No se permiten rangos mayores a 200 números por boleto para evitar sobrecargar el sistema.', { title: 'Rango muy amplio', type: 'warning' });
      return;
    }

    const newLines = [];
    let blockedCount = 0;

    for (let i = start; i <= end; i++) {
      const formatted = formatLotteryNumber(selectedType, i);
      if (blockedNums.includes(String(formatted))) {
        blockedCount++;
        continue;
      }
      newLines.push({
        _id: Date.now() + Math.random() + i,
        numero: formatted,
        monto: rangeMonto,
        fecha: '',
        modalidad: '',
        serie: '',
        fraccion: '',
      });
    }

    if (newLines.length === 0) {
      await dialog.alert('No se pudo agregar ningún número del rango ya que todos se encuentran cerrados.', { title: 'Números bloqueados', type: 'warning' });
      return;
    }

    let nextJugadas = [...jugadas];
    if (nextJugadas.length === 1 && nextJugadas[0].numero === '') {
      nextJugadas = newLines;
    } else {
      nextJugadas = [...nextJugadas, ...newLines];
    }

    setJugadas(nextJugadas);
    if (blockedCount > 0) {
      toast.success(`Se agregaron ${newLines.length} números. ${blockedCount} números cerrados fueron omitidos.`);
    } else {
      toast.success(`Se agregaron ${newLines.length} números al boleto.`);
    }
  };

  const handleSellClick = useCallback(async () => {
    if (!lottery || isGameDisabled || jugadas.length === 0) return;

    // Verificar si el sorteo seleccionado está abierto
    const closeMinutes = settings?.drawCloseMinutes ?? 10;
    const open = isDrawOpen(selectedDate, selectedHour, closeMinutes);
    if (!open) {
      await dialog.alert('La venta está desactivada por sorteo', {
        title: 'Sorteo cerrado',
        type: 'warning',
      });
      return;
    }

    // Validar todas las jugadas
    for (const j of jugadas) {
      const errs = validateJugada(selectedType, j);
      if (errs.length > 0) {
        await dialog.alert(errs[0], { title: 'Datos incompletos', type: 'warning' });
        return;
      }
      const isBlocked = selectedType === 'fechea'
        ? (j.fecha && blockedNums.includes(j.fecha))
        : (j.numero !== '' && blockedNums.includes(String(j.numero)));
      if (isBlocked) {
        const displayVal = selectedType === 'fechea' ? formatFecheaDate(j.fecha) : j.numero;
        await dialog.alert(`La jugada (${displayVal}) está cerrada para este juego.`, {
          title: 'Fecha/Número Bloqueado', type: 'warning',
        });
        return;
      }
    }

    setShowConfirm(true);
  }, [lottery, isGameDisabled, jugadas, selectedType, blockedNums, dialog, selectedDate, selectedHour, settings?.drawCloseMinutes]);

  const handleConfirmSale = async () => {
    setLoading(true);
    try {
      const isMulti = lottery?.allowMultiDraw && selectedHours.length > 1;
      const saleData = {
        lotteryId: selectedType,
        comprador: comprador.trim() || null,
        horaSorteo: selectedHour,
        ...(isMulti ? { multiHours: selectedHours } : {}),
        drawDate: selectedDate,
        jugadas: jugadas.map((j) => ({
          numero:    j.numero,
          monto:     parseFloat(j.monto) || 0,
          fecha:     j.fecha || (selectedType !== 'fechea' ? selectedDate : null),
          modalidad: j.modalidad || null,
          serie:     j.serie || null,
          fraccion:  j.fraccion ? parseInt(j.fraccion) : null,
        })),
      };
      const result = await addSale(saleData);
      let saleToDisplay = null;
      if (result?.sales && result.sales.length > 0) {
        saleToDisplay = {
          ...result.sales[0],
          multiHours: result.sales.map(s => s.horaSorteo || s.hora_sorteo)
        };
      } else {
        saleToDisplay = result?.sale || result;
      }
      setLastSale(saleToDisplay);
      setShowVoucher(true);
      setShowConfirm(false);
      setJugadas([emptyJugada(selectedType, lottery?.defaultPrice || 0)]);
      setComprador('');
      toast.success(`¡Boleto vendido! ${lottery?.priceLabel}${totalMonto.toFixed(2)}`);

      if (settings.autoprint && connected) {
        await print(saleToDisplay, settings.businessName);
      }
    } catch (err) {
      toast.error(err.message || 'Error al registrar la venta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.25rem' }}>
        Vender Boleto
      </h1>

      {/* Grid de tipos */}
      <LotteryTypeGrid
        selected={selectedType}
        onSelect={setSelectedType}
        disabledGames={disabledGames}
      />

      {/* Juego deshabilitado */}
      {selectedType && isGameDisabled && (
        <div style={{
          marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', color: 'var(--neon-yellow)',
        }}>
          <AlertTriangle size={18} />
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
            Este juego está deshabilitado. Contacta al administrador.
          </span>
        </div>
      )}

      {/* Editor de jugadas */}
      {lottery && !isGameDisabled && (
        <>
          <div className="divider" style={{ margin: '1rem 0' }} />

          {/* Encabezado del juego */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{lottery.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{lottery.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{lottery.description}</div>
            </div>
          </div>

          {/* Selectores de Sorteo (Fecha y Hora) */}
          <div className="card" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            padding: '1rem',
            marginBottom: '1rem',
            background: 'var(--bg-elevated)',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="draw-date-select" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>
                Fecha del sorteo
              </label>
              <div
                onClick={() => {
                  if (!isPast5PM) {
                    dialog.alert("La fecha del sorteo está bloqueada para evitar errores de registro en el sistema.");
                  }
                }}
                style={{ cursor: !isPast5PM ? 'not-allowed' : 'default', width: '100%' }}
              >
                <input
                  id="draw-date-select"
                  type="date"
                  className="form-control"
                  value={selectedDate}
                  onChange={(e) => isPast5PM && setSelectedDate(e.target.value)}
                  style={{ 
                    width: '100%', 
                    fontWeight: 700,
                    pointerEvents: !isPast5PM ? 'none' : 'auto',
                    opacity: !isPast5PM ? 0.65 : 1
                  }}
                  disabled={!isPast5PM}
                />
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="draw-hour-select" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>
                Hora del sorteo {lottery?.allowMultiDraw && <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>(toca para seleccionar varias)</span>}
              </label>
              {lottery?.allowMultiDraw ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {lotteryDrawHours.map((hourVal) => {
                    const isOpen = isDrawOpen(selectedDate, hourVal, settings?.drawCloseMinutes ?? 10);
                    const isSel = selectedHours.includes(hourVal);
                    return (
                      <button
                        key={hourVal}
                        type="button"
                        onClick={() => {
                          if (!isOpen) return;
                          setSelectedHours(prev =>
                            prev.includes(hourVal) ? prev.filter(h => h !== hourVal) : [...prev, hourVal]
                          );
                          if (!selectedHours.includes(hourVal)) setSelectedHour(hourVal);
                        }}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: 'var(--radius-md)',
                          border: `2px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSel ? 'var(--accent)' : 'transparent',
                          color: isSel ? '#fff' : isOpen ? 'var(--text-primary)' : 'var(--text-muted)',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: isOpen ? 'pointer' : 'not-allowed',
                          opacity: isOpen ? 1 : 0.5,
                        }}
                      >
                        {formatHourAmPm(hourVal)}{!isOpen ? ' ✗' : ''}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <select
                  id="draw-hour-select"
                  className="form-control"
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(e.target.value)}
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  {lotteryDrawHours.map((hourVal) => {
                    const isOpen = isDrawOpen(selectedDate, hourVal, settings?.drawCloseMinutes ?? 10);
                    return (
                      <option key={hourVal} value={hourVal} disabled={!isOpen}>
                        {formatHourAmPm(hourVal)} {!isOpen ? '(Cerrado)' : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>

          {/* Alerta de sorteo cerrado */}
          {!isDrawOpen(selectedDate, selectedHour, settings?.drawCloseMinutes ?? 10) && (
            <div style={{
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              color: 'var(--neon-red)',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>La venta está desactivada por sorteo</span>
            </div>
          )}


          {/* Panel de números bloqueados */}
          {blockedNums.length > 0 && (
            <div style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                marginBottom: '0.5rem', fontSize: '0.75rem',
                color: 'var(--neon-red)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <Lock size={13} /> Números cerrados ({blockedNums.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {blockedNums.map((n) => (
                  <span key={n} style={{
                    background: 'rgba(248,113,113,0.18)',
                    border: '1px solid rgba(248,113,113,0.4)',
                    color: 'var(--neon-red)',
                    borderRadius: '6px',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    letterSpacing: '0.03em',
                  }}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Selector de modo si permite series */}
          {lottery.allowSeries && (
            <div className="admin-tab-bar" style={{ marginBottom: '1.25rem', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => setSaleMode('single')}
                className="admin-tab-btn"
                style={{
                  flex: 1,
                  background: saleMode === 'single' ? 'linear-gradient(135deg, var(--accent), var(--accent-light))' : 'transparent',
                  color: saleMode === 'single' ? '#fff' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                }}
              >
                Número Único
              </button>
              <button
                type="button"
                onClick={() => setSaleMode('range')}
                className="admin-tab-btn"
                style={{
                  flex: 1,
                  background: saleMode === 'range' ? 'linear-gradient(135deg, var(--accent), var(--accent-light))' : 'transparent',
                  color: saleMode === 'range' ? '#fff' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                }}
              >
                Compra en Rango
              </button>
            </div>
          )}

          {/* Editor de jugadas / Rango Selector */}
          {saleMode === 'range' ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--accent-light)' }}>
                Definir Serie o Rango de Números
              </p>
              
              <div className="responsive-grid-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.5rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Desde (De)</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder={`${lottery.numberRange?.min ?? 0}`}
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.05rem' }}
                    autoFocus
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Hasta (A)</label>
                  <input
                    className="form-control"
                    type="number"
                    placeholder={`${lottery.numberRange?.max ?? 99}`}
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.05rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Monto por Número</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                      {lottery.priceLabel}
                    </span>
                    <input
                      className="form-control"
                      type="number"
                      placeholder="0"
                      value={rangeMonto}
                      onChange={(e) => setRangeMonto(e.target.value)}
                      style={{ paddingLeft: `${Math.max(1.6, 0.6 + lottery.priceLabel.length * 0.65)}rem`, fontWeight: 800, fontSize: '1.05rem' }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-full"
                onClick={handleAddRange}
                style={{ marginTop: '0.4rem', gap: '0.5rem', background: 'linear-gradient(135deg, var(--accent), var(--accent-light))', padding: '0.7rem' }}
              >
                <Plus size={16} /> Agregar Rango al Boleto
              </button>

              {/* Lista de jugadas en el carrito para cuando está en modo rango */}
              {jugadas.length > 0 && jugadas[0].numero !== '' && (
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Números en el Boleto ({jugadas.length})
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setJugadas([emptyJugada(selectedType, lottery?.defaultPrice || 0)])}
                      style={{ fontSize: '0.72rem', color: 'var(--neon-red)', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 3 }}
                    >
                      <Trash2 size={12} /> Limpiar Todo
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px', paddingBottom: '2px' }}>
                    {jugadas.map((j, idx) => (
                      <div
                        key={j._id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '0.3rem 0.55rem',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ color: 'var(--text-primary)' }}>#{j.numero}</span>
                        <span style={{ color: 'var(--neon-green)', fontSize: '0.75rem' }}>({lottery.priceLabel}{parseFloat(j.monto).toFixed(0)})</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = jugadas.filter((_, i) => i !== idx);
                            setJugadas(next.length === 0 ? [emptyJugada(selectedType, lottery?.defaultPrice || 0)] : next);
                          }}
                          style={{ background: 'none', color: 'var(--text-muted)', lineHeight: 1, padding: '1px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Eliminar"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <JugadasEditor
              lotteryId={selectedType}
              jugadas={jugadas}
              onChange={setJugadas}
              blockedNums={blockedNums}
            />
          )}

          {/* Comprador */}
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>Comprador (opcional)</label>
            <input
              className="form-control"
              placeholder="Nombre del cliente"
              value={comprador}
              onChange={(e) => setComprador(e.target.value)}
              id="comprador-input"
            />
          </div>

          {/* Total + Botón vender */}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{
              flex: 1, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                TOTAL ({jugadas.length} {jugadas.length === 1 ? 'jugada' : 'jugadas'})
              </span>
              <span style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--neon-green)' }}>
                {lottery.priceLabel}{totalMonto.toFixed(2)}
              </span>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSellClick}
              disabled={loading || totalMonto <= 0}
              id="sell-confirm-btn"
              style={{ padding: '0.85rem 1.25rem', flexShrink: 0 }}
            >
              <ShoppingCart size={18} />
            </button>
          </div>
        </>
      )}

      {/* Último boleto vendido */}
      {lastSale && (
        <>
          <div className="divider" style={{ margin: '1.5rem 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <p className="section-title" style={{ margin: 0 }}>Último boleto</p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowVoucher(true)} 
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', gap: '0.3rem', display: 'flex', alignItems: 'center', background: 'var(--accent-dim)', borderColor: 'var(--accent-light)', color: 'var(--accent-light)' }}
              >
                <Sparkles size={13} /> Boleto Digital
              </button>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowPreview((v) => !v)} title="Texto Plano">
                {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {connected && (
                <button
                  className="btn btn-secondary"
                  onClick={() => print(lastSale, settings.businessName)}
                  disabled={printing}
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  id="reprint-btn"
                >
                  <Printer size={14} /> Reimprimir
                </button>
              )}
            </div>
          </div>

          {/* Resumen del último boleto */}
          <div className="card" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {getLotteryById(lastSale.lotteryId)?.name}
              {lastSale.comprador ? ` · ${lastSale.comprador}` : ''}
            </div>
            {lastSale.lines && lastSale.lines.length > 10 ? (
              (() => {
                const lt = getLotteryById(lastSale.lotteryId);
                const lns = lastSale.lines;
                let rangeTxt = '';
                const unitM = parseFloat(lns[0]?.monto || 0);
                const winM = unitM * parseFloat(lt?.payoutMultiplier || 80);
                
                if (lastSale.lotteryId === 'fechea') {
                  rangeTxt = `${lns.length} Fechas`;
                } else {
                  const nums = lns.map(l => parseInt(l.numero, 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
                  if (nums.length > 0) {
                    rangeTxt = `Rango: De ${formatLotteryNumber(lastSale.lotteryId, nums[0])} a ${formatLotteryNumber(lastSale.lotteryId, nums[nums.length-1])}`;
                  } else {
                    rangeTxt = `${lns.length} números`;
                  }
                }
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Serie Adquirida:</span>
                      <strong style={{ color: 'var(--neon-yellow)' }}>{rangeTxt}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Cant. Jugadas:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{lns.length} números</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Inv. por Número:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{lt?.priceLabel}{unitM.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Premio por Ganador:</span>
                      <strong style={{ color: 'var(--neon-green)' }}>{lt?.priceLabel}{winM.toFixed(2)}</strong>
                    </div>
                  </div>
                );
              })()
            ) : (
              (lastSale.lines || []).map((line, i) => (
                <div key={line.id ?? i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.25rem 0.75rem',
                  padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.88rem' }}>
                  <span style={{ fontWeight: 700 }}>
                    {lastSale.lotteryId === 'fechea' ? formatFecheaDate(getFecheaPlayValue(line)) : `#${formatLotteryNumber(lastSale.lotteryId, line.numero)}`}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {line.fecha && lastSale.lotteryId !== 'fechea' ? line.fecha : '—'}
                  </span>
                  <span style={{ color: 'var(--neon-green)', fontWeight: 800, textAlign: 'right' }}>
                    {getLotteryById(lastSale.lotteryId)?.priceLabel}{parseFloat(line.monto).toFixed(2)}
                  </span>
                </div>
              ))
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontWeight: 900 }}>
              <span>Total</span>
              <span style={{ color: 'var(--neon-green)' }}>
                {getLotteryById(lastSale.lotteryId)?.priceLabel}{parseFloat(lastSale.monto).toFixed(2)}
              </span>
            </div>
          </div>

          {showPreview && (
            <pre className="ticket-preview" style={{ marginTop: '0.75rem' }}>{previewText}</pre>
          )}
          {showVoucher && (
            <TicketVoucher
              sale={lastSale}
              settings={settings}
              onClose={() => setShowVoucher(false)}
            />
          )}
        </>
      )}

      {/* Modal de confirmación */}
      {showConfirm && (
        <ConfirmModal
          lottery={lottery}
          jugadas={jugadas}
          comprador={comprador}
          total={totalMonto}
          loading={loading}
          selectedDate={selectedDate}
          selectedHour={selectedHour}
          onConfirm={handleConfirmSale}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
};

// ─── Modal de confirmación inline ────────────────────────────
const ConfirmModal = ({ lottery, jugadas, comprador, total, loading, selectedDate, selectedHour, onConfirm, onCancel }) => {
  const isSummarized = jugadas.length > 10;
  
  // Calcular datos del rango resumido
  let rangeText = '';
  let unitMonto = 0;
  let winPerNumber = 0;
  
  if (isSummarized) {
    if (lottery.id === 'fechea') {
      rangeText = `${jugadas.length} Fechas`;
      unitMonto = parseFloat(jugadas[0]?.monto || 0);
      winPerNumber = unitMonto * parseFloat(lottery.payoutMultiplier || 80);
    } else {
      const numbersList = jugadas
        .map(j => parseInt(j.numero, 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
        
      if (numbersList.length > 0) {
        const minNum = numbersList[0];
        const maxNum = numbersList[numbersList.length - 1];
        const formattedMin = formatLotteryNumber(lottery.id, minNum);
        const formattedMax = formatLotteryNumber(lottery.id, maxNum);
        rangeText = `De ${formattedMin} a ${formattedMax}`;
      } else {
        rangeText = `${jugadas.length} números`;
      }
      unitMonto = parseFloat(jugadas[0]?.monto || 0);
      winPerNumber = unitMonto * parseFloat(lottery.payoutMultiplier || 80);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h2 className="modal-title">
          Confirmar venta
        </h2>

        {comprador && (
          <div style={{ marginBottom: '0.75rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Comprador: {comprador}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          <span>Fecha: <strong>{selectedDate}</strong></span>
          <span>·</span>
          <span>Sorteo: <strong>{formatHourAmPm(selectedHour)}</strong></span>
        </div>

        {isSummarized ? (
          <div style={{ marginBottom: '1.25rem' }}>
            {/* Alerta de Boleto Simplificado */}
            <div style={{
              display: 'flex',
              gap: '0.6rem',
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              color: 'var(--neon-yellow)',
              fontSize: '0.8rem',
              lineHeight: 1.4,
              marginBottom: '1rem',
              alignItems: 'flex-start'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Aviso de Boleto Resumido:</strong> La cantidad de jugadas ({jugadas.length}) excede la norma de formato estándar. El boleto se generará en formato simplificado de rango para mejorar el diseño y ahorrar papel térmico.
              </div>
            </div>

            {/* Tarjeta de Resumen Premium */}
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1.5px dashed var(--accent)',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Serie / Rango</span>
                <span style={{ fontWeight: 900, color: 'var(--neon-yellow)', fontSize: '1.1rem' }}>{rangeText}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Números</span>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{jugadas.length} jugadas</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Inv. por Número</span>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{lottery.priceLabel}{unitMonto.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Premio por Ganador</span>
                <span style={{ fontWeight: 950, color: 'var(--neon-green)', fontSize: '1.05rem' }}>{lottery.priceLabel}{winPerNumber.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Tabla de jugadas */
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.25rem 0.75rem',
              fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: '0.4rem', paddingBottom: '0.4rem',
              borderBottom: '1px solid var(--border)' }}>
              <span>{lottery.id === 'fechea' ? 'Fecha' : 'Número'}</span><span>Fecha</span><span>Monto</span>
            </div>
            {jugadas.map((j, i) => (
              <div key={j._id || i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto',
                gap: '0.25rem 0.75rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border)',
                fontSize: '0.9rem' }}>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                  {lottery.id === 'fechea'
                    ? formatFecheaDate(j.fecha)
                    : `#${String(j.numero).padStart(lottery.numberDigits || 0, '0')}`}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  {j.fecha && lottery.id !== 'fechea' ? j.fecha : '—'}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--neon-green)', textAlign: 'right' }}>
                  {lottery.priceLabel}{parseFloat(j.monto || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem',
          background: 'var(--accent-dim)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
          <span style={{ fontWeight: 700 }}>Total</span>
          <span style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--neon-green)' }}>
            {lottery.priceLabel}{total.toFixed(2)}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-full" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className="btn btn-primary btn-full" onClick={onConfirm} disabled={loading} id="confirm-sale-btn">
            {loading
              ? <span className="spinner" style={{ width: 18, height: 18 }} />
              : <><CheckCircle2 size={18} /> Confirmar</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};
