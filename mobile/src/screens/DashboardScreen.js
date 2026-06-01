// ============================================================
// DashboardScreen — Pantalla Principal con Resumen
// ============================================================
import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { User, LogOut, Ticket, History, Settings, ShieldAlert, Award } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS } from '../styles/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomButton } from '../components/CustomButton';

export const DashboardScreen = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const { dailySummary, refreshSummary, loading } = useApp();

  const isAdmin = user && user.role === 'admin';
  const currency = dailySummary.currency || 'NIO';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refreshSummary}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Cabecera / Saludo */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.userBadge}>
            <User size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.welcome}>Bienvenido,</Text>
            <Text style={styles.username}>{user?.name || 'Vendedor'}</Text>
          </View>
        </View>
        <CustomButton
          variant="ghost"
          icon={LogOut}
          onPress={logout}
          style={styles.logoutBtn}
          title=""
        />
      </View>

      {/* Resumen del Día */}
      <Text style={styles.sectionTitle}>Resumen de Hoy</Text>
      
      <View style={styles.summaryGrid}>
        <GlassCard style={[styles.summaryCard, { borderLeftColor: COLORS.success, borderLeftWidth: 4 }]}>
          <Text style={styles.cardLabel}>Vendido</Text>
          <Text style={[styles.cardVal, { color: COLORS.successLight }]}>
            {currency} {parseFloat(dailySummary.total || 0).toFixed(2)}
          </Text>
        </GlassCard>

        <GlassCard style={[styles.summaryCard, { borderLeftColor: COLORS.info, borderLeftWidth: 4 }]}>
          <Text style={styles.cardLabel}>Boletos</Text>
          <Text style={[styles.cardVal, { color: COLORS.info }]}>
            {dailySummary.count || 0}
          </Text>
        </GlassCard>
      </View>

      {/* Menú de Acciones */}
      <Text style={styles.sectionTitle}>Acciones Rápidas</Text>

      <GlassCard style={styles.menuCard}>
        <CustomButton
          title="Nueva Venta (Vender)"
          variant="primary"
          icon={Ticket}
          onPress={() => onNavigate('sell')}
          style={styles.menuBtn}
        />

        <CustomButton
          title="Historial de Ventas"
          variant="secondary"
          icon={History}
          onPress={() => onNavigate('history')}
          style={styles.menuBtn}
        />

        {isAdmin && (
          <CustomButton
            title="Panel de Administración"
            variant="secondary"
            icon={ShieldAlert}
            onPress={() => onNavigate('admin')}
            style={styles.menuBtn}
          />
        )}

        <CustomButton
          title="Ajustes Comerciales"
          variant="secondary"
          icon={Settings}
          onPress={() => onNavigate('settings')}
          style={styles.menuBtn}
        />
      </GlassCard>

      {/* Mensaje Informativo */}
      <View style={styles.footerInfo}>
        <Award size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
        <Text style={styles.footerText}>Rifas Express v1.0.0 • 80mm Layout</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgBase,
    paddingTop: 12,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  welcome: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  username: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginVertical: 10,
    letterSpacing: 0.5,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    height: 90,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  cardVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  menuCard: {
    padding: 20,
    gap: 8,
  },
  menuBtn: {
    height: 52,
  },
  footerInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 36,
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
});
