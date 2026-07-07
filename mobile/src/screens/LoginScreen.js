// ============================================================
// LoginScreen — Pantalla de Acceso Móvil (Rediseño Premium)
// ============================================================
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { LogIn, Server, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react-native';
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
            activeOpacity={0.95}
            style={styles.logoOuterWrapper}
          >
            <View style={styles.logoInnerWrapper}>
              <Image
                source={require('../../assets/app_logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
          
          <Text style={styles.brandTitle}>ZENTRIC</Text>
          <Text style={styles.brandSubtitle}>TERMINAL DE VENTAS MÓVIL</Text>
        </View>

        {/* Tarjeta de Formulario con Glow en Borde */}
        <View style={styles.cardContainer}>
          <GlassCard style={styles.formCard}>
            {/* Indicador de conexión segura */}
            <View style={styles.secureBadgeRow}>
              <View style={styles.secureBadge}>
                <CheckCircle2 size={12} color="#10b981" />
                <Text style={styles.secureBadgeText}>CONEXIÓN SEGURA SSL</Text>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <FormInput
                label="Usuario de Vendedor"
                value={username}
                onChangeText={setUsername}
                placeholder="Ingrese su usuario"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <FormInput
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
              />
            </View>

            {showConfig && (
              <View style={styles.configContainer}>
                <View style={styles.divider} />
                <FormInput
                  label="Servidor de Producción (API)"
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
                <Text style={styles.supportText}>Servidor Personalizado Activo</Text>
              </View>
            )}
          </GlassCard>
        </View>

        <Text style={styles.footerText}>Zentric Engine v1.14[beta] • Conexión Cifrada</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070915', // Fondo premium ultra oscuro
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
    backgroundColor: 'rgba(124, 58, 237, 0.08)', // Glow Violeta sutil
  },
  neonOrbBottom: {
    position: 'absolute',
    bottom: '-8%',
    right: '-10%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(59, 130, 246, 0.06)', // Glow Azul sutil
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoOuterWrapper: {
    padding: 3,
    borderRadius: 36,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    marginBottom: 16,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  logoInnerWrapper: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 64,
    height: 64,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#a78bfa',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  cardContainer: {
    width: '100%',
    maxWidth: 380,
    borderRadius: RADIUS.xl,
    padding: 1, // Glow sutil del borde
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  formCard: {
    width: '100%',
    paddingVertical: 24,
    paddingHorizontal: 22,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(17, 24, 39, 0.75)', // Cristal oscuro translúcido
  },
  secureBadgeRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  secureBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#34d399',
    letterSpacing: 0.8,
  },
  inputContainer: {
    marginBottom: 12,
    width: '100%',
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
    marginTop: 6,
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
  footerText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    marginTop: 32,
    letterSpacing: 0.5,
  },
});
