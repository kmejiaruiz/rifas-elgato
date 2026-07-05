// ============================================================
// SellTicketScreen — Pantalla de Ventas para Móvil
// Fiel a la app web: sorteo automático, números bloqueados,
// extra fields, modo rango, modal de confirmación y resumen del boleto
// ============================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList, Share,
  Image, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, Trash2, ShoppingCart, Lock, AlertTriangle, CheckCircle, X, ChevronDown, Share2, Printer, QrCode } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, SHADOWS, getThemeColors } from '../styles/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomButton } from '../components/CustomButton';
import { validateJugada, getLotteryById, formatLotteryNumber, LOTTERY_LIST } from '../data/lotteryTypes';
import { getBlockedNumbers, getDisabledGames, getNextAvailableDraw, isDrawOpen, formatHourAmPm } from '../services/gameService';
import { HeaderClock } from '../components/HeaderClock';
import { DigitalTicketModal } from '../components/DigitalTicketModal';
// ─── Helpers para Fechas y Sorteos ─────────────────────────────
const getFecheaPlayValue = (line) => {
  if (!line) return '';
  if (line.numero && typeof line.numero === 'string' && line.numero.includes('/')) {
    return line.numero;
  }
  if (line.fecha && typeof line.fecha === 'string' && line.fecha.includes('/')) {
    return line.fecha;
  }
  return line.numero || '';
};

const formatFecheaDate = (str) => {
  if (!str || typeof str !== 'string') return '—';
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const parts = str.split('/');
  if (parts.length === 2) {
    const m = parseInt(parts[1], 10);
    return `${parts[0]} ${months[(m - 1)] || parts[1]}`;
  }
  return str;
};

const formatDrawDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateStr;
};

// ─── Jugada vacía ─────────────────────────────────────────────
const emptyJugada = (lotteryId, price) => ({
  _id: String(Date.now() + Math.random()),
  numero: '',
  monto: price ? String(price) : '',
  fecha: '',
  modalidad: '',
  serie: '',
  fraccion: '',
});

