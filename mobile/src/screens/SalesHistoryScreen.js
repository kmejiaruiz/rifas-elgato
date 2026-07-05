// ============================================================
// SalesHistoryScreen — Historial de Boletos para Móvil
// Fiel a la app web: filtros, métricas, pago de premios,
// lógica de bloqueo de anulación, badges de estado, expansión de jugadas
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, ScrollView, Platform,
  Share, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ChevronLeft, Search, RefreshCw, X, Printer, ShieldAlert,
  ChevronDown, ChevronUp, Trophy, Lock, Ticket, TrendingUp,
  XCircle, CheckCircle, Eye, Share2,
} from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, SHADOWS } from '../styles/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomButton } from '../components/CustomButton';
import { FormInput } from '../components/FormInput';
import { api } from '../services/apiService';
import { getSalesByFilter, getResults } from '../services/storageService';
import { getLotteryById, formatLotteryNumber, LOTTERY_LIST } from '../data/lotteryTypes';
import { formatHourAmPm } from '../services/gameService';
import { HeaderClock } from '../components/HeaderClock';
import { DigitalTicketModal } from '../components/DigitalTicketModal';

// ─── Helpers ──────────────────────────────────────────────────
const today = () => new Date().toLocaleDateString('sv-SE');

const formatDrawDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateStr;
};

const parseDate = (str) => {
  if (!str || typeof str !== 'string') return new Date();
  const clean = str.replace(' ', 'T');
  if (!clean.includes('Z') && !clean.includes('+') && !clean.match(/-\d{2}:\d{2}$/)) {
    return new Date(clean + 'Z');
  }
  return new Date(clean);
};

