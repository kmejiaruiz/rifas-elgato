// ============================================================
// GlassCard — Tarjeta translúcida con estética Premium
// ============================================================
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SHADOWS } from '../styles/theme';

export const GlassCard = ({ children, style, statusColor }) => {
  return (
    <View style={[
      styles.card,
      statusColor ? { borderColor: statusColor, borderWidth: 1.5 } : null,
      style
    ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(23, 31, 50, 0.75)', // Fondo oscuro translúcido
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',   // Borde sutil del cristal
    borderRadius: RADIUS.lg,
    padding: 16,
    marginVertical: 6,
    ...SHADOWS.md,
  },
});
