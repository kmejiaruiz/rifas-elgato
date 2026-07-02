// ============================================================
// AppBlockedScreen — Pantalla de bloqueo completo (Parámetros)
// ============================================================
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { AlertTriangle, LogOut } from 'lucide-react-native';

export const AppBlockedScreen = ({ onLogout }) => {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {/* Código de referencia en la esquina superior derecha */}
        <Text style={styles.codeText}>[ERR-PARAM]</Text>
        
        {/* Círculo del icono de alerta */}
        <View style={styles.iconContainer}>
          <AlertTriangle size={32} color="#ef4444" />
        </View>

        {/* Título de error */}
        <Text style={styles.title}>Error de Parametrización</Text>

        {/* Mensaje descriptivo */}
        <Text style={styles.message}>
          La aplicación no está disponible en este momento.{"\n"}
          Contacte al administrador del sistema para restablecer el servicio.
        </Text>

        {/* Separador degradado/sutil */}
        <View style={styles.divider} />

        {/* Badge de estado del servicio */}
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Servicio no disponible</Text>
        </View>

        {/* Separador inferior sutil */}
        <View style={styles.dividerLight} />

        {/* Botón de cerrar sesión */}
        <TouchableOpacity
          onPress={onLogout}
          style={styles.logoutBtn}
          activeOpacity={0.7}
        >
          <LogOut size={16} color="rgba(241, 245, 249, 0.7)" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 11, 20, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#12131f',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: 'rgba(239, 68, 68, 0.1)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 8,
    position: 'relative',
  },
  codeText: {
    position: 'absolute',
    top: 16,
    right: 18,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(248, 113, 113, 0.5)',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: 'rgba(241, 245, 249, 0.5)',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    color: '#f87171',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dividerLight: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
  },
  logoutBtn: {
    width: '100%',
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: 'rgba(241, 245, 249, 0.7)',
    fontSize: 14,
    fontWeight: '700',
  },
});
