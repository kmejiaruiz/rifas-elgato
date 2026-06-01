// ============================================================
// LoginScreen — Pantalla de Acceso Móvil
// ============================================================
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ticket, LogIn, Server } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getApiUrl, setApiUrl } from '../services/apiService';
import { COLORS, RADIUS } from '../styles/theme';
import { FormInput } from '../components/FormInput';
import { CustomButton } from '../components/CustomButton';
import { GlassCard } from '../components/GlassCard';

export const LoginScreen = () => {
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrlInput] = useState('');
  
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cargar URL inicial de API
  useEffect(() => {
    setApiUrlInput(getApiUrl());
  }, []);

  const handleLoginSubmit = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Campos requeridos', 'Por favor complete todos los campos');
      return;
    }
    
    setLoading(true);
    try {
      // Guardar la URL configurada
      await setApiUrl(apiUrl);
      await login(username.trim(), password);
    } catch (err) {
      // Los errores ya son alertados por AuthContext, solo paramos el loading
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (user, pass) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Luces de neón de fondo */}
        <View style={styles.neonOrbTop} />
        <View style={styles.neonOrbBottom} />

        {/* Logo y Encabezado */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ticket size={40} color="#fff" />
          </View>
          <Text style={styles.title}>Rifas Express</Text>
          <Text style={styles.subtitle}>Inicie sesión para continuar</Text>
        </View>

        {/* Tarjeta de Formulario */}
        <GlassCard style={styles.formCard}>
          <FormInput
            label="Usuario"
            value={username}
            onChangeText={setUsername}
            placeholder="Nombre de usuario"
            autoCapitalize="none"
          />

          <FormInput
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          {/* Configuración de Servidor API (Editable) */}
          <TouchableOpacity
            style={styles.toggleConfig}
            onPress={() => setShowConfig(!showConfig)}
            activeOpacity={0.7}
          >
            <Server size={14} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
            <Text style={styles.toggleText}>
              {showConfig ? 'Ocultar ajustes de red' : 'Configurar servidor API'}
            </Text>
          </TouchableOpacity>

          {showConfig && (
            <FormInput
              label="Dirección del Servidor API"
              value={apiUrl}
              onChangeText={setApiUrlInput}
              placeholder="http://192.168.1.100/app"
              keyboardType="url"
            />
          )}

          <CustomButton
            title="Iniciar Sesión"
            onPress={handleLoginSubmit}
            loading={loading}
            icon={LogIn}
            style={{ marginTop: 12 }}
          />

          {/* Presets Rápidos */}
          <View style={styles.divider} />
          <Text style={styles.hintTitle}>Cuentas de prueba:</Text>
          
          <View style={styles.presetRow}>
            <CustomButton
              title="Administrador"
              variant="secondary"
              onPress={() => loadPreset('admin', 'admin123')}
              style={styles.presetBtn}
              textStyle={{ fontSize: 12 }}
            />
            <CustomButton
              title="Vendedor"
              variant="secondary"
              onPress={() => loadPreset('vendedor', '1234')}
              style={styles.presetBtn}
              textStyle={{ fontSize: 12 }}
            />
          </View>
        </GlassCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

import { TouchableOpacity as RNTouchableOpacity } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgBase,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: '100%',
  },
  neonOrbTop: {
    position: 'absolute',
    top: '-15%',
    left: '-20%',
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    filter: 'blur(80px)',
  },
  neonOrbBottom: {
    position: 'absolute',
    bottom: '-10%',
    right: '-15%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    filter: 'blur(70px)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
  },
  toggleConfig: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 12,
    padding: 4,
  },
  toggleText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 16,
  },
  hintTitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  presetBtn: {
    flex: 1,
    height: 36,
  },
});
