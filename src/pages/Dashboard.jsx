// ─── Página: Dashboard ────────────────────────────────────────
import { useApp } from '../context/AppContext';
import { usePrinter } from '../context/PrinterContext';
import { getLotteryById, LOTTERY_LIST } from '../data/lotteryTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, Ticket, XCircle, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parseDate } from '../utils/dateUtils';

export const Dashboard = () => {
  const { dailySummary, loading, settings, sales, lotteries } = useApp();
  const { connected } = usePrinter();
  const navigate = useNavigate();

  const today = format(new Date(), "EEEE dd 'de' MMMM", { locale: es });

  const recentSales = sales.filter((s) => {
    const d = parseDate(s.createdAt).toDateString();
    return d === new Date().toDateString();
  }).slice(0, 5);

  return (
    <div className="page-content">

      {/* Bienvenida */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize', marginBottom: '0.25rem' }}>
          {today}
        </div>
        <h1 style={{
          fontSize: '1.8rem', fontWeight: 900, lineHeight: 1.1,
          background: 'linear-gradient(90deg, #f1f5f9, #c084fc)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          {settings.businessName}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Resumen del día
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-card-value">
            {loading ? '–' : dailySummary.count}
          </div>
          <div className="stat-card-label">
            <Ticket size={12} style={{ display: 'inline', marginRight: 4 }} />
            Boletos
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value" style={{ fontSize: '1.25rem', whiteSpace: 'nowrap' }}>
            {loading ? '–' : `${settings.currency} ${dailySummary.total.toLocaleString('es-CR')}`}
          </div>
          <div className="stat-card-label">
            <TrendingUp size={12} style={{ display: 'inline', marginRight: 4 }} />
            Total del día
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value" style={{ color: 'var(--neon-red)', WebkitTextFillColor: 'var(--neon-red)', background: 'none', fontSize: '1.8rem' }}>
            {loading ? '–' : dailySummary.cancelled}
          </div>
          <div className="stat-card-label">
            <XCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
            Anulados
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/settings')}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <Printer size={28} color={connected ? 'var(--neon-green)' : 'var(--neon-red)'} />
          </div>
          <div className="stat-card-label" style={{ color: connected ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 800 }}>
            {connected ? 'Impresora OK' : 'Sin impresora'}
          </div>
        </div>
      </div>

      {/* Por tipo de rifa */}
      {Object.keys(dailySummary.byType).length > 0 && (
        <>
          <p className="section-title">Por tipo de rifa</p>
          <div className="card" style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem' }}>
            {Object.entries(dailySummary.byType).map(([id, data]) => {
              const lottery = lotteries.find((l) => l.id === id) || getLotteryById(id);
              if (!lottery) return null;
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '1.4rem' }}>{lottery.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{lottery.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{data.count} boleto{data.count !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--neon-green)' }}>
                    {lottery.priceLabel}{data.total.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Últimas ventas */}
      <p className="section-title">Últimas ventas</p>
      {recentSales.length === 0 ? (
        <div className="empty-state">
          <Ticket size={48} />
          <p>Aún no hay ventas hoy</p>
          <button className="btn btn-primary" onClick={() => navigate('/sell')} style={{ marginTop: '1rem' }} id="go-sell-btn">
            Vender primer boleto
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: '0.25rem 1rem' }}>
          {recentSales.map((sale) => {
            const lottery = lotteries.find((l) => l.id === sale.lotteryId) || getLotteryById(sale.lotteryId);
            return (
              <div key={sale.id} className="sale-record">
                <div className="sale-record-left" style={{ background: lottery ? `${lottery.color}22` : 'var(--bg-elevated)' }}>
                  {lottery?.emoji}
                </div>
                <div className="sale-record-info">
                  <div className="sale-record-title">{lottery?.name}</div>
                  <div className="sale-record-subtitle">
                    {sale.lines?.length > 0
                      ? `${sale.lines.length} jugada${sale.lines.length !== 1 ? 's' : ''}`
                      : '–'}
                    {sale.comprador ? ` · ${sale.comprador}` : ''}
                  </div>
                </div>
                <div>
                  <div className="sale-record-amount">
                    {lottery?.priceLabel}{parseFloat(sale.monto || 0).toFixed(2)}
                  </div>
                  {sale.status === 'cancelled' && (
                    <div style={{ textAlign: 'right', marginTop: 2 }}>
                      <span className="badge badge-cancelled">Anulado</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-ghost" onClick={() => navigate('/history')} id="view-all-sales-btn" style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem 0.25rem' }}>
              Ver todas las ventas →
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/history?status=winner')} id="view-winners-btn" style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem 0.25rem', color: '#fbbf24', fontWeight: 700 }}>
              Ver Ganadores
            </button>
          </div>
        </div>
      )}

      {/* Acceso rápido */}
      <div style={{ height: '1.5rem' }} />
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {lotteries.slice(0, 3).map((lottery) => (
          <button
            key={lottery.id}
            className="btn btn-full"
            style={{ background: lottery.gradient, color: '#fff', fontWeight: 700, fontSize: '0.8rem', padding: '0.6rem 0.4rem', flex: 1 }}
            onClick={() => navigate(`/sell?type=${lottery.id}`)}
            id={`quick-sell-${lottery.id}`}
          >
            {lottery.emoji} {lottery.name}
          </button>
        ))}
      </div>
    </div>
  );
};
