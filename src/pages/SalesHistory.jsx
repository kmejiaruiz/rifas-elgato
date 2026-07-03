// ─── Página: Historial con jugadas expandidas ────────────────
import { useState, useEffect, useCallback } from 'react';
import NProgress from 'nprogress';
import { useApp } from '../context/AppContext';
import { usePrinter } from '../context/PrinterContext';
import { useAuth, can } from '../context/AuthContext';
import { getLotteryById, LOTTERY_LIST, formatLotteryNumber } from '../data/lotteryTypes';
import { getSalesByFilter, getResults } from '../services/storageService';
import { parseDate, formatFecheaDate, getFecheaPlayValue } from '../utils/dateUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Filter, Printer, XCircle, ChevronDown, ChevronUp, TrendingUp, Trophy, Lock, Ticket, Sparkles } from 'lucide-react';
import { useDialog } from '../components/ui/DialogProvider';
import { useSearchParams } from 'react-router-dom';
import { TicketVoucher } from '../components/ticket/TicketVoucher';

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

export const SalesHistory = () => {
  const { annulSale, paySalePrize, settings, lotteries } = useApp();
  const { print, connected } = usePrinter();
  const { user } = useAuth();
  const { dialog } = useDialog();
  const [searchParams] = useSearchParams();

  const [sales, setSales] = useState([]);
  const [results, setResults] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (loadingData) {
      NProgress.start();
    } else {
      NProgress.done();
    }
    return () => {
      NProgress.done();
    };
  }, [loadingData]);

  const { getUsers } = useAuth();
  const [sellers, setSellers] = useState([]);
  const [filters, setFilters] = useState({
    lotteryId: searchParams.get('lotteryId') || '',
    date: searchParams.get('date') !== null ? searchParams.get('date') : format(new Date(), 'yyyy-MM-dd'),
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
    sellerId: searchParams.get('sellerId') || '',
  });
  const [expandedId, setExpandedId] = useState(null);
  const [adminAuthModal, setAdminAuthModal] = useState(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [selectedVoucherSale, setSelectedVoucherSale] = useState(null);

  useEffect(() => {
    if (!adminAuthModal) {
      setAdminUsername('');
      setAdminPassword('');
      setAuthError('');
    }
  }, [adminAuthModal]);

  // Cargar lista de vendedores si es admin
  useEffect(() => {
    if (user?.role === 'admin') {
      getUsers()
        .then((list) => setSellers(list || []))
        .catch((err) => console.error('[SalesHistory] Error fetching users:', err));
    }
  }, [user, getUsers]);

  // Sincronizar parámetros de búsqueda de la URL
  useEffect(() => {
    setFilters({
      lotteryId: searchParams.get('lotteryId') || '',
      date: searchParams.get('date') !== null ? searchParams.get('date') : format(new Date(), 'yyyy-MM-dd'),
      status: searchParams.get('status') || '',
      search: searchParams.get('search') || '',
      sellerId: searchParams.get('sellerId') || '',
    });
  }, [searchParams]);

  const loadSales = useCallback(async () => {
    setLoadingData(true);
    try {
      const [salesResult, resultsResult] = await Promise.all([
        getSalesByFilter(filters),
        getResults(),
      ]);
      setSales(salesResult);
      setResults(resultsResult || []);
    } catch (err) {
      console.error('[SalesHistory] Error al cargar datos:', err);
    } finally {
      setLoadingData(false);
    }
  }, [filters]);

  useEffect(() => { loadSales(); }, [loadSales]);

  const handleAnnul = async (id) => {
    if (!can(user, 'annul')) return;
    const ok = await dialog.confirm('¿Anular este boleto? Esta acción no se puede deshacer.', {
      title: 'Anular boleto',
      type: 'danger',
      confirmLabel: 'Sí, anular',
      cancelLabel: 'Cancelar',
    });
    if (!ok) return;
    try {
      const updated = await annulSale(id);
      if (updated) {
        setSales((prev) => prev.map((s) => s.id === id ? { ...s, ...updated } : s));
      }
    } catch (err) {
      console.error('[SalesHistory] Error al anular boleto:', err);
    }
  };

  const handlePrint = async (sale) => {
    await print(sale, settings.businessName);
  };

  const handleAdminAnnulSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!adminUsername || !adminPassword) {
      setAuthError('Por favor ingrese usuario y contraseña.');
      return;
    }
    setAuthSubmitting(true);
    setAuthError('');
    try {
      const updated = await annulSale(adminAuthModal.saleId, {
        adminUsername,
        adminPassword,
      });
      setSales((prev) => prev.map((s) => s.id === adminAuthModal.saleId ? { ...s, ...updated } : s));
      setAdminAuthModal(null);
      setAdminUsername('');
      setAdminPassword('');
    } catch (err) {
      setAuthError(err.message || 'Error de autenticación.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const checkSaleAnnulmentStatus = (sale) => {
    if (sale.status === 'cancelled') {
      return { isCancelled: true, canAnnul: false, isBlocked: false, requiresAdmin: false, hasAnnouncedDraw: false };
    }
    if (!sale.lines || sale.lines.length === 0) {
      return { isCancelled: false, canAnnul: true, isBlocked: false, requiresAdmin: user?.role !== 'admin' && user?.role !== 'root', hasAnnouncedDraw: false };
    }

    let hasAnnouncedDraw = false;
    let blockedAnnulment = false;

    for (const line of sale.lines) {
      const lineDate = line.fecha || sale.createdAt?.substring(0, 10) || new Date().toISOString().substring(0, 10);
      const match = results.find((res) => res.lotteryId === line.lotteryId && res.fechaSorteo === lineDate && res.horaSorteo === sale.horaSorteo);
      
      if (match) {
        hasAnnouncedDraw = true;
        if (sale.createdAt && match.announcedAt) {
          const saleTime = new Date(sale.createdAt.replace(' ', 'T')).getTime();
          const announcedTime = new Date(match.announcedAt.replace(' ', 'T')).getTime();
          if (saleTime <= announcedTime) {
            blockedAnnulment = true;
          }
        } else {
          blockedAnnulment = true;
        }
      }
    }

    if (blockedAnnulment) {
      return { isCancelled: false, canAnnul: false, isBlocked: true, requiresAdmin: false, hasAnnouncedDraw: true };
    }

    // Requiere admin si el sorteo ya fue anunciado, o si el usuario firmado NO es un administrador
    const requiresAdmin = (user?.role !== 'admin' && user?.role !== 'root') || hasAnnouncedDraw;
    return { isCancelled: false, canAnnul: true, isBlocked: false, requiresAdmin, hasAnnouncedDraw };
  };

  // ─── Métricas ─────────────────────────────────────────────────
  const activeSales   = sales.filter((s) => s.status === 'active');
  const cancelledSales= sales.filter((s) => s.status === 'cancelled');
  const total = activeSales.reduce((acc, s) => acc + parseFloat(s.monto || 0), 0);

  // Calcular total de premios ganados en boletos no anulados y pagados
  const totalPrizes = sales.reduce((acc, s) => {
    if (s.status === 'cancelled' || !s.prizePaid) return acc;
    const sPrizes = (s.lines || []).reduce((lAcc, l) => {
      if (l.status !== 'winner') return lAcc;
      const lottery = lotteries.find((x) => x.id === s.lotteryId) || getLotteryById(s.lotteryId);
      const mult = parseFloat(lottery?.payoutMultiplier || 80);
      return lAcc + (parseFloat(l.monto || 0) * mult);
    }, 0);
    return acc + sPrizes;
  }, 0);

  return (
    <div className="page-content">
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.25rem' }}>
        Historial de Ventas
      </h1>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
          borderRadius: 'var(--radius-md)', padding: '0.75rem', boxShadow: 'var(--shadow-neon)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
            {loadingData ? '–' : `${settings.currency} ${total.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.8)', marginTop: '0.25rem', fontWeight: 600, textTransform: 'uppercase' }}>
            Total vendido
          </div>
        </div>

        {totalPrizes > 0 && (
          <div style={{ background: 'linear-gradient(135deg, #d97706, #fbbf24)',
            borderRadius: 'var(--radius-md)', padding: '0.75rem', boxShadow: '0 0 15px rgba(251,191,36,0.3)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#000', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              {loadingData ? '–' : `${settings.currency} ${totalPrizes.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(0,0,0,0.8)', marginTop: '0.25rem', fontWeight: 800, textTransform: 'uppercase' }}>
              Total Ganado
            </div>
          </div>
        )}

        <div className="stat-card" style={{ padding: '0.75rem' }}>
          <div className="stat-card-value" style={{ fontSize: '1.1rem', whiteSpace: 'nowrap' }}>{loadingData ? '–' : activeSales.length}</div>
          <div className="stat-card-label" style={{ fontSize: '0.62rem' }}>Activos</div>
        </div>
        <div className="stat-card" style={{ padding: '0.75rem' }}>
          <div className="stat-card-value" style={{ fontSize: '1.1rem', WebkitTextFillColor: 'var(--neon-red)', background: 'none', whiteSpace: 'nowrap' }}>
            {loadingData ? '–' : cancelledSales.length}
          </div>
          <div className="stat-card-label" style={{ fontSize: '0.62rem' }}>Anulados</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-control"
            placeholder="Buscar por número, comprador..."
            style={{ paddingLeft: '2.25rem' }}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            id="search-sales-input"
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input type="date" className="form-control" value={filters.date}
            onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
            id="filter-date-input" style={{ flex: 1 }} />
          <select className="form-control" value={filters.lotteryId}
            onChange={(e) => setFilters((f) => ({ ...f, lotteryId: e.target.value }))}
            id="filter-lottery-select" style={{ flex: 1 }}>
            <option value="">Todas</option>
            {lotteries.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        {user?.role === 'admin' && sellers.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              className="form-control"
              value={filters.sellerId}
              onChange={(e) => setFilters((f) => ({ ...f, sellerId: e.target.value }))}
              id="filter-seller-select"
              style={{ flex: 1 }}
            >
              <option value="">Todos los vendedores</option>
              {sellers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role === 'admin' ? 'Admin' : 'Vendedor'})
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {[
            { val: '', label: 'Todos' },
            { val: 'active', label: 'Activos' },
            { val: 'cancelled', label: 'Anulados' },
            { val: 'winner', label: 'Ganadores' }
          ]
            .map(({ val, label }) => (
              <button key={val} className="btn btn-secondary"
                style={{ flex: '1 1 auto', fontSize: '0.72rem', padding: '0.5rem 0.6rem',
                  borderColor: filters.status === val ? 'var(--accent-light)' : 'var(--border)',
                  color: filters.status === val ? 'var(--accent-light)' : 'var(--text-secondary)',
                  background: filters.status === val ? 'var(--bg-elevated)' : 'transparent' }}
                onClick={() => setFilters((f) => ({ ...f, status: val }))}
                id={`filter-status-${val || 'all'}`}>
                {label}
              </button>
            ))}
        </div>
      </div>

      {/* Contador */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {loadingData ? 'Cargando...' : `${sales.length} boleto${sales.length !== 1 ? 's' : ''}`}
        </span>
        {!loadingData && activeSales.length > 0 && (
          <span style={{ fontSize: '0.78rem', color: 'var(--neon-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={13} /> {activeSales.length} activos · {settings.currency} {total.toFixed(2)}
          </span>
        )}
      </div>

      {/* Lista */}
      {loadingData ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <span className="loading-text">Cargando...</span>
        </div>
      ) : sales.length === 0 ? (
        <div className="empty-state">
          <Filter size={48} />
          <p>No se encontraron boletos con estos filtros</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sales.map((sale) => {
            const lottery  = lotteries.find((l) => l.id === sale.lotteryId) || getLotteryById(sale.lotteryId);
            const isExpanded  = expandedId === sale.id;
            const isCancelled = sale.status === 'cancelled';
            const lines   = sale.lines || [];
            const hasWinner = lines.some((l) => l.status === 'winner');
            const annulStatus = checkSaleAnnulmentStatus(sale);

            const ticketPrize = lines.reduce((acc, l) => {
              if (l.status !== 'winner') return acc;
              const mult = parseFloat(lottery?.payoutMultiplier || 80);
              return acc + (parseFloat(l.monto || 0) * mult);
            }, 0);

            // Range formatting for web history
            const isFechea = sale.lotteryId === 'fechea';
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
                rangeText = `De ${formatLotteryNumber(sale.lotteryId, firstNum)} a ${formatLotteryNumber(sale.lotteryId, lastNum)}`;
              } else {
                rangeText = `${lines.length} números`;
              }
            }

            return (
              <div key={sale.id} className="card"
                style={{ padding: '0.85rem 1rem', opacity: isCancelled ? 0.65 : 1,
                  borderColor: hasWinner ? '#fbbf24' : undefined,
                  boxShadow: hasWinner ? '0 0 15px rgba(251,191,36,0.15)' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                  onClick={() => setExpandedId(isExpanded ? null : sale.id)}>

                  <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                    background: hasWinner ? 'rgba(251,191,36,0.15)' : (lottery ? `${lottery.color}22` : 'var(--bg-elevated)'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: hasWinner ? '1px solid rgba(251,191,36,0.4)' : 'none' }}>
                    <Ticket size={20} color={hasWinner ? '#fbbf24' : (lottery ? lottery.color : 'var(--text-secondary)')} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', rowGap: '0.2rem', marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {lottery?.name} {sale.horaSorteo && `(${formatHourAmPm(sale.horaSorteo)})`}
                      </span>
                      <span className={`badge badge-${isCancelled ? 'cancelled' : hasWinner ? 'winner' : 'active'}`}>
                        {isCancelled ? (sale.cancelledByName ? `Anulado por ${sale.cancelledByName}` : 'Anulado') : hasWinner ? 'Ganador' : 'Activo'}
                      </span>
                      {hasWinner && !isCancelled && (
                        <span className="badge" style={{
                          background: sale.prizePaid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: sale.prizePaid ? 'var(--neon-green)' : 'var(--neon-red)',
                          border: sale.prizePaid ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                          fontSize: '0.65rem',
                          padding: '0.1rem 0.35rem'
                        }}>
                          {sale.prizePaid ? 'Pagado' : 'No Pagado'}
                        </span>
                      )}
                      {annulStatus.isBlocked && !isCancelled && (
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--neon-red)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.65rem', padding: '0.1rem 0.35rem', display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Lock size={10} style={{ marginRight: 2 }} /> Bloqueado
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lines.length} {lines.length === 1 ? 'jugada' : 'jugadas'}
                      {sale.comprador ? ` · ${sale.comprador}` : ''}
                      {' · '}{format(parseDate(sale.createdAt), 'HH:mm')}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800,
                      color: isCancelled ? 'var(--text-muted)' : hasWinner ? 'var(--neon-yellow)' : 'var(--neon-green)',
                      textDecoration: isCancelled ? 'line-through' : 'none', fontSize: hasWinner ? '0.82rem' : '0.95rem' }}>
                      {lottery?.priceLabel}{parseFloat(sale.monto || 0).toFixed(2)}
                    </div>
                    {hasWinner && (
                      <div style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--neon-yellow)', marginTop: 2 }}>
                        Ganó: {lottery?.priceLabel || 'NIO '}{parseFloat(ticketPrize).toFixed(2)}
                      </div>
                    )}
                    {isExpanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                  </div>
                </div>

                {/* Detalle expandido con jugadas */}
                {isExpanded && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', animation: 'fadeIn 0.2s ease' }}>

                    {/* Tabla de jugadas */}
                    {lines.length > 6 ? (
                      <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>RANGO</span>
                          <span style={{ fontWeight: 800, color: 'var(--neon-yellow)' }}>{rangeText}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>CANT. NÚMEROS</span>
                          <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{rangeCount}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>MONTO POR NÚMERO</span>
                          <span style={{ fontWeight: 800, color: 'var(--neon-green)' }}>{lottery?.priceLabel || 'NIO '}{unitMonto.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto',
                          gap: '0.2rem 0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)',
                          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                          paddingBottom: '0.3rem', borderBottom: '1px solid var(--border)', marginBottom: '0.3rem' }}>
                          <span>{sale.lotteryId === 'fechea' ? 'Fecha' : 'Número'}</span><span>Fecha</span><span>Monto</span>
                        </div>
                        {lines.map((line, i) => (
                          <div key={line.id ?? i} style={{ display: 'grid',
                            gridTemplateColumns: '1fr auto auto', gap: '0.2rem 0.75rem',
                            padding: '0.35rem 0', borderBottom: '1px solid var(--border)',
                            fontSize: '0.88rem',
                            background: line.status === 'winner' ? 'rgba(251,191,36,0.05)' : undefined }}>
                            <span style={{ fontWeight: 800, color: line.status === 'winner' ? 'var(--neon-yellow)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              {line.status === 'winner' && <Trophy size={12} color="var(--neon-yellow)" />}
                              {sale.lotteryId === 'fechea' ? formatFecheaDate(getFecheaPlayValue(line)) : `#${formatLotteryNumber(sale.lotteryId, line.numero)}`}
                            </span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                              {line.fecha && sale.lotteryId !== 'fechea' ? line.fecha : '—'}
                            </span>
                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span style={{ fontWeight: 700, color: 'var(--neon-green)', fontSize: '0.85rem' }}>
                                {lottery?.priceLabel}{parseFloat(line.monto || 0).toFixed(2)}
                              </span>
                              {line.status === 'winner' && (
                                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--neon-yellow)', marginTop: 2 }}>
                                  Ganó: {lottery?.priceLabel || 'NIO '}{parseFloat(line.monto * (lottery?.payoutMultiplier || 80)).toFixed(2)}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Info adicional */}
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      ID: <strong style={{ fontSize: '0.7rem' }}>{sale.id?.split('_').pop()}</strong>
                      {' · '}Creado: <strong>{format(parseDate(sale.createdAt), 'dd/MM/yyyy')}</strong>
                    </div>

                    {isCancelled && sale.cancelledAt && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--neon-red)', marginBottom: '0.5rem' }}>
                        Anulado: {format(parseDate(sale.cancelledAt), 'dd/MM/yyyy HH:mm')}
                        {sale.cancelledByName && (
                          <span style={{ color: 'var(--text-secondary)' }}> · Autorizado por Admin: <strong style={{ color: 'var(--neon-yellow)' }}>{sale.cancelledByName}</strong></span>
                        )}
                      </div>
                    )}

                    {!isCancelled && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {hasWinner && !sale.prizePaid && (
                          <button
                            className="btn"
                            style={{
                              flex: '1 1 100%',
                              fontSize: '0.8rem',
                              padding: '0.6rem',
                              background: 'linear-gradient(135deg, #d97706, #fbbf24)',
                              color: '#000',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              boxShadow: '0 0 15px rgba(251,191,36,0.3)',
                              marginBottom: '0.25rem'
                            }}
                            onClick={async () => {
                              const ok = await dialog.confirm('¿Confirmas que deseas marcar este premio como pagado? Esta acción es irreversible.', {
                                title: 'Pagar Premio',
                                type: 'warning',
                                confirmLabel: 'Sí, pagar',
                                cancelLabel: 'Cancelar',
                              });
                              if (!ok) return;
                              try {
                                const updated = await paySalePrize(sale.id);
                                if (updated) {
                                  setSales((prev) => prev.map((s) => s.id === sale.id ? { ...s, ...updated } : s));
                                }
                              } catch (err) {
                                console.error('[SalesHistory] Error al pagar premio:', err);
                              }
                            }}
                          >
                            <Trophy size={14} color="#000" /> Pagar Premio
                          </button>
                        )}
                        <button 
                          className="btn btn-secondary" 
                          style={{ flex: 1, fontSize: '0.8rem', padding: '0.6rem', gap: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-dim)', borderColor: 'var(--accent-light)', color: 'var(--accent-light)' }}
                          onClick={() => setSelectedVoucherSale(sale)}
                        >
                          <Sparkles size={14} /> Digital
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem', padding: '0.6rem' }}
                          onClick={() => handlePrint(sale)} disabled={!connected} id={`print-sale-${sale.id}`}>
                          <Printer size={14} /> Imprimir
                        </button>
                        {can(user, 'annul') && (
                          annulStatus.isBlocked ? (
                            <button
                              type="button"
                              onClick={() => {
                                dialog.alert('No se puede realizar la acción: este boleto pertenece a un sorteo que ya fue anunciado.', {
                                  title: 'Boleto Bloqueado',
                                  type: 'warning',
                                });
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                                flex: 1,
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.6rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                                cursor: 'pointer',
                                outline: 'none',
                                opacity: 0.6
                              }}
                              title="Este sorteo ya fue anunciado y no se puede anular"
                            >
                              <Lock size={12} style={{ marginRight: 4 }} /> Bloqueado
                            </button>
                          ) : annulStatus.requiresAdmin ? (
                            <button
                              className="btn btn-danger"
                              style={{ flex: 1, fontSize: '0.8rem', padding: '0.6rem' }}
                              onClick={() => setAdminAuthModal({ saleId: sale.id, hasAnnouncedDraw: annulStatus.hasAnnouncedDraw })}
                              id={`annul-sale-${sale.id}`}
                            >
                              <XCircle size={14} /> Anular
                            </button>
                          ) : (
                            <button
                              className="btn btn-danger"
                              style={{ flex: 1, fontSize: '0.8rem', padding: '0.6rem' }}
                              onClick={() => handleAnnul(sale.id)}
                              id={`annul-sale-${sale.id}`}
                            >
                              <XCircle size={14} /> Anular
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de autorización de Admin para anulación */}
      {adminAuthModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} role="dialog" aria-modal="true">
          <div className="modal-sheet" style={{ maxWidth: 360 }}>
            <div className="modal-handle" />
            <h2 className="modal-title" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Autorización Especial
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.4 }}>
              {adminAuthModal.hasAnnouncedDraw 
                ? 'Este sorteo ya fue anunciado. Se requiere que un administrador ingrese sus credenciales de administrador para autorizar la anulación de este boleto.'
                : 'Se requiere que un administrador ingrese sus credenciales para autorizar la anulación de este boleto.'
              }
            </p>
            
            <form onSubmit={handleAdminAnnulSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Usuario Administrador</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="admin"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  disabled={authSubmitting}
                  required
                  id="admin-auth-username"
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Contraseña</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={authSubmitting}
                  required
                  id="admin-auth-password"
                />
              </div>

              {authError && (
                <div style={{ color: 'var(--neon-red)', fontSize: '0.78rem', fontWeight: 600, marginTop: '0.25rem' }}>
                  Error: {authError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-full"
                  onClick={() => {
                    setAdminAuthModal(null);
                    setAdminUsername('');
                    setAdminPassword('');
                    setAuthError('');
                  }}
                  disabled={authSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={authSubmitting}
                >
                  {authSubmitting ? (
                    <span className="spinner" style={{ width: 16, height: 16 }} />
                  ) : (
                    'Autorizar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {selectedVoucherSale && (
        <TicketVoucher
          sale={selectedVoucherSale}
          settings={settings}
          onClose={() => setSelectedVoucherSale(null)}
        />
      )}
    </div>
  );
};