// ─── Selector de día/mes para Fechea ─────────────────────────
const FecheaPicker = ({ value, onChange }) => {
  const parts = (value || '').split('/');
  const currentDay = parts[0] || '';
  const currentMonth = parts[1] || '';

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  return (
    <View style={styles.fecheaRow}>
      <View style={styles.fecheaPicker}>
        <Text style={styles.fecheaLabel}>Día</Text>
        <ScrollView style={styles.fecheaScroll} nestedScrollEnabled>
          {days.map(d => (
            <TouchableOpacity
              key={d}
              onPress={() => onChange(`${d}/${currentMonth || '01'}`)}
              style={[styles.fecheaOpt, currentDay === d && styles.fecheaOptActive]}
            >
              <Text style={[styles.fecheaOptText, currentDay === d && styles.fecheaOptTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.fecheaPicker}>
        <Text style={styles.fecheaLabel}>Mes</Text>
        <ScrollView style={styles.fecheaScroll} nestedScrollEnabled>
          {monthNames.map((label, idx) => {
            const mVal = String(idx + 1).padStart(2, '0');
            return (
              <TouchableOpacity
                key={mVal}
                onPress={() => onChange(`${currentDay || '01'}/${mVal}`)}
                style={[styles.fecheaOpt, currentMonth === mVal && styles.fecheaOptActive]}
              >
                <Text style={[styles.fecheaOptText, currentMonth === mVal && styles.fecheaOptTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

// ─── Selector nativo de opciones (para extraFields type=select) ──
const SelectPicker = ({ value, options, placeholder, onChange }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <>
      <TouchableOpacity style={styles.selectBtn} onPress={() => setOpen(true)}>
        <Text style={[styles.selectBtnText, !selected && { color: COLORS.textMuted }]}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={14} color={COLORS.textMuted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.selectOverlay} onPress={() => setOpen(false)} activeOpacity={1}>
          <View style={styles.selectSheet}>
            <Text style={styles.selectSheetTitle}>{placeholder}</Text>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.selectOpt, value === opt.value && styles.selectOptActive]}
                onPress={() => { onChange(opt.value); setOpen(false); }}
              >
                <Text style={[styles.selectOptText, value === opt.value && styles.selectOptTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// ─── Editor de una jugada ─────────────────────────────────────
const JugadaRow = ({ jugada, index, lottery, isFechea, blockedNums, onUpdate, onRemove, showRemove }) => {
  const isBlocked = isFechea
    ? (jugada.fecha && blockedNums.includes(jugada.fecha))
    : (jugada.numero !== '' && blockedNums.includes(String(jugada.numero)));

  return (
    <GlassCard style={[styles.jugadaCard, isBlocked && styles.jugadaCardBlocked]}>
      <Text style={styles.jugadaIndex}>Jugada {index + 1}</Text>

      {isBlocked && (
        <View style={styles.blockedBadge}>
          <Lock size={11} color={COLORS.dangerLight} />
          <Text style={styles.blockedBadgeText}>{isFechea ? 'Fecha cerrada' : 'Número cerrado'}</Text>
        </View>
      )}

      <View style={styles.jugadaRow}>
        {/* Número o Fechea */}
        {isFechea ? (
          <View style={{ flex: 2 }}>
            <Text style={styles.fieldLabel}>Fecha</Text>
            <FecheaPicker value={jugada.fecha} onChange={val => onUpdate('fecha', val)} />
          </View>
        ) : (
          <View style={{ flex: 2 }}>
            <Text style={styles.fieldLabel}>
              {lottery.numberRange ? `${lottery.numberRange.min}–${lottery.numberRange.max}` : 'Número'}
            </Text>
            <TextInput
              style={[styles.jugadaInput, isBlocked && styles.jugadaInputBlocked]}
              value={jugada.numero}
              onChangeText={val => onUpdate('numero', val)}
              keyboardType="numeric"
              placeholder={lottery.numberDigits ? '0'.repeat(lottery.numberDigits) : (lottery.numberRange ? `${lottery.numberRange.min}` : '0')}
              placeholderTextColor={COLORS.textMuted}
              textAlign="center"
              maxLength={lottery.numberDigits || 4}
              autoFocus={index === 0}
            />
          </View>
        )}

        {/* Monto */}
        <View style={{ flex: 2 }}>
          <Text style={styles.fieldLabel}>Monto ({lottery.priceLabel?.trim()})</Text>
          <View style={styles.amountWrap}>
            <Text style={styles.currencySymbol}>{lottery.priceLabel}</Text>
            <TextInput
              style={[styles.jugadaInput, { paddingLeft: 36 }]}
              value={jugada.monto}
              onChangeText={val => onUpdate('monto', val)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        </View>

        {/* Botón eliminar */}
        {showRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
            <Trash2 size={18} color={COLORS.dangerLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Extra Fields (modalidad, serie, fraccion) */}
      {lottery.extraFields && lottery.extraFields.length > 0 && (
        <View style={styles.extraFieldsRow}>
          {lottery.extraFields.map(f => (
            <View key={f.key} style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              {f.type === 'select' ? (
                <SelectPicker
                  value={jugada[f.key] || ''}
                  options={f.options || []}
                  placeholder={`${f.label}...`}
                  onChange={val => onUpdate(f.key, val)}
                />
              ) : (
                <TextInput
                  style={styles.jugadaInput}
                  value={jugada[f.key] || ''}
                  onChangeText={val => onUpdate(f.key, val)}
                  placeholder={f.label}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType={f.type === 'number' ? 'numeric' : 'default'}
                />
              )}
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
};

// ─── Modal de confirmación ────────────────────────────────────
const ConfirmModal = ({ visible, lottery, jugadas, comprador, selectedDate, selectedHour, selectedHours = [], totalMonto, loading, onConfirm, onCancel }) => {
  const insets = useSafeAreaInsets();
  if (!lottery) return null;
  const isSummarized = jugadas.length > 5;
  let rangeText = '';
  let unitMonto = 0;

  let missingNums = [];
  if (isSummarized) {
    if (lottery.id === 'fechea') {
      rangeText = `${jugadas.length} Fechas`;
    } else {
      const nums = jugadas.map(j => parseInt(j.numero, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (nums.length > 0) {
        const minNum = nums[0];
        const maxNum = nums[nums.length - 1];
        rangeText = `De ${formatLotteryNumber(lottery.id, minNum)} a ${formatLotteryNumber(lottery.id, maxNum)}`;
        
        for (let i = minNum; i <= maxNum; i++) {
          if (!nums.includes(i)) {
            missingNums.push(formatLotteryNumber(lottery.id, i));
          }
        }
      } else {
        rangeText = `${jugadas.length} números`;
      }
    }
    unitMonto = parseFloat(jugadas[0]?.monto || 0);
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.confirmOverlay}>
        <View style={[styles.confirmSheet, { paddingBottom: 20 + insets.bottom }]}>
          {/* Handle */}
          <View style={styles.handle} />
          <Text style={styles.confirmTitle}>Confirmar Venta</Text>

          <Text style={styles.confirmMeta}>Comprador: <Text style={{ color: '#fff', fontWeight: '700' }}>{comprador || '—'}</Text></Text>
          <Text style={styles.confirmMeta}>
            Fecha: <Text style={{ color: '#fff', fontWeight: '700' }}>{formatDrawDate(selectedDate)}</Text>
            {'  ·  '}
            Sorteo:{' '}
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {lottery.allowMultiDraw && selectedHours && selectedHours.length > 1
                ? selectedHours.map(formatHourAmPm).join(', ')
                : formatHourAmPm(selectedHour)}
            </Text>
          </Text>

          <View style={styles.confirmDivider} />

          {isSummarized && (
            <View style={{
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              borderColor: 'rgba(234, 179, 8, 0.4)',
              borderWidth: 1,
              borderRadius: 8,
              padding: 12,
              flexDirection: 'row',
              gap: 8,
              marginBottom: 14,
              alignItems: 'flex-start',
            }}>
              <AlertTriangle size={18} color="#eab308" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: '#fbbf24', fontWeight: '800', marginBottom: 2 }}>Aviso de Boleto Resumido:</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 15 }}>
                  La cantidad de jugadas ({jugadas.length}) excede la norma de formato estándar. El boleto se generará en formato simplificado de rango para mejorar el diseño y ahorrar papel térmico.
                </Text>
              </View>
            </View>
          )}

          {isSummarized ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>SERIE / RANGO</Text>
                <Text style={[styles.summaryValue, { color: '#fbbf24', fontWeight: '800' }]}>{rangeText}</Text>
              </View>
              {missingNums.length > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: COLORS.dangerLight }]}>OMITIDOS (CERRADOS)</Text>
                  <Text style={[styles.summaryValue, { color: COLORS.dangerLight, fontWeight: '800', fontSize: 11 }]}>
                    {missingNums.map(n => `#${n}`).join(', ')}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>TOTAL NÚMEROS</Text>
                <Text style={styles.summaryValue}>{jugadas.length} jugadas</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>INV. POR NÚMERO</Text>
                <Text style={styles.summaryValue}>{lottery.priceLabel}{unitMonto.toFixed(2)}</Text>
              </View>
              <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.summaryLabel}>PREMIO POR GANADOR</Text>
                <Text style={[styles.summaryValue, { color: COLORS.successLight }]}>
                  {lottery.priceLabel}{(unitMonto * parseFloat(lottery.payoutMultiplier || 80)).toFixed(2)}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.jugadasTable}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>{lottery.id === 'fechea' ? 'FECHA' : 'NÚMERO'}</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>MONTO</Text>
              </View>
              <ScrollView style={{ maxHeight: 200 }}>
                {jugadas.map((j, i) => (
                  <View key={j._id || i} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 2, fontWeight: '800', color: '#fff' }]}>
                      {lottery.id === 'fechea' ? formatFecheaDate(j.fecha) : `#${formatLotteryNumber(lottery.id, j.numero)}`}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', color: COLORS.successLight, fontWeight: '700' }]}>
                      {lottery.priceLabel}{parseFloat(j.monto || 0).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Total */}
          <View style={styles.totalBox}>
            <Text style={styles.totalBoxLabel}>Total</Text>
            <Text style={styles.totalBoxValue}>{lottery.priceLabel}{totalMonto.toFixed(2)}</Text>
          </View>

          <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={loading}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, loading && { opacity: 0.6 }]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.confirmBtnInner}>
                  <CheckCircle size={16} color="#fff" />
                  <Text style={styles.confirmBtnText}>Confirmar</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const generateTicketText = (sale, settings, lottery) => {
  if (!sale || !lottery) return '';
  const now = new Date(sale.createdAt || new Date());
  const dateStr = now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const lines = sale.lines || [];
  const list = [
    '================================',
    `        ${(settings.businessName || 'Zentric').toUpperCase()}`,
    `    ${lottery.name}`,
    '================================',
    `Boleto: #${sale.id?.split('_').pop()?.toUpperCase()}`,
    `Fecha Venta: ${dateStr}`,
    `Fecha Sorteo: ${formatDrawDate(sale.lines?.[0]?.fecha || sale.drawDate)}`,
  ];
  if (sale.horaSorteo || sale.hora_sorteo) {
    list.push(`Sorteo Hora: ${formatHourAmPm(sale.horaSorteo || sale.hora_sorteo)}`);
  }
  list.push(`Comprador: ${sale.comprador || '—'}`);
  list.push(`Vendedor: ${sale.sellerName || 'Vendedor'}`);
  list.push('--------------------------------');

  if (lines.length > 10) {
    let rangeTxt = '';
    const unitM = parseFloat(lines[0]?.monto || 0);
    const winM = unitM * parseFloat(lottery.payoutMultiplier || 80);
    
    if (sale.lotteryId === 'fechea') {
      rangeTxt = `${lines.length} Fechas`;
    } else {
      const nums = lines.map(l => parseInt(l.numero, 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
      if (nums.length > 0) {
        rangeTxt = `De ${nums[0]} a ${nums[nums.length-1]}`;
      } else {
        rangeTxt = `${lines.length} números`;
      }
    }
    
    list.push('   *** COMPRA EN SERIE / RANGO ***');
    list.push(`   Rango: ${rangeTxt}`);
    list.push(`   Cant. Números: ${lines.length}`);
    list.push(`   Inv. por Número: ${lottery.priceLabel || 'NIO '}${unitM.toFixed(2)}`);
    list.push(`   PREMIO GANADOR: ${lottery.priceLabel || 'NIO '}${winM.toFixed(2)}`);
    list.push('--------------------------------');
    list.push(`INVERSION TOTAL: ${lottery.priceLabel || 'NIO '}${parseFloat(sale.monto || 0).toFixed(2)}`);
  } else {
    lines.forEach((l, i) => {
      const numStr = sale.lotteryId === 'fechea'
        ? formatFecheaDate(getFecheaPlayValue(l))
        : `#${l.numero}`;
      list.push(`${i + 1}. ${numStr}  ${lottery.priceLabel || 'NIO '}${parseFloat(l.monto || 0).toFixed(2)}`);
    });
    list.push('--------------------------------');
    list.push(`TOTAL: ${lottery.priceLabel || 'NIO '}${parseFloat(sale.monto || 0).toFixed(2)}`);
  }
  list.push('================================');
  list.push('        ¡Buena suerte!');
  return list.join('\n');
};

const getDrawHoursText = (sale) => {
  if (sale.multiHours && Array.isArray(sale.multiHours) && sale.multiHours.length > 0) {
    return sale.multiHours.map(formatHourAmPm).join(', ');
  }
  const hr = sale.horaSorteo || sale.hora_sorteo || sale.sorteo;
  return hr ? formatHourAmPm(hr) : '';
};

const generateWhatsAppText = (sale, settings, lottery) => {
  if (!sale || !lottery) return '';
  const now = new Date(sale.createdAt || new Date());
  const dateStr = now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const lines = sale.lines || [];
  const list = [
    `🎟️ *${(settings.businessName || 'Zentric').toUpperCase()}* 🎟️`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `*Boleto:* #${sale.id?.split('_').pop()?.toUpperCase()}`,
    `*Sorteo:* ${lottery.name} ${getDrawHoursText(sale) ? `(${getDrawHoursText(sale)})` : ''}`,
    `*Fecha Venta:* ${dateStr}`,
    `*Fecha Sorteo:* ${formatDrawDate(sale.lines?.[0]?.fecha || sale.drawDate)}`,
    `*Vendedor:* ${sale.sellerName || 'Vendedor'}`,
  ];
  list.push(`*Cliente:* ${sale.comprador || '—'}`);
  list.push(`━━━━━━━━━━━━━━━━━━━━━\n`);

  if (lines.length > 10) {
    let rangeTxt = '';
    const unitM = parseFloat(lines[0]?.monto || 0);
    const winM = unitM * parseFloat(lottery.payoutMultiplier || 80);
    
    if (sale.lotteryId === 'fechea') {
      rangeTxt = `${lines.length} Fechas`;
    } else {
      const nums = lines.map(l => parseInt(l.numero, 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
      if (nums.length > 0) {
        rangeTxt = `De ${nums[0]} a ${nums[nums.length-1]}`;
      } else {
        rangeTxt = `${lines.length} números`;
      }
    }
    
    list.push(`*RESUMEN DE COMPRA POR RANGO:*`);
    list.push(`👉 *Serie/Rango:* ${rangeTxt}`);
    list.push(`👉 *Cant. Números:* ${lines.length}`);
    list.push(`👉 *Inv. por Número:* ${settings.currency || 'NIO '}${unitM.toFixed(2)}`);
    list.push(`👉 *Premio por Ganador:* ${settings.currency || 'NIO '}${winM.toFixed(2)}`);
  } else {
    list.push(`*JUGADAS DETALLADAS:*`);
    lines.forEach((l, i) => {
      const numStr = sale.lotteryId === 'fechea'
        ? formatFecheaDate(getFecheaPlayValue(l))
        : `#${l.numero}`;
      const potentialWin = parseFloat(l.monto || 0) * parseFloat(lottery.payoutMultiplier || 80);
      list.push(`👉 [${i + 1}] *${numStr}* | Inv: ${settings.currency || 'NIO '}${parseFloat(l.monto).toFixed(2)} | *Premio: ${settings.currency || 'NIO '}${potentialWin.toFixed(2)}*`);
    });
  }
  list.push(`\n━━━━━━━━━━━━━━━━━━━━━`);
  list.push(`*INVERSIÓN TOTAL:* ${settings.currency || 'NIO '} ${parseFloat(sale.monto).toFixed(2)}`);
  list.push(`*Sello de Autenticidad:* Código QR Verificado ✓`);
  list.push(`_¡Mucha suerte! Revisa tus números en el portal oficial._`);
  return list.join('\n');
};

// ─── Componente principal ─────────────────────────────────────
export const SellTicketScreen = ({ onNavigate }) => {
  const { lotteries, addSale, settings, loading: dataLoading, printTicket, printerConnected, loadAllData, isDarkMode } = useApp();
  const activeColors = getThemeColors(isDarkMode);
  const { user } = useAuth();
  const ticketRef = useRef(null);

  // Cargar/actualizar datos frescos en cada montura
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const [selectedType, setSelectedType] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedHour, setSelectedHour] = useState('12:00');
  const [selectedHours, setSelectedHours] = useState([]); // multi-sorteo
  const [comprador, setComprador] = useState('');
  const [jugadas, setJugadas] = useState([]);
  const [loading, setLoading] = useState(false);

  const [blockedNums, setBlockedNums] = useState([]);
  const [disabledGames, setDisabledGames] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [showVoucher, setShowVoucher] = useState(false);
  const [voucherTheme, setVoucherTheme] = useState('digital');

  // Modo rango
  const [saleMode, setSaleMode] = useState('single');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [rangeMonto, setRangeMonto] = useState('');

  // Cargar juegos deshabilitados al inicio
  useEffect(() => {
    getDisabledGames().then(setDisabledGames);
  }, []);

  // Seleccionar la primera lotería activa
  useEffect(() => {
    if (lotteries.length > 0 && !selectedType) {
      const active = lotteries.filter(l => l.enabled !== false);
      if (active.length > 0) setSelectedType(active[0].id);
    }
  }, [lotteries]);

  // Cuando cambia el tipo de juego o configuraciones
  useEffect(() => {
    if (!selectedType) { setJugadas([]); setBlockedNums([]); return; }

    const lt = lotteries.find(l => l.id === selectedType);
    const closeMin = settings?.drawCloseMinutes ?? 10;
    const hours = lt?.drawHours
      ? lt.drawHours.split(',').map(h => h.trim()).filter(Boolean)
      : ['12:00', '15:00', '18:00', '21:00'];

    const nextDraw = getNextAvailableDraw(closeMin, hours);
    setSelectedDate(nextDraw.date);
    setSelectedHour(nextDraw.hour);
    setSelectedHours([nextDraw.hour]); // reset multi-draw
    setJugadas([emptyJugada(selectedType, lt?.defaultPrice || 0)]);
    setRangeFrom('');
    setRangeTo('');
    setRangeMonto(lt?.defaultPrice ? String(lt.defaultPrice) : '');
    setSaleMode('single');

    getBlockedNumbers(selectedType).then(setBlockedNums);
  }, [selectedType, settings?.drawCloseMinutes, lotteries]);

  const lottery = lotteries.find(l => l.id === selectedType);
  const isFechea = selectedType === 'fechea';
  const isGameDisabled = disabledGames.includes(selectedType);

  // Multi-sorteo: el total se multiplica por la cantidad de horas seleccionadas
  const activeHoursCount = (lottery?.allowMultiDraw && selectedHours.length > 1) ? selectedHours.length : 1;
  const totalMonto = jugadas.reduce((s, j) => s + (parseFloat(j.monto) || 0), 0) * activeHoursCount;

  const lotteryHours = lottery?.drawHours
    ? lottery.drawHours.split(',').map(h => h.trim()).filter(Boolean)
    : ['12:00', '15:00', '18:00', '21:00'];

  const isPast5PM = new Date().getHours() >= 17;

  // ─── Actualizar una jugada ─────────────────────────────────
  const updateJugada = useCallback((idx, field, val) => {
    setJugadas(prev => prev.map((j, i) => i === idx ? { ...j, [field]: val } : j));
  }, []);

  const removeJugada = useCallback((idx) => {
    setJugadas(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [emptyJugada(selectedType, lottery?.defaultPrice || 0)] : next;
    });
  }, [selectedType, lottery]);

  const addJugada = useCallback(() => {
    setJugadas(prev => [...prev, emptyJugada(selectedType, lottery?.defaultPrice || 0)]);
  }, [selectedType, lottery]);

  // ─── Agregar rango ─────────────────────────────────────────
  const handleAddRange = () => {
    if (!lottery) return;
    const desdeVal = parseInt(rangeFrom, 10);
    const hastaVal = parseInt(rangeTo, 10);
    const montoVal = parseFloat(rangeMonto) || 0;

    if (isNaN(desdeVal) || isNaN(hastaVal)) {
      Alert.alert('Datos inválidos', 'Ingrese un rango numérico válido.');
      return;
    }
    if (montoVal <= 0) {
      Alert.alert('Datos inválidos', 'El monto debe ser mayor a 0.');
      return;
    }
    const minL = lottery.numberRange?.min ?? 0;
    const maxL = lottery.numberRange?.max ?? 99;
    if (desdeVal < minL || desdeVal > maxL || hastaVal < minL || hastaVal > maxL) {
      Alert.alert('Límite superado', `El rango debe estar entre ${minL} y ${maxL}.`);
      return;
    }
    const start = Math.min(desdeVal, hastaVal);
    const end = Math.max(desdeVal, hastaVal);
    if (end - start + 1 > 200) {
      Alert.alert('Rango muy amplio', 'No se permiten rangos mayores a 200 números.');
      return;
    }

    const newLines = [];
    let blocked = 0;
    for (let i = start; i <= end; i++) {
      const formatted = formatLotteryNumber(selectedType, i);
      if (blockedNums.includes(String(formatted))) { blocked++; continue; }
      newLines.push({
        _id: String(Date.now() + Math.random() + i),
        numero: formatted,
        monto: rangeMonto,
        fecha: '', modalidad: '', serie: '', fraccion: '',
      });
    }

    if (newLines.length === 0) {
      Alert.alert('Números bloqueados', 'Todos los números del rango están cerrados.');
      return;
    }

    setJugadas(prev => {
      const empty = prev.length === 1 && prev[0].numero === '';
      return empty ? newLines : [...prev, ...newLines];
    });

    if (blocked > 0) {
      Alert.alert('Rango agregado', `Se agregaron ${newLines.length} números. ${blocked} cerrados omitidos.`);
    } else {
      Alert.alert('Rango agregado', `Se agregaron ${newLines.length} números al boleto.`);
    }
  };

  // ─── Click vender ──────────────────────────────────────────
  const handleSellClick = useCallback(() => {
    if (!lottery || isGameDisabled || jugadas.length === 0) return;

    const closeMin = settings?.drawCloseMinutes ?? 10;
    if (!isDrawOpen(selectedDate, selectedHour, closeMin)) {
      Alert.alert('Sorteo cerrado', 'La venta está desactivada para este sorteo.');
      return;
    }

    for (let i = 0; i < jugadas.length; i++) {
      const j = jugadas[i];
      const errs = validateJugada(selectedType, {
        numero: j.numero,
        fecha: isFechea ? j.fecha : j.numero,
        monto: j.monto,
      });
      if (errs.length > 0) {
        Alert.alert(`Jugada ${i + 1} — Datos inválidos`, errs[0]);
        return;
      }
      const isBlocked = isFechea
        ? (j.fecha && blockedNums.includes(j.fecha))
        : (j.numero !== '' && blockedNums.includes(String(j.numero)));
      if (isBlocked) {
        const displayVal = isFechea ? formatFecheaDate(j.fecha) : j.numero;
        Alert.alert('Cerrado', `La jugada (${displayVal}) está cerrada para este juego.`);
        return;
      }
    }

    setShowConfirm(true);
  }, [lottery, isGameDisabled, jugadas, selectedType, blockedNums, selectedDate, selectedHour, isFechea, settings]);

  // ─── Confirmar venta ───────────────────────────────────────
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
        jugadas: jugadas.map(j => ({
          numero:    isFechea ? '' : j.numero,
          monto:     parseFloat(j.monto) || 0,
          fecha:     j.fecha || (!isFechea ? selectedDate : null),
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
      setShowConfirm(false);
      setShowVoucher(true);
      setJugadas([emptyJugada(selectedType, lottery?.defaultPrice || 0)]);
      setComprador('');
    } catch {
      // Manejado en AppContext
    } finally {
      setLoading(false);
    }
  };

  // ─── Compartir por WhatsApp como Imagen/Texto ───────────────
  const handleShareWhatsApp = async (sale, game) => {
    if (Platform.OS !== 'web') {
      const shareText = generateWhatsAppText(sale, settings, game);
      try {
        const { captureRef } = require('react-native-view-shot');
        const Sharing = require('expo-sharing');

        if (ticketRef.current) {
          const localUri = await captureRef(ticketRef, {
            format: 'jpg',
            quality: 0.95,
          });

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(localUri, {
              mimeType: 'image/jpeg',
              dialogTitle: `Boleto ${game.name}`,
              UTI: 'public.jpeg',
            });
          } else {
            await Share.share({
              message: shareText,
            });
          }
        } else {
          await Share.share({
            message: shareText,
          });
        }
      } catch (err) {
        console.warn('[Native Share Error]', err);
        try {
          await Share.share({
            message: shareText,
          });
        } catch {}
      }
      return;
    }

    if (!ticketRef.current) return;
    try {
      const html2canvas = require('html2canvas');
      const element = ticketRef.current;
      // Esperar a que la imagen del QR esté cargada
      const images = element.querySelectorAll('img');
      const imagePromises = Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(imagePromises);

      // Guardar posición de scroll original
      const originalScrollTop = element.scrollTop;
      element.scrollTop = 0;
      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(element, {
        useCORS: true,
        scale: 2.2,
        backgroundColor: voucherTheme === 'digital' ? '#0b0f19' : '#ffffff',
        logging: false,
        height: element.scrollHeight,
        windowHeight: element.scrollHeight,
      });

      element.scrollTop = originalScrollTop;

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) throw new Error('No se pudo generar la imagen.');

      const fileName = `Boleto_${game.name?.replace(/\s+/g, '_')}_${sale.id?.split('_').pop()?.toUpperCase()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      const shareText = generateWhatsAppText(sale, settings, game);

      // Usar Web Share API si está disponible para compartir archivos (ej: navegadores móviles)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Boleto ${game.name}`,
          text: shareText,
        });
      } else {
        // Fallback: intentar copiar al portapapeles y luego abrir WhatsApp
        let copied = false;
        try {
          const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': pngBlob })
            ]);
            copied = true;
          }
        } catch (clipErr) {
          console.warn('[Clipboard write failed]', clipErr);
        }

        if (copied) {
          Alert.alert(
            '¡Boleto Copiado!',
            'La imagen del boleto ha sido copiada al portapapeles. Abre WhatsApp y pégala (Ctrl+V o mantener presionado para pegar).'
          );
        } else {
          // Si no se puede copiar, descargar la imagen
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          Alert.alert(
            'Boleto Descargado',
            'La imagen del boleto se descargó en tu equipo. Abre WhatsApp para adjuntarla y enviar el mensaje.'
          );
        }

        // Abrir WhatsApp con el texto codificado
        const encodedText = encodeURIComponent(shareText);
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
      }
    } catch (err) {
      console.warn('[WhatsApp Share Error]', err);
      // Fallback a compartir texto normal
      const shareText = generateWhatsAppText(sale, settings, game);
      const encodedText = encodeURIComponent(shareText);
      window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
    }
  };

  if (dataLoading) {
    return (
      <View style={[styles.loaderContainer, { backgroundColor: activeColors.bgBase }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { backgroundColor: activeColors.bgBase }]}>
      {/* Barra superior */}
      <View style={[styles.navBar, { 
        justifyContent: 'space-between', 
        backgroundColor: isDarkMode ? '#111827' : '#ffffff', 
        borderBottomColor: activeColors.border 
      }]}>
        <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color={activeColors.textPrimary} />
          <Text style={[styles.navTitle, { color: activeColors.textPrimary }]}>Venta de Boletos</Text>
        </TouchableOpacity>
        <HeaderClock />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* ─── Selector de Lotería ─────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>Seleccionar Lotería</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {lotteries.filter(l => l.enabled !== false).map(game => (
            <TouchableOpacity
              key={game.id}
              style={[styles.gameTab, selectedType === game.id ? styles.gameTabActive : null, { backgroundColor: isDarkMode ? '#1f2937' : '#ffffff', borderColor: activeColors.border }]}
              onPress={() => setSelectedType(game.id)}
              activeOpacity={0.75}
            >
              {game.emoji ? <Text style={{ fontSize: 16, marginBottom: 2 }}>{game.emoji}</Text> : null}
              <Text style={[styles.gameTabText, selectedType === game.id && styles.gameTabTextActive, { color: selectedType === game.id ? '#ffffff' : activeColors.textSecondary }]}>
                {game.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ─── Juego deshabilitado ──────────────────────────── */}
        {selectedType && isGameDisabled && (
          <View style={styles.alertBox}>
            <AlertTriangle size={16} color="#fbbf24" />
            <Text style={styles.alertText}>
              Este juego está deshabilitado. Contacta al administrador.
            </Text>
          </View>
        )}

        {lottery && !isGameDisabled && (
          <>
            {/* ─── Info del juego ───────────────────────────── */}
            <View style={styles.gameInfo}>
              <View style={styles.gameInfoNameRow}>
                {lottery.emoji ? <Text style={styles.gameInfoEmoji}>{lottery.emoji}</Text> : null}
                <Text style={[styles.gameInfoName, { color: activeColors.textPrimary }]}>{lottery.name}</Text>
              </View>
              <Text style={[styles.gameInfoDesc, { color: activeColors.textSecondary }]}>{lottery.description}</Text>
            </View>

            {/* ─── Selectores Fecha y Hora ──────────────────── */}
            <GlassCard style={styles.drawCard}>
              <View style={styles.drawRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: activeColors.textSecondary }]}>Fecha del sorteo</Text>
                  <View style={[styles.dateDisplayBox, !isPast5PM && { opacity: 0.6 }, { backgroundColor: isDarkMode ? 'rgba(17,24,39,0.7)' : '#ffffff', borderColor: activeColors.border }]}>
                    <Text style={[styles.dateDisplayText, { color: activeColors.textPrimary }]}>{formatDrawDate(selectedDate)}</Text>
                    {!isPast5PM && <Lock size={12} color={activeColors.textMuted} />}
                  </View>
                  {!isPast5PM && (
                    <Text style={styles.dateHintText}>Bloqueado hasta las 5 PM</Text>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.fieldLabel, { color: activeColors.textSecondary }]}>
                    Hora del sorteo {lottery?.allowMultiDraw ? <Text style={{ color: COLORS.primaryLight, fontSize: 8.5 }}>(toca varias)</Text> : null}
                  </Text>
                  <View style={styles.hoursGrid}>
                    {lotteryHours.map(hVal => {
                      const open = isDrawOpen(selectedDate, hVal, settings?.drawCloseMinutes ?? 10);
                      const isMultiMode = lottery?.allowMultiDraw;
                      const isSelected = isMultiMode
                        ? selectedHours.includes(hVal)
                        : selectedHour === hVal;
                      const toggleHour = () => {
                        if (!open) return;
                        if (!isMultiMode) { setSelectedHour(hVal); return; }
                        setSelectedHours(prev =>
                          prev.includes(hVal) ? prev.filter(h => h !== hVal) : [...prev, hVal]
                        );
                        if (!selectedHours.includes(hVal)) setSelectedHour(hVal);
                      };
                      return (
                        <TouchableOpacity
                          key={hVal}
                          style={[
                            styles.hourChip,
                            isSelected && styles.hourChipActive,
                            !open && styles.hourChipClosed,
                            { backgroundColor: isSelected ? activeColors.primary : (isDarkMode ? '#1f2937' : '#ffffff'), borderColor: activeColors.border, borderWidth: 1 }
                          ]}
                          onPress={toggleHour}
                          activeOpacity={open ? 0.7 : 1}
                        >
                          <Text style={[
                            styles.hourChipText,
                            isSelected && styles.hourChipTextActive,
                            !open && styles.hourChipTextClosed,
                            { color: isSelected ? '#ffffff' : activeColors.textSecondary }
                          ]}>
                            {formatHourAmPm(hVal)}
                            {!open ? '\n(Cerrado)' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </GlassCard>

            {/* ─── Alerta sorteo cerrado ────────────────────── */}
            {!isDrawOpen(selectedDate, selectedHour, settings?.drawCloseMinutes ?? 10) && (
              <View style={[styles.alertBox, styles.alertDanger]}>
                <AlertTriangle size={16} color={COLORS.dangerLight} />
                <Text style={[styles.alertText, { color: COLORS.dangerLight }]}>
                  La venta está desactivada para este sorteo
                </Text>
              </View>
            )}

            {/* ─── Números bloqueados ───────────────────────── */}
            {blockedNums.length > 0 && (
              <View style={styles.blockedPanel}>
                <View style={styles.blockedPanelHeader}>
                  <Lock size={12} color={COLORS.dangerLight} />
                  <Text style={styles.blockedPanelTitle}>{isFechea ? 'Fechas cerradas' : 'Números cerrados'} ({blockedNums.length})</Text>
                </View>
                <View style={styles.blockedChips}>
                  {blockedNums.map(n => (
                    <View key={n} style={styles.blockedChip}>
                      <Text style={styles.blockedChipText}>{isFechea ? formatFecheaDate(n) : n}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ─── Selector de modo (si allowSeries) ───────── */}
            {lottery.allowSeries && (
              <View style={styles.modeBar}>
                <TouchableOpacity
                  style={[styles.modeBtn, saleMode === 'single' && styles.modeBtnActive]}
                  onPress={() => setSaleMode('single')}
                >
                  <Text style={[styles.modeBtnText, saleMode === 'single' && styles.modeBtnTextActive]}>
                    Número Único
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, saleMode === 'range' && styles.modeBtnActive]}
                  onPress={() => setSaleMode('range')}
                >
                  <Text style={[styles.modeBtnText, saleMode === 'range' && styles.modeBtnTextActive]}>
                    Compra en Rango
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── Editor de rango ──────────────────────────── */}
            {saleMode === 'range' ? (
              <GlassCard style={styles.rangeCard}>
                <Text style={styles.rangeTitleText}>Definir Rango de Números</Text>
                <View style={styles.rangeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Desde</Text>
                    <TextInput
                      style={styles.jugadaInput}
                      value={rangeFrom}
                      onChangeText={setRangeFrom}
                      keyboardType="numeric"
                      placeholder={String(lottery.numberRange?.min ?? 0)}
                      placeholderTextColor={COLORS.textMuted}
                      textAlign="center"
                      autoFocus
                    />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 8 }}>
                    <Text style={styles.fieldLabel}>Hasta</Text>
                    <TextInput
                      style={styles.jugadaInput}
                      value={rangeTo}
                      onChangeText={setRangeTo}
                      keyboardType="numeric"
                      placeholder={String(lottery.numberRange?.max ?? 99)}
                      placeholderTextColor={COLORS.textMuted}
                      textAlign="center"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Monto</Text>
                    <TextInput
                      style={styles.jugadaInput}
                      value={rangeMonto}
                      onChangeText={setRangeMonto}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={COLORS.textMuted}
                      textAlign="center"
                    />
                  </View>
                </View>
                <TouchableOpacity style={styles.addRangeBtn} onPress={handleAddRange}>
                  <Plus size={16} color="#fff" />
                  <Text style={styles.addRangeBtnText}>Agregar Rango al Boleto</Text>
                </TouchableOpacity>

                {/* Lista de números en el carrito (modo rango) */}
                {jugadas.length > 0 && jugadas[0].numero !== '' && (
                  <View style={styles.rangeCartSection}>
                    <View style={styles.rangeCartHeader}>
                      <Text style={styles.rangeCartTitle}>En el Boleto ({jugadas.length})</Text>
                      <TouchableOpacity onPress={() => setJugadas([emptyJugada(selectedType, lottery?.defaultPrice || 0)])}>
                        <Text style={styles.rangeCartClear}>Limpiar</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.rangeCartScroll} horizontal showsHorizontalScrollIndicator={false}>
                      {jugadas.map((j, idx) => (
                        <View key={j._id || idx} style={styles.rangeCartChip}>
                          <Text style={styles.rangeCartChipNum}>#{j.numero}</Text>
                          <Text style={styles.rangeCartChipMonto}>
                            {lottery.priceLabel}{parseFloat(j.monto).toFixed(0)}
                          </Text>
                          <TouchableOpacity onPress={() => removeJugada(idx)} style={{ padding: 2 }}>
                            <X size={10} color={COLORS.textMuted} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </GlassCard>
            ) : (
              /* ─── Editor de jugadas (modo único) ─────────── */
              <>
                {jugadas.map((j, idx) => (
                  <JugadaRow
                    key={j._id}
                    jugada={j}
                    index={idx}
                    lottery={lottery}
                    isFechea={isFechea}
                    blockedNums={blockedNums}
                    onUpdate={(field, val) => updateJugada(idx, field, val)}
                    onRemove={() => removeJugada(idx)}
                    showRemove={jugadas.length > 1}
                  />
                ))}
                <TouchableOpacity style={styles.addJugadaBtn} onPress={addJugada}>
                  <Plus size={16} color={COLORS.primaryLight} />
                  <Text style={styles.addJugadaBtnText}>Agregar número</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ─── Comprador ────────────────────────────────── */}
            <TextInput
              style={styles.compradorInput}
              value={comprador}
              onChangeText={setComprador}
              placeholder="Comprador (opcional)"
              placeholderTextColor={COLORS.textMuted}
            />

            {/* ─── Checkout ─────────────────────────────────── */}
            <GlassCard style={styles.checkoutCard}>
              <View style={styles.checkoutRow}>
                <View>
                  <Text style={styles.checkoutCountLabel}>
                    {jugadas.length} {jugadas.length === 1 ? 'jugada' : 'jugadas'}
                  </Text>
                  <Text style={styles.checkoutTotal}>
                    {lottery.priceLabel}{totalMonto.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.sellBtn, (loading || totalMonto <= 0) && { opacity: 0.5 }]}
                  onPress={handleSellClick}
                  disabled={loading || totalMonto <= 0}
                  activeOpacity={0.8}
                >
                  <ShoppingCart size={22} color="#fff" />
                  <Text style={styles.sellBtnText}>Vender</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>

            {/* ─── Último boleto vendido ────────────────────── */}
            {lastSale && (
              <GlassCard style={styles.lastSaleCard}>
                <View style={styles.lastSaleHeader}>
                  <Text style={styles.lastSaleTitle}>✅ Último boleto vendido</Text>
                  <TouchableOpacity onPress={() => setLastSale(null)}>
                    <X size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.lastSaleMeta}>
                  {getLotteryById(lastSale.lotteryId)?.name}
                  {lastSale.comprador ? ` · ${lastSale.comprador}` : ''}
                </Text>
                {(lastSale.lines || []).slice(0, 8).map((line, i) => (
                  <View key={line.id ?? i} style={styles.lastSaleLine}>
                    <Text style={styles.lastSaleLineNum}>
                      {lastSale.lotteryId === 'fechea'
                        ? formatFecheaDate(getFecheaPlayValue(line))
                        : `#${formatLotteryNumber(lastSale.lotteryId, line.numero)}`}
                    </Text>
                    <Text style={styles.lastSaleLineMonto}>
                      {getLotteryById(lastSale.lotteryId)?.priceLabel}{parseFloat(line.monto).toFixed(2)}
                    </Text>
                  </View>
                ))}
                {lastSale.lines && lastSale.lines.length > 8 && (
                  <Text style={styles.lastSaleMore}>+{lastSale.lines.length - 8} jugadas más...</Text>
                )}
                <View style={styles.lastSaleTotalRow}>
                  <Text style={styles.lastSaleTotalLabel}>Total</Text>
                  <Text style={styles.lastSaleTotalValue}>
                    {getLotteryById(lastSale.lotteryId)?.priceLabel}
                    {parseFloat(lastSale.monto).toFixed(2)}
                  </Text>
                </View>
              </GlassCard>
            )}
          </>
        )}
      </ScrollView>

      {/* ─── Modal de confirmación ────────────────────────────── */}
      <ConfirmModal
        visible={showConfirm}
        lottery={lottery}
        jugadas={jugadas}
        comprador={comprador}
        selectedDate={selectedDate}
        selectedHour={selectedHour}
        selectedHours={selectedHours}
        totalMonto={totalMonto}
        loading={loading}
        onConfirm={handleConfirmSale}
        onCancel={() => setShowConfirm(false)}
      />

      {/* ─── Modal de Comprobante (Voucher Reutilizable) ────────────── */}
      <DigitalTicketModal
        visible={showVoucher}
        sale={lastSale}
        settings={settings}
        onClose={() => setShowVoucher(false)}
      />
    </View>
    </KeyboardAvoidingView>
  );
};

// ─── Estilos ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgBase },
  loaderContainer: { flex: 1, backgroundColor: COLORS.bgBase, justifyContent: 'center', alignItems: 'center' },
  navBar: {
    height: 56, backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', height: '100%' },
  navTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginLeft: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  gameTab: {
    paddingHorizontal: 16, height: 44, borderRadius: RADIUS.full,
    backgroundColor: '#1f2937', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  gameTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight },
  gameTabText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },
  gameTabTextActive: { color: '#fff' },

  alertBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)', borderRadius: RADIUS.md,
    padding: 12, marginBottom: 16,
  },
  alertDanger: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  alertText: { fontSize: 13, color: '#fbbf24', fontWeight: '600', flex: 1 },

  gameInfo: { marginBottom: 12 },
  gameInfoNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  gameInfoEmoji: { fontSize: 18 },
  gameInfoName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  gameInfoDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  drawCard: { padding: 14, marginBottom: 12 },
  drawRow: { flexDirection: 'row', gap: 12 },
  dateDisplayBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(17,24,39,0.7)', borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    height: 44, paddingHorizontal: 12, marginTop: 4,
  },
  dateDisplayText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  dateHintText: { fontSize: 10, color: COLORS.textMuted, marginTop: 3 },

  hoursGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  hourChip: {
    flex: 1, minWidth: '44%', height: 34, borderRadius: RADIUS.sm,
    backgroundColor: '#1f2937', justifyContent: 'center', alignItems: 'center',
  },
  hourChipActive: { backgroundColor: COLORS.primary },
  hourChipClosed: { opacity: 0.4 },
  hourChipText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  hourChipTextActive: { color: '#fff' },
  hourChipTextClosed: { color: COLORS.textMuted },

  blockedPanel: {
    backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)', borderRadius: RADIUS.md,
    padding: 12, marginBottom: 12,
  },
  blockedPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  blockedPanelTitle: { fontSize: 11, fontWeight: '700', color: COLORS.dangerLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  blockedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  blockedChip: {
    backgroundColor: 'rgba(248,113,113,0.18)', borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.4)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  blockedChipText: { color: COLORS.dangerLight, fontWeight: '800', fontSize: 12, fontVariant: ['tabular-nums'] },

  modeBar: { flexDirection: 'row', backgroundColor: '#111827', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
  modeBtn: { flex: 1, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.md },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeBtnText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: '#fff', fontWeight: '800' },

  // Range
  rangeCard: { padding: 14, marginBottom: 12 },
  rangeTitleText: { fontSize: 13, fontWeight: '700', color: COLORS.primaryLight, marginBottom: 12 },
  rangeRow: { flexDirection: 'row', marginBottom: 12 },
  addRangeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, height: 44,
  },
  addRangeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  rangeCartSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10 },
  rangeCartHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rangeCartTitle: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  rangeCartClear: { fontSize: 11, color: COLORS.dangerLight, fontWeight: '700' },
  rangeCartScroll: { maxHeight: 80 },
  rangeCartChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1f2937', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6,
  },
  rangeCartChipNum: { color: '#fff', fontWeight: '800', fontSize: 12 },
  rangeCartChipMonto: { color: COLORS.successLight, fontSize: 11 },

  // Jugada card
  jugadaCard: { padding: 12, marginBottom: 8, position: 'relative' },
  jugadaCardBlocked: { borderColor: 'rgba(239,68,68,0.5)', borderWidth: 1.5 },
  jugadaIndex: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, marginBottom: 4 },
  blockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  blockedBadgeText: { fontSize: 11, color: COLORS.dangerLight, fontWeight: '600' },
  jugadaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
  jugadaInput: {
    height: 44, backgroundColor: 'rgba(17,24,39,0.5)', borderRadius: RADIUS.sm,
    color: '#fff', fontSize: 15, fontWeight: '800', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8,
  },
  jugadaInputBlocked: { borderColor: COLORS.danger, color: COLORS.dangerLight },
  amountWrap: { position: 'relative', justifyContent: 'center' },
  currencySymbol: {
    position: 'absolute', left: 10, zIndex: 1, color: COLORS.textMuted, fontSize: 12, fontWeight: '700',
  },
  removeBtn: { width: 36, height: 44, justifyContent: 'center', alignItems: 'center' },

  extraFieldsRow: { flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' },

  // Fechea picker
  fecheaRow: { flexDirection: 'row', gap: 8, height: 80 },
  fecheaPicker: { flex: 1 },
  fecheaLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
  fecheaScroll: { backgroundColor: 'rgba(17,24,39,0.7)', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  fecheaOpt: { paddingVertical: 6, alignItems: 'center' },
  fecheaOptActive: { backgroundColor: 'rgba(124,58,237,0.25)' },
  fecheaOptText: { color: COLORS.textSecondary, fontSize: 13 },
  fecheaOptTextActive: { color: COLORS.primaryLight, fontWeight: '800' },

  // Select picker
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 44, backgroundColor: 'rgba(17,24,39,0.5)', borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10,
  },
  selectBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  selectOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  selectSheet: { backgroundColor: '#1f2937', borderRadius: RADIUS.lg, width: '100%', maxWidth: 300, padding: 16 },
  selectSheetTitle: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 12, textAlign: 'center' },
  selectOpt: { padding: 12, borderRadius: RADIUS.sm, marginVertical: 2 },
  selectOptActive: { backgroundColor: 'rgba(124,58,237,0.2)' },
  selectOptText: { color: COLORS.textSecondary, fontWeight: '600' },
  selectOptTextActive: { color: COLORS.primaryLight, fontWeight: '800' },

  addJugadaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.primaryLight, borderStyle: 'dashed',
    borderRadius: RADIUS.md, height: 44, marginBottom: 12,
  },
  addJugadaBtnText: { color: COLORS.primaryLight, fontWeight: '700', fontSize: 14 },

  compradorInput: {
    height: 48, backgroundColor: '#1f2937', borderRadius: RADIUS.md,
    color: '#fff', paddingHorizontal: 16, fontSize: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 16,
  },

  checkoutCard: { padding: 16, marginBottom: 16 },
  checkoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkoutCountLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  checkoutTotal: { fontSize: 22, fontWeight: '900', color: COLORS.successLight, marginTop: 2 },
  sellBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: 20, paddingVertical: 12,
    ...SHADOWS.lg,
  },
  sellBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Último boleto
  lastSaleCard: { padding: 14, marginBottom: 20 },
  lastSaleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  lastSaleTitle: { fontSize: 13, fontWeight: '800', color: COLORS.successLight },
  lastSaleMeta: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  lastSaleLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  lastSaleLineNum: { color: '#fff', fontWeight: '800', fontSize: 13 },
  lastSaleLineMonto: { color: COLORS.successLight, fontWeight: '700', fontSize: 13 },
  lastSaleMore: { fontSize: 11, color: COLORS.textMuted, marginVertical: 4, textAlign: 'center' },
  lastSaleTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  lastSaleTotalLabel: { fontSize: 14, fontWeight: '800', color: '#fff' },
  lastSaleTotalValue: { fontSize: 18, fontWeight: '900', color: COLORS.successLight },

  // Confirm modal
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  confirmSheet: {
    backgroundColor: COLORS.bgBase, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 12 },
  confirmMeta: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  confirmDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 },

  summaryCard: {
    backgroundColor: 'rgba(124,58,237,0.08)', borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.3)', padding: 12, marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },
  summaryValue: { fontSize: 14, fontWeight: '800', color: '#fff' },

  jugadasTable: { marginBottom: 12 },
  tableHeader: {
    flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)', marginBottom: 4,
  },
  tableHeaderCell: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  tableCell: { fontSize: 13, color: COLORS.textSecondary },

  totalBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: RADIUS.md,
    padding: 14, marginBottom: 16,
  },
  totalBoxLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  totalBoxValue: { fontSize: 22, fontWeight: '900', color: COLORS.successLight },

  confirmActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, height: 48, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1f2937', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 },
  confirmBtn: {
    flex: 2, height: 48, flexDirection: 'row', gap: 8,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, ...SHADOWS.lg,
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  confirmBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Modal de Comprobante (Voucher)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  voucherModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1f2937',
    borderRadius: RADIUS.lg,
    padding: 16,
    maxHeight: '90%',
  },
  voucherHeaderControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 8,
    marginBottom: 12,
  },
  themeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  themeBtnActive: {
    backgroundColor: COLORS.primary,
  },
  themeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  themeBtnTextActive: {
    color: '#fff',
  },
  closeIconBtn: {
    padding: 4,
  },
  ticketWrapper: {
    borderRadius: 8,
    borderWidth: 1.5,
    maxHeight: 400,
    marginBottom: 16,
  },
  ticketWrapperDigital: {
    backgroundColor: '#0f172a',
    borderColor: '#a855f7',
  },
  ticketWrapperThermal: {
    backgroundColor: '#ffffff',
    borderColor: '#000000',
  },
  ticketBusinessName: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 2,
  },
  ticketBusinessNameDigital: {
    color: '#a855f7',
  },
  ticketBusinessNameThermal: {
    color: '#000000',
    fontFamily: 'Courier',
  },
  ticketTitleLabel: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  ticketTitleLabelDigital: {
    color: '#a855f7',
    borderColor: '#a855f7',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
  },
  ticketTitleLabelThermal: {
    color: '#000',
    borderColor: '#000',
    fontFamily: 'Courier',
  },
  ticketMetaText: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
  },
  ticketMetaTextDigital: {
    color: '#94a3b8',
  },
  ticketMetaTextThermal: {
    color: '#000',
    fontFamily: 'Courier',
    fontWeight: '700',
  },
  ticketInfoBox: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    gap: 2,
  },
  ticketInfoBoxDigital: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(168, 85, 247, 0.15)',
  },
  ticketInfoBoxThermal: {
    borderColor: '#000',
  },
  ticketInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketInfoLabel: {
    fontSize: 11,
    color: '#888',
  },
  ticketInfoValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  ticketDivider: {
    textAlign: 'center',
    marginVertical: 8,
    fontSize: 10,
    color: '#888',
  },
  ticketDividerDigital: {
    color: 'rgba(168, 85, 247, 0.25)',
  },
  ticketDividerThermal: {
    color: '#000',
    fontFamily: 'Courier',
  },
  ticketRangeCard: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  ticketRangeCardDigital: {
    backgroundColor: 'rgba(168, 85, 247, 0.05)',
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  ticketRangeCardThermal: {
    borderColor: '#000',
  },
  ticketRangeTitle: {
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    color: '#888',
    textTransform: 'uppercase',
  },
  ticketRangeValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fbbf24',
    textAlign: 'center',
    marginBottom: 4,
  },
  ticketRangeLabel: {
    fontSize: 11,
    color: '#888',
  },
  ticketRangeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  ticketRangePrize: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
  },
  ticketLinesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#888',
    paddingBottom: 4,
    marginBottom: 4,
  },
  ticketLinesHeaderLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
  },
  ticketLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#555',
  },
  ticketLineNum: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  ticketLineMonto: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'right',
  },
  ticketLinePrize: {
    flex: 1.2,
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'right',
  },
  ticketTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  ticketTotalRowDigital: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  ticketTotalRowThermal: {
    borderColor: '#000',
  },
  ticketTotalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#888',
    textTransform: 'uppercase',
  },
  ticketTotalValue: {
    fontSize: 15,
    fontWeight: '950',
    color: '#fff',
  },
  qrBox: {
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  qrTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
  },
  qrSubtitle: {
    fontSize: 8,
    color: '#888',
  },
  voucherActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  voucherActionBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.md,
  },
  voucherActionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
