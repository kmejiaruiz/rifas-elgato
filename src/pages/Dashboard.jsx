// ─── Página: Dashboard ────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { usePrinter } from '../context/PrinterContext';
import { getLotteryById } from '../data/lotteryTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, Ticket, XCircle, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parseDate } from '../utils/dateUtils';
import { getApiUrl } from '../services/apiService';

export const Dashboard = () => {
  const { dailySummary, loading, settings, sales, lotteries, installPwa } = useApp();
  const { connected } = usePrinter();
  const navigate = useNavigate();
  
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const animTimeout = useRef(null);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa_install_dismissed') === 'true';
    setShowInstallBanner(!!installPwa && !dismissed);
  }, [installPwa]);

  const handleDismissInstall = () => {
    localStorage.setItem('pwa_install_dismissed', 'true');
    setShowInstallBanner(false);
  };

  // Build full image URL from relative path (e.g. /app/uploads/carousel_xxx.jpg)
  const buildImageUrl = (url) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // Relative path — attach to API origin
    try {
      const apiUrl = getApiUrl(); // e.g. http://192.168.1.100/app/api
      const origin = apiUrl.replace(/\/api\/?$/, ''); // strip /api
      return origin + url;
    } catch { return url; }
  };

  const carouselImages = (() => {
    try { return JSON.parse(settings.carousel_images || '[]'); } catch { return []; }
  })();

  const defaultSlides = [
    {
      type: 'default',
      background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
      title: 'Sistema de Ventas Amaranto',
      subtitle: 'Gestiona tus sorteos y boletos de forma rápida y sencilla.'
    },
    {
      type: 'default',
      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      title: 'Modo Offline Activo',
      subtitle: 'Las ventas realizadas sin conexión se sincronizarán al recuperar la red.'
    }
  ];

  const slidesToRender = carouselImages.length > 0
    ? carouselImages.map(url => ({ type: 'image', url: buildImageUrl(url) }))
    : defaultSlides;

  const goToSlide = (idx) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCarouselIndex(idx);
    clearTimeout(animTimeout.current);
    animTimeout.current = setTimeout(() => setIsAnimating(false), 550);
  };

  useEffect(() => {
    if (slidesToRender.length <= 1) return;
    const interval = setInterval(() => {
      goToSlide((carouselIndex + 1) % slidesToRender.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slidesToRender.length, carouselIndex]);

  useEffect(() => () => clearTimeout(animTimeout.current), []);

  const today = format(new Date(), "EEEE dd 'de' MMMM", { locale: es });

  const recentSales = sales.filter((s) => {
    const d = parseDate(s.createdAt).toDateString();
    return d === new Date().toDateString();
  }).slice(0, 5);

  // Obtener datos de los últimos 7 días (Ventas vs Pagos de boletos)
  const getLast7DaysData = () => {
    const days = [];
    const todayObj = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(todayObj.getDate() - i);
      const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
      const label = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      days.push({ dateStr, label, sales: 0, payouts: 0 });
    }
    
    sales.forEach((s) => {
      if (s.status === 'cancelled') return;
      const sDateStr = s.createdAt ? s.createdAt.replace(' ', 'T').split('T')[0] : '';
      const dayData = days.find((d) => d.dateStr === sDateStr);
      if (dayData) {
        dayData.sales += parseFloat(s.monto || 0);
        
        // Payouts: boletos ganadores pagados
        if (s.prizePaid) {
          const prizeAmt = (s.lines || []).reduce((acc, l) => {
            if (l.status !== 'winner') return acc;
            const lottery = lotteries.find((x) => x.id === s.lotteryId) || getLotteryById(s.lotteryId);
            const mult = parseFloat(lottery?.payoutMultiplier || 80);
            return acc + (parseFloat(l.monto || 0) * mult);
          }, 0);
          dayData.payouts += prizeAmt;
        }
      }
    });
    
    return days;
  };

  const chartData = getLast7DaysData();

  return (
    <div className="page-content dashboard-page-content">

      {/* ── Hero Banner ── */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-left">
          <span className="dashboard-hero-date">{today}</span>
          <h1 className="dashboard-hero-title">{settings.businessName}</h1>
          <p className="dashboard-hero-subtitle">Resumen del día</p>
        </div>
      </div>

      {/* PWA Install Banner — full width */}
      {showInstallBanner && (
        <div className="pwa-banner" style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
          <span>📲</span>
          <div style={{ flex: 1 }}>
            <strong>Instalar Aplicación</strong>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Instala la app en tu pantalla de inicio para acceso rápido y soporte sin conexión.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={installPwa} style={{ whiteSpace: 'nowrap', padding: '0.5rem 1.1rem', fontSize: '0.8rem', borderRadius: '99px' }}>Instalar</button>
            <button 
              type="button" 
              onClick={handleDismissInstall} 
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--text-muted)', 
                cursor: 'pointer', 
                padding: '0.25rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'background-color 0.2s'
              }}
              title="No mostrar de nuevo"
            >
              <XCircle size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Main 2-column dashboard grid ── */}
      <div className="dashboard-grid-pc">
        
        {/* LEFT COLUMN: Weekly performance chart & Advertising carousel */}
        <div className="dashboard-col-left">
          
          {/* Gráfico de Ventas y Pagos */}
          {loading ? (
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', height: 260, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton-line" style={{ width: '40%', height: 16, borderRadius: 4 }}></div>
                <div className="skeleton-line" style={{ width: '20%', height: 12, borderRadius: 4 }}></div>
              </div>
              <div style={{ display: 'flex', height: 160, alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                {[30, 15, 45, 20, 60, 25, 75].map((h, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', width: '70%', height: '100%', alignItems: 'flex-end', justifyContent: 'center', gap: '4px' }}>
                      <div className="skeleton-line" style={{ width: '35%', height: `${h}%`, borderRadius: '4px 4px 0 0' }}></div>
                      <div className="skeleton-line" style={{ width: '35%', height: `${h * 0.6}%`, borderRadius: '4px 4px 0 0' }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="skeleton-line" style={{ width: '8%', height: 10, borderRadius: 2 }}></div>
                ))}
              </div>
            </div>
          ) : (
            sales.length > 0 && (
              <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: 0 }}>
                    Rendimiento Semanal (Ventas vs Pagos)
                  </h3>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(to top, #6366f1, #a855f7)', display: 'inline-block' }}></span>
                      <span style={{ color: 'var(--text-secondary)' }}>Ventas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(to top, #059669, #10b981)', display: 'inline-block' }}></span>
                      <span style={{ color: 'var(--text-secondary)' }}>Premios Pagados</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', height: 180, alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                  {/* Gridlines */}
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '25%', borderTop: '1px dashed rgba(255,255,255,0.03)' }}></div>
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '1px dashed rgba(255,255,255,0.03)' }}></div>
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '75%', borderTop: '1px dashed rgba(255,255,255,0.03)' }}></div>

                  {chartData.map((day) => {
                    const maxVal = Math.max(...chartData.map(d => Math.max(d.sales, d.payouts)), 100);
                    const salesHeight = (day.sales / maxVal) * 100;
                    const payoutsHeight = (day.payouts / maxVal) * 100;

                    return (
                      <div key={day.dateStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ display: 'flex', width: '70%', height: '100%', alignItems: 'flex-end', justifyContent: 'center', gap: '4px', zIndex: 1 }}>
                          
                          {/* Sales Bar */}
                          <div 
                            style={{
                              width: '35%',
                              height: `${Math.max(salesHeight, 2)}%`,
                              background: day.sales > 0 ? 'linear-gradient(to top, #6366f1, #a855f7)' : 'rgba(255,255,255,0.05)',
                              borderRadius: '4px 4px 0 0',
                              position: 'relative',
                              cursor: 'pointer',
                            }}
                            title={`Ventas: ${settings.currency} ${day.sales.toLocaleString()}`}
                          >
                            {day.sales > 0 && salesHeight > 15 && (
                              <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: '0.6rem', fontWeight: 800, color: 'var(--neon-purple)', whiteSpace: 'nowrap' }}>
                                {day.sales.toFixed(0)}
                              </div>
                            )}
                          </div>

                          {/* Payouts Bar */}
                          <div 
                            style={{
                              width: '35%',
                              height: `${Math.max(payoutsHeight, 2)}%`,
                              background: day.payouts > 0 ? 'linear-gradient(to top, #059669, #10b981)' : 'rgba(255,255,255,0.05)',
                              borderRadius: '4px 4px 0 0',
                              position: 'relative',
                              cursor: 'pointer',
                            }}
                            title={`Pagos: ${settings.currency} ${day.payouts.toLocaleString()}`}
                          >
                            {day.payouts > 0 && payoutsHeight > 15 && (
                              <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: '0.6rem', fontWeight: 800, color: 'var(--neon-green)', whiteSpace: 'nowrap' }}>
                                {day.payouts.toFixed(0)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* X-axis labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  {chartData.map((day) => (
                    <div key={day.dateStr} style={{ flex: 1, textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'capitalize' }}>
                      {day.label}
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Carrusel de anuncios — smooth sliding strip */}
          {slidesToRender.length > 0 && (
            <div className="carousel-wrapper" style={{ marginBottom: '1.5rem' }}>
              {/* Strip container — all slides side by side, translated */}
              <div
                className="carousel-strip"
                style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
              >
                {slidesToRender.map((slide, idx) => (
                  <div key={idx} className="carousel-slide">
                    {slide.type === 'image' ? (
                      <img
                        src={slide.url}
                        alt={`Anuncio ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        background: slide.background,
                        display: 'flex', flexDirection: 'column',
                        justifyContent: 'center', alignItems: 'center',
                        padding: '1.5rem', textAlign: 'center', color: '#fff',
                      }}>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '0.4rem', textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
                          {slide.title}
                        </h2>
                        <p style={{ fontSize: '0.8rem', opacity: 0.9, maxWidth: '80%', margin: 0 }}>
                          {slide.subtitle}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {slidesToRender.length > 1 && (
                <>
                  {/* Dot indicators */}
                  <div className="carousel-dots">
                    {slidesToRender.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => goToSlide(idx)}
                        className={`carousel-dot${carouselIndex === idx ? ' carousel-dot--active' : ''}`}
                        aria-label={`Ir a anuncio ${idx + 1}`}
                      />
                    ))}
                  </div>

                  {/* Prev / Next arrows */}
                  <button
                    onClick={() => goToSlide((carouselIndex - 1 + slidesToRender.length) % slidesToRender.length)}
                    className="carousel-arrow carousel-arrow--prev"
                    aria-label="Anterior"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => goToSlide((carouselIndex + 1) % slidesToRender.length)}
                    className="carousel-arrow carousel-arrow--next"
                    aria-label="Siguiente"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
            </div>
          )}

          {/* Acceso rápido */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p className="section-title" style={{ marginTop: 0 }}>Accesos Rápidos</p>
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

        </div>

        {/* RIGHT COLUMN: Business metrics, lottery sales summary, and recent tickets list */}
        <div className="dashboard-col-right">
          
          {/* Stats 2x2 compact */}
          <div className="stat-cards-2x2" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card-compact">
              <div className="stat-card-compact-value">{loading ? '–' : dailySummary.count}</div>
              <div className="stat-card-compact-label">
                <Ticket size={11} style={{ display: 'inline', marginRight: 3 }} />
                Boletos hoy
              </div>
            </div>
            <div className="stat-card-compact">
              <div className="stat-card-compact-value" style={{ fontSize: '0.95rem' }}>
                {loading ? '–' : `${settings.currency} ${dailySummary.total.toLocaleString('es-CR')}`}
              </div>
              <div className="stat-card-compact-label">
                <TrendingUp size={11} style={{ display: 'inline', marginRight: 3 }} />
                Total del día
              </div>
            </div>
            <div className="stat-card-compact">
              <div
                className="stat-card-compact-value"
                style={{ color: 'var(--neon-red)', background: 'none', fontSize: '1.4rem', WebkitTextFillColor: 'var(--neon-red)' }}
              >
                {loading ? '–' : dailySummary.cancelled}
              </div>
              <div className="stat-card-compact-label">
                <XCircle size={11} style={{ display: 'inline', marginRight: 3 }} />
                Anulados
              </div>
            </div>
            <div
              className="stat-card-compact"
              style={{ cursor: 'pointer', borderColor: connected ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)' }}
              onClick={() => navigate('/settings')}
            >
              <Printer size={22} color={connected ? 'var(--neon-green)' : 'var(--neon-red)'} style={{ marginBottom: 4 }} />
              <div className="stat-card-compact-label" style={{ color: connected ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 800 }}>
                {connected ? 'Impresora OK' : 'Sin impresora'}
              </div>
            </div>
          </div>

          {/* Por tipo de rifa */}
          {Object.keys(dailySummary.byType).length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <p className="section-title" style={{ marginTop: 0 }}>Por tipo de rifa</p>
              <div className="card" style={{ padding: '0.75rem 1rem' }}>
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
            </div>
          )}

          {/* Últimas ventas */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p className="section-title" style={{ marginTop: 0 }}>Últimas ventas</p>
            {recentSales.length === 0 ? (
              <div className="empty-state">
                <Ticket size={48} />
                <p>Aún no hay ventas hoy</p>
                <button className="btn btn-primary" onClick={() => navigate('/sell')} style={{ marginTop: '1rem' }} id="go-sell-btn">
                  Vender primer boleto
                </button>
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem 0.75rem' }}>
                {recentSales.map((sale) => {
                  const lottery = lotteries.find((l) => l.id === sale.lotteryId) || getLotteryById(sale.lotteryId);
                  return (
                    <div key={sale.id} className="sale-record-row" style={{ display: 'flex', padding: '0.65rem 0', borderBottom: '1px solid var(--border)', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.3rem' }}>{lottery?.emoji || '🎟️'}</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                            {lottery?.name || 'Sorteo'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            {sale.lines?.length || 0} jugada{sale.lines?.length !== 1 ? 's' : ''}
                          </div>
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
          </div>

        </div>
      </div>
    </div>
  );
};
