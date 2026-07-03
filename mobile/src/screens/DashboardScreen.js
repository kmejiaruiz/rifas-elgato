// ============================================================
// DashboardScreen — Pantalla Principal con Resumen
// Muestra datos del negocio sincronizados desde el API
// ============================================================
import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, Animated, Dimensions } from 'react-native';
import {
  User, LogOut, Ticket, TrendingUp, XCircle, Lock, ChevronLeft, ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS, SHADOWS } from '../styles/theme';
import { GlassCard } from '../components/GlassCard';
import { HeaderClock } from '../components/HeaderClock';
import { getApiUrl } from '../services/apiService';

const SCREEN_W = Dimensions.get('window').width;

const formatCurrency = (amount, currency = 'NIO') =>
  `${currency} ${parseFloat(amount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const DashboardScreen = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const { dailySummary, settings, loading, loadAllData, lotteries, sales, isServerConnected } = useApp();

  const isAdmin = user?.role === 'admin' || user?.role === 'root';
  const currency = settings.currency || 'NIO';
  const businessName = settings.businessName || 'Amaranto';
  const isBlocked = settings.isBlocked === true;

  // Resumen por tipo de juego
  const byType = dailySummary.byType || {};
  const activeGamesWithSales = lotteries.filter(l => byType[l.id] && byType[l.id] > 0);

  const [carouselIndex, setCarouselIndex] = React.useState(0);
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  const buildImageUrl = React.useCallback((url) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    try {
      const apiBase = getApiUrl(); // e.g. http://192.168.1.100/app/api
      const match = apiBase.match(/^(https?:\/\/[^\/]+)/);
      const host = match ? match[1] : '';
      return host + url;
    } catch { return url; }
  }, []);

  const carouselImages = React.useMemo(() => {
    try {
      return JSON.parse(settings.carousel_images || '[]');
    } catch {
      return [];
    }
  }, [settings.carousel_images]);

  const defaultSlides = React.useMemo(() => [
    {
      type: 'default',
      background: '#6366f1',
      title: 'Sistema de Ventas Amaranto',
      subtitle: 'Gestiona tus sorteos y boletos de forma rápida.'
    },
    {
      type: 'default',
      background: '#10b981',
      title: 'Modo Offline Activo',
      subtitle: 'Las ventas sin conexión se sincronizarán al recuperar la red.'
    }
  ], []);

  const slidesToRender = React.useMemo(() => {
    return carouselImages.length > 0
      ? carouselImages.map(url => ({ type: 'image', url: buildImageUrl(url) }))
      : defaultSlides;
  }, [carouselImages, defaultSlides, buildImageUrl]);

  const goToSlide = React.useCallback((idx) => {
    setCarouselIndex(idx);
    Animated.spring(slideAnim, {
      toValue: -idx * SCREEN_W,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [slideAnim]);

  React.useEffect(() => {
    if (slidesToRender.length <= 1) return;
    const interval = setInterval(() => {
      const next = (carouselIndex + 1) % slidesToRender.length;
      goToSlide(next);
    }, 5000);
    return () => clearInterval(interval);
  }, [slidesToRender.length, carouselIndex, goToSlide]);

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
    
    if (sales && sales.length > 0) {
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
              const lottery = lotteries.find((x) => x.id === s.lotteryId);
              const mult = parseFloat(lottery?.payoutMultiplier || 80);
              return acc + (parseFloat(l.monto || 0) * mult);
            }, 0);
            dayData.payouts += prizeAmt;
          }
        }
      });
    }
    
    return days;
  };

  const chartData = getLast7DaysData();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadAllData}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* ─── Cabecera ────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.userBadge}>
            <User size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.businessName}>{businessName}</Text>
            <Text style={styles.username} numberOfLines={1}>{user?.name || 'Vendedor'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={styles.userRole}>
                {user?.role === 'admin' ? 'Administrador' : user?.role === 'root' ? 'Root' : 'Vendedor'}
              </Text>
              <View style={{ 
                width: 6, 
                height: 6, 
                borderRadius: 3, 
                backgroundColor: isServerConnected ? '#10b981' : '#ef4444' 
              }} />
              <Text style={{ 
                fontSize: 10, 
                fontWeight: '600', 
                color: isServerConnected ? '#10b981' : '#ef4444' 
              }}>
                {isServerConnected ? 'Conectado' : 'Local'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <HeaderClock />
          <TouchableOpacity onPress={logout} style={styles.logoutBtn} activeOpacity={0.7}>
            <LogOut size={18} color={COLORS.dangerLight} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Alerta si la app está bloqueada ─────────────────── */}
      {isBlocked && (
        <View style={styles.blockedBanner}>
          <Lock size={16} color="#fbbf24" />
          <Text style={styles.blockedBannerText}>
            La aplicación está temporalmente bloqueada por el administrador.
          </Text>
        </View>
      )}

      {/* ─── Resumen del día ──────────────────────────────────── */}
      <Text style={styles.sectionTitle}>Resumen de Hoy</Text>

      <View style={styles.metricsGrid}>
        {/* Total vendido */}
        <GlassCard style={[styles.metricCard, { borderLeftColor: COLORS.success, borderLeftWidth: 3 }]}>
          <View style={styles.metricRow}>
            <TrendingUp size={18} color={COLORS.successLight} />
          </View>
          <Text style={styles.metricLabel}>Total Vendido</Text>
          <Text style={[styles.metricValue, { color: COLORS.successLight }]}>
            {formatCurrency(dailySummary.total, currency)}
          </Text>
        </GlassCard>

        {/* Boletos activos */}
        <GlassCard style={[styles.metricCard, { borderLeftColor: COLORS.primary, borderLeftWidth: 3 }]}>
          <View style={styles.metricRow}>
            <Ticket size={18} color={COLORS.primaryLight} />
          </View>
          <Text style={styles.metricLabel}>Boletos</Text>
          <Text style={[styles.metricValue, { color: COLORS.primaryLight }]}>
            {dailySummary.count || 0}
          </Text>
        </GlassCard>

        {/* Anulados */}
        {(dailySummary.cancelled || 0) > 0 && (
          <GlassCard style={[styles.metricCard, { borderLeftColor: COLORS.danger, borderLeftWidth: 3 }]}>
            <View style={styles.metricRow}>
              <XCircle size={18} color={COLORS.dangerLight} />
            </View>
            <Text style={styles.metricLabel}>Anulados</Text>
            <Text style={[styles.metricValue, { color: COLORS.dangerLight }]}>
              {dailySummary.cancelled}
            </Text>
          </GlassCard>
        )}
      </View>

      {/* ─── Gráfico de Ventas y Pagos ───────────────────────── */}
      {!loading && sales && sales.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Rendimiento Semanal</Text>
          <GlassCard style={styles.chartCard}>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#a855f7' }]} />
                <Text style={styles.legendText}>Ventas</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#10b981' }]} />
                <Text style={styles.legendText}>Pagos</Text>
              </View>
            </View>

            <View style={styles.chartBody}>
              {chartData.map((day) => {
                const maxVal = Math.max(...chartData.map(d => Math.max(d.sales, d.payouts)), 100);
                const salesHeight = (day.sales / maxVal) * 100; // max height is 100
                const payoutsHeight = (day.payouts / maxVal) * 100;

                return (
                  <View key={day.dateStr} style={styles.chartColumn}>
                    <View style={styles.barsContainer}>
                      {/* Barra de Ventas */}
                      <View 
                        style={[
                          styles.bar, 
                          { 
                            height: Math.max(salesHeight, 2), 
                            backgroundColor: day.sales > 0 ? '#a855f7' : 'rgba(255,255,255,0.05)' 
                          }
                        ]} 
                      />
                      {/* Barra de Pagos */}
                      <View 
                        style={[
                          styles.bar, 
                          { 
                            height: Math.max(payoutsHeight, 2), 
                            backgroundColor: day.payouts > 0 ? '#10b981' : 'rgba(255,255,255,0.05)' 
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.chartDayLabel}>{day.label}</Text>
                  </View>
                );
              })}
            </View>
          </GlassCard>
        </>
      )}

      {/* ─── Carrusel de anuncios (Animated sliding) ─────────── */}
      {slidesToRender.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Anuncios y Promociones</Text>
          <View style={styles.carouselWrapper}>
            {/* Sliding strip */}
            <Animated.View
              style={[
                styles.carouselStrip,
                { width: SCREEN_W * slidesToRender.length, transform: [{ translateX: slideAnim }] },
              ]}
            >
              {slidesToRender.map((slide, idx) => (
                <View key={idx} style={[styles.carouselSlide, { width: SCREEN_W }]}>
                  {slide.type === 'image' ? (
                    <Image
                      source={{ uri: slide.url }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.carouselDefaultSlide, { backgroundColor: slide.background }]}>
                      <Text style={styles.carouselDefaultTitle}>{slide.title}</Text>
                      <Text style={styles.carouselDefaultSubtitle}>{slide.subtitle}</Text>
                    </View>
                  )}
                </View>
              ))}
            </Animated.View>

            {/* Prev / Next arrows */}
            {slidesToRender.length > 1 && (
              <>
                <TouchableOpacity
                  style={[styles.carouselArrow, styles.carouselArrowLeft]}
                  onPress={() => goToSlide((carouselIndex - 1 + slidesToRender.length) % slidesToRender.length)}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.carouselArrow, styles.carouselArrowRight]}
                  onPress={() => goToSlide((carouselIndex + 1) % slidesToRender.length)}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={18} color="#fff" />
                </TouchableOpacity>

                {/* Dot indicators */}
                <View style={styles.carouselIndicators}>
                  {slidesToRender.map((_, idx) => (
                    <TouchableOpacity key={idx} onPress={() => goToSlide(idx)}>
                      <View style={[
                        styles.indicatorDot,
                        carouselIndex === idx ? styles.indicatorActive : styles.indicatorInactive
                      ]} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        </>
      )}

      {/* ─── Ventas por juego ────────────────────────────────── */}
      {activeGamesWithSales.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Por Juego</Text>
          <GlassCard style={styles.byGameCard}>
            {activeGamesWithSales.map((game, idx) => {
              const gameTotal = byType[`${game.id}_total`] || 0;
              const gameCount = byType[game.id] || 0;
              return (
                <View
                  key={game.id}
                  style={[
                    styles.gameRow,
                    idx < activeGamesWithSales.length - 1 && styles.gameRowBorder,
                  ]}
                >
                  <View style={styles.gameRowLeft}>
                    {game.emoji ? (
                      <Text style={styles.gameEmoji}>{game.emoji}</Text>
                    ) : (
                      <View style={[styles.gameColorDot, { backgroundColor: game.color || COLORS.primary }]} />
                    )}
                    <Text style={styles.gameName}>{game.name}</Text>
                  </View>
                  <View style={styles.gameRowRight}>
                    <Text style={styles.gameCount}>{gameCount} boleto{gameCount !== 1 ? 's' : ''}</Text>
                    {gameTotal > 0 && (
                      <Text style={styles.gameTotal}>{formatCurrency(gameTotal, currency)}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </GlassCard>
        </>
      )}

      {/* ─── Footer ───────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {businessName} • {currency}
        </Text>
        {settings.drawCloseMinutes && (
          <Text style={styles.footerSub}>
            Cierre de venta {settings.drawCloseMinutes} min antes del sorteo
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgBase,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    paddingTop: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  userBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    ...SHADOWS.md,
  },
  businessName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryLight,
    letterSpacing: 0.2,
  },
  username: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 22,
  },
  userRole: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },

  // Blocked banner
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 16,
  },
  blockedBannerText: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '600',
    flex: 1,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },

  // Metrics
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: 14,
  },
  metricRow: {
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
  },

  // By game
  byGameCard: {
    padding: 4,
    marginBottom: 18,
  },
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  gameRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  gameRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gameEmoji: { fontSize: 18 },
  gameColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gameName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  gameRowRight: { alignItems: 'flex-end' },
  gameCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  gameTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.successLight,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  footerSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  // Estilos del gráfico
  chartCard: {
    padding: 16,
    marginBottom: 18,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  chartBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 6,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 100,
    marginBottom: 6,
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
  chartDayLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  carouselCard: {
    width: '100%',
    aspectRatio: 2.33,
    maxHeight: 180,
    minHeight: 120,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginBottom: 18,
    position: 'relative',
    padding: 0,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselIndicators: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  indicatorActive: {
    backgroundColor: COLORS.primaryLight,
  },
  indicatorInactive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  /* ── Animated Carousel ─────────────────────────────────────── */
  carouselWrapper: {
    width: '100%',
    height: 170,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginBottom: 18,
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  carouselStrip: {
    flexDirection: 'row',
    height: '100%',
  },
  carouselSlide: {
    height: '100%',
    overflow: 'hidden',
  },
  carouselDefaultSlide: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  carouselDefaultTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  carouselDefaultSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  carouselArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  carouselArrowLeft: { left: 8 },
  carouselArrowRight: { right: 8 },
  carouselIndicators: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    zIndex: 2,
  },
  indicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
