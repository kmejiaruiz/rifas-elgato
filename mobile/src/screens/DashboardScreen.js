// ============================================================
// DashboardScreen — Pantalla Principal con Resumen
// Muestra datos del negocio sincronizados desde el API
// ============================================================
import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, Animated, Dimensions, ToastAndroid, Platform, Alert } from 'react-native';
import {
  User, LogOut, Ticket, TrendingUp, XCircle, Lock, ChevronLeft, ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS, SHADOWS, getThemeColors } from '../styles/theme';
import { GlassCard } from '../components/GlassCard';
import { HeaderClock } from '../components/HeaderClock';
import { getApiUrl } from '../services/apiService';
import { getResults } from '../services/storageService';

const SCREEN_W = Dimensions.get('window').width;

const formatCurrency = (amount, currency = 'NIO') =>
  `${currency} ${parseFloat(amount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SkeletonBox = ({ style }) => {
  const pulseAnim = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: 8,
        },
        style,
        { opacity: pulseAnim },
      ]}
    />
  );
};

const DashboardSkeleton = ({ activeColors }) => {
  return (
    <View style={[styles.container, { backgroundColor: activeColors.bgBase, flex: 1, paddingTop: 16 }]}>
      {/* Cabecera */}
      <View style={[styles.header, { borderBottomWidth: 0, paddingBottom: 12, paddingHorizontal: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SkeletonBox style={{ width: 40, height: 40, borderRadius: 20 }} />
          <View style={{ gap: 6 }}>
            <SkeletonBox style={{ width: 120, height: 16 }} />
            <SkeletonBox style={{ width: 70, height: 12 }} />
          </View>
        </View>
        <SkeletonBox style={{ width: 90, height: 26, borderRadius: 12 }} />
      </View>

      {/* Resumen de Hoy */}
      <View style={{ marginTop: 8, paddingHorizontal: 16 }}>
        <SkeletonBox style={{ width: 110, height: 16, marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <SkeletonBox style={{ flex: 1, height: 80, borderRadius: 12 }} />
          <SkeletonBox style={{ flex: 1, height: 80, borderRadius: 12 }} />
          <SkeletonBox style={{ flex: 1, height: 80, borderRadius: 12 }} />
        </View>
      </View>

      {/* Carrusel */}
      <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
        <SkeletonBox style={{ width: 140, height: 16, marginBottom: 12 }} />
        <SkeletonBox style={{ width: '100%', height: 160, borderRadius: 16 }} />
      </View>

      {/* Resultados */}
      <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
        <SkeletonBox style={{ width: 120, height: 16, marginBottom: 12 }} />
        <SkeletonBox style={{ width: '100%', height: 110, borderRadius: 16 }} />
      </View>
    </View>
  );
};

export const DashboardScreen = ({ onNavigate, onOpenSidebar, profileImage }) => {
  const { user, logout } = useAuth();
  const { dailySummary, settings, loading, loadAllData, lotteries, sales, isServerConnected, isDarkMode } = useApp();
  const activeColors = getThemeColors(isDarkMode);

  const isFirstLoad = loading && (!dailySummary || dailySummary.ventasHoy === undefined);

  if (isFirstLoad) {
    return <DashboardSkeleton activeColors={activeColors} />;
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'root';
  const currency = settings.currency || 'NIO';
  const businessName = settings.businessName || 'Zentric';
  const isBlocked = settings.isBlocked === true;

  // Resumen por tipo de juego
  const byType = dailySummary.byType || {};
  const activeGamesWithSales = lotteries.filter(l => byType[l.id] && byType[l.id] > 0);

  const [results, setResults] = React.useState([]);

  React.useEffect(() => {
    let active = true;
    const fetchRes = async () => {
      try {
        const list = await getResults();
        if (active) setResults(list || []);
      } catch (err) {
        console.warn('Error loading results in dashboard screen:', err);
      }
    };
    fetchRes();
    const interval = setInterval(fetchRes, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const [carouselIndex, setCarouselIndex] = React.useState(0);
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  const buildImageUrl = React.useCallback((url) => {
    if (!url) return url;
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) return url;
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
      title: 'Sistema de Ventas Zentric',
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
      ? carouselImages.map(item => {
          if (typeof item === 'object' && item !== null) {
            return {
              ...item,
              url: item.url ? buildImageUrl(item.url) : null
            };
          }
          return { type: 'image', url: buildImageUrl(item) };
        })
      : defaultSlides;
  }, [carouselImages, defaultSlides, buildImageUrl]);

  const goToSlide = React.useCallback((idx) => {
    setCarouselIndex(idx);
    Animated.timing(slideAnim, {
      toValue: -idx * SCREEN_W,
      duration: 380,
      useNativeDriver: true,
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

  const handleBarPress = (day) => {
    const msg = `${day.label} · Ventas: ${formatCurrency(day.sales, currency)} | Pagos: ${formatCurrency(day.payouts, currency)}`;
    if (Platform.OS === 'android') {
      ToastAndroid.showWithGravity(msg, ToastAndroid.SHORT, ToastAndroid.BOTTOM);
    } else {
      Alert.alert('Resumen del Día', msg, [{ text: 'Aceptar' }]);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: activeColors.bgBase }]}
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
          <TouchableOpacity onPress={onOpenSidebar} style={styles.userBadge} activeOpacity={0.7}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
            ) : (
              <User size={20} color="#fff" />
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.businessName, { color: activeColors.primaryLight }]}>{businessName}</Text>
            <Text style={[styles.username, { color: activeColors.textPrimary }]} numberOfLines={1}>{user?.name || 'Vendedor'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={[styles.userRole, { color: activeColors.textSecondary }]}>
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
      <Text style={[styles.sectionTitle, { color: activeColors.textSecondary }]}>Resumen de Hoy</Text>

      <GlassCard style={styles.metricsContainer}>
        {/* Total vendido */}
        <View style={styles.metricCell}>
          <View style={[styles.metricIconCircle, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
            <TrendingUp size={16} color={activeColors.successLight} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.metricCellLabel}>Vendido</Text>
            <Text style={[styles.metricCellVal, { color: activeColors.successLight }]} numberOfLines={1}>
              {formatCurrency(dailySummary.total, currency).replace(currency + ' ', '')}
            </Text>
          </View>
        </View>

        <View style={styles.metricDivider} />

        {/* Boletos */}
        <View style={styles.metricCell}>
          <View style={[styles.metricIconCircle, { backgroundColor: 'rgba(124,58,237,0.12)' }]}>
            <Ticket size={16} color={activeColors.primaryLight} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.metricCellLabel}>Boletos</Text>
            <Text style={[styles.metricCellVal, { color: activeColors.primaryLight }]}>
              {dailySummary.count || 0}
            </Text>
          </View>
        </View>

        {(dailySummary.cancelled || 0) > 0 && (
          <>
            <View style={styles.metricDivider} />
            {/* Anulados */}
            <View style={styles.metricCell}>
              <View style={[styles.metricIconCircle, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <XCircle size={16} color={activeColors.dangerLight} />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.metricCellLabel}>Anulado</Text>
                <Text style={[styles.metricCellVal, { color: activeColors.dangerLight }]}>
                  {dailySummary.cancelled}
                </Text>
              </View>
            </View>
          </>
        )}
      </GlassCard>

      {/* ─── Carrusel de anuncios (Animated sliding) ─────────── */}
      {slidesToRender.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: activeColors.textSecondary }]}>Anuncios y Promociones</Text>
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
                    <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                      <Image
                        source={{ uri: slide.url }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                      {(slide.title || slide.subtitle) && (
                        <View style={styles.carouselTextOverlay}>
                          {slide.title ? <Text style={styles.carouselOverlayTitle}>{slide.title}</Text> : null}
                          {slide.subtitle ? <Text style={styles.carouselOverlaySubtitle}>{slide.subtitle}</Text> : null}
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={[styles.carouselDefaultSlide, { backgroundColor: slide.background || '#6366f1' }]}>
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

      {/* ─── Resultados Recientes ────────────────────────────── */}
      {!loading && results && results.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: activeColors.textSecondary }]}>Últimos Resultados</Text>
          <GlassCard style={{ padding: 14, paddingBottom: 8, marginBottom: 16 }}>
            <ScrollView style={{ maxHeight: 135 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
              {results.slice(0, 10).map((r, idx) => {
                const lottery = lotteries.find(l => l.id === r.lotteryId);
                const displayNum = r.lotteryId === 'fechea' ? r.numeroGanador : `#${r.numeroGanador}`;
                return (
                  <View
                    key={r.id}
                    style={[
                      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
                      idx < Math.min(results.length, 10) - 1 && { borderBottomWidth: 1, borderBottomColor: activeColors.border }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View>
                        <Text style={{ color: activeColors.textPrimary, fontSize: 12, fontWeight: '700' }}>{lottery?.name || r.lotteryId}</Text>
                        <Text style={{ color: activeColors.textMuted, fontSize: 10 }}>{r.fechaSorteo} ({r.horaSorteo})</Text>
                      </View>
                    </View>
                    <View style={{ backgroundColor: 'rgba(168,85,247,0.15)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ color: '#d8b4fe', fontWeight: '900', fontSize: 13 }}>{displayNum}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </GlassCard>
        </>
      )}

      {/* ─── Gráfico de Ventas y Pagos ───────────────────────── */}
      {!loading && sales && sales.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: activeColors.textSecondary }]}>Rendimiento Semanal</Text>
          <GlassCard style={styles.chartCard}>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#a855f7' }]} />
                <Text style={[styles.legendText, { color: activeColors.textSecondary }]}>Ventas</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#10b981' }]} />
                <Text style={[styles.legendText, { color: activeColors.textSecondary }]}>Pagos</Text>
              </View>
            </View>

            <View style={[styles.chartBody, { borderBottomColor: activeColors.border }]}>
              {chartData.map((day) => {
                const maxVal = Math.max(...chartData.map(d => Math.max(d.sales, d.payouts)), 100);
                const salesHeight = (day.sales / maxVal) * 100; // max height is 100
                const payoutsHeight = (day.payouts / maxVal) * 100;

                return (
                  <TouchableOpacity 
                    key={day.dateStr} 
                    style={styles.chartColumn}
                    onPress={() => handleBarPress(day)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.barsContainer}>
                      {/* Barra de Ventas */}
                      <View 
                        style={[
                          styles.bar, 
                          { 
                            height: Math.max(salesHeight, 2), 
                            backgroundColor: day.sales > 0 ? '#a855f7' : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                          }
                        ]} 
                      />
                      {/* Barra de Pagos */}
                      <View 
                        style={[
                          styles.bar, 
                          { 
                            height: Math.max(payoutsHeight, 2), 
                            backgroundColor: day.payouts > 0 ? '#10b981' : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                          }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.chartDayLabel, { color: activeColors.textMuted }]}>{day.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </GlassCard>
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
  metricsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 18,
  },
  metricCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCellLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricCellVal: {
    fontSize: 13,
    fontWeight: '900',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    marginHorizontal: 4,
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
  carouselTextOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  carouselOverlayTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  carouselOverlaySubtitle: {
    color: '#d1d5db',
    fontSize: 11,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
