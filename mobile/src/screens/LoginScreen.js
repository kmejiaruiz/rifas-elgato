// ============================================================
// LoginScreen — Pantalla de Acceso Móvil (Rediseño Premium)
// ============================================================
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { LogIn, Server, Lock, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getApiUrl, setApiUrl } from '../services/apiService';
import { COLORS, RADIUS, SHADOWS } from '../styles/theme';
import { FormInput } from '../components/FormInput';
import { CustomButton } from '../components/CustomButton';
import { GlassCard } from '../components/GlassCard';
import { storage } from '../services/storageService';

export const LoginScreen = () => {
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrlInput] = useState('');
  
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cachedBypassCode, setCachedBypassCode] = useState('1005199611712301977');

  // Cargar URL inicial de API y bypassCode
  useEffect(() => {
    const init = async () => {
      setApiUrlInput(getApiUrl());
      try {
        const cached = await storage.get('cached_settings');
        if (cached && cached.bypassCode) {
          setCachedBypassCode(cached.bypassCode);
        }
      } catch (err) {
        // no-op
      }
    };
    init();
  }, []);

  const handleLogoLongPress = () => {
    if (username.trim() === cachedBypassCode) {
      setShowConfig(true);
      setUsername(''); // Limpiar el código secreto
      Alert.alert('Modo Soporte 🛠️', 'Ajustes de red desbloqueados.');
    }
  };

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Glows de fondo */}
        <View style={styles.neonOrbTop} />
        <View style={styles.neonOrbBottom} />

        {/* Logo y Encabezado */}
        <View style={styles.header}>
          <TouchableOpacity 
            onLongPress={handleLogoLongPress} 
            delayLongPress={3000} 
            activeOpacity={0.9}
            style={styles.logoWrapper}
          >
            <Image
              source={require('../../assets/app_logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.title}>Zentric</Text>
          <Text style={styles.subtitle}>Inicie sesión para continuar</Text>
        </View>

        {/* Tarjeta de Formulario con Glow en Borde */}
        <View style={styles.cardContainer}>
          <GlassCard style={styles.formCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconCircle}>
                <Lock size={18} color="#a78bfa" />
              </View>
              <Text style={styles.cardTitle}>Acceso de Vendedor</Text>
            </View>

            <FormInput
              label="Usuario"
              value={username}
              onChangeText={setUsername}
              placeholder="Ingrese su usuario"
              autoCapitalize="none"
            />

            <FormInput
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            {showConfig && (
              <View style={styles.configContainer}>
                <View style={styles.divider} />
                <FormInput
                  label="Dirección del Servidor API"
                  value={apiUrl}
                  onChangeText={setApiUrlInput}
                  placeholder="http://192.168.1.100/app"
                  keyboardType="url"
                />
              </View>
            )}

            <CustomButton
              title="Iniciar Sesión"
              onPress={handleLoginSubmit}
              loading={loading}
              icon={LogIn}
              style={styles.loginBtn}
            />

            {showConfig && (
              <View style={styles.supportBadge}>
                <ShieldCheck size={12} color="#10b981" />
                <Text style={styles.supportText}>Servidor Personalizado Desbloqueado</Text>
              </View>
            )}
          </GlassCard>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070915', // Ultra dark premium background
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
    top: '-10%',
    left: '-15%',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(139, 92, 246, 0.12)', // Subtle Violet Glow
  },
  neonOrbBottom: {
    position: 'absolute',
    bottom: '-8%',
    right: '-10%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(59, 130, 246, 0.08)', // Subtle Blue Glow
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoWrapper: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#9ca3af',
  },
  cardContainer: {
    width: '100%',
    maxWidth: 380,
    borderRadius: RADIUS.xl,
    padding: 1, // Border highlight spacer
    backgroundColor: 'rgba(167, 139, 250, 0.08)', // Ambient border glow
  },
  formCard: {
    width: '100%',
    paddingVertical: 24,
    paddingHorizontal: 22,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(17, 24, 39, 0.72)', // Transparent dark glass
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#e5e7eb',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loginBtn: {
    marginTop: 18,
    backgroundColor: '#7c3aed',
    height: 48,
    borderRadius: RADIUS.sm,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  configContainer: {
    width: '100%',
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 12,
  },
  supportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 16,
  },
  supportText: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '800',
  },
});
