// ============================================================
// CustomAlert — Dialogo/Modal Personalizado Estilo Premium
// Reemplaza los Alerts nativos de React Native con estética Glassmorphic
// ============================================================
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated } from 'react-native';
import { COLORS, RADIUS, SHADOWS } from '../styles/theme';
import { CustomButton } from './CustomButton';

export const CustomAlert = ({
  visible,
  title,
  message,
  onClose,
  confirmText = 'Aceptar',
  cancelText,
  onConfirm,
  onCancel,
  type = 'info', // 'info' | 'success' | 'error' | 'warning'
  progress = null, // null o número del 0 al 100
  progressText = '',
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 100, // snappier, ultra-fast 100ms fade-in
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100, // snappier, ultra-fast 100ms scale-up
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.96);
    }
  }, [visible]);

  if (!visible) return null;

  const getBorderColor = () => {
    switch (type) {
      case 'success': return 'rgba(16, 185, 129, 0.35)';
      case 'error':   return 'rgba(239, 68, 68, 0.35)';
      case 'warning': return 'rgba(251, 191, 36, 0.35)';
      default:        return 'rgba(255, 255, 255, 0.08)';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.card, { borderColor: getBorderColor(), transform: [{ scale: scaleAnim }] }]}>
          {/* Título */}
          <Text style={styles.title}>{title}</Text>
          
          {/* Mensaje descriptivo */}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Barra de progreso */}
          {progress !== null && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
              </View>
              {progressText ? (
                <Text style={styles.progressLabel}>
                  {progressText} ({progress}%)
                </Text>
              ) : (
                <Text style={styles.progressLabel}>{progress}%</Text>
              )}
            </View>
          )}

          {/* Fila de botones */}
          {progress === null && (
            <View style={styles.buttonRow}>
              {cancelText && (
                <CustomButton
                  title={cancelText}
                  variant="ghost"
                  onPress={onCancel || onClose}
                  style={[styles.btn, { marginRight: 8 }]}
                />
              )}
              <CustomButton
                title={confirmText}
                variant={type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'primary'}
                onPress={onConfirm || onClose}
                style={styles.btn}
              />
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 11, 20, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#12131f',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressContainer: {
    marginVertical: 8,
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    color: COLORS.primaryLight,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  btn: {
    flex: 1,
    height: 40,
  },
});
