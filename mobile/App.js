// ============================================================
// App.js — Punto de Entrada de la Aplicación Móvil Expo
// Maneja el enrutamiento de pantallas y los proveedores de contexto
// ============================================================
import React, { useState } from 'react';
import { StatusBar, StyleSheet, View, ActivityIndicator, Text, Platform, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppProvider, useApp } from './src/context/AppContext';
import { COLORS } from './src/styles/theme';
import { Home, Ticket, History, Settings, ShieldAlert } from 'lucide-react-native';
import { CustomAlert } from './src/components/CustomAlert';
import { api } from './src/services/apiService';
import * as Notifications from 'expo-notifications';
import { storage } from './src/services/storageService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Global reference to register our alert handler
let globalAlertRegister = null;

// Preserve original Alert.alert
const originalAlert = Alert.alert;

// Override Alert.alert globally
Alert.alert = (title, message, buttons, options) => {
  if (globalAlertRegister) {
    globalAlertRegister(title, message, buttons, options);
  } else {
    originalAlert(title, message, buttons, options);
  }
};

// Importación de pantallas
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { SellTicketScreen } from './src/screens/SellTicketScreen';
import { SalesHistoryScreen } from './src/screens/SalesHistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AdminPanelScreen } from './src/screens/AdminPanelScreen';
import { RootPanelScreen } from './src/screens/RootPanelScreen';
import { AppBlockedScreen } from './src/screens/AppBlockedScreen';
import { OfflineSalesQueueModal } from './src/components/OfflineSalesQueueModal';