const formatDateShort = (str) => {
  if (!str) return '—';
  const d = parseDate(str);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const formatTimeShort = (str) => {
  if (!str) return '—';
  const d = parseDate(str);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatFecheaDate = (str) => {
  if (!str) return '—';
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const parts = str.split('/');
  if (parts.length === 2) {
    const m = parseInt(parts[1], 10);
    return `${parts[0]} ${months[(m - 1)] || parts[1]}`;
  }
  return str;
};

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

// ─── Verificar estado de anulación (espejo de la web) ─────────
const checkSaleAnnulmentStatus = (sale, results, userRole) => {
  if (sale.status === 'cancelled') {
    return { isCancelled: true, canAnnul: false, isBlocked: false, requiresAdmin: false };
  }
  if (!sale.lines || sale.lines.length === 0) {
    return { isCancelled: false, canAnnul: true, isBlocked: false, requiresAdmin: userRole !== 'admin' && userRole !== 'root' };
  }

  let hasAnnouncedDraw = false;
  let blockedAnnulment = false;

  for (const line of sale.lines) {
    const lineDate = line.fecha || (sale.createdAt || sale.created_at || '').substring(0, 10);
    const match = results.find(
      res => res.lotteryId === (line.lotteryId || sale.lotteryId || sale.lottery_id)
        && res.fechaSorteo === lineDate
        && res.horaSorteo === (sale.horaSorteo || sale.hora_sorteo)
    );
    if (match) {
      hasAnnouncedDraw = true;
      const saleTime = parseDate(sale.createdAt || sale.created_at).getTime();
      const announcedTime = parseDate(match.announcedAt || match.announced_at).getTime();
      if (saleTime <= announcedTime) blockedAnnulment = true;
    }
  }

  if (blockedAnnulment) {
    return { isCancelled: false, canAnnul: false, isBlocked: true, requiresAdmin: false, hasAnnouncedDraw: true };
  }

  const requiresAdmin = (userRole !== 'admin' && userRole !== 'root') || hasAnnouncedDraw;
  return { isCancelled: false, canAnnul: true, isBlocked: false, requiresAdmin, hasAnnouncedDraw };
};

// ─── Chips de filtro por estado ───────────────────────────────
const STATUS_FILTERS = [
  { val: '', label: 'Todos' },
  { val: 'active', label: 'Activos' },
  { val: 'cancelled', label: 'Anulados' },
  { val: 'winner', label: 'Ganadores' },
];

// ─── Modal de detalle del boleto ─────────────────────────────
const SaleDetailModal = ({ visible, sale, settings, results, userRole, onClose, onReprint, onPayPrize, onAnnul, onOpenDigital }) => {
  const insets = useSafeAreaInsets();
  if (!sale) return null;
  const lottery = getLotteryById(sale.lotteryId || sale.lottery_id);
  const isCancelled = sale.status === 'cancelled';
  const lines = sale.lines || [];
  const hasWinner = lines.some(l => l.status === 'winner');
  const annulStatus = checkSaleAnnulmentStatus(sale, results, userRole);
  const ticketPrize = lines.reduce((acc, l) => {
    if (l.status !== 'winner') return acc;
    const mult = parseFloat(lottery?.payoutMultiplier || 80);
    return acc + parseFloat(l.monto || 0) * mult;
  }, 0);

  // Range formatting for details modal
  const isFechea = (sale.lotteryId || sale.lottery_id) === 'fechea';
  let rangeText = '';
  let rangeCount = lines.length;
  let unitMonto = parseFloat(lines[0]?.monto || 0);

  if (isFechea) {
    rangeText = `${lines.length} Fechas`;
  } else {
    const nums = lines.map(l => parseInt(l.numero, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (nums.length > 0) {
      const firstNum = nums[0];
      const lastNum = nums[nums.length - 1];
      rangeCount = lastNum - firstNum + 1;
      rangeText = `De ${formatLotteryNumber(sale.lotteryId || sale.lottery_id, firstNum)} a ${formatLotteryNumber(sale.lotteryId || sale.lottery_id, lastNum)}`;
    } else {
      rangeText = `${lines.length} números`;
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.detailSheet, { paddingBottom: 18 + insets.bottom }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Cabecera */}
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>
              {lottery?.name} #{sale.id?.slice(-8).toUpperCase()}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.detailScroll} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Info */}
            <GlassCard style={styles.detailInfoCard}>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Sorteo</Text>
                <Text style={styles.detailInfoValue}>{formatHourAmPm(sale.horaSorteo || sale.hora_sorteo)}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Vendedor</Text>
                <Text style={styles.detailInfoValue}>{sale.sellerName || sale.seller_name || '—'}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Cliente</Text>
                <Text style={styles.detailInfoValue}>{sale.comprador || 'Sin cliente'}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Fecha Venta</Text>
                <Text style={styles.detailInfoValue}>{formatDateShort(sale.createdAt || sale.created_at)} {formatTimeShort(sale.createdAt || sale.created_at)}</Text>
              </View>
              <View style={styles.detailInfoRow}>
                <Text style={styles.detailInfoLabel}>Fecha Sorteo</Text>
                <Text style={styles.detailInfoValue}>{formatDrawDate(sale.lines?.[0]?.fecha || sale.drawDate)}</Text>
              </View>
              <View style={[styles.detailInfoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.detailInfoLabel}>Estado</Text>
                <View style={styles.statusBadgeRow}>
                  <View style={[styles.statusBadge, isCancelled ? styles.badgeCancelled : hasWinner ? styles.badgeWinner : styles.badgeActive]}>
                    <Text style={[styles.statusBadgeText, isCancelled ? styles.badgeCancelledText : hasWinner ? styles.badgeWinnerText : styles.badgeActiveText]}>
                      {isCancelled ? 'ANULADO' : hasWinner ? 'GANADOR' : 'ACTIVO'}
                    </Text>
                  </View>
                  {hasWinner && !isCancelled && (
                    <View style={[styles.statusBadge, sale.prizePaid ? styles.badgePaid : styles.badgeUnpaid]}>
                      <Text style={[styles.statusBadgeText, sale.prizePaid ? styles.badgePaidText : styles.badgeUnpaidText]}>
                        {sale.prizePaid ? 'PAGADO' : 'NO PAGADO'}
                      </Text>
                    </View>
                  )}
                  {annulStatus.isBlocked && !isCancelled && (
                    <View style={[styles.statusBadge, styles.badgeBlocked]}>
                      <Lock size={9} color={COLORS.dangerLight} />
                      <Text style={[styles.statusBadgeText, { color: COLORS.dangerLight, marginLeft: 3 }]}>BLOQ.</Text>
                    </View>
                  )}
                </View>
              </View>
            </GlassCard>

            {/* Si tiene ganador: mostrar monto del premio */}
            {hasWinner && !isCancelled && (
              <View style={styles.prizeBox}>
                <Trophy size={16} color="#fbbf24" />
                <Text style={styles.prizeBoxLabel}>Premio: </Text>
                <Text style={styles.prizeBoxValue}>{lottery?.priceLabel}{ticketPrize.toFixed(2)}</Text>
              </View>
            )}

            {/* Cancelación */}
            {isCancelled && sale.cancelledAt && (
              <View style={styles.cancelledBox}>
                <Text style={styles.cancelledBoxText}>
                  Anulado el {formatDateShort(sale.cancelledAt)}
                  {sale.cancelledByName ? ` · por ${sale.cancelledByName}` : ''}
                </Text>
              </View>
            )}

            {/* Tabla de jugadas */}
            <Text style={styles.detailSubtitle}>Jugadas del boleto</Text>
            {lines.length > 6 ? (
              <GlassCard style={{ padding: 14, marginBottom: 12 }}>
                <View style={styles.detailInfoRow}>
                  <Text style={styles.detailInfoLabel}>Rango</Text>
                  <Text style={[styles.detailInfoValue, { color: '#fbbf24' }]}>{rangeText}</Text>
                </View>
                <View style={styles.detailInfoRow}>
                  <Text style={styles.detailInfoLabel}>Cant. Números</Text>
                  <Text style={styles.detailInfoValue}>{rangeCount}</Text>
                </View>
                <View style={[styles.detailInfoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.detailInfoLabel}>Monto por Número</Text>
                  <Text style={styles.detailInfoValue}>{lottery?.priceLabel || 'NIO '}{unitMonto.toFixed(2)}</Text>
                </View>
              </GlassCard>
            ) : (
              <View style={styles.linesTable}>
                <View style={styles.linesTableHeader}>
                  <Text style={[styles.linesTableCell, { flex: 2 }]}>
                    {sale.lotteryId === 'fechea' ? 'FECHA' : 'NÚMERO'}
                  </Text>
                  <Text style={[styles.linesTableCell, { flex: 1 }]}>FECHA</Text>
                  <Text style={[styles.linesTableCell, { flex: 1, textAlign: 'right' }]}>MONTO</Text>
                </View>
                {lines.map((line, i) => {
                  const isWinnerLine = line.status === 'winner';
                  return (
                    <View key={line.id ?? i} style={[styles.linesTableRow, isWinnerLine && styles.linesTableRowWinner]}>
                      <Text style={[styles.linesTableData, { flex: 2, fontWeight: '800', color: isWinnerLine ? '#fbbf24' : '#fff' }]}>
                        {isWinnerLine && <Trophy size={11} color="#fbbf24" />}
                        {' '}
                        {(sale.lotteryId || sale.lottery_id) === 'fechea'
                          ? formatFecheaDate(getFecheaPlayValue(line))
                          : `#${formatLotteryNumber(sale.lotteryId || sale.lottery_id, line.numero)}`}
                      </Text>
                      <Text style={[styles.linesTableData, { flex: 1, color: COLORS.textMuted, fontSize: 11 }]}>
                        {line.fecha && (sale.lotteryId || sale.lottery_id) !== 'fechea' ? line.fecha : '—'}
                      </Text>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={[styles.linesTableData, { color: COLORS.successLight, fontWeight: '700', textAlign: 'right' }]}>
                          {lottery?.priceLabel || 'NIO '}{parseFloat(line.monto || 0).toFixed(2)}
                        </Text>
                        {isWinnerLine && (
                          <Text style={{ fontSize: 10, color: '#fbbf24', fontWeight: '900' }}>
                            Ganó: {lottery?.priceLabel || 'NIO '}{(parseFloat(line.monto || 0) * parseFloat(lottery?.payoutMultiplier || 80)).toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Total */}
            <View style={styles.detailTotalRow}>
              <Text style={styles.detailTotalLabel}>Total</Text>
              <Text style={styles.detailTotalValue}>
                {lottery?.priceLabel}{parseFloat(sale.monto || 0).toFixed(2)}
              </Text>
            </View>

            {/* Ver Boleto Digital */}
            <TouchableOpacity 
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 12,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 1,
                borderColor: 'rgba(59, 130, 246, 0.25)',
                borderRadius: RADIUS.md,
                marginTop: 16,
                marginBottom: 8,
              }}
              activeOpacity={0.8}
              onPress={onOpenDigital}
            >
              <Eye size={16} color={COLORS.primaryLight} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.primaryLight }}>
                Ver Boleto Digital (Compartir)
              </Text>
            </TouchableOpacity>

            {/* Acciones */}
            {!isCancelled && (
              <View style={styles.detailActions}>
                {/* Pagar Premio */}
                {hasWinner && !sale.prizePaid && (
                  <TouchableOpacity style={styles.payPrizeBtn} onPress={onPayPrize}>
                    <Trophy size={15} color="#000" />
                    <Text style={styles.payPrizeBtnText}>Pagar Premio</Text>
                  </TouchableOpacity>
                )}

                {/* Reimprimir */}
                <TouchableOpacity style={styles.reprintBtn} onPress={onReprint}>
                  <Printer size={15} color={COLORS.primaryLight} />
                  <Text style={styles.reprintBtnText}>Reimprimir</Text>
                </TouchableOpacity>

                {/* Anular */}
                {annulStatus.isBlocked ? (
                  <TouchableOpacity
                    style={styles.blockedBtn}
                    onPress={() => Alert.alert('Bloqueado', 'Este boleto pertenece a un sorteo ya anunciado y no puede anularse.')}
                  >
                    <Lock size={13} color={COLORS.textMuted} />
                    <Text style={styles.blockedBtnText}>Bloqueado</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.annulBtn} onPress={onAnnul}>
                    <XCircle size={15} color="#fff" />
                    <Text style={styles.annulBtnText}>Anular</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Reusable DigitalTicketModal is imported from '../components/DigitalTicketModal'

// ─── Modal de autenticación de admin (para anular) ────────────
const AdminAuthModal = ({ visible, hasAnnouncedDraw, onSubmit, onCancel }) => {
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  React.useEffect(() => {
    if (!visible) {
      setAdminUser('');
      setAdminPass('');
      setAuthError('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!adminUser.trim() || !adminPass) {
      setAuthError('Complete los campos de administrador.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      await onSubmit(adminUser.trim(), adminPass);
    } catch (err) {
      setAuthError(err.message || 'Credenciales incorrectas.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.authBackdrop}>
        <GlassCard style={styles.authCard}>
          <View style={styles.authHeader}>
            <ShieldAlert size={22} color={COLORS.dangerLight} />
            <Text style={styles.authTitle}>Autorización Requerida</Text>
          </View>
          <Text style={styles.authDesc}>
            {hasAnnouncedDraw
              ? 'Este sorteo ya fue anunciado. Se requieren credenciales de administrador para anular.'
              : 'Se requieren credenciales de administrador para anular este boleto.'}
          </Text>
          <FormInput label="Usuario Administrador" value={adminUser} onChangeText={setAdminUser} placeholder="admin" autoCapitalize="none" />
          <FormInput label="Contraseña" value={adminPass} onChangeText={setAdminPass} placeholder="••••••••" secureTextEntry />
          {authError ? <Text style={styles.authError}>{authError}</Text> : null}
          <View style={styles.authActions}>
            <TouchableOpacity style={styles.authCancelBtn} onPress={onCancel} disabled={authLoading}>
              <Text style={styles.authCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.authSubmitBtn, authLoading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={authLoading}>
              {authLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.authSubmitText}>Autorizar</Text>}
            </TouchableOpacity>
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
};

// ─── Componente principal ─────────────────────────────────────
export const SalesHistoryScreen = ({ onNavigate }) => {
  const { annulSale, paySalePrize, settings, lotteries, loadAllData, printTicket, printerConnected } = useApp();
  const { user } = useAuth();



  const [sales, setSales] = useState([]);
  const [results, setResults] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [filters, setFilters] = useState({
    date: today(),
    lotteryId: '',
    status: '',
    search: '',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [selectedSale, setSelectedSale] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [digitalModalVisible, setDigitalModalVisible] = useState(false);
  const [authModalData, setAuthModalData] = useState(null); // { saleId, hasAnnouncedDraw }
  const [expandedId, setExpandedId] = useState(null);

  // ─── Cargar datos ──────────────────────────────────────────
  const loadSales = useCallback(async () => {
    setLoadingData(true);
    try {
      const [salesResult, resultsResult] = await Promise.all([
        getSalesByFilter(filters),
        getResults(),
      ]);
      setSales(salesResult);
      setResults(resultsResult);
    } catch (err) {
      console.warn('[SalesHistory] Error:', err.message);
    } finally {
      setLoadingData(false);
    }
  }, [filters]);

  useEffect(() => { loadSales(); }, [loadSales]);

  // ─── Métricas ──────────────────────────────────────────────
  const activeSales   = sales.filter(s => s.status === 'active');
  const cancelledSales = sales.filter(s => s.status === 'cancelled');
  const totalVendido  = activeSales.reduce((acc, s) => acc + parseFloat(s.monto || 0), 0);
  const totalPremios  = sales.reduce((acc, s) => {
    if (s.status === 'cancelled' || !s.prizePaid) return acc;
    return acc + (s.lines || []).reduce((lAcc, l) => {
      if (l.status !== 'winner') return lAcc;
      const lt = getLotteryById(s.lotteryId || s.lottery_id);
      return lAcc + parseFloat(l.monto || 0) * parseFloat(lt?.payoutMultiplier || 80);
    }, 0);
  }, 0);

  // ─── Acciones ──────────────────────────────────────────────
  const handleOpenDetail = (sale) => {
    setSelectedSale(sale);
    setDetailVisible(true);
  };

  const handleCloseDetail = () => {
    setDetailVisible(false);
    setSelectedSale(null);
  };

  const handleAnnulClick = (sale) => {
    const annulStatus = checkSaleAnnulmentStatus(sale, results, user?.role);
    if (annulStatus.isBlocked) {
      Alert.alert('Bloqueado', 'No se puede anular: sorteo ya anunciado.');
      return;
    }
    if (!annulStatus.requiresAdmin) {
      // Admin directo sin credenciales extra
      Alert.alert(
        'Confirmar Anulación',
        `¿Anular el boleto #${sale.id?.slice(-8).toUpperCase()}? Esta acción no se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Anular',
            style: 'destructive',
            onPress: async () => {
              try {
                const updated = await annulSale(sale.id);
                setSales(prev => prev.map(s => s.id === sale.id ? { ...s, ...updated } : s));
                setDetailVisible(false);
              } catch {}
            },
          },
        ]
      );
    } else {
      setAuthModalData({ saleId: sale.id, hasAnnouncedDraw: annulStatus.hasAnnouncedDraw });
    }
  };

  const handleAdminAuthSubmit = async (adminUsername, adminPassword) => {
    const res = await api.post('/auth.php', { username: adminUsername, password: adminPassword });
    if (!res.user || (res.user.role !== 'admin' && res.user.role !== 'root')) {
      throw new Error('Las credenciales no corresponden a un administrador.');
    }
    // Confirmar anulación con credenciales
    Alert.alert(
      'Confirmar Anulación',
      '¿Anular este boleto? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => setAuthModalData(null) },
        {
          text: 'Anular',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await annulSale(authModalData.saleId, { adminUsername, adminPassword });
              setSales(prev => prev.map(s => s.id === authModalData.saleId ? { ...s, ...updated } : s));
              setDetailVisible(false);
              setAuthModalData(null);
            } catch {}
          },
        },
      ]
    );
  };

  const handlePayPrize = (sale) => {
    Alert.alert(
      'Pagar Premio',
      '¿Confirmas que deseas marcar este premio como pagado? Esta acción es irreversible.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, pagar',
          onPress: async () => {
            try {
              const updated = await paySalePrize(sale.id);
              setSales(prev => prev.map(s => s.id === sale.id ? { ...s, ...updated } : s));
              if (selectedSale?.id === sale.id) setSelectedSale(prev => ({ ...prev, ...updated }));
            } catch {}
          },
        },
      ]
    );
  };

  // ─── Tarjeta de venta en la lista ─────────────────────────
  const renderItem = ({ item }) => {
    const lottery = getLotteryById(item.lotteryId || item.lottery_id);
    const isCancelled = item.status === 'cancelled';
    const lines = item.lines || [];
    const hasWinner = lines.some(l => l.status === 'winner');
    const annulStatus = checkSaleAnnulmentStatus(item, results, user?.role);
    const isExpanded = expandedId === item.id;

    // Range formatting for inline list item
    const isItemFechea = (item.lotteryId || item.lottery_id) === 'fechea';
    let itemRangeText = '';
    let itemRangeCount = lines.length;
    let itemUnitMonto = parseFloat(lines[0]?.monto || 0);

    if (isItemFechea) {
      itemRangeText = `${lines.length} Fechas`;
    } else {
      const nums = lines.map(l => parseInt(l.numero, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (nums.length > 0) {
        const firstNum = nums[0];
        const lastNum = nums[nums.length - 1];
        itemRangeCount = lastNum - firstNum + 1;
        itemRangeText = `De ${formatLotteryNumber(item.lotteryId || item.lottery_id, firstNum)} a ${formatLotteryNumber(item.lotteryId || item.lottery_id, lastNum)}`;
      } else {
        itemRangeText = `${lines.length} números`;
      }
    }

    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => setExpandedId(isExpanded ? null : item.id)}>
        <GlassCard style={[
          styles.saleCard,
          isCancelled && styles.saleCardCancelled,
          hasWinner && !isCancelled && styles.saleCardWinner,
        ]}>
          {/* Fila principal */}
          <View style={styles.saleMainRow}>
            {/* Icono */}
            <View style={[styles.saleIcon, hasWinner && styles.saleIconWinner]}>
              <Ticket size={18} color={hasWinner ? '#fbbf24' : (lottery?.color || COLORS.textSecondary)} />
            </View>

            {/* Info */}
            <View style={styles.saleInfo}>
              <View style={styles.saleTitleRow}>
                <Text style={styles.saleName}>
                  {lottery?.name} {item.horaSorteo || item.hora_sorteo ? `(${formatHourAmPm(item.horaSorteo || item.hora_sorteo)})` : ''}
                </Text>
                <View style={[styles.statusBadge, isCancelled ? styles.badgeCancelled : hasWinner ? styles.badgeWinner : styles.badgeActive]}>
                  <Text style={[styles.statusBadgeText, isCancelled ? styles.badgeCancelledText : hasWinner ? styles.badgeWinnerText : styles.badgeActiveText]}>
                    {isCancelled ? (item.cancelledByName ? `Anulado` : 'Anulado') : hasWinner ? 'Ganador' : 'Activo'}
                  </Text>
                </View>
                {hasWinner && !isCancelled && (
                  <View style={[styles.statusBadge, item.prizePaid ? styles.badgePaid : styles.badgeUnpaid]}>
                    <Text style={[styles.statusBadgeText, item.prizePaid ? styles.badgePaidText : styles.badgeUnpaidText]}>
                      {item.prizePaid ? 'Pagado' : 'No Pagado'}
                    </Text>
                  </View>
                )}
                {annulStatus.isBlocked && !isCancelled && (
                  <View style={[styles.statusBadge, styles.badgeBlocked]}>
                    <Lock size={8} color={COLORS.dangerLight} />
                  </View>
                )}
              </View>
              <Text style={styles.saleSub}>
                {lines.length} {lines.length === 1 ? 'jugada' : 'jugadas'}
                {item.comprador ? ` · ${item.comprador}` : ''}
                {' · '}{formatTimeShort(item.createdAt || item.created_at)}
              </Text>
            </View>

            {/* Monto + chevron */}
            <View style={styles.saleRight}>
              <Text style={[
                styles.saleMonto,
                isCancelled && styles.salemontoCancelled,
                hasWinner && !isCancelled && styles.salemontOwinner,
              ]}>
                {lottery?.priceLabel}{parseFloat(item.monto || 0).toFixed(2)}
              </Text>
              {hasWinner && !isCancelled && (
                <Text style={styles.saleWinAmount}>
                  Ganó: {lottery?.priceLabel}{(lines.reduce((a, l) => l.status === 'winner' ? a + parseFloat(l.monto || 0) * parseFloat(lottery?.payoutMultiplier || 80) : a, 0)).toFixed(2)}
                </Text>
              )}
              {isExpanded
                ? <ChevronUp size={13} color={COLORS.textMuted} />
                : <ChevronDown size={13} color={COLORS.textMuted} />}
            </View>
          </View>

          {/* Jugadas expandidas */}
          {isExpanded && (
            <View style={styles.expandedSection}>
              {lines.length > 6 ? (
                <GlassCard style={{ padding: 14, marginBottom: 12 }}>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Rango</Text>
                    <Text style={[styles.detailInfoValue, { color: '#fbbf24' }]}>{itemRangeText}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Cant. Números</Text>
                    <Text style={styles.detailInfoValue}>{itemRangeCount}</Text>
                  </View>
                  <View style={[styles.detailInfoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.detailInfoLabel}>Monto por Número</Text>
                    <Text style={styles.detailInfoValue}>{lottery?.priceLabel || 'NIO '}{itemUnitMonto.toFixed(2)}</Text>
                  </View>
                </GlassCard>
              ) : (
                <>
                  <View style={styles.expandedHeader}>
                    <Text style={[styles.linesTableCell, { flex: 2 }]}>
                      {(item.lotteryId || item.lottery_id) === 'fechea' ? 'FECHA' : 'NÚMERO'}
                    </Text>
                    <Text style={[styles.linesTableCell, { flex: 1 }]}>FECHA</Text>
                    <Text style={[styles.linesTableCell, { flex: 1, textAlign: 'right' }]}>MONTO</Text>
                  </View>
                  {lines.map((line, i) => {
                    const isWL = line.status === 'winner';
                    return (
                      <View key={line.id ?? i} style={[styles.linesTableRow, isWL && styles.linesTableRowWinner]}>
                        <Text style={[styles.linesTableData, { flex: 2, color: isWL ? '#fbbf24' : '#fff', fontWeight: '800' }]}>
                          {(item.lotteryId || item.lottery_id) === 'fechea'
                            ? formatFecheaDate(getFecheaPlayValue(line))
                            : `#${formatLotteryNumber(item.lotteryId || item.lottery_id, line.numero)}`}
                        </Text>
                        <Text style={[styles.linesTableData, { flex: 1, color: COLORS.textMuted, fontSize: 11 }]}>
                          {line.fecha && (item.lotteryId || item.lottery_id) !== 'itemFechea' ? line.fecha : '—'}
                        </Text>
                        <Text style={[styles.linesTableData, { flex: 1, textAlign: 'right', color: COLORS.successLight, fontWeight: '700' }]}>
                          {lottery?.priceLabel || 'NIO '}{parseFloat(line.monto || 0).toFixed(2)}
                        </Text>
                      </View>
                    );
                  })}
                </>
              )}

              {/* Info extra */}
              <Text style={styles.expandedMeta}>
                ID: <Text style={{ fontSize: 10, color: COLORS.textMuted }}>{item.id?.split('_').pop()}</Text>
                {'  '}Creado: <Text style={{ color: COLORS.textMuted }}>{formatDateShort(item.createdAt || item.created_at)}</Text>
              </Text>

              {isCancelled && item.cancelledAt && (
                <Text style={styles.cancelledInfo}>
                  Anulado: {formatDateShort(item.cancelledAt)}
                  {item.cancelledByName ? ` · Admin: ${item.cancelledByName}` : ''}
                </Text>
              )}

              {/* Botones de acción en la expansión */}
              {!isCancelled && (
                <View style={styles.expandedActions}>
                  {hasWinner && !item.prizePaid && (
                    <TouchableOpacity style={styles.payPrizeBtn} onPress={() => handlePayPrize(item)}>
                      <Trophy size={13} color="#000" />
                      <Text style={styles.payPrizeBtnText}>Pagar Premio</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.detailBtn} onPress={() => handleOpenDetail(item)}>
                    <Text style={styles.detailBtnText}>Ver Detalle</Text>
                  </TouchableOpacity>
                  {annulStatus.isBlocked ? (
                    <View style={[styles.blockedBtn, { flex: 1 }]}>
                      <Lock size={11} color={COLORS.textMuted} />
                      <Text style={styles.blockedBtnText}>Bloq.</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={[styles.annulBtn, { flex: 1 }]} onPress={() => handleAnnulClick(item)}>
                      <XCircle size={13} color="#fff" />
                      <Text style={styles.annulBtnText}>Anular</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </GlassCard>
      </TouchableOpacity>
    );
  };

  // ─── Render ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Cabecera */}
      <View style={[styles.navBar, { justifyContent: 'space-between' }]}>
        <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#fff" />
          <Text style={styles.navTitle}>Historial de Ventas</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <HeaderClock />
          <TouchableOpacity onPress={loadSales} style={styles.refreshBtn} activeOpacity={0.7}>
            <RefreshCw size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Métricas */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { backgroundColor: COLORS.primary }]}>
          <Text style={styles.metricValue} numberOfLines={1}>
            {settings.currency} {totalVendido.toFixed(2)}
          </Text>
          <Text style={styles.metricLabel}>Total vendido</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{activeSales.length}</Text>
          <Text style={styles.metricLabel}>Activos</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: COLORS.dangerLight }]}>{cancelledSales.length}</Text>
          <Text style={styles.metricLabel}>Anulados</Text>
        </View>
        {totalPremios > 0 && (
          <View style={[styles.metricCard, { backgroundColor: '#d97706' }]}>
            <Text style={[styles.metricValue, { color: '#000' }]} numberOfLines={1}>
              {settings.currency} {totalPremios.toFixed(2)}
            </Text>
            <Text style={[styles.metricLabel, { color: 'rgba(0,0,0,0.8)' }]}>Total Ganado</Text>
          </View>
        )}
      </View>

      {/* Filtros */}
      <View style={styles.filtersSection}>
        {/* Búsqueda */}
        <View style={styles.searchBar}>
          <Search size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={filters.search}
            onChangeText={v => setFilters(f => ({ ...f, search: v }))}
            placeholder="Buscar por número, comprador..."
            placeholderTextColor={COLORS.textMuted}
          />
          {filters.search ? (
            <TouchableOpacity onPress={() => setFilters(f => ({ ...f, search: '' }))}>
              <X size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filtro de fecha + juego */}
        <View style={styles.filterRow}>
          <View style={styles.filterDateWrap}>
            <Text style={styles.filterLabel}>Fecha</Text>
            <TouchableOpacity
              style={[styles.filterDateInput, { justifyContent: 'center' }]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 12, color: filters.date ? '#fff' : COLORS.textMuted }}>
                {filters.date || 'YYYY-MM-DD'}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={filters.date ? new Date(filters.date + 'T00:00:00') : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    setFilters(f => ({ ...f, date: `${y}-${m}-${d}` }));
                  }
                }}
              />
            )}
          </View>
          <View style={styles.filterGameWrap}>
            <Text style={styles.filterLabel}>Juego</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              {[{ id: '', name: 'Todos' }, ...lotteries].map(l => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.filterChip, filters.lotteryId === l.id && styles.filterChipActive]}
                  onPress={() => setFilters(f => ({ ...f, lotteryId: l.id }))}
                >
                  <Text style={[styles.filterChipText, filters.lotteryId === l.id && styles.filterChipTextActive]}>
                    {l.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Chips de estado */}
        <View style={styles.statusChipsRow}>
          {STATUS_FILTERS.map(({ val, label }) => (
            <TouchableOpacity
              key={val}
              style={[styles.statusChip, filters.status === val && styles.statusChipActive]}
              onPress={() => setFilters(f => ({ ...f, status: val }))}
            >
              <Text style={[styles.statusChipText, filters.status === val && styles.statusChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Contador */}
        <View style={styles.counterRow}>
          <Text style={styles.counterText}>
            {loadingData ? 'Cargando...' : `${sales.length} boleto${sales.length !== 1 ? 's' : ''}`}
          </Text>
          {!loadingData && activeSales.length > 0 && (
            <View style={styles.counterRight}>
              <TrendingUp size={12} color={COLORS.successLight} />
              <Text style={styles.counterActiveText}>
                {activeSales.length} activos · {settings.currency} {totalVendido.toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Lista */}
      {loadingData ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No se encontraron boletos con estos filtros.</Text>
            </View>
          }
          onRefresh={loadSales}
          refreshing={loadingData}
        />
      )}

      {/* Modal de detalle */}
      <SaleDetailModal
        visible={detailVisible}
        sale={selectedSale}
        settings={settings}
        results={results}
        userRole={user?.role}
        onClose={handleCloseDetail}
        onReprint={async () => {
          if (!printerConnected) {
            Alert.alert('Sin Impresora', 'No hay ninguna impresora Bluetooth conectada. Conéctala en Ajustes.');
            return;
          }
          try {
            await printTicket(selectedSale);
          } catch {}
        }}
        onPayPrize={() => handlePayPrize(selectedSale)}
        onAnnul={() => handleAnnulClick(selectedSale)}
        onOpenDigital={() => setDigitalModalVisible(true)}
      />

      {/* Modal de boleto digital */}
      <DigitalTicketModal
        visible={digitalModalVisible}
        sale={selectedSale}
        settings={settings}
        onClose={() => setDigitalModalVisible(false)}
      />

      {/* Modal de auth admin */}
      <AdminAuthModal
        visible={!!authModalData}
        hasAnnouncedDraw={authModalData?.hasAnnouncedDraw}
        onSubmit={handleAdminAuthSubmit}
        onCancel={() => setAuthModalData(null)}
      />

    </View>
  );
};

// ─── Estilos ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgBase },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  navBar: {
    height: 56, backgroundColor: '#111827', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', height: '100%' },
  navTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginLeft: 8 },
  refreshBtn: { padding: 8 },

  // Métricas
  metricsRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  metricCard: {
    flex: 1, backgroundColor: '#1f2937', borderRadius: RADIUS.md,
    padding: 10, alignItems: 'center',
  },
  metricValue: { fontSize: 13, fontWeight: '900', color: '#fff', lineHeight: 18 },
  metricLabel: { fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 2, textTransform: 'uppercase', fontWeight: '600' },

  // Filtros
  filtersSection: {
    backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937',
    borderRadius: RADIUS.md, paddingHorizontal: 12, height: 40, marginBottom: 8,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 13 },

  filterRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  filterDateWrap: { width: 130 },
  filterGameWrap: { flex: 1 },
  filterLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  filterDateInput: {
    height: 36, backgroundColor: '#1f2937', borderRadius: RADIUS.sm, color: '#fff',
    paddingHorizontal: 10, fontSize: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  filterChip: {
    height: 32, paddingHorizontal: 12, borderRadius: RADIUS.full, backgroundColor: '#1f2937',
    justifyContent: 'center', marginRight: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight },
  filterChipText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: '#fff' },

  statusChipsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  statusChip: {
    flex: 1, height: 30, justifyContent: 'center', alignItems: 'center',
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'transparent',
  },
  statusChipActive: { borderColor: COLORS.primaryLight, backgroundColor: '#1f2937' },
  statusChipText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  statusChipTextActive: { color: COLORS.primaryLight, fontWeight: '800' },

  counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counterText: { fontSize: 11, color: COLORS.textMuted },
  counterRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  counterActiveText: { fontSize: 11, color: COLORS.successLight, fontWeight: '600' },

  listContent: { padding: 12, paddingBottom: 40 },

  // Sale card
  saleCard: { padding: 12, marginVertical: 4 },
  saleCardCancelled: { borderColor: 'rgba(239,68,68,0.15)', opacity: 0.7 },
  saleCardWinner: { borderColor: 'rgba(251,191,36,0.35)' },

  saleMainRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saleIcon: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  saleIconWinner: { backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' },
  saleInfo: { flex: 1 },
  saleTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 2 },
  saleName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  saleSub: { fontSize: 11, color: COLORS.textSecondary },
  saleRight: { alignItems: 'flex-end' },
  saleMonto: { fontSize: 14, fontWeight: '800', color: COLORS.successLight },
  salemontoCancelled: { color: COLORS.textMuted, textDecorationLine: 'line-through' },
  salemontOwinner: { color: '#fbbf24', fontSize: 12 },
  saleWinAmount: { fontSize: 11, fontWeight: '900', color: '#fbbf24' },

  // Badges
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  statusBadgeText: { fontSize: 9, fontWeight: '900' },
  statusBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badgeActive: { backgroundColor: 'rgba(16,185,129,0.12)' },
  badgeActiveText: { color: COLORS.successLight },
  badgeCancelled: { backgroundColor: 'rgba(239,68,68,0.12)' },
  badgeCancelledText: { color: COLORS.dangerLight },
  badgeWinner: { backgroundColor: 'rgba(251,191,36,0.15)' },
  badgeWinnerText: { color: '#fbbf24' },
  badgePaid: { backgroundColor: 'rgba(16,185,129,0.12)' },
  badgePaidText: { color: COLORS.successLight },
  badgeUnpaid: { backgroundColor: 'rgba(239,68,68,0.12)' },
  badgeUnpaidText: { color: COLORS.dangerLight },
  badgeBlocked: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },

  // Expanded section
  expandedSection: {
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  expandedHeader: {
    flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)', marginBottom: 4,
  },
  expandedMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 8 },
  cancelledInfo: { fontSize: 11, color: COLORS.dangerLight, marginTop: 4 },
  expandedActions: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },

  linesTable: { marginBottom: 8 },
  linesTableHeader: {
    flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)', marginBottom: 2,
  },
  linesTableCell: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  linesTableRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  linesTableRowWinner: { backgroundColor: 'rgba(251,191,36,0.04)' },
  linesTableData: { fontSize: 12, color: COLORS.textSecondary },

  detailTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  detailTotalLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  detailTotalValue: { fontSize: 18, fontWeight: '900', color: COLORS.successLight },

  // Action buttons
  payPrizeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: '#d97706', borderRadius: RADIUS.sm, height: 36,
  },
  payPrizeBtnText: { color: '#000', fontWeight: '800', fontSize: 12 },
  detailBtn: {
    flex: 1, height: 36, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
  },
  detailBtnText: { color: COLORS.primaryLight, fontWeight: '700', fontSize: 12 },
  annulBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: COLORS.danger, borderRadius: RADIUS.sm, height: 36,
  },
  annulBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  reprintBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: RADIUS.sm, height: 36,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
  },
  reprintBtnText: { color: COLORS.primaryLight, fontWeight: '700', fontSize: 12 },
  blockedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: RADIUS.sm, height: 36,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  blockedBtnText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 12 },

  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center' },

  // Detail modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  detailSheet: {
    width: '100%', height: '80%', backgroundColor: COLORS.bgBase,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  detailTitle: { fontSize: 16, fontWeight: '800', color: '#fff', flex: 1 },
  closeBtn: { padding: 4 },
  detailScroll: { flex: 1 },
  detailInfoCard: { padding: 14, marginBottom: 12 },
  detailInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  detailInfoLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  detailInfoValue: { fontSize: 13, color: '#fff', fontWeight: '700' },
  detailSubtitle: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 10 },

  prizeBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
    borderRadius: RADIUS.md, padding: 10, marginBottom: 10,
  },
  prizeBoxLabel: { fontSize: 13, color: '#fbbf24', fontWeight: '700' },
  prizeBoxValue: { fontSize: 16, fontWeight: '900', color: '#fbbf24' },

  cancelledBox: {
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: RADIUS.md, padding: 8, marginBottom: 10,
  },
  cancelledBoxText: { fontSize: 11, color: COLORS.dangerLight, fontWeight: '600' },

  detailActions: { marginTop: 20, gap: 8 },

  // Auth modal
  authBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  authCard: { width: '100%', maxWidth: 360, padding: 20 },
  authHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  authTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  authDesc: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16, lineHeight: 18 },
  authError: { fontSize: 12, color: COLORS.dangerLight, fontWeight: '600', marginBottom: 8 },
  authActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  authCancelBtn: {
    flex: 1, height: 42, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1f2937', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  authCancelText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 },
  authSubmitBtn: {
    flex: 1, height: 42, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.danger, borderRadius: RADIUS.md,
  },
  authSubmitText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
