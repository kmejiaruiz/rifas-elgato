// ============================================================
// GlassCard — Tarjeta translúcida con estética Premium
// ============================================================
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { RADIUS, SHADOWS, getThemeColors } from '../styles/theme';
import { useApp } from '../context/AppContext';

export const GlassCard = ({ children, style, statusColor }) => {
  const { isDarkMode } = useApp();
  const activeColors = getThemeColors(isDarkMode);

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: activeColors.bgCard,
        borderColor: activeColors.border,
      },
      statusColor ? { borderColor: statusColor, borderWidth: 1.5 } : null,
      style
    ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginVertical: 6,
    ...SHADOWS.md,
  },
});
