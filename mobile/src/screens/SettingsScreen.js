// ============================================================
// SettingsScreen — Ajustes Comerciales para Móvil
// ============================================================
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { ChevronLeft, Save } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS } from '../styles/theme';
import { GlassCard } from '../components/GlassCard';
import { FormInput } from '../components/FormInput';
import { CustomButton } from '../components/CustomButton';

export const SettingsScreen = ({ onNavigate }) => {
  const { settings, updateSettings } = useApp();

  const [businessName, setBusinessName] = useState(settings.businessName || '');
  const [currency, setCurrency] = useState(settings.currency || '');
  const [autoprint, setAutoprint] = useState(settings.autoprint ?? true);
  const [drawCloseMinutes, setDrawCloseMinutes] = useState(String(settings.drawCloseMinutes || '10'));
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateSettings({
        businessName,
        currency,
        autoprint,
        drawCloseMinutes: Number(drawCloseMinutes),
      });
      onNavigate('dashboard');
    } catch {
      // Alertado en AppContext
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Barra superior */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#fff" />
          <Text style={styles.navTitle}>Ajustes Comerciales</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Identidad Comercial</Text>
          
          <FormInput
            label="Nombre Comercial"
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Rifas Express"
          />

          <FormInput
            label="Símbolo de Moneda"
            value={currency}
            onChangeText={setCurrency}
            placeholder="NIO"
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Parámetros del Sorteo</Text>

          <FormInput
            label="Minutos Cierre del Sorteo (antes de la hora)"
            value={drawCloseMinutes}
            onChangeText={setDrawCloseMinutes}
            placeholder="10"
            keyboardType="numeric"
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Preferencias de Impresión (80mm)</Text>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Impresión Automática</Text>
              <Text style={styles.switchDesc}>
                Imprime un ticket térmico al confirmar una venta.
              </Text>
            </View>
            <Switch
              value={autoprint}
              onValueChange={setAutoprint}
              trackColor={{ false: '#374151', true: COLORS.primaryLight }}
              thumbColor={autoprint ? COLORS.primary : '#9ca3af'}
            />
          </View>
        </GlassCard>

        <CustomButton
          title="Guardar Ajustes"
          onPress={handleSave}
          loading={loading}
          icon={Save}
          style={styles.saveBtn}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgBase,
  },
  navBar: {
    height: 56,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    paddingBottom: 6,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  switchDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  saveBtn: {
    marginTop: 16,
    height: 50,
  },
});
