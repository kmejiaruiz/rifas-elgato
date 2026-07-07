// ============================================================
// App.js — Punto de Entrada de la Aplicación Móvil Expo
// Maneja el enrutamiento de pantallas y los proveedores de contexto
// ============================================================
import React, { useState } from 'react';
import { StatusBar, StyleSheet, View, ActivityIndicator, Text, Platform, TouchableOpacity, Alert, Image, Modal, ScrollView, LogBox, Animated } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppProvider, useApp } from './src/context/AppContext';
import { COLORS, getThemeColors } from './src/styles/theme';
import { Home, Ticket, History, Settings, ShieldAlert, Trophy, User, LogOut, Key, Sun, Moon, Camera, Info, X, RefreshCw } from 'lucide-react-native';
import { CustomAlert } from './src/components/CustomAlert';
import { api } from './src/services/apiService';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import * as Updates from 'expo-updates';
import { storage } from './src/services/storageService';
import { FormInput } from './src/components/FormInput';

// Ignorar advertencias sobre limitaciones de expo-notifications en Expo Go
LogBox.ignoreLogs([
  'expo-notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
  'Android Push notifications (remote notifications) functionality provided by expo-notifications was removed'
]);

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
  const { user, loading: authLoading, logout, updateUser } = useAuth();
  const { loadAllData, settings, lotteries, offlineQueue, isDarkMode, toggleTheme, isServerConnected } = useApp();
  const activeColors = getThemeColors(isDarkMode);
  const insets = useSafeAreaInsets();
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // 'dashboard' | 'sell' | 'history' | 'settings' | 'admin'
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [skippedPaymentIds, setSkippedPaymentIds] = useState([]);
  const [winnerAlert, setWinnerAlert] = useState(null);

  const [fadeAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    fadeAnim.setValue(0.3);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [currentScreen]);

  // --- Sidebar state ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarAnim] = useState(new Animated.Value(0)); // 0 = cerrado, 1 = abierto

  const toggleSidebar = (open) => {
    if (open) {
      setIsSidebarOpen(true);
      Animated.timing(sidebarAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setIsSidebarOpen(false));
    }
  };

  // --- Foto de perfil ---
  const [profileImage, setProfileImage] = useState(null);

  React.useEffect(() => {
    if (user) {
      const loadAvatar = async () => {
        try {
          const cachedImg = await storage.get(`user_avatar_${user.id}`);
          if (cachedImg) {
            setProfileImage(cachedImg);
          } else {
            setProfileImage(null);
          }
        } catch (_) {}
      };
      loadAvatar();
    }
  }, [user]);

  // --- Control de Actualizaciones OTA (expo-updates) ---
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const checkUpdatesBackground = async () => {
    if (__DEV__) return;
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        const fetchResult = await Updates.fetchUpdateAsync();
        if (fetchResult.isNew) {
          Alert.alert(
            "Actualización Lista 🚀",
            "Se ha descargado una nueva versión de la aplicación. ¿Deseas reiniciar la aplicación ahora para aplicar los cambios?",
            [
              { text: "Más tarde", style: "cancel" },
              { 
                text: "Reiniciar Ahora", 
                onPress: async () => {
                  await Updates.reloadAsync();
                } 
              }
            ]
          );
        }
      }
    } catch (err) {
      console.log("Error buscando actualización automática:", err);
    }
  };

  React.useEffect(() => {
    checkUpdatesBackground();
  }, []);

  const checkUpdatesManual = async () => {
    setIsCheckingUpdate(true);
    try {
      if (__DEV__) {
        Alert.alert("Modo Desarrollo", "Las actualizaciones OTA no están activas en el entorno de desarrollo local.");
        setIsCheckingUpdate(false);
        return;
      }
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        const fetchResult = await Updates.fetchUpdateAsync();
        if (fetchResult.isNew) {
          Alert.alert(
            "Actualización Lista 🚀",
            "Se ha descargado e instalado la nueva versión de Zentric. ¿Reiniciar la aplicación ahora?",
            [
              { text: "Más tarde", style: "cancel" },
              { 
                text: "Reiniciar Ahora", 
                onPress: async () => {
                  await Updates.reloadAsync();
                } 
              }
            ]
          );
        } else {
          Alert.alert("Actualización", "La actualización fue descargada pero no es nueva.");
        }
      } else {
        Alert.alert("Actualizado ✅", "Ya cuentas con la versión más reciente de la aplicación.");
      }
    } catch (err) {
      Alert.alert("Error de Conexión", "No se pudo conectar al servidor de actualizaciones. Por favor verifica tu conexión a internet.");
      console.log("Error buscando actualización manual:", err);
    } finally {
      setIsCheckingUpdate(false);
    }
  };


  const pickProfileImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permiso Requerido', 'Necesitamos acceso a tu galería para cambiar tu foto de perfil.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setProfileImage(uri);
        await storage.set(`user_avatar_${user.id}`, uri);
        Alert.alert('Éxito', 'Foto de perfil actualizada correctamente.');
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen: ' + err.message);
    }
  };

  // --- Modal editar perfil (contraseña) ---
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const handleUpdatePassword = async () => {
    if (!newPassword) {
      Alert.alert('Campo requerido', 'Por favor ingrese la nueva contraseña.');
      return;
    }
    if (newPassword.length < 4) {
      Alert.alert('Contraseña débil', 'La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateUser(user.id, { password: newPassword });
      Alert.alert('Éxito', 'Contraseña actualizada correctamente.');
      setNewPassword('');
      setConfirmPassword('');
      setShowEditProfileModal(false);
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setSavingProfile(false);
    }
  };

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
          // Trigger in-app Winner Modal
          setWinnerAlert(newWinners);

          // Solo enviar notificaciones push locales si ya existía una lista guardada (evita spam de notificaciones al abrir la app)
          if (seenWinnerIds.length > 0) {
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
          }
          const updatedSeen = [...seenWinnerIds, ...newWinners.map(w => `${w.resultId}-${w.lineId}`)];
          await storage.set(seenKey, updatedSeen);
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
        return (
          <DashboardScreen 
            onNavigate={setCurrentScreen} 
            onOpenSidebar={() => toggleSidebar(true)}
            profileImage={profileImage}
          />
        );
    }
  };

  const isAdmin = user && (user.role === 'admin' || user.role === 'root');
  const showBottomNav = user && user.role !== 'root' && !(settings && settings.isBlocked);

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, backgroundColor: activeColors.bgBase }]}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={isDarkMode ? '#111827' : '#ffffff'} 
      />
      <View style={[styles.mainContainer, { backgroundColor: activeColors.bgBase }]}>
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
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {renderScreen()}
        </Animated.View>
      </View>

      {showBottomNav && (
        <View style={[styles.tabBar, {
          height: 52 + Math.max(insets.bottom, 6),
          paddingBottom: Math.max(insets.bottom, 4),
          backgroundColor: isDarkMode ? '#111827' : '#ffffff',
          borderTopColor: activeColors.border,
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

      {/* Modal de Ganador(es) para Vendedor */}
      <Modal visible={!!winnerAlert} transparent animationType="slide" onRequestClose={() => setWinnerAlert(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.winnerCard}>
            <View style={styles.trophyWrapper}>
              <Trophy size={44} color="#fbbf24" />
            </View>
            <Text style={styles.winnerTitle}>¡Boleto Ganador!</Text>
            <Text style={styles.winnerSubtitle}>Felicidades, has vendido un boleto premiado:</Text>
            
            <ScrollView style={{ maxHeight: 220, width: '100%', marginVertical: 12 }} contentContainerStyle={{ paddingBottom: 8 }}>
              {winnerAlert && winnerAlert.map((w, idx) => {
                const displayNum = w.lotteryId === 'fechea' ? w.numeroGanador : `#${w.numeroGanador || w.numero}`;
                return (
                  <View key={idx} style={styles.winnerItem}>
                    <Text style={styles.winnerLottery}>{w.lotteryName || w.lotteryId}</Text>
                    <Text style={styles.winnerDetails}>Número: <Text style={{ fontWeight: '800', color: '#fff' }}>{displayNum}</Text></Text>
                    {w.comprador ? <Text style={styles.winnerDetails}>Cliente: {w.comprador}</Text> : null}
                    <Text style={styles.winnerPrize}>Premio: NIO {parseFloat(w.prize || 0).toFixed(2)}</Text>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity 
              style={styles.winnerCloseBtn} 
              onPress={() => setWinnerAlert(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.winnerCloseBtnText}>¡Entendido!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

      {/* --- Menú Lateral (Sidebar Drawer) --- */}
      {isSidebarOpen && (
        <TouchableOpacity
          activeOpacity={1}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.45)', zIndex: 9999 }]}
          onPress={() => toggleSidebar(false)}
        >
          <Animated.View
            style={[
              styles.sidebarDrawer,
              {
                backgroundColor: activeColors.bgElevated,
                borderRightColor: activeColors.border,
                transform: [
                  {
                    translateX: sidebarAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-280, 0],
                    }),
                  },
                ],
              },
            ]}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {/* Header / Foto / Info de Usuario */}
            <View style={[styles.sidebarHeader, { borderBottomColor: activeColors.border }]}>
              <View style={styles.avatarContainer}>
                <TouchableOpacity onPress={pickProfileImage} activeOpacity={0.8} style={styles.avatarWrapper}>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: activeColors.primary }]}>
                      <User size={32} color="#fff" />
                    </View>
                  )}
                  <View style={[styles.cameraBadge, { backgroundColor: activeColors.primary }]}>
                    <Camera size={10} color="#fff" />
                  </View>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sidebarName, { color: activeColors.textPrimary }]} numberOfLines={1}>
                {user?.name || 'Usuario'}
              </Text>
              <Text style={[styles.sidebarSubtitle, { color: activeColors.textMuted }]} numberOfLines={1}>
                @{user?.username || 'vendedor'} · {user?.role === 'admin' ? 'Administrador' : user?.role === 'root' ? 'Root' : 'Vendedor'}
              </Text>
            </View>

            {/* Opciones del menú */}
            <ScrollView style={styles.sidebarMenu} contentContainerStyle={{ paddingVertical: 12 }}>
              <TouchableOpacity
                style={[styles.sidebarItem, { borderBottomColor: activeColors.border }]}
                onPress={() => {
                  toggleSidebar(false);
                  setShowEditProfileModal(true);
                }}
                activeOpacity={0.7}
              >
                <Key size={18} color={activeColors.primaryLight} style={styles.sidebarIcon} />
                <Text style={[styles.sidebarText, { color: activeColors.textPrimary }]}>Editar Contraseña</Text>
              </TouchableOpacity>

              <View style={[styles.sidebarItem, { borderBottomColor: activeColors.border, justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {isDarkMode ? (
                    <Moon size={18} color="#fbbf24" style={styles.sidebarIcon} />
                  ) : (
                    <Sun size={18} color="#f59e0b" style={styles.sidebarIcon} />
                  )}
                  <Text style={[styles.sidebarText, { color: activeColors.textPrimary }]}>Modo Oscuro</Text>
                </View>
                <TouchableOpacity
                  onPress={toggleTheme}
                  activeOpacity={0.8}
                  style={[
                    styles.themeSwitchTrack,
                    {
                      backgroundColor: isDarkMode ? activeColors.primary : '#d1d5db',
                      alignItems: isDarkMode ? 'flex-end' : 'flex-start',
                    },
                  ]}
                >
                  <View style={styles.themeSwitchThumb} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.sidebarItem, { borderBottomColor: activeColors.border }]}
                onPress={checkUpdatesManual}
                disabled={isCheckingUpdate}
                activeOpacity={0.7}
              >
                {isCheckingUpdate ? (
                  <ActivityIndicator size="small" color={activeColors.primaryLight} style={styles.sidebarIcon} />
                ) : (
                  <RefreshCw size={18} color={activeColors.primaryLight} style={styles.sidebarIcon} />
                )}
                <Text style={[styles.sidebarText, { color: activeColors.textPrimary }]}>
                  {isCheckingUpdate ? 'Buscando actualizaciones...' : 'Buscar Actualizaciones'}
                </Text>
              </TouchableOpacity>

              {/* Info de la App */}
              <View style={[styles.sidebarItemInfo, { borderBottomColor: activeColors.border }]}>
                <Info size={16} color={activeColors.textSecondary} style={{ marginRight: 8, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoTitle, { color: activeColors.textSecondary }]}>Información</Text>
                  <Text style={[styles.infoDesc, { color: activeColors.textMuted }]}>
                    Servidor: {settings.businessName || 'Zentric'}
                  </Text>
                  <Text style={[styles.infoDesc, { color: activeColors.textMuted }]}>
                    Red: {isServerConnected ? 'Conectado (Servidor)' : 'Modo Offline (Local)'}
                  </Text>
                  {offlineQueue.length > 0 && (
                    <Text style={[styles.infoDesc, { color: '#fbbf24', fontWeight: '700' }]}>
                      Pendientes: {offlineQueue.length} boletos
                    </Text>
                  )}
                </View>
              </View>

              {/* Botón cerrar sesión */}
              <TouchableOpacity
                style={[styles.sidebarItem, { borderBottomColor: activeColors.border, marginTop: 16 }]}
                onPress={() => {
                  toggleSidebar(false);
                  logout();
                }}
                activeOpacity={0.7}
              >
                <LogOut size={18} color={COLORS.dangerLight} style={styles.sidebarIcon} />
                <Text style={[styles.sidebarText, { color: COLORS.dangerLight }]}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Versión de la app al fondo */}
            <View style={[styles.sidebarFooter, { borderTopColor: activeColors.border }]}>
              <Text style={[styles.sidebarVersionText, { color: activeColors.textMuted }]}>
                ZENTRIC MOBILE
              </Text>
              <Text style={{ fontSize: 9, color: activeColors.textMuted, marginTop: 2 }}>
                Versión 1.14[beta]
              </Text>
            </View>
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* --- Modal Editar Perfil --- */}
      <Modal
        visible={showEditProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: activeColors.bgElevated, borderColor: activeColors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, width: '100%' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: activeColors.textPrimary }}>
                Editar Perfil
              </Text>
              <TouchableOpacity onPress={() => setShowEditProfileModal(false)} style={{ padding: 4 }}>
                <X size={18} color={activeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Read-Only Username */}
            <View style={styles.disabledInputWrapper}>
              <Text style={[styles.disabledInputLabel, { color: activeColors.textMuted }]}>Usuario</Text>
              <View style={[styles.disabledInputBox, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }]}>
                <Text style={{ color: activeColors.textMuted, fontSize: 13 }}>@{user?.username}</Text>
              </View>
            </View>

            {/* Read-Only Name */}
            <View style={styles.disabledInputWrapper}>
              <Text style={[styles.disabledInputLabel, { color: activeColors.textMuted }]}>Nombre completo</Text>
              <View style={[styles.disabledInputBox, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }]}>
                <Text style={{ color: activeColors.textMuted, fontSize: 13 }}>{user?.name}</Text>
              </View>
              <Text style={{ fontSize: 9, color: activeColors.textMuted, marginTop: 4 }}>
                * El nombre y usuario no se pueden editar por el vendedor.
              </Text>
            </View>

            {/* Campos de contraseña */}
            <View style={{ width: '100%', marginTop: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: activeColors.textSecondary, marginBottom: 6 }}>
                Nueva Contraseña
              </Text>
              <FormInput
                placeholder="Mínimo 4 caracteres"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                style={{ marginBottom: 12 }}
              />

              <Text style={{ fontSize: 11, fontWeight: '700', color: activeColors.textSecondary, marginBottom: 6 }}>
                Confirmar Contraseña
              </Text>
              <FormInput
                placeholder="Repita la contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                style={{ marginBottom: 16 }}
              />
            </View>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: activeColors.primary }]}
              onPress={handleUpdatePassword}
              disabled={savingProfile}
              activeOpacity={0.8}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Guardar Cambios</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  // Winner Alert Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 21, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  winnerCard: {
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: '#fbbf24',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  trophyWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  winnerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fbbf24',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  winnerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  winnerItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    width: '100%',
  },
  winnerLottery: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryLight,
    marginBottom: 2,
  },
  winnerDetails: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  winnerPrize: {
    fontSize: 12,
    fontWeight: '800',
    color: '#34d399',
    marginTop: 4,
  },
  winnerCloseBtn: {
    backgroundColor: '#fbbf24',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 99,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  winnerCloseBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Sidebar styles
  sidebarDrawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    borderRightWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 16,
  },
  sidebarHeader: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatarWrapper: {
    position: 'relative',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 2,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarName: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 2,
  },
  sidebarSubtitle: {
    fontSize: 11,
    textAlign: 'center',
  },
  sidebarMenu: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sidebarIcon: {
    marginRight: 12,
  },
  sidebarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  themeSwitchTrack: {
    width: 38,
    height: 20,
    borderRadius: 10,
    padding: 2,
    justifyContent: 'center',
  },
  themeSwitchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sidebarItemInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  infoTitle: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 1,
  },
  sidebarFooter: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  sidebarVersionText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  // Modal Edit Profile
  modalCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    elevation: 10,
  },
  disabledInputWrapper: {
    width: '100%',
    marginBottom: 10,
  },
  disabledInputLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  disabledInputBox: {
    width: '100%',
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.15)',
  },
  modalSubmitBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 99,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  modalSubmitBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
});
