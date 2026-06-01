// ============================================================
// App.js — Punto de Entrada de la Aplicación Móvil Expo
// Maneja el enrutamiento de pantallas y los proveedores de contexto
// ============================================================
import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppProvider, useApp } from './src/context/AppContext';
import { COLORS } from './src/styles/theme';

// Importación de pantallas
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { SellTicketScreen } from './src/screens/SellTicketScreen';
import { SalesHistoryScreen } from './src/screens/SalesHistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AdminPanelScreen } from './src/screens/AdminPanelScreen';

const AppContent = () => {
  const { user, loading: authLoading } = useAuth();
  const { loadAllData } = useApp();
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // 'dashboard' | 'sell' | 'history' | 'settings' | 'admin'

  // Cuando cambia el estado del usuario, recargar todos los datos si se loguea
  React.useEffect(() => {
    if (user) {
      loadAllData();
      setCurrentScreen('dashboard');
    }
  }, [user, loadAllData]);

  // Pantalla de carga inicial (restaurando token seguro)
  if (authLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando Rifas Express...</Text>
      </View>
    );
  }

  // Si no está autenticado, renderiza pantalla de Login
  if (!user) {
    return <LoginScreen />;
  }

  // Enrutamiento de pantallas simple y eficiente
  const renderScreen = () => {
    switch (currentScreen) {
      case 'sell':
        return <SellTicketScreen onNavigate={setCurrentScreen} />;
      case 'history':
        return <SalesHistoryScreen onNavigate={setCurrentScreen} />;
      case 'settings':
        return <SettingsScreen onNavigate={setCurrentScreen} />;
      case 'admin':
        return <AdminPanelScreen onNavigate={setCurrentScreen} />;
      default:
        return <DashboardScreen onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />
      <View style={styles.mainContainer}>
        {renderScreen()}
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#111827',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.bgBase,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.bgBase,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
