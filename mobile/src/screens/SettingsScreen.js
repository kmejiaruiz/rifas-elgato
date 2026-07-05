// ============================================================
// SettingsScreen — Ajustes Comerciales para Móvil
// Incluye configuración del servidor y visualización de datos sinc.
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, ActivityIndicator, Alert, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { storage } from '../services/storageService';
import { ChevronLeft, Save, Server, RefreshCw, CheckCircle, Wifi, Clock, Lock, Printer, Bluetooth, BluetoothOff } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS, getThemeColors } from '../styles/theme';
import { GlassCard } from '../components/GlassCard';
import { FormInput } from '../components/FormInput';
import { CustomButton } from '../components/CustomButton';
import { getApiUrl, setApiUrl } from '../services/apiService';
import { api } from '../services/apiService';
import { HeaderClock } from '../components/HeaderClock';
import { CustomAlert } from '../components/CustomAlert';

export const SettingsScreen = ({ onNavigate }) => {
  const { user } = useAuth();
  const {
    settings, updateSettings, lotteries, loadAllData,
    printerDevice, printerConnected, printerConnecting,
    connectPrinter, disconnectPrinter, printTestPage, isDarkMode
  } = useApp();
  const activeColors = getThemeColors(isDarkMode);

  const isRoot = user?.role === 'root';
  const isAdmin = user?.role === 'admin' || user?.role === 'root';

  const [businessName, setBusinessName]         = useState(settings.businessName || '');
  const [currency, setCurrency]                 = useState(settings.currency || '');
  const [autoprint, setAutoprint]               = useState(settings.autoprint ?? true);
  const [drawCloseMinutes, setDrawCloseMinutes] = useState(String(settings.drawCloseMinutes || '10'));
  const [carouselImages, setCarouselImages]     = useState(() => {
    try {
      return JSON.parse(settings.carousel_images || '[]');
    } catch {
      return [];
    }
  });
  const [loading, setLoading]                   = useState(false);
  const [localPreviewUri, setLocalPreviewUri]   = useState(null);
  const [uploadingImage, setUploadingImage]     = useState(false);

  // Utilidad para parsear URL
  const parseApiUrlString = (urlStr) => {
    let protocol = 'https://';
    let host = '';
    let port = '';
    let path = '/api';

    if (urlStr) {
      let temp = urlStr.trim();
      if (temp.startsWith('http://')) {
        protocol = 'http://';
        temp = temp.replace('http://', '');
      } else if (temp.startsWith('https://')) {
        protocol = 'https://';
        temp = temp.replace('https://', '');
      }

      const slashIndex = temp.indexOf('/');
      let hostPort = temp;
      if (slashIndex !== -1) {
        hostPort = temp.substring(0, slashIndex);
        path = temp.substring(slashIndex);
      } else {
        path = '';
      }

      if (hostPort.includes(':')) {
        const parts = hostPort.split(':');
        host = parts[0];
        port = parts[1];
      } else {
        host = hostPort;
      }
    }

    return { protocol, host, port, path };
  };

  const parsed = parseApiUrlString(getApiUrl());
  const [apiProtocol, setApiProtocol] = useState(parsed.protocol);
  const [apiHost, setApiHost] = useState(parsed.host);
  const [apiPort, setApiPort] = useState(parsed.port);
  const [apiPath, setApiPath] = useState(parsed.path || '/api');

  const [apiSaving, setApiSaving]  = useState(false);
  const [apiStatus, setApiStatus]  = useState(null); // null | 'ok' | 'error'
  const [apiChecking, setApiChecking] = useState(false);

  const getBuiltApiUrl = () => {
    const host = apiHost.trim();
    const port = apiPort.trim();
    const path = apiPath.trim();

    if (!host) return '';

    let url = `${apiProtocol}${host}`;
    if (port) {
      url += `:${port}`;
    }
    if (path) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      url += cleanPath;
    }
    return url;
  };

  // Alertas personalizadas
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'Aceptar',
    cancelText: null,
    onConfirm: null,
    progress: null,
    progressText: '',
  });

  const buildImageUrl = React.useCallback((url) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    try {
      const apiBase = getApiUrl();
      const match = apiBase.match(/^(https?:\/\/[^\/]+)/);
      const host = match ? match[1] : '';
      return host + url;
    } catch { return url; }
  }, []);


  // Cargar campos inicialmente al montar la pantalla
  useEffect(() => {
    setBusinessName(settings.businessName || '');
    setCurrency(settings.currency || '');
    setAutoprint(settings.autoprint ?? true);
    setDrawCloseMinutes(String(settings.drawCloseMinutes || '10'));
    try {
      setCarouselImages(JSON.parse(settings.carousel_images || '[]'));
    } catch {
      setCarouselImages([]);
    }
  }, []);

  // ─── Guardar ajustes comerciales ──────────────────────────
  const handleSave = async () => {
    setLoading(true);
    try {
      await updateSettings({
        businessName,
        currency,
        autoprint,
        drawCloseMinutes: Number(drawCloseMinutes),
        carousel_images: JSON.stringify(carouselImages),
      });
      Alert.alert('Ajustes Guardados', 'Los parámetros comerciales se actualizaron en el servidor.');
    } catch {
      // Alertado en AppContext
    } finally {
      setLoading(false);
    }
  };

  const handleSelectImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permiso requerido", "Se requiere acceso a la galería para subir fotos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [21, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setLocalPreviewUri(result.assets[0].uri);
    }
  };

  const confirmUploadImage = async () => {
    if (!localPreviewUri) return;
    setUploadingImage(true);
    
    try {
      const formData = new FormData();
      const uri = localPreviewUri;
      const uriParts = uri.split('/');
      const fileName = uriParts[uriParts.length - 1];
      
      formData.append('image', {
        uri: uri,
        name: fileName,
        type: 'image/jpeg',
      });

      const token = await storage.getSecure('rifas_token');
      const headers = {
        'Content-Type': 'multipart/form-data',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Auth-Token'] = token;
      }

      const base = getApiUrl();
      const url = `${base}/upload.php`;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al subir la imagen.');
      }

      const newImages = [...carouselImages, data.url];
      setCarouselImages(newImages);
      setLocalPreviewUri(null);
      Alert.alert('Éxito', 'Imagen seleccionada. Recuerde presionar "Guardar Ajustes" al final.');
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  };

  const cancelLocalPreview = () => {
    setLocalPreviewUri(null);
  };

  const handleDeleteImage = (indexToDelete) => {
    const newImages = carouselImages.filter((_, idx) => idx !== indexToDelete);
    setCarouselImages(newImages);
  };

  // ─── Guardar URL del servidor ──────────────────────────────
  const handleSaveApiUrl = async () => {
    const fullUrl = getBuiltApiUrl();
    if (!fullUrl) {
      Alert.alert('Servidor requerido', 'Ingrese la IP o dominio del servidor.');
      return;
    }
    setApiSaving(true);
    try {
      await setApiUrl(fullUrl);
      Alert.alert(
        'Servidor Actualizado',
        `URL guardada: ${getApiUrl()}\n\nSe sincronizarán los datos automáticamente.`,
        [
          {
            text: 'OK',
            onPress: () => {
              loadAllData();
            }
          }
        ]
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setApiSaving(false);
    }
  };

  // ─── Verificar conexión con el servidor ───────────────────
  const handleCheckApi = async () => {
    const fullUrl = getBuiltApiUrl();
    if (!fullUrl) {
      Alert.alert('Servidor requerido', 'Ingrese la IP o dominio del servidor.');
      return;
    }
    setApiChecking(true);
    setApiStatus(null);
    try {
      await setApiUrl(fullUrl);
      await api.get('/settings.php');
      setApiStatus('ok');
    } catch {
      setApiStatus('error');
    } finally {
      setApiChecking(false);
    }
  };

  // ─── Sincronizar manualmente ──────────────────────────────
  const handleSync = async () => {
    setLoading(true);
    setAlertConfig({
      visible: true,
      title: 'Sincronizando Datos',
      message: 'Por favor espere mientras nos conectamos al servidor...',
      type: 'info',
      confirmText: 'Aceptar',
      cancelText: null,
      onConfirm: null,
      progress: 0,
      progressText: 'Iniciando conexión...',
    });

    try {
      await loadAllData((pct, stepText) => {
        setAlertConfig(prev => ({
          ...prev,
          progress: pct,
          progressText: stepText,
        }));
      });

      setAlertConfig({
        visible: true,
        title: 'Sincronización Exitosa',
        message: 'Todos los datos del negocio, loterías y ventas se han actualizado.',
        type: 'success',
        confirmText: 'Entendido',
        cancelText: null,
        onConfirm: () => setAlertConfig(a => ({ ...a, visible: false })),
        progress: null,
        progressText: '',
      });
    } catch (err) {
      setAlertConfig({
        visible: true,
        title: 'Error de Conexión',
        message: 'No se pudo sincronizar los datos. Verifique su conexión al servidor e inténtelo de nuevo.',
        type: 'error',
        confirmText: 'Aceptar',
        cancelText: null,
        onConfirm: () => setAlertConfig(a => ({ ...a, visible: false })),
        progress: null,
        progressText: '',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.bgBase }]}>
      {/* Barra superior */}
      <View style={[styles.navBar, { 
        justifyContent: 'space-between', 
        backgroundColor: isDarkMode ? '#111827' : '#ffffff', 
        borderBottomColor: activeColors.border 
      }]}>
        <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color={activeColors.textPrimary} />
          <Text style={[styles.navTitle, { color: activeColors.textPrimary }]}>Ajustes</Text>
        </TouchableOpacity>
        <HeaderClock />
      </View>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        onConfirm={alertConfig.onConfirm}
        progress={alertConfig.progress}
        progressText={alertConfig.progressText}
        onClose={() => setAlertConfig(a => ({ ...a, visible: false }))}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ─── Estado actual del servidor ─────────────────────── */}
        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Estado del Sistema</Text>

          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Negocio</Text>
              <Text style={styles.statusValue} numberOfLines={1}>{settings.businessName}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Moneda</Text>
              <Text style={[styles.statusValue, { color: COLORS.primaryLight }]}>{settings.currency}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Cierre</Text>
              <Text style={styles.statusValue}>{settings.drawCloseMinutes}min</Text>
            </View>
          </View>

          {settings.isBlocked && (
            <View style={styles.blockedNote}>
              <Lock size={12} color="#fbbf24" />
              <Text style={styles.blockedNoteText}>App bloqueada por administrador</Text>
            </View>
          )}

          <View style={styles.lotteryList}>
            <Text style={styles.statusLabel}>Juegos activos ({lotteries.filter(l => l.enabled !== false).length})</Text>
            <View style={styles.lotteryChips}>
              {lotteries.filter(l => l.enabled !== false).map(l => (
                <View key={l.id} style={styles.lotteryChip}>
                  {l.emoji ? <Text style={{ fontSize: 12 }}>{l.emoji}</Text> : null}
                  <Text style={styles.lotteryChipText}>{l.name}</Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.syncBtn} onPress={handleSync} activeOpacity={0.8}>
            <RefreshCw size={15} color={COLORS.primaryLight} />
            <Text style={styles.syncBtnText}>Sincronizar datos ahora</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* ─── URL del Servidor (Solo visible a Root) ─────────── */}
        {isRoot && (
          <GlassCard style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Server size={15} color={COLORS.primaryLight} />
              <Text style={styles.sectionTitleInline}>Servidor de API</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Dirección IP o dominio de tu servidor XAMPP/Vercel. Todos los datos se cargan desde aquí.
            </Text>

            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 }}>Protocolo</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {['http://', 'https://'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 8,
                    backgroundColor: apiProtocol === p ? COLORS.primary : 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: apiProtocol === p ? COLORS.primaryLight : 'rgba(255,255,255,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onPress={() => setApiProtocol(p)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FormInput
              label="Servidor (IP o Dominio)"
              value={apiHost}
              onChangeText={setApiHost}
              placeholder="192.168.1.103 o tu-app.vercel.app"
              autoCapitalize="none"
            />

            <FormInput
              label="Puerto (Opcional)"
              value={apiPort}
              onChangeText={setApiPort}
              placeholder="3000"
              keyboardType="numeric"
            />

            <FormInput
              label="Ruta Base (Path)"
              value={apiPath}
              onChangeText={setApiPath}
              placeholder="/api"
              autoCapitalize="none"
            />

            <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4, marginBottom: 12 }}>
              URL Generada: <Text style={{ color: COLORS.primaryLight, fontWeight: '700' }}>{getBuiltApiUrl() || 'Incompleta'}</Text>
            </Text>

            {apiStatus === 'ok' && (
              <View style={styles.apiStatusOk}>
                <CheckCircle size={13} color={COLORS.successLight} />
                <Text style={styles.apiStatusOkText}>Conexión exitosa con el servidor ✓</Text>
              </View>
            )}
            {apiStatus === 'error' && (
              <View style={styles.apiStatusError}>
                <Wifi size={13} color={COLORS.dangerLight} />
                <Text style={styles.apiStatusErrorText}>No se pudo conectar al servidor.</Text>
              </View>
            )}

            <View style={styles.apiActions}>
              <TouchableOpacity
                style={[styles.testBtn, apiChecking && { opacity: 0.6 }]}
                onPress={handleCheckApi}
                disabled={apiChecking}
                activeOpacity={0.8}
              >
                {apiChecking
                  ? <ActivityIndicator size="small" color={COLORS.primaryLight} />
                  : <View style={styles.btnInner}><Wifi size={13} color={COLORS.primaryLight} /><Text style={styles.testBtnText}>Probar</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveApiBtn, apiSaving && { opacity: 0.6 }]}
                onPress={handleSaveApiUrl}
                disabled={apiSaving}
                activeOpacity={0.8}
              >
                {apiSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <View style={styles.btnInner}><Save size={13} color="#fff" /><Text style={styles.saveApiBtnText}>Guardar y Conectar</Text></View>}
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* ─── Identidad Comercial (Sólo visible a Admin/Root) ── */}
        {isAdmin && (
          <GlassCard style={styles.card}>
            <Text style={styles.sectionTitle}>Identidad Comercial</Text>
            <Text style={styles.sectionDesc}>
              Estos valores se guardan en el servidor y son compartidos entre la app web y la app móvil.
            </Text>

            <FormInput
              label="Nombre Comercial"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Zentric"
            />

            <FormInput
              label="Símbolo de Moneda"
              value={currency}
              onChangeText={setCurrency}
              placeholder="NIO"
            />
          </GlassCard>
        )}

        {/* ─── Parámetros del Sorteo (Sólo visible a Admin/Root) ─ */}
        {isAdmin && (
          <GlassCard style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Clock size={15} color={COLORS.primaryLight} />
              <Text style={styles.sectionTitleInline}>Parámetros del Sorteo</Text>
            </View>

            <FormInput
              label="Minutos de cierre antes del sorteo"
              value={drawCloseMinutes}
              onChangeText={setDrawCloseMinutes}
              placeholder="10"
              keyboardType="numeric"
            />
            <Text style={styles.fieldHint}>
              Se bloquea la venta {drawCloseMinutes} minutos antes de la hora del sorteo.
            </Text>
          </GlassCard>
        )}

        {/* ─── Carrusel de Imágenes (Admin) ────────────────────────── */}
        {isAdmin && (
          <GlassCard style={styles.card}>
            <Text style={styles.sectionTitle}>Carrusel de Anuncios</Text>
            <Text style={styles.sectionDesc}>
              Selecciona o sube imágenes para la cartelera en la pantalla de inicio.
            </Text>
            <Text style={{ fontSize: 10.5, color: COLORS.primaryLight, fontWeight: '600', marginTop: 2, lineHeight: 14 }}>
              💡 Recomendado: Usar imágenes panorámicas de proporción 21:9 (Ej: 1200 x 500 px) para evitar recortes drásticos.
            </Text>

            {/* Vista previa en fila/envoltura */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 }}>
              {carouselImages.map((url, idx) => (
                <View key={idx} style={{ position: 'relative', width: 70, height: 70, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                  <Image source={{ uri: buildImageUrl(url) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  <TouchableOpacity 
                    onPress={() => handleDeleteImage(idx)}
                    style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 18, height: 18, borderRadius: 9,
                      backgroundColor: 'rgba(239,68,68,0.9)',
                      alignItems: 'center', justifyContent: 'center',
                      zIndex: 10,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', lineHeight: 12 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {carouselImages.length === 0 && (
                <Text style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' }}>
                  No hay imágenes en el carrusel.
                </Text>
              )}
            </View>

             <TouchableOpacity 
              style={[styles.testBtn, { width: 140, height: 36, marginTop: 4 }]} 
              onPress={handleSelectImage}
              activeOpacity={0.8}
            >
              <View style={styles.btnInner}>
                <Text style={styles.testBtnText}>Seleccionar Imagen</Text>
              </View>
            </TouchableOpacity>

            {/* Vista previa real dinámica */}
            {localPreviewUri && (
              <View style={{ marginTop: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingTop: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.primaryLight, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Previsualización Real (Cómo se verá en la cartelera)
                </Text>
                
                <View style={{ width: '100%', height: 170, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 2, borderColor: COLORS.primaryLight, marginBottom: 8 }}>
                  <Image source={{ uri: localPreviewUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.testBtn, { flex: 1, height: 36 }]}
                    onPress={confirmUploadImage}
                    disabled={uploadingImage}
                    activeOpacity={0.8}
                  >
                    <View style={styles.btnInner}>
                      <Text style={styles.testBtnText}>
                        {uploadingImage ? 'Subiendo...' : 'Confirmar y Subir'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.testBtn, { width: 80, height: 36, backgroundColor: 'transparent' }]}
                    onPress={cancelLocalPreview}
                    disabled={uploadingImage}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.btnInner, { backgroundColor: 'transparent' }]}>
                      <Text style={[styles.testBtnText, { color: COLORS.textMuted }]}>Cancelar</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </GlassCard>
        )}

        {/* ─── Preferencias de Impresión ──────────────────────── */}
        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Preferencias de Impresión</Text>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Impresión Automática</Text>
              <Text style={styles.switchDesc}>
                Imprime un ticket térmico al confirmar una venta.
              </Text>
            </View>
            <Switch
              value={autoprint}
              onValueChange={setAutoprint}
              trackColor={{ false: '#374151', true: COLORS.primaryLight }}
              thumbColor={autoprint ? COLORS.primary : '#9ca3af'}
            />
          </View>
        </GlassCard>

        {/* ─── Conexión de Impresora Bluetooth ───────────────── */}
        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Impresora Bluetooth</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={[
              { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
              printerConnected ? { backgroundColor: 'rgba(16,185,129,0.12)' } : { backgroundColor: 'rgba(239,68,68,0.1)' }
            ]}>
              <Printer size={20} color={printerConnected ? COLORS.successLight : COLORS.dangerLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', fontSize: 14, color: '#fff' }}>
                {printerConnected ? (printerDevice?.name || 'Impresora conectada') : 'Sin impresora'}
              </Text>
              <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
                {printerConnected ? 'Bluetooth activo y vinculado ✓' : 'No hay dispositivo vinculado'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!printerConnected ? (
              <TouchableOpacity
                style={[
                  { flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: 8 },
                  printerConnecting && { opacity: 0.6 }
                ]}
                onPress={async () => {
                  try {
                    await connectPrinter();
                  } catch (err) {
                    Alert.alert('Error de Conexión', err.message);
                  }
                }}
                disabled={printerConnecting}
                activeOpacity={0.8}
              >
                {printerConnecting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Bluetooth size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Conectar Impresora</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={{ flex: 2, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1f2937', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8 }}
                  onPress={printTestPage}
                  activeOpacity={0.8}
                >
                  <Printer size={14} color={COLORS.primaryLight} />
                  <Text style={{ color: COLORS.primaryLight, fontSize: 12, fontWeight: '800' }}>Prueba de impresión</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 8 }}
                  onPress={disconnectPrinter}
                  activeOpacity={0.8}
                >
                  <BluetoothOff size={14} color={COLORS.dangerLight} />
                  <Text style={{ color: COLORS.dangerLight, fontSize: 12, fontWeight: '800' }}>Desconectar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </GlassCard>

        {/* ─── Guardar ─────────────────────────────────────────── */}
        {isAdmin && (
          <CustomButton
            title={loading ? 'Guardando...' : 'Guardar Ajustes'}
            onPress={handleSave}
            loading={loading}
            icon={Save}
            style={styles.saveBtn}
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgBase },
  navBar: {
    height: 56, backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', height: '100%' },
  navTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginLeft: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48, gap: 12 },

  card: { padding: 16 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: '#fff',
    textTransform: 'uppercase', letterSpacing: 0.5,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', paddingBottom: 8, marginBottom: 12,
    flex: 1,
  },
  sectionDesc: {
    fontSize: 12, color: COLORS.textSecondary, lineHeight: 16, marginBottom: 12, marginTop: -4,
  },

  // Status row
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statusItem: {
    flex: 1, backgroundColor: '#1f2937', borderRadius: RADIUS.sm, padding: 10, alignItems: 'center',
  },
  statusLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 3 },
  statusValue: { fontSize: 13, fontWeight: '800', color: '#fff', textAlign: 'center' },

  blockedNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: RADIUS.sm, padding: 8, marginBottom: 10,
  },
  blockedNoteText: { fontSize: 11, color: '#fbbf24', fontWeight: '600' },

  lotteryList: { marginBottom: 12 },
  lotteryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  lotteryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)',
  },
  lotteryChipText: { fontSize: 11, color: COLORS.primaryLight, fontWeight: '700' },

  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(124,58,237,0.12)', borderRadius: RADIUS.md, height: 40,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)',
  },
  syncBtnText: { fontSize: 13, color: COLORS.primaryLight, fontWeight: '700' },

  // API
  apiStatusOk: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: RADIUS.sm, padding: 8, marginBottom: 8,
  },
  apiStatusOkText: { fontSize: 11, color: COLORS.successLight, fontWeight: '600' },
  apiStatusError: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: RADIUS.sm, padding: 8, marginBottom: 8,
  },
  apiStatusErrorText: { fontSize: 11, color: COLORS.dangerLight, fontWeight: '600', flex: 1 },
  apiActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  testBtn: {
    flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(124,58,237,0.12)', borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
  },
  testBtnText: { color: COLORS.primaryLight, fontWeight: '700', fontSize: 12 },
  saveApiBtn: {
    flex: 2, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
  },
  saveApiBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  fieldHint: { fontSize: 11, color: COLORS.textMuted, marginTop: -4, marginBottom: 4 },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  switchInfo: { flex: 1, marginRight: 16 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  switchDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  saveBtn: { height: 50 },

  // Título de sección con ícono al lado (sin borderBottom)
  sectionTitleInline: {
    fontSize: 13, fontWeight: '800', color: '#fff',
    textTransform: 'uppercase', letterSpacing: 0.5, flex: 1,
  },

  // Contenedor interior de botones (reemplaza fragments)
  btnInner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
});
