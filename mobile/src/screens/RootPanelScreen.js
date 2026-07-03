// ============================================================
// RootPanelScreen — Panel de control exclusivo para el usuario root (Móvil)
// Permite gestionar la disponibilidad y bloqueo de la aplicación
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Modal, Platform
} from 'react-native';
import {
  ShieldAlert, Power, Clock, CheckCircle,
  AlertTriangle, RefreshCw, LogOut, Activity,
  User, Lock, XCircle, Server, Wifi, Save
} from 'lucide-react-native';
import { api, getApiUrl, setApiUrl } from '../services/apiService';
import { COLORS, RADIUS, SHADOWS } from '../styles/theme';
import { GlassCard } from '../components/GlassCard';
import { FormInput } from '../components/FormInput';
import { useApp } from '../context/AppContext';

// ─── Modal de confirmación de credenciales root ───────────────
const RootCredentialsModal = ({ visible, onConfirm, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [insufficientPerms, setInsufficientPerms] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      setError('Ingresa usuario y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Verifica credenciales sin crear sesión — POST /root.php
      const { role } = await api.post('/root.php', { username: username.trim(), password });
      if (role !== 'root') {
        setInsufficientPerms(true);
        setLoading(false);
        return;
      }
      // Credenciales root correctas → proceder
      onConfirm();
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas.');
      setLoading(false);
    }
  };

  if (insufficientPerms) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <GlassCard style={[styles.modalCard, { borderColor: 'rgba(251,191,36,0.35)' }]}>
            <View style={{ alignItems: 'center', padding: 4 }}>
              <View style={[styles.statusIconCircle, { backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)' }]}>
                <ShieldAlert size={28} color="#fbbf24" />
              </View>
              <Text style={styles.modalTitleText}>Permisos Insuficientes</Text>
              <Text style={styles.modalDescText}>
                Las credenciales ingresadas pertenecen a un rol sin autorización para realizar esta operación.
              </Text>
              <View style={styles.errCodeBadge}>
                <Text style={styles.errCodeText}>[ERR-AUTH-403] ROLE_INSUFFICIENT</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                  <Text style={styles.secondaryBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)' }]}
                  onPress={() => { setInsufficientPerms(false); setUsername(''); setPassword(''); }}
                >
                  <Text style={[styles.confirmBtnText, { color: '#fbbf24' }]}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </GlassCard>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <GlassCard style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.statusIconCircle, { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.25)' }]}>
                <Lock size={16} color="#34d399" />
              </View>
              <View>
                <Text style={{ fontWeight: '800', fontSize: 14, color: '#fff' }}>Confirmar Identidad</Text>
                <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 1 }}>Se requieren credenciales root</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <XCircle size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={{ gap: 12, marginTop: 10 }}>
            <FormInput
              label="Usuario root"
              value={username}
              onChangeText={setUsername}
              placeholder="root"
              autoCapitalize="none"
            />

            <FormInput
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={true}
            />

            {error ? (
              <View style={styles.errorContainer}>
                <AlertTriangle size={13} color="#f87171" style={{ marginRight: 6 }} />
                <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '600' }}>{error}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} disabled={loading}>
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmit} disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <CheckCircle size={14} color="#34d399" />
                    <Text style={styles.confirmBtnText}>Confirmar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
};

