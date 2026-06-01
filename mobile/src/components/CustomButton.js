// ============================================================
// CustomButton — Botón Táctil Premium con múltiples estados
// ============================================================
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { COLORS, RADIUS, SHADOWS } from '../styles/theme';

export const CustomButton = ({
  onPress,
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon: IconComponent = null,
  style,
  textStyle,
}) => {
  const getStyles = () => {
    switch (variant) {
      case 'secondary':
        return { btn: styles.btnSecondary, text: styles.textSecondary };
      case 'danger':
        return { btn: styles.btnDanger, text: styles.textDanger };
      case 'warning':
        return { btn: styles.btnWarning, text: styles.textWarning };
      case 'ghost':
        return { btn: styles.btnGhost, text: styles.textGhost };
      default:
        return { btn: styles.btnPrimary, text: styles.textPrimary };
    }
  };

  const currentStyles = getStyles();
  const isInteractionDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={isInteractionDisabled}
      style={[
        styles.btnBase,
        currentStyles.btn,
        isInteractionDisabled ? styles.btnDisabled : null,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <View style={styles.content}>
          {IconComponent && (
            <View style={styles.iconContainer}>
              <IconComponent size={18} color={variant === 'secondary' || variant === 'ghost' ? COLORS.textPrimary : '#fff'} />
            </View>
          )}
          <Text style={[styles.textBase, currentStyles.text, textStyle]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btnBase: {
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginVertical: 4,
    ...SHADOWS.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  textBase: {
    fontSize: 15,
    fontWeight: '700',
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
  },
  textPrimary: {
    color: '#ffffff',
  },
  btnSecondary: {
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textSecondary: {
    color: COLORS.textPrimary,
  },
  btnDanger: {
    backgroundColor: COLORS.danger,
  },
  textDanger: {
    color: '#ffffff',
  },
  btnWarning: {
    backgroundColor: COLORS.warning,
  },
  textWarning: {
    color: '#ffffff',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  textGhost: {
    color: COLORS.textSecondary,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
