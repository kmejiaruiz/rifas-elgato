// ============================================================
// FormInput — Campo de Entrada de datos Premium
// Soporta etiquetas, iconos y visibilidad de contraseña
// ============================================================
import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { COLORS, RADIUS, getThemeColors } from '../styles/theme';
import { useApp } from '../context/AppContext';

export const FormInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  style,
  autoFocus = false,
  ...props
}) => {
  const { isDarkMode } = useApp();
  const activeColors = getThemeColors(isDarkMode);
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const shouldSecure = secureTextEntry && !showPassword;

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={[styles.label, { color: activeColors.textSecondary }]}>{label}</Text>}
      <View style={[
        styles.inputWrapper,
        {
          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
          borderColor: isFocused ? activeColors.primary : activeColors.border,
        }
      ]}>
        <TextInput
          style={[styles.input, { color: activeColors.textPrimary }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={activeColors.textMuted}
          secureTextEntry={shouldSecure}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
          >
            {showPassword ? (
              <EyeOff size={18} color={activeColors.textSecondary} />
            ) : (
              <Eye size={18} color={activeColors.textSecondary} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    width: '100%',
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    paddingLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: RADIUS.md,
    height: 48,
    paddingHorizontal: 12,
  },
  inputFocused: {
    borderColor: COLORS.primary,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    height: '100%',
    padding: 0,
  },
  eyeBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