// ─── Componente Principal ─────────────────────────────────────
export const RootPanelScreen = ({ onLogout }) => {
  const { loadAllData } = useApp();

  const [appControl, setAppControl] = useState({
    status: 'active',
    disableAt: 'never',
    isBlocked: false,
  });
  const [loading, setLoading] = useState(true);
  const [minutes, setMinutes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showCredModal, setShowCredModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'restore' | 'cancelTimer'
  const [localTime, setLocalTime] = useState(new Date());
  const [bypassCode, setBypassCodeState] = useState('');
  const [activeTab, setActiveTab] = useState('status'); // 'status' | 'server' | 'security'

  // --- API URL States & Helpers ---
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

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setLocalTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cargar disponibilidad
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/root.php');
      setAppControl(res.appControl || { status: 'active', disableAt: 'never', isBlocked: false });

      // Cargar configuraciones de bypassCode
      const settingsRes = await api.get('/settings.php');
      if (settingsRes && settingsRes.settings) {
        setBypassCodeState(settingsRes.settings.bypassCode || '1005199611712301977');
      }
    } catch (err) {
      // Ignorar fallas silenciosas en arranque local
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSaveBypassCode = async () => {
    if (!bypassCode.trim()) {
      Alert.alert('Código requerido', 'Ingrese un código de recuperación válido.');
      return;
    }
    setActionLoading(true);
    try {
      await api.put('/settings.php', { bypassCode: bypassCode.trim() });
      Alert.alert('Éxito', 'Código de recuperación actualizado correctamente.');
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar el código: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Actualizar disponibilidad
  const doAction = async (action, extraData = {}) => {
    setActionLoading(true);
    try {
      const res = await api.put('/root.php', { action, ...extraData });
      setAppControl(res.appControl || { status: 'active', disableAt: 'never', isBlocked: false });
      const messages = {
        disable:  'Aplicación desactivada correctamente.',
        restore:  'Aplicación reactivada correctamente.',
        schedule: `Desactivación programada en ${extraData.minutes} minuto(s).`,
      };
      Alert.alert('Éxito', messages[action] || 'Operación realizada.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Error al actualizar el estado.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreClick = () => {
    setPendingAction('restore');
    setShowCredModal(true);
  };

  const handleCancelTimerClick = () => {
    setPendingAction('restore'); // Cancelar temporizador es equivalente a restaurar a activo
    setShowCredModal(true);
  };

  const handleRestoreConfirmed = () => {
    setShowCredModal(false);
    doAction('restore');
  };

  const handleSchedule = () => {
    const mins = parseInt(minutes, 10);
    if (!mins || mins <= 0) {
      Alert.alert('Minutos inválidos', 'Ingresa un número de minutos válido (mayor a 0).');
      return;
    }
    doAction('schedule', { minutes: mins });
    setMinutes('');
  };

  // Minutos restantes para desactivación
  const minutesRemaining = (() => {
    if (appControl.disableAt === 'never' || appControl.status === 'disabled' || appControl.isBlocked) return null;
    const ts = new Date(appControl.disableAt.replace(' ', 'T')).getTime();
    if (isNaN(ts)) return null;
    const diff = Math.ceil((ts - Date.now()) / 60000);
    return diff > 0 ? diff : 0;
  })();

  const formatDisableAt = (dt) => {
    if (!dt || dt === 'never') return null;
    try {
      const parts = dt.split(' ');
      const [y, m, d] = parts[0].split('-');
      return `${d}/${m}/${y} ${parts[1]?.substring(0, 5) || ''}`;
    } catch { return dt; }
  };

  const isBlocked = appControl.isBlocked || appControl.status === 'disabled';
  const hasTimer = appControl.disableAt !== 'never' && !isBlocked;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.navBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ShieldAlert size={20} color="#ef4444" />
          <Text style={styles.navTitle}>Panel Root</Text>
          <View style={styles.rootBadge}>
            <Text style={styles.rootBadgeText}>Superusuario</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={styles.clockText}>{localTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.7}>
            <LogOut size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Selector Bar */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#111827',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 8,
      }}>
        {[
          { id: 'status', label: 'Estado' },
          { id: 'server', label: 'Servidor' },
          { id: 'security', label: 'Seguridad' },
        ].map((t) => (
          <TouchableOpacity
            key={t.id}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: activeTab === t.id ? COLORS.primary : 'transparent',
            }}
            onPress={() => setActiveTab(t.id)}
            activeOpacity={0.7}
          >
            <Text style={{
              color: activeTab === t.id ? COLORS.primaryLight : COLORS.textSecondary,
              fontSize: 13,
              fontWeight: '800',
            }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {/* ─── PANELES DE ESTADO ─────────────────────────────────── */}
        {activeTab === 'status' && (
          <>
            {/* ─── Estado Actual ────────────────────────────────────── */}
            <GlassCard style={[
              styles.statusCard,
              isBlocked ? { borderColor: 'rgba(239,68,68,0.25)' } : { borderColor: 'rgba(52,211,153,0.25)' }
            ]}>
              <View style={styles.statusCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Activity size={14} color={COLORS.textMuted} />
                  <Text style={styles.statusCardTitle}>Estado de la Aplicación</Text>
                </View>
                <TouchableOpacity onPress={loadStatus} style={styles.refreshBtn} disabled={loading} activeOpacity={0.7}>
                  <RefreshCw size={13} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {loading ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 14 }} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <View style={[
                    styles.statusIconCircle,
                    isBlocked
                      ? { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)' }
                      : { backgroundColor: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.25)' }
                  ]}>
                    {isBlocked ? <AlertTriangle size={20} color="#f87171" /> : <CheckCircle size={20} color="#34d399" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statusValueText, isBlocked ? { color: '#f87171' } : { color: '#34d399' }]}>
                      {isBlocked ? 'Desactivada / Bloqueada' : 'Activa'}
                    </Text>
                    {hasTimer && (
                      <Text style={styles.timerHintText}>
                        ⏱ Se desactivará: {formatDisableAt(appControl.disableAt)}
                        {minutesRemaining !== null && ` (~${minutesRemaining} min)`}
                      </Text>
                    )}
                    {!hasTimer && !isBlocked && (
                      <Text style={styles.subtext}>Sin restricciones de tiempo</Text>
                    )}
                  </View>
                </View>
              )}
            </GlassCard>

            {/* ─── Controles de Disponibilidad ──────────────────────── */}
            <GlassCard style={styles.card}>
              <Text style={styles.sectionTitle}>Control de Disponibilidad</Text>

              <View style={{ gap: 8, marginTop: 4 }}>
                {!isBlocked && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }]}
                    onPress={() => doAction('disable')}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <Power size={16} color="#f87171" />
                    <Text style={[styles.actionBtnText, { color: '#f87171' }]}>Desactivar aplicación ahora</Text>
                  </TouchableOpacity>
                )}

                {isBlocked && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.25)' }]}
                    onPress={handleRestoreClick}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <CheckCircle size={16} color="#34d399" />
                    <Text style={[styles.actionBtnText, { color: '#34d399' }]}>Reactivar aplicación</Text>
                    <View style={styles.actionBtnLockIcon}>
                      <Lock size={10} color="#34d399" />
                      <Text style={{ fontSize: 9, color: '#34d399', fontWeight: '800' }}>Confirmar</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {hasTimer && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.2)' }]}
                    onPress={handleCancelTimerClick}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={16} color="#fbbf24" />
                    <Text style={[styles.actionBtnText, { color: '#fbbf24' }]}>Cancelar temporizador</Text>
                    <View style={styles.actionBtnLockIcon}>
                      <Lock size={10} color="#fbbf24" />
                      <Text style={{ fontSize: 9, color: '#fbbf24', fontWeight: '800' }}>Confirmar</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </GlassCard>

            {/* ─── Programar Desactivación ──────────────────────────── */}
            {!isBlocked && (
              <GlassCard style={styles.card}>
                <Text style={styles.sectionTitle}>Programar Desactivación</Text>
                <Text style={styles.sectionDesc}>
                  La app seguirá funcionando hasta que expire el tiempo. Al vencer, los usuarios verán una notificación de error y no podrán operar.
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <FormInput
                      label="Minutos antes de desactivar"
                      value={minutes}
                      onChangeText={setMinutes}
                      placeholder="ej: 30"
                      keyboardType="numeric"
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.scheduleBtn,
                      (!minutes || actionLoading) && { opacity: 0.5 }
                    ]}
                    onPress={handleSchedule}
                    disabled={!minutes || actionLoading}
                    activeOpacity={0.8}
                  >
                    <Clock size={13} color="#fbbf24" />
                    <Text style={styles.scheduleBtnText}>Programar</Text>
                  </TouchableOpacity>
                </View>
              </GlassCard>
            )}

            {/* Aviso informativo */}
            {isBlocked && (
              <View style={styles.disabledBanner}>
                <AlertTriangle size={15} color="#f87171" style={{ marginRight: 6, marginTop: 1 }} />
                <Text style={styles.disabledBannerText}>
                  Todos los usuarios verán el modal de error y la app estará suspendida. La app se reactivará solo cuando ingreses tus credenciales root.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ─── CÓDIGO DE SEGURIDAD (BYPASS) ─────────────────────── */}
        {activeTab === 'security' && (
          <GlassCard style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Lock size={15} color={COLORS.primaryLight} />
              <Text style={styles.sectionTitleInline}>Código de Recuperación</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Código de texto utilizado para desbloquear la configuración de red en la pantalla de inicio de sesión.
            </Text>

            <FormInput
              label="Código Secreto"
              value={bypassCode}
              onChangeText={setBypassCodeState}
              placeholder="1005199611712301977"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight, marginTop: 8 }]}
              onPress={handleSaveBypassCode}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              <View style={styles.btnInner}>
                <Save size={14} color="#fff" />
                <Text style={[styles.actionBtnText, { color: '#fff' }]}>Guardar Código</Text>
              </View>
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* ─── CONFIGURACIÓN DEL SERVIDOR API ───────────────────── */}
        {activeTab === 'server' && (
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
      </ScrollView>

      {/* Credentials Modal */}
      {showCredModal && (
        <RootCredentialsModal
          visible={showCredModal}
          onConfirm={handleRestoreConfirmed}
          onClose={() => setShowCredModal(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgBase },
  navBar: {
    height: 56, backgroundColor: '#111827', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  navTitle: { fontSize: 16, fontWeight: '900', color: '#fff' },
  rootBadge: {
    backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 99,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  rootBadgeText: { fontSize: 8, color: '#f87171', fontWeight: '800', textTransform: 'uppercase' },
  clockText: { fontSize: 12, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },
  logoutBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)'
  },
  scrollContent: { padding: 14, gap: 12, paddingBottom: 40 },

  // Card general
  card: { padding: 14 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8
  },
  sectionDesc: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 15, marginBottom: 10 },

  // Status card
  statusCard: { padding: 14, borderWidth: 1 },
  statusCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusCardTitle: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },
  refreshBtn: { padding: 4 },
  statusIconCircle: {
    width: 44, height: 44, borderRadius: 22, borderOffset: 1, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center'
  },
  statusValueText: { fontSize: 16, fontWeight: '900' },
  timerHintText: { fontSize: 11, color: '#fbbf24', marginTop: 3, fontWeight: '600' },
  subtext: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  // Action buttons
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontWeight: '800' },
  actionBtnLockIcon: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },

  // Schedule input and btn
  scheduleBtn: {
    height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
    borderRadius: 8, paddingHorizontal: 16, marginBottom: 10
  },
  scheduleBtnText: { color: '#fbbf24', fontSize: 12, fontWeight: '800' },

  // Info banners
  disabledBanner: {
    flexDirection: 'row', backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 8, padding: 10,
  },
  disabledBannerText: { fontSize: 11, color: '#f87171', flex: 1, lineHeight: 15 },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitleText: { fontSize: 16, fontWeight: '800', color: '#f1f5f9', marginTop: 10 },
  modalDescText: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 17, marginVertical: 10 },
  errCodeBadge: {
    backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
    borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, marginVertical: 8
  },
  errCodeText: { fontSize: 10, color: '#fbbf24', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '700' },

  errorContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)', borderRadius: 8, padding: 8, marginVertical: 4
  },

  secondaryBtn: {
    flex: 1, height: 38, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1f2937', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
  },
  secondaryBtnText: { color: COLORS.textSecondary, fontWeight: '800', fontSize: 12 },
  confirmBtn: {
    flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(52,211,153,0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)'
  },
  confirmBtnText: { color: '#34d399', fontWeight: '800', fontSize: 12 },

  // API URL Config Styles
  apiStatusOk: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 6, padding: 8, marginBottom: 8,
  },
  apiStatusOkText: { fontSize: 11, color: '#34d399', fontWeight: '600' },
  apiStatusError: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: 8, marginBottom: 8,
  },
  apiStatusErrorText: { fontSize: 11, color: '#f87171', fontWeight: '600', flex: 1 },
  apiActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  testBtn: {
    flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(124,58,237,0.12)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
  },
  testBtnText: { color: COLORS.primaryLight, fontWeight: '700', fontSize: 12 },
  saveApiBtn: {
    flex: 2, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 8,
  },
  saveApiBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  sectionTitleInline: {
    fontSize: 11, fontWeight: '800', color: '#fff',
    textTransform: 'uppercase', letterSpacing: 0.5, flex: 1,
  },
  btnInner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
});