const AppContent = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const { loadAllData, settings, lotteries, offlineQueue } = useApp();
  const insets = useSafeAreaInsets();
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // 'dashboard' | 'sell' | 'history' | 'settings' | 'admin'
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [skippedPaymentIds, setSkippedPaymentIds] = useState([]);

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'Aceptar',
    cancelText: null,
    onConfirm: null,
    onCancel: null,
  });

  React.useEffect(() => {
    globalAlertRegister = (title, message, buttons, options) => {
      let cancelText = null;
      let confirmText = 'Aceptar';
      let extraText = null;
      let onConfirmHandler = null;
      let onCancelHandler = null;
      let onExtraHandler = null;
      let extraVariant = null;

      if (buttons && buttons.length > 0) {
        if (buttons.length === 1) {
          confirmText = buttons[0].text || 'Aceptar';
          onConfirmHandler = buttons[0].onPress;
        } else if (buttons.length === 2) {
          const cancelBtnIndex = buttons.findIndex(b => b.style === 'cancel' || b.text?.toLowerCase() === 'cancelar');
          if (cancelBtnIndex !== -1) {
            const cancelBtn = buttons[cancelBtnIndex];
            const confirmBtn = buttons[cancelBtnIndex === 0 ? 1 : 0];
            cancelText = cancelBtn.text || 'Cancelar';
            onCancelHandler = cancelBtn.onPress;
            confirmText = confirmBtn.text || 'Aceptar';
            onConfirmHandler = confirmBtn.onPress;
          } else {
            cancelText = buttons[0].text || 'Cancelar';
            onCancelHandler = buttons[0].onPress;
            confirmText = buttons[1].text || 'Aceptar';
            onConfirmHandler = buttons[1].onPress;
          }
        } else if (buttons.length >= 3) {
          // Soporta 3 botones (ej: confirmación de pago con Preguntar Luego, Rechazar, Confirmar)
          const cancelBtn = buttons.find(b => b.style === 'cancel');
          const destBtn = buttons.find(b => b.style === 'destructive');
          const defaultBtn = buttons.find(b => b.style !== 'cancel' && b.style !== 'destructive');

          if (cancelBtn) {
            cancelText = cancelBtn.text;
            onCancelHandler = cancelBtn.onPress;
          }
          if (destBtn) {
            extraText = destBtn.text;
            onExtraHandler = destBtn.onPress;
            extraVariant = 'danger';
          }
          if (defaultBtn) {
            confirmText = defaultBtn.text;
            onConfirmHandler = defaultBtn.onPress;
          } else {
            confirmText = buttons[2].text;
            onConfirmHandler = buttons[2].onPress;
          }
        }
      }

      // Infer type if not explicitly passed
      let type = 'info';
      if (options && options.type) {
        type = options.type;
      } else {
        const text = `${title || ''} ${message || ''}`.toLowerCase();
        if (text.includes('error') || text.includes('incorrecto') || text.includes('falló') || text.includes('inválid') || text.includes('vencido') || text.includes('bloqueada') || text.includes('desactivada') || text.includes('no se pudo') || text.includes('sin impresora') || text.includes('requerido')) {
          type = 'error';
        } else if (text.includes('éxito') || text.includes('exitoso') || text.includes('guardad') || text.includes('correctamente') || text.includes('sincronizad') || text.includes('completad') || text.includes('confirmad') || text.includes('conectado') || text.includes('¡listo!') || text.includes('✅')) {
          type = 'success';
        } else if (text.includes('advertencia') || text.includes('seguro') || text.includes('alerta') || text.includes('eliminar') || text.includes('anular') || text.includes('confirmar') || text.includes('bloqueado')) {
          type = 'warning';
        }
      }

      setAlertConfig({
        visible: true,
        title,
        message: typeof message === 'string' ? message : '',
        type,
        confirmText,
        cancelText,
        extraText,
        extraVariant,
        onConfirm: () => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          if (onConfirmHandler) onConfirmHandler();
        },
        onCancel: () => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          if (onCancelHandler) onCancelHandler();
        },
        onExtra: () => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          if (onExtraHandler) onExtraHandler();
        }
      });
    };

    return () => {
      globalAlertRegister = null;
    };
  }, []);

  // Cuando cambia el estado del usuario, recargar todos los datos si se loguea
  React.useEffect(() => {
    if (user) {
      if (user.role !== 'root') {
        loadAllData();
        setCurrentScreen('dashboard');
      }
    } else {
      setCurrentScreen('dashboard');
    }
  }, [user, loadAllData]);

  // Polling de notificaciones para admin (pagos y anulaciones de boletos)
  React.useEffect(() => {
    let intervalId = null;
    let isFirstRun = true;

    const checkNotifications = async () => {
      // En la primera ejecución solo sincronizamos (marcamos todo como leído en el backend)
      // sin mostrar alertas, para evitar spam de eventos pasados.
      try {
        const res = await api.get('/notifications');
        if (isFirstRun) {
          // Primera corrida: solo vaciamos el buzón sin mostrar alertas
          isFirstRun = false;
          return;
        }
        if (res && res.notifications && res.notifications.length > 0) {
          // Mostrar alerta dentro de la app
          const messages = res.notifications.map(n => `• ${n.message}`).join('\n\n');
          Alert.alert('💰 Notificación de Boleto', messages);
          // Notificación local nativa (funciona aunque app esté en segundo plano)
          try {
            for (const n of res.notifications) {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: n.title || 'Alerta de Boleto',
                  body: n.message,
                  sound: true,
                },
                trigger: null,
              });
            }
          } catch (_) { /* Expo Go puede no soportar push remoto */ }
        }
      } catch (err) {
        console.warn('Error fetching notifications:', err.message);
      }
    };

    if (user && user.role === 'admin') {
      const requestPerms = async () => {
        try {
          const { status } = await Notifications.getPermissionsAsync();
          if (status !== 'granted') {
            await Notifications.requestPermissionsAsync();
          }
        } catch (_) {
          // En Expo Go SDK 53+ los permisos push remotos no están disponibles.
        }
        checkNotifications();
      };
      requestPerms();
      intervalId = setInterval(checkNotifications, 12000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  // ─── Recordatorio de sorteos próximos para admin ───────────────────────────
  React.useEffect(() => {
    if (!user || user.role !== 'admin') return;

    // Guardar último timestamp notificado para cada sorteo: clave = "YYYY-MM-DD-lotteryId-HH:MM"
    const lastNotified = {};

    const checkUpcomingDraws = (isInitialCall = false) => {
      if (!lotteries || lotteries.length === 0) return;
      const now = new Date();
      const nowTime = now.getTime();
      const todayStr = now.toLocaleDateString('sv-SE');

      for (const lottery of lotteries) {
        if (lottery.enabled === false) continue;
        const hoursRaw = lottery.drawHours || '12:00,15:00,18:00,21:00';
        const hours = hoursRaw.split(',').map(h => h.trim()).filter(Boolean);

        for (const hourStr of hours) {
          const [hh, mm] = hourStr.split(':').map(Number);
          if (isNaN(hh) || isNaN(mm)) continue;

          const drawTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
          const diffMin = (drawTime - now) / 60000;

          const key = `${todayStr}-${lottery.id}-${hourStr}`;

          // Notificar cuando quedan 15 minutos o menos para el sorteo
          if (diffMin > 0 && diffMin <= 15) {
            if (isInitialCall) {
              // En el primer chequeo al cargar la app, marcamos como notificado
              // para evitar mostrar la alerta al usuario inmediatamente tras el arranque.
              lastNotified[key] = nowTime;
              continue;
            }

            const lastTime = lastNotified[key] || 0;
            // Solo volver a notificar si pasaron al menos 5 minutos
            if (nowTime - lastTime >= 5 * 60 * 1000) {
              lastNotified[key] = nowTime;
              const mins = Math.round(diffMin);
              const lotteryName = lottery.name || lottery.id;

              // Alerta dentro de la app
              Alert.alert(
                '⏰ Sorteo Próximo',
                `${lotteryName} tiene sorteo en ${mins} minuto${mins !== 1 ? 's' : ''} (${hourStr}).\n\nRecuerde anunciar el número ganador.`,
                [{ text: 'Entendido' }]
              );

              // Notificación nativa
              try {
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: `⏰ Sorteo en ${mins} min — ${lotteryName}`,
                    body: `El sorteo de ${lotteryName} (${hourStr}) es en ${mins} minuto${mins !== 1 ? 's' : ''}. ¡No olvide anunciar el ganador!`,
                    sound: true,
                  },
                  trigger: null,
                });
              } catch (_) {}
            }
          }
        }
      }
    };

    // Registrar sorteos actuales en el arranque sin levantar alertas
    checkUpcomingDraws(true);

    const intervalId = setInterval(() => checkUpcomingDraws(false), 60000); // Revisar cada minuto
    return () => clearInterval(intervalId);
  }, [user, lotteries]);

  // Polling de notificaciones para vendedores (resultados anunciados y ganadores)
  React.useEffect(() => {
    let intervalId = null;
    // Guardamos el timestamp de inicio del polling: solo notificamos eventos POSTERIORES
    let sessionStart = null;

    const checkSellersNotifications = async () => {
      try {
        // 1. Resultados anunciados después del inicio de sesión
        const resData = await api.get('/results');
        const results = resData.results || [];

        if (sessionStart === null) {
          // Primera corrida: establecer el timestamp de inicio con el resultado más reciente
          sessionStart = results.length > 0
            ? new Date(results[0].announcedAt || results[0].announced_at || 0).getTime()
            : Date.now();
          // También inicializamos la referencia de ganadores
        } else if (results.length > 0) {
          const newResults = results.filter(r => {
            const ts = new Date(r.announcedAt || r.announced_at || 0).getTime();
            return ts > sessionStart;
          });

          for (const r of newResults) {
            const formatFecheaDate = (val) => {
              if (!val) return '';
              const parts = val.split('/');
              if (parts.length === 2) {
                const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                const mIdx = parseInt(parts[1], 10) - 1;
                return `${parts[0]} de ${months[mIdx] || parts[1]}`;
              }
              return val;
            };
            const displayNum = r.lotteryId === 'fechea' ? formatFecheaDate(r.numeroGanador) : `#${r.numeroGanador}`;
            const lotteryName = r.lotteryName || r.lotteryId;
            let displayDrawDate = r.fechaSorteo;
            const dateParts = (r.fechaSorteo || '').split('-');
            if (dateParts.length === 3) displayDrawDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

            const ampmFormat = (hourStr) => {
              if (!hourStr) return '';
              let str = String(hourStr).trim().toLowerCase().replace(/(hrs|horas|hr|h)/g, '').trim();
              let h = 0, m = 0;
              if (str.includes(':')) { const p = str.split(':'); h = Number(p[0]); m = Number(p[1]); }
              else { h = Number(str); }
              if (isNaN(h) || isNaN(m)) return hourStr;
              const ampm = h >= 12 ? 'PM' : 'AM';
              return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
            };

            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: '📢 Nuevo Resultado Anunciado',
                  body: `${lotteryName} · Número ${displayNum}\nSorteo: ${displayDrawDate} (${ampmFormat(r.horaSorteo)})`,
                  sound: true,
                },
                trigger: null,
              });
            } catch (_) {}

            // Actualizar sessionStart al resultado más reciente notificado
            const ts = new Date(r.announcedAt || r.announced_at || 0).getTime();
            if (ts > sessionStart) sessionStart = ts;
          }
        }

        // 2. Boletos ganadores del vendedor
        const winnersData = await api.get('/results?check=1');
        const winners = winnersData.winners || [];

        const seenKey = `seen_winners_v2_${user?.id}`;
        const seenWinnerIds = (await storage.get(seenKey)) || [];

        const newWinners = winners.filter(w => !seenWinnerIds.includes(`${w.resultId}-${w.lineId}`));
        if (newWinners.length > 0) {
          // En la primera corrida (seenWinnerIds vacío), solo registramos sin notificar
          if (seenWinnerIds.length === 0) {
            await storage.set(seenKey, winners.map(w => `${w.resultId}-${w.lineId}`));
          } else {
            for (const w of newWinners) {
              const displayNum = w.lotteryId === 'fechea' ? w.numeroGanador : `#${w.numeroGanador || w.numero}`;
              try {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: '🏆 ¡Tienes un Boleto Ganador!',
                    body: `${w.lotteryName || w.lotteryId} · Número ${displayNum}\nCliente: ${w.comprador || 'Sin nombre'} · Premio: NIO ${parseFloat(w.prize).toFixed(2)}`,
                    sound: true,
                  },
                  trigger: null,
                });
              } catch (_) {}
            }
            const updatedSeen = [...seenWinnerIds, ...newWinners.map(w => `${w.resultId}-${w.lineId}`)];
            await storage.set(seenKey, updatedSeen);
          }
        }

      } catch (err) {
        console.warn('Error checking seller notifications:', err.message);
      }
    };

    if (user && user.role === 'vendedor') {
      const requestPerms = async () => {
        try {
          const { status } = await Notifications.getPermissionsAsync();
          if (status !== 'granted') {
            await Notifications.requestPermissionsAsync();
          }
        } catch (_) {
          // En Expo Go SDK 53+ los permisos push remotos no están disponibles.
        }
        checkSellersNotifications();
      };
      requestPerms();
      intervalId = setInterval(checkSellersNotifications, 12000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  // ─── Polling de pagos de salario pendientes para el vendedor ────────────────
  React.useEffect(() => {
    let intervalId = null;
    let isChecking = false;

    const checkPendingPayments = async () => {
      if (isChecking) return;
      isChecking = true;

      try {
        const res = await api.get('/users?pending_pay=1');
        if (res && res.pendingPayments && res.pendingPayments.length > 0) {
          const p = res.pendingPayments[0];

          // Evitar mostrar si el usuario ya saltó este pago en esta sesión
          if (skippedPaymentIds.includes(p.id)) {
            isChecking = false;
            return;
          }

          // Formateadores locales simples
          const currency = (settings && settings.currency) ? settings.currency + ' ' : 'NIO ';
          const formatNIO = (val) => {
            const num = Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return `${currency}${num}`;
          };
          const formatDrawDate = (dateStr) => {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return dateStr;
          };

          const formattedDate = new Date(p.paid_at).toLocaleString('es-NI');
          const message = `• Solicitado por: ${p.created_by_name}\n• Período: ${formatDrawDate(p.start_date)} al ${formatDrawDate(p.end_date)}\n• Ventas Totales: ${formatNIO(p.total_sold)}\n• Premios Pagados: ${formatNIO(p.prizes_total)}\n• Comisión Generada: ${formatNIO(p.commission_amount)}\n• Neto a Pagar: ${formatNIO(p.net_salary)}\n• Generado el: ${formattedDate}\n\n¿Confirmas que has recibido el dinero de este pago de salario?`;

          Alert.alert(
            'Confirmación de Pago',
            message,
            [
              {
                text: 'Preguntar luego',
                style: 'cancel',
                onPress: () => {
                  setSkippedPaymentIds(prev => [...prev, p.id]);
                }
              },
              {
                text: 'Rechazar (No recibido)',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await api.post('/users?confirm_pay=1', { paymentId: p.id, reject: true });
                    Alert.alert('Rechazado', 'El pago ha sido marcado como rechazado.');
                  } catch (err) {
                    Alert.alert('Error', err.message || 'No se pudo rechazar el pago.');
                  }
                }
              },
              {
                text: 'Sí, Confirmar Recibido',
                onPress: async () => {
                  try {
                    await api.post('/users?confirm_pay=1', { paymentId: p.id });
                    Alert.alert('Confirmado', 'El pago ha sido marcado como recibido.');
                  } catch (err) {
                    Alert.alert('Error', err.message || 'No se pudo confirmar el pago.');
                  }
                }
              }
            ],
            { cancelable: false }
          );
        } else {
          // Si no hay pagos pendientes y la alerta activa es la de confirmación de pago, la cerramos
          setAlertConfig(prev => {
            if (prev.visible && prev.title === 'Confirmación de Pago') {
              return { ...prev, visible: false };
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Error checking pending payments:', err.message);
      } finally {
        isChecking = false;
      }
    };

    if (user && user.role === 'vendedor') {
      checkPendingPayments();
      intervalId = setInterval(checkPendingPayments, 15000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, settings, skippedPaymentIds]);


  // Pantalla de carga inicial (restaurando token seguro)
  if (authLoading) {
    return (
      <View style={[styles.splashContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0C14" />
        <View style={{ alignItems: 'center', justifyContent: 'center', width: 200, height: 200 }}>
          <View style={{
            position: 'absolute', width: 180, height: 180, borderRadius: 90,
            backgroundColor: 'rgba(59,130,246,0.12)',
          }} />
          <Image
            source={require('./assets/app_logo.png')}
            style={{ width: 170, height: 170 }}
            resizeMode="contain"
          />
        </View>
      </View>
    );
  }

  // Si no está autenticado, renderiza pantalla de Login
  if (!user) {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor="#111827" />
        <LoginScreen />
        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          confirmText={alertConfig.confirmText}
          cancelText={alertConfig.cancelText}
          onConfirm={alertConfig.onConfirm}
          onCancel={alertConfig.onCancel}
          onClose={() => setAlertConfig(a => ({ ...a, visible: false }))}
        />
      </View>
    );
  }

  // Si la aplicación está desactivada y el usuario NO es root, renderiza pantalla de bloqueo completo
  if (settings && settings.isBlocked && user.role !== 'root') {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0C14" />
        <AppBlockedScreen onLogout={logout} />
        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          confirmText={alertConfig.confirmText}
          cancelText={alertConfig.cancelText}
          onConfirm={alertConfig.onConfirm}
          onCancel={alertConfig.onCancel}
          onClose={() => setAlertConfig(a => ({ ...a, visible: false }))}
        />
      </View>
    );
  }

  // Enrutamiento de pantallas simple y eficiente
  const renderScreen = () => {
    // Si es root, siempre renderizar root_panel directamente
    if (user && user.role === 'root') {
      return <RootPanelScreen onLogout={logout} />;
    }

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

  const isAdmin = user && (user.role === 'admin' || user.role === 'root');
  const showBottomNav = user && user.role !== 'root' && !(settings && settings.isBlocked);

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#111827" />
      <View style={styles.mainContainer}>
        {offlineQueue && offlineQueue.length > 0 && (
          <View style={{
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(245, 158, 11, 0.25)',
            paddingVertical: 8,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Text style={{ fontSize: 11, color: '#fbbf24', fontWeight: '700', flex: 1 }}>
              ⚠️ Tienes {offlineQueue.length} boletos pendientes de sincronización.
            </Text>
            <TouchableOpacity 
              onPress={() => setShowQueueModal(true)}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderWidth: 1,
                borderColor: 'rgba(245, 158, 11, 0.3)',
                borderRadius: 6,
                backgroundColor: 'rgba(245, 158, 11, 0.05)',
              }}
            >
              <Text style={{ fontSize: 10, color: '#fbbf24', fontWeight: '800' }}>Gestionar</Text>
            </TouchableOpacity>
          </View>
        )}
        {renderScreen()}
      </View>

      {showBottomNav && (
        <View style={[styles.tabBar, {
          height: 52 + Math.max(insets.bottom, 6),
          paddingBottom: Math.max(insets.bottom, 4)
        }]}>
          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => setCurrentScreen('dashboard')}
            activeOpacity={0.7}
          >
            <Home size={18} color={currentScreen === 'dashboard' ? '#a78bfa' : COLORS.textSecondary} />
            <Text style={[styles.tabLabel, currentScreen === 'dashboard' && styles.tabLabelActive]}>Inicio</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => setCurrentScreen('sell')}
            activeOpacity={0.7}
          >
            <Ticket size={18} color={currentScreen === 'sell' ? '#a78bfa' : COLORS.textSecondary} />
            <Text style={[styles.tabLabel, currentScreen === 'sell' && styles.tabLabelActive]}>Vender</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => setCurrentScreen('history')}
            activeOpacity={0.7}
          >
            <History size={18} color={currentScreen === 'history' ? '#a78bfa' : COLORS.textSecondary} />
            <Text style={[styles.tabLabel, currentScreen === 'history' && styles.tabLabelActive]}>Historial</Text>
          </TouchableOpacity>

          {isAdmin && (
            <TouchableOpacity
              style={styles.tabBtn}
              onPress={() => setCurrentScreen('admin')}
              activeOpacity={0.7}
            >
              <ShieldAlert size={18} color={currentScreen === 'admin' ? '#a78bfa' : COLORS.textSecondary} />
              <Text style={[styles.tabLabel, currentScreen === 'admin' && styles.tabLabelActive]}>Admin</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => setCurrentScreen('settings')}
            activeOpacity={0.7}
          >
            <Settings size={18} color={currentScreen === 'settings' ? '#a78bfa' : COLORS.textSecondary} />
            <Text style={[styles.tabLabel, currentScreen === 'settings' && styles.tabLabelActive]}>Ajustes</Text>
          </TouchableOpacity>
        </View>
      )}

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
        extraText={alertConfig.extraText}
        onExtra={alertConfig.onExtra}
        extraVariant={alertConfig.extraVariant}
        onClose={() => setAlertConfig(a => ({ ...a, visible: false }))}
      />
      <OfflineSalesQueueModal isOpen={showQueueModal} onClose={() => setShowQueueModal(false)} />
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </AuthProvider>
    </SafeAreaProvider>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  tabLabelActive: {
    color: '#a78bfa',
    fontWeight: '800',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#0B0C14',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  splashLogoContainer: {
    alignItems: 'center',
    marginTop: '25%',
  },
  splashLogo: {
    width: 130,
    height: 130,
    borderRadius: 28,
    marginBottom: 20,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  splashSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  splashLoadingSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLoadingText: {
    marginTop: 14,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  splashFooter: {
    marginBottom: 10,
  },
  splashVersionText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
