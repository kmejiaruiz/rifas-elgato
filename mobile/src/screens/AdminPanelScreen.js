// ============================================================
// AdminPanelScreen — Panel Administrativo para Móvil
// Fiel a la web: parametrización de juegos, usuarios, bloqueos, ganadores
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, ActivityIndicator, Modal, TextInput, FlatList,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ChevronLeft, Gamepad2, Hash, Trophy, Users, Plus, Trash2,
  Edit3, Save, X, ToggleLeft, ToggleRight, Lock, Unlock,
  UserPlus, Eye, EyeOff, Shield, Ticket, XCircle, RefreshCw, DollarSign,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS, SHADOWS } from '../styles/theme';
import { GlassCard } from '../components/GlassCard';
import { FormInput } from '../components/FormInput';
import { api } from '../services/apiService';
import { formatHourAmPm } from '../services/gameService';
import { HeaderClock } from '../components/HeaderClock';

// ─── Tabs ─────────────────────────────────────────────────────
const TABS = [
  { id: 'games',    label: 'Juegos',    Icon: Gamepad2 },
  { id: 'numbers',  label: 'Números',   Icon: Hash },
  { id: 'results',  label: 'Ganadores',  Icon: Trophy },
  { id: 'users',    label: 'Usuarios',  Icon: Users },
  { id: 'salaries', label: 'Salarios',  Icon: DollarSign },
];

// ─── Formulario en blanco para nuevo juego ───────────────────
const BLANK_GAME = {
  name: '',
  description: '',
  defaultPrice: 100,
  priceLabel: 'NIO ',
  payoutMultiplier: 80,
  emoji: '',
  numberDigits: 2,
  minNumber: 0,
  maxNumber: 99,
  allowSeries: false,
  allowMultiDraw: false,
  drawHours: '12:00,15:00,18:00,21:00',
  maxSalesPerNumber: 0,
};

// ─── Componente numérico rápido ───────────────────────────────
const NumInput = ({ label, value, onChange, step = 1, hint }) => (
  <View style={fi.group}>
    <Text style={fi.label}>{label}</Text>
    <TextInput
      style={fi.input}
      value={String(value ?? '')}
      onChangeText={(v) => onChange(parseFloat(v) || 0)}
      keyboardType="numeric"
      placeholderTextColor={COLORS.textMuted}
    />
    {hint ? <Text style={fi.hint}>{hint}</Text> : null}
  </View>
);

const StrInput = ({ label, value, onChange, placeholder, hint, autoCapitalize = 'none', autoFocus = false, secureTextEntry = false }) => (
  <View style={fi.group}>
    <Text style={fi.label}>{label}</Text>
    <TextInput
      style={fi.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      autoCapitalize={autoCapitalize}
      autoFocus={autoFocus}
      secureTextEntry={secureTextEntry}
    />
    {hint ? <Text style={fi.hint}>{hint}</Text> : null}
  </View>
);

const fi = StyleSheet.create({
  group: { marginBottom: 10 },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 4 },
  input: {
    height: 40, backgroundColor: '#111827', borderRadius: RADIUS.sm,
    color: '#fff', paddingHorizontal: 12, fontSize: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  hint: { fontSize: 10, color: COLORS.textMuted, marginTop: 3, lineHeight: 14 },
});

// ─── Tab: Juegos ──────────────────────────────────────────────
const GamesTab = ({ lotteries, loadAllData }) => {
  const [gameStates, setGameStates] = useState([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(BLANK_GAME);
  const [creating, setCreating] = useState(false);

  const loadStates = useCallback(async () => {
    try {
      const { configs } = await api.get('/games.php');
      const merged = lotteries.map(l => {
        const cfg = configs?.[l.id] || {};
        return {
          ...l,
          enabled:           cfg.enabled !== undefined ? Boolean(Number(cfg.enabled)) : true,
          name:              cfg.name              || l.name,
          description:       cfg.description       || l.description || '',
          defaultPrice:      parseFloat(cfg.default_price   || l.defaultPrice   || 100),
          priceLabel:        cfg.price_label        || l.priceLabel        || 'NIO ',
          payoutMultiplier:  parseFloat(cfg.payout_multiplier || l.payoutMultiplier || 80),
          emoji:             cfg.emoji              ?? l.emoji ?? '',
          numberDigits:      parseInt(cfg.number_digits     || l.numberDigits || 2, 10),
          minNumber:         parseInt(cfg.min_number        || (l.numberRange?.min ?? 0), 10),
          maxNumber:         parseInt(cfg.max_number        || (l.numberRange?.max ?? 99), 10),
          isCustom:          Boolean(Number(cfg.is_custom   || 0)),
          allowSeries:       Boolean(Number(cfg.allow_series || 0)),
          allowMultiDraw:    Boolean(Number(cfg.allow_multi_draw || 0)),
          drawHours:         cfg.draw_hours         || l.drawHours || '12:00,15:00,18:00,21:00',
          maxSalesPerNumber: parseFloat(cfg.max_sales_per_number || 0),
        };
      });
      // Agregar juegos custom que NO están en LOTTERY_LIST
      const extraIds = Object.keys(configs || {}).filter(
        id => !lotteries.find(l => l.id === id) && configs[id].is_custom
      );
      for (const id of extraIds) {
        const cfg = configs[id];
        merged.push({
          id,
          enabled:           Boolean(Number(cfg.enabled ?? 1)),
          name:              cfg.name || id,
          description:       cfg.description || '',
          defaultPrice:      parseFloat(cfg.default_price || 100),
          priceLabel:        cfg.price_label || 'NIO ',
          payoutMultiplier:  parseFloat(cfg.payout_multiplier || 80),
          emoji:             cfg.emoji || '',
          numberDigits:      parseInt(cfg.number_digits || 2, 10),
          minNumber:         parseInt(cfg.min_number || 0, 10),
          maxNumber:         parseInt(cfg.max_number || 99, 10),
          isCustom:          true,
          allowSeries:       Boolean(Number(cfg.allow_series || 0)),
          allowMultiDraw:    Boolean(Number(cfg.allow_multi_draw || 0)),
          drawHours:         cfg.draw_hours || '12:00,15:00,18:00,21:00',
          maxSalesPerNumber: parseFloat(cfg.max_sales_per_number || 0),
        });
      }
      setGameStates(merged);
    } catch (err) {
      Alert.alert('Error', 'No se pudieron cargar los juegos.');
    } finally {
      setLoadingStates(false);
    }
  }, [lotteries]);

  useEffect(() => { loadStates(); }, [loadStates]);

  const toggleEnabled = async (game) => {
    try {
      await api.put(`/games.php?id=${game.id}`, { enabled: !game.enabled });
      await loadStates();
      await loadAllData();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const startEdit = (game) => {
    setEditingId(game.id);
    setEditForm({
      name:              game.name,
      description:       game.description,
      defaultPrice:      game.defaultPrice,
      priceLabel:        game.priceLabel,
      payoutMultiplier:  game.payoutMultiplier,
      emoji:             game.emoji,
      numberDigits:      game.numberDigits,
      minNumber:         game.minNumber,
      maxNumber:         game.maxNumber,
      isCustom:          game.isCustom,
      allowSeries:       game.allowSeries,
      allowMultiDraw:    game.allowMultiDraw,
      drawHours:         game.drawHours,
      maxSalesPerNumber: game.maxSalesPerNumber,
    });
  };

  const saveEdit = async (gameId) => {
    setSaving(true);
    try {
      await api.put(`/games.php?id=${gameId}`, editForm);
      Alert.alert('Guardado', 'Configuración actualizada.');
      setEditingId(null);
      await loadStates();
      await loadAllData();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomGame = (game) => {
    Alert.alert(
      'Eliminar Juego',
      `¿Eliminar el juego personalizado "${game.name}"? Se borrará su configuración y números bloqueados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/games.php?id=${game.id}`);
              Alert.alert('Eliminado', 'Juego eliminado.');
              await loadStates();
              await loadAllData();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      Alert.alert('Requerido', 'Ingrese un nombre para el juego.');
      return;
    }
    const lotteryId = createForm.name
      .toLowerCase().trim()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/__+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!lotteryId) {
      Alert.alert('Error', 'Nombre inválido. Use letras y números.');
      return;
    }
    if (gameStates.some(g => g.id === lotteryId)) {
      Alert.alert('Error', 'Ya existe un juego con este nombre/ID.');
      return;
    }
    setCreating(true);
    try {
      await api.put(`/games.php?id=${lotteryId}`, { ...createForm, isCustom: true });
      Alert.alert('¡Listo!', `Juego "${createForm.name}" creado con éxito.`);
      setCreateForm(BLANK_GAME);
      setShowCreate(false);
      await loadStates();
      await loadAllData();
    } catch (err) {
      Alert.alert('Error al crear', err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loadingStates) {
    return (
      <View style={styles.loaderBox}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.tabDesc}>
        Habilita/deshabilita juegos, edita sus parámetros de precio, horas y premios.
      </Text>

      {gameStates.map(game => (
        <GlassCard key={game.id} style={[styles.gameCard, !game.enabled && styles.gameCardDisabled]}>
          {/* Cabecera del juego */}
          <View style={styles.gameRow}>
            <View style={[styles.gameIconBox, { backgroundColor: game.enabled ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.04)' }]}>
              {game.emoji
                ? <Text style={{ fontSize: 20 }}>{game.emoji}</Text>
                : <Gamepad2 size={18} color={game.enabled ? COLORS.primaryLight : COLORS.textMuted} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.gameTitleRow}>
                <Text style={styles.gameName}>{game.name}</Text>
                {game.isCustom && (
                  <View style={styles.customBadge}>
                    <Text style={styles.customBadgeText}>Personalizado</Text>
                  </View>
                )}
                {!game.enabled && (
                  <View style={styles.disabledBadge}>
                    <Text style={styles.disabledBadgeText}>Desactivado</Text>
                  </View>
                )}
              </View>
              <Text style={styles.gameDesc} numberOfLines={1}>{game.description}</Text>
              <Text style={styles.gameMeta}>
                Base: {game.priceLabel}{game.defaultPrice}
                {'  ·  '}Premio: <Text style={{ color: COLORS.successLight, fontWeight: '800' }}>{game.payoutMultiplier}x</Text>
                {'\n'}Sorteos: {game.drawHours?.split(',').map(h => formatHourAmPm(h.trim())).join(', ')}
              </Text>
            </View>
            <View style={styles.gameActions}>
              {game.isCustom && (
                <TouchableOpacity onPress={() => deleteCustomGame(game)} style={styles.iconBtn}>
                  <Trash2 size={15} color={COLORS.dangerLight} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => editingId === game.id ? setEditingId(null) : startEdit(game)}
                style={styles.iconBtn}
              >
                <Edit3 size={15} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggleEnabled(game)} activeOpacity={0.7}>
                {game.enabled
                  ? <ToggleRight size={34} color={COLORS.successLight} />
                  : <ToggleLeft size={34} color={COLORS.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Formulario de edición inline */}
          {editingId === game.id && (
            <View style={styles.editForm}>
              <View style={styles.editGrid}>
                <View style={{ flex: 1 }}>
                  <StrInput label="Nombre" value={editForm.name} onChange={v => setEditForm(f => ({ ...f, name: v }))} autoCapitalize="words" />
                </View>
                <View style={{ flex: 1 }}>
                  <StrInput label="Símbolo moneda" value={editForm.priceLabel} onChange={v => setEditForm(f => ({ ...f, priceLabel: v }))} placeholder="NIO " />
                </View>
              </View>

              <View style={styles.editGrid}>
                <View style={{ flex: 1 }}>
                  <NumInput label="Precio base" value={editForm.defaultPrice} onChange={v => setEditForm(f => ({ ...f, defaultPrice: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <NumInput label="Multiplicador premio (x)" value={editForm.payoutMultiplier} onChange={v => setEditForm(f => ({ ...f, payoutMultiplier: v }))} step={0.1} />
                </View>
              </View>

              <StrInput
                label="Horas de sorteo (separadas por coma)"
                value={editForm.drawHours}
                onChange={v => setEditForm(f => ({ ...f, drawHours: v }))}
                placeholder="12:00,15:00,18:00,21:00"
                hint="Formato 24h (HH:MM), separadas por comas. Ej: 12:00,15:00,18:00,21:00"
              />

              <NumInput
                label="Límite acumulado por número (0 = ilimitado)"
                value={editForm.maxSalesPerNumber}
                onChange={v => setEditForm(f => ({ ...f, maxSalesPerNumber: v }))}
                step={0.01}
                hint="Tope máximo de ventas para un mismo número/hora de sorteo."
              />

              {/* Campos extra solo para juegos personalizados */}
              {editForm.isCustom && (
                <>
                  <View style={styles.editGrid}>
                    <View style={{ flex: 1 }}>
                      <StrInput label="Emoji" value={editForm.emoji} onChange={v => setEditForm(f => ({ ...f, emoji: v }))} placeholder="🎯" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <NumInput
                        label="Dígitos del número"
                        value={editForm.numberDigits}
                        onChange={v => {
                          const d = Math.max(1, Math.min(5, parseInt(v, 10) || 2));
                          setEditForm(f => ({ ...f, numberDigits: d, maxNumber: Math.pow(10, d) - 1 }));
                        }}
                      />
                    </View>
                  </View>
                  <View style={styles.editGrid}>
                    <View style={{ flex: 1 }}>
                      <NumInput label="Número mínimo" value={editForm.minNumber} onChange={v => setEditForm(f => ({ ...f, minNumber: parseInt(v, 10) || 0 }))} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <NumInput label="Número máximo" value={editForm.maxNumber} onChange={v => setEditForm(f => ({ ...f, maxNumber: parseInt(v, 10) || 99 }))} />
                    </View>
                  </View>
                </>
              )}

              {/* Descripción */}
              <StrInput
                label="Descripción"
                value={editForm.description}
                onChange={v => setEditForm(f => ({ ...f, description: v }))}
                placeholder="Sorteo diario..."
                autoCapitalize="sentences"
              />

              {/* Toggle: Permitir rango */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Permitir venta por rango</Text>
                  <Text style={styles.switchDesc}>Permite vender una serie (ej. del 00 al 99)</Text>
                </View>
                <Switch
                  value={editForm.allowSeries}
                  onValueChange={v => setEditForm(f => ({ ...f, allowSeries: v }))}
                  trackColor={{ false: '#374151', true: COLORS.primaryLight }}
                  thumbColor={editForm.allowSeries ? COLORS.primary : '#9ca3af'}
                />
              </View>

              {/* Toggle: Permitir Multi-Sorteo */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Permitir Multi-Sorteo</Text>
                  <Text style={styles.switchDesc}>El vendedor puede comprar para varios sorteos a la vez</Text>
                </View>
                <Switch
                  value={editForm.allowMultiDraw}
                  onValueChange={v => setEditForm(f => ({ ...f, allowMultiDraw: v }))}
                  trackColor={{ false: '#374151', true: COLORS.primaryLight }}
                  thumbColor={editForm.allowMultiDraw ? COLORS.primary : '#9ca3af'}
                />
              </View>

              {/* Botones guardar/cancelar */}
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={() => saveEdit(game.id)}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <View style={styles.btnInner}><Save size={14} color="#fff" /><Text style={styles.saveBtnText}>Guardar</Text></View>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingId(null)}>
                  <View style={styles.btnInner}><X size={14} color={COLORS.textSecondary} /><Text style={styles.cancelBtnText}>Cancelar</Text></View>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </GlassCard>
      ))}

      {/* Crear juego personalizado */}
      <TouchableOpacity
        style={[styles.createGameBtn, showCreate && styles.createGameBtnActive]}
        onPress={() => setShowCreate(v => !v)}
        activeOpacity={0.8}
      >
        <View style={styles.btnInner}>
          {showCreate ? (
            <X size={16} color="#c084fc" />
          ) : (
            <Plus size={16} color="#c084fc" />
          )}
          <Text style={styles.createGameBtnText}>
            {showCreate ? 'Cancelar creación' : 'Crear Nuevo Juego'}
          </Text>
        </View>
      </TouchableOpacity>

      {showCreate && (
        <GlassCard style={[styles.createCard]}>
          <Text style={styles.createTitle}>Nuevo Juego Personalizado</Text>

          <StrInput label="Nombre del juego *" value={createForm.name} onChange={v => setCreateForm(f => ({ ...f, name: v }))} placeholder="Ej: Diaria Millonaria" autoCapitalize="words" />

          <View style={styles.editGrid}>
            <View style={{ flex: 1 }}>
              <StrInput label="Símbolo moneda *" value={createForm.priceLabel} onChange={v => setCreateForm(f => ({ ...f, priceLabel: v }))} placeholder="NIO " />
            </View>
            <View style={{ flex: 1 }}>
              <StrInput label="Emoji" value={createForm.emoji} onChange={v => setCreateForm(f => ({ ...f, emoji: v }))} placeholder="🎯" />
            </View>
          </View>

          <View style={styles.editGrid}>
            <View style={{ flex: 1 }}>
              <NumInput label="Precio por defecto *" value={createForm.defaultPrice} onChange={v => setCreateForm(f => ({ ...f, defaultPrice: v }))} />
            </View>
            <View style={{ flex: 1 }}>
              <NumInput label="Multiplicador (x) *" value={createForm.payoutMultiplier} onChange={v => setCreateForm(f => ({ ...f, payoutMultiplier: v }))} step={0.1} />
            </View>
          </View>

          <StrInput
            label="Horas de sorteo *"
            value={createForm.drawHours}
            onChange={v => setCreateForm(f => ({ ...f, drawHours: v }))}
            placeholder="12:00,15:00,18:00,21:00"
            hint="Formato 24h, separadas por comas"
          />

          <NumInput
            label="Límite por número (0 = ilimitado)"
            value={createForm.maxSalesPerNumber}
            onChange={v => setCreateForm(f => ({ ...f, maxSalesPerNumber: v }))}
            step={0.01}
          />

          <View style={styles.editGrid}>
            <View style={{ flex: 1 }}>
              <NumInput
                label="Dígitos del número"
                value={createForm.numberDigits}
                onChange={v => {
                  const d = Math.max(1, Math.min(5, parseInt(v, 10) || 2));
                  setCreateForm(f => ({ ...f, numberDigits: d, maxNumber: Math.pow(10, d) - 1 }));
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <NumInput label="Número mínimo" value={createForm.minNumber} onChange={v => setCreateForm(f => ({ ...f, minNumber: parseInt(v, 10) || 0 }))} />
            </View>
            <View style={{ flex: 1 }}>
              <NumInput label="Número máximo" value={createForm.maxNumber} onChange={v => setCreateForm(f => ({ ...f, maxNumber: parseInt(v, 10) || 99 }))} />
            </View>
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Permitir venta por rango</Text>
            </View>
            <Switch
              value={createForm.allowSeries}
              onValueChange={v => setCreateForm(f => ({ ...f, allowSeries: v }))}
              trackColor={{ false: '#374151', true: COLORS.primaryLight }}
              thumbColor={createForm.allowSeries ? COLORS.primary : '#9ca3af'}
            />
          </View>

          <StrInput
            label="Descripción"
            value={createForm.description}
            onChange={v => setCreateForm(f => ({ ...f, description: v }))}
            placeholder="Sorteo diario personalizado de 2 dígitos"
            autoCapitalize="sentences"
          />

          <TouchableOpacity
            style={[styles.saveBtn, { marginTop: 8 }, creating && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={creating}
          >
            {creating
              ? <ActivityIndicator size="small" color="#fff" />
              : <View style={styles.btnInner}><Plus size={14} color="#fff" /><Text style={styles.saveBtnText}>Crear Juego</Text></View>}
          </TouchableOpacity>
        </GlassCard>
      )}
    </View>
  );
};

// ─── Tab: Números bloqueados ──────────────────────────────────
const NumbersTab = ({ lotteries }) => {
  const [selectedGame, setSelectedGame] = useState(lotteries[0]?.id || '');
  const [blocked, setBlocked] = useState([]);
  const [newNum, setNewNum] = useState(lotteries[0]?.id === 'fechea' ? '01/01' : '');
  const [loading, setLoading] = useState(false);

  const handleSelectGame = (gameId) => {
    setSelectedGame(gameId);
    setNewNum(gameId === 'fechea' ? '01/01' : '');
  };

  const load = useCallback(async () => {
    if (!selectedGame) return;
    setLoading(true);
    try {
      const { blocked: b } = await api.get(`/blocked.php?lottery_id=${selectedGame}`);
      setBlocked(b || []);
    } catch {}
    finally { setLoading(false); }
  }, [selectedGame]);

  useEffect(() => { load(); }, [load]);

  const handleBlock = async () => {
    const val = newNum.trim() || (selectedGame === 'fechea' ? '01/01' : '');
    if (!val) {
      Alert.alert('Requerido', 'Ingrese un número a bloquear.');
      return;
    }
    try {
      await api.post('/blocked.php', { lottery_id: selectedGame, numero: val });
      setNewNum(selectedGame === 'fechea' ? '01/01' : '');
      load();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleUnblock = async (num) => {
    try {
      await api.delete(`/blocked.php?lottery_id=${selectedGame}&numero=${encodeURIComponent(num)}`);
      load();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      '¿Desbloquear todos?',
      'Se eliminarán todos los bloqueos de este juego.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desbloquear',
          onPress: async () => {
            try {
              await api.delete(`/blocked.php?lottery_id=${selectedGame}&clear=1`);
              load();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const lottery = lotteries.find(l => l.id === selectedGame);

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.tabDesc}>Cierra números para que no puedan venderse en un juego específico.</Text>

      {/* Selector de juego */}
      <GlassCard style={styles.innerCard}>
        <Text style={styles.fieldLabel}>Juego</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
          {lotteries.map(l => (
            <TouchableOpacity
               key={l.id}
               style={[styles.gameChip, selectedGame === l.id && styles.gameChipActive]}
               onPress={() => handleSelectGame(l.id)}
            >
              {l.emoji ? <Text style={{ fontSize: 14 }}>{l.emoji}</Text> : null}
              <Text style={[styles.gameChipText, selectedGame === l.id && styles.gameChipTextActive]}>{l.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </GlassCard>

      {/* Agregar número */}
      <GlassCard style={styles.innerCard}>
        <Text style={styles.fieldLabel}>{selectedGame === 'fechea' ? 'Bloquear fecha' : 'Bloquear número'}</Text>
        <View style={[styles.blockRow, selectedGame === 'fechea' && { flexDirection: 'column', alignItems: 'stretch' }]}>
          {selectedGame === 'fechea' ? (
            <View style={{ marginBottom: 10 }}>
              <FecheaPicker value={newNum || '01/01'} onChange={setNewNum} />
            </View>
          ) : (
            <TextInput
              style={[fi.input, { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' }]}
              value={newNum}
              onChangeText={setNewNum}
              placeholder={lottery?.numberRange ? `${lottery.minNumber || 0}–${lottery.maxNumber || 99}` : 'Número'}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
            />
          )}
          <TouchableOpacity 
            style={[styles.blockBtn, selectedGame === 'fechea' && { width: '100%', height: 40, marginTop: 4 }]} 
            onPress={handleBlock}
          >
            <Lock size={15} color="#fff" />
            <Text style={styles.blockBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>

      {/* Lista de bloqueados */}
      <GlassCard style={styles.innerCard}>
        <View style={styles.blockedHeader}>
          <Text style={styles.fieldLabel}>{selectedGame === 'fechea' ? 'Fechas cerradas' : 'Números cerrados'} ({blocked.length})</Text>
          {blocked.length > 0 && (
            <TouchableOpacity onPress={handleClearAll}>
              <View style={styles.btnInner}>
                <Unlock size={12} color={COLORS.dangerLight} />
                <Text style={{ fontSize: 11, color: COLORS.dangerLight, fontWeight: '700' }}>Desbloquear todos</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        {loading
          ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
          : blocked.length === 0
            ? <Text style={styles.emptyText}>{selectedGame === 'fechea' ? 'No hay fechas cerradas' : 'No hay números cerrados'}</Text>
            : (
              <View style={styles.blockedChips}>
                {blocked.map(num => (
                  <View key={num} style={styles.blockedChip}>
                    <Text style={styles.blockedChipText}>{selectedGame === 'fechea' ? formatFecheaDate(num) : num}</Text>
                    <TouchableOpacity onPress={() => handleUnblock(num)}>
                      <X size={12} color="#f87171" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
      </GlassCard>
    </View>
  );
};

// ─── Helpers para Resultados ──────────────────────────────────
const formatDrawDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateStr;
};

const formatFecheaDate = (str) => {
  if (!str || typeof str !== 'string') return '—';
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const parts = str.split('/');
  if (parts.length === 2) {
    const m = parseInt(parts[1], 10);
    return `${parts[0]} ${months[(m - 1)] || parts[1]}`;
  }
  return str;
};

// ─── Selector Día/Mes para Ganador de Fechea ─────────────────
const FecheaPicker = ({ value, onChange }) => {
  const parts = (value || '').split('/');
  const currentDay = parts[0] || '01';
  const currentMonth = parts[1] || '01';

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  return (
    <View style={styles.fecheaRow}>
      <View style={styles.fecheaPicker}>
        <Text style={styles.fecheaLabel}>Día</Text>
        <ScrollView style={styles.fecheaScroll} nestedScrollEnabled>
          {days.map(d => (
            <TouchableOpacity
              key={d}
              onPress={() => onChange(`${d}/${currentMonth || '01'}`)}
              style={[styles.fecheaOpt, currentDay === d && styles.fecheaOptActive]}
            >
              <Text style={[styles.fecheaOptText, currentDay === d && styles.fecheaOptTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.fecheaPicker}>
        <Text style={styles.fecheaLabel}>Mes</Text>
        <ScrollView style={styles.fecheaScroll} nestedScrollEnabled>
          {monthNames.map((label, idx) => {
            const mVal = String(idx + 1).padStart(2, '0');
            return (
              <TouchableOpacity
                key={mVal}
                onPress={() => onChange(`${currentDay || '01'}/${mVal}`)}
                style={[styles.fecheaOpt, currentMonth === mVal && styles.fecheaOptActive]}
              >
                <Text style={[styles.fecheaOptText, currentMonth === mVal && styles.fecheaOptTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

// ─── Selector Día/Mes/Año para Fecha del Sorteo ──────────────
const DrawDatePicker = ({ value, onChange }) => {
  const today = new Date();
  const todayYear  = String(today.getFullYear());
  const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
  const todayDay   = String(today.getDate()).padStart(2, '0');
  const todayStr   = `${todayYear}-${todayMonth}-${todayDay}`;

  const parts = (value || '').split('-');
  const currentYear  = parts[0] || todayYear;
  const currentMonth = parts[1] || todayMonth;
  const currentDay   = parts[2] || todayDay;

  // Generar años: año anterior, actual y próximo
  const currentYearNum = today.getFullYear();
  const years = [String(currentYearNum - 1), String(currentYearNum), String(currentYearNum + 1)];

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Altura de cada opción: paddingVertical 6 + lineHeight ~13 ≈ 25px
  const ITEM_H = 25;

  const dayRef   = React.useRef(null);
  const monthRef = React.useRef(null);
  const yearRef  = React.useRef(null);

  // Auto-scroll al item activo al montar / cuando cambia el valor
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const dayIdx   = days.indexOf(currentDay);
      const monthIdx = parseInt(currentMonth, 10) - 1;
      const yearIdx  = years.indexOf(currentYear);

      if (dayRef.current   && dayIdx   >= 0) dayRef.current.scrollTo({ y: Math.max(0, dayIdx * ITEM_H - ITEM_H), animated: false });
      if (monthRef.current && monthIdx >= 0) monthRef.current.scrollTo({ y: Math.max(0, monthIdx * ITEM_H - ITEM_H), animated: false });
      if (yearRef.current  && yearIdx  >= 0) yearRef.current.scrollTo({ y: Math.max(0, yearIdx  * ITEM_H - ITEM_H), animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [currentDay, currentMonth, currentYear]);

  // Validar y cambiar fecha — solo se permite el día de hoy
  const handleChange = (newDate) => {
    if (newDate < todayStr) {
      Alert.alert(
        '📅 Fecha no permitida',
        'No se pueden anunciar ganadores de sorteos pasados. Solo puede anunciar el sorteo del día de hoy.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    if (newDate > todayStr) {
      Alert.alert(
        '📅 Fecha no permitida',
        'No se pueden anunciar ganadores de sorteos futuros. Solo puede anunciar el sorteo del día de hoy.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    onChange(newDate);
  };

  return (
    <View style={styles.fecheaRow}>
      <View style={styles.fecheaPicker}>
        <Text style={styles.fecheaLabel}>Día</Text>
        <ScrollView ref={dayRef} style={styles.fecheaScroll} nestedScrollEnabled>
          {days.map(d => {
            const candidate = `${currentYear}-${currentMonth}-${d}`;
            const isToday = candidate === todayStr;
            const isPast = candidate < todayStr;
            const isFuture = candidate > todayStr;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => handleChange(candidate)}
                style={[
                  styles.fecheaOpt,
                  currentDay === d && styles.fecheaOptActive,
                  (isPast || isFuture) && { opacity: 0.35 },
                ]}
              >
                <Text style={[styles.fecheaOptText, currentDay === d && styles.fecheaOptTextActive]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.fecheaPicker}>
        <Text style={styles.fecheaLabel}>Mes</Text>
        <ScrollView ref={monthRef} style={styles.fecheaScroll} nestedScrollEnabled>
          {monthNames.map((label, idx) => {
            const mVal = String(idx + 1).padStart(2, '0');
            const candidateMonth = `${currentYear}-${mVal}`;
            const todayMonth2    = `${todayYear}-${todayMonth}`;
            const dimmed = candidateMonth !== todayMonth2;
            return (
              <TouchableOpacity
                key={mVal}
                onPress={() => handleChange(`${currentYear}-${mVal}-${currentDay}`)}
                style={[
                  styles.fecheaOpt,
                  currentMonth === mVal && styles.fecheaOptActive,
                  dimmed && { opacity: 0.35 },
                ]}
              >
                <Text style={[styles.fecheaOptText, currentMonth === mVal && styles.fecheaOptTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.fecheaPicker}>
        <Text style={styles.fecheaLabel}>Año</Text>
        <ScrollView ref={yearRef} style={styles.fecheaScroll} nestedScrollEnabled>
          {years.map(y => {
            const dimmed = y !== todayYear;
            return (
              <TouchableOpacity
                key={y}
                onPress={() => handleChange(`${y}-${currentMonth}-${currentDay}`)}
                style={[
                  styles.fecheaOpt,
                  currentYear === y && styles.fecheaOptActive,
                  dimmed && { opacity: 0.35 },
                ]}
              >
                <Text style={[styles.fecheaOptText, currentYear === y && styles.fecheaOptTextActive]}>{y}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};


// ─── Tab: Ganadores / Resultados ─────────────────────────────



const ResultsTab = ({ lotteries }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    lotteryId: lotteries[0]?.id || '',
    date: new Date().toLocaleDateString('sv-SE'),
    hour: '12:00',
    numero: lotteries[0]?.id === 'fechea' ? '01/01' : '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showHourPicker, setShowHourPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { results: r } = await api.get('/results.php');
      setResults(r || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAnnounce = async () => {
    if (!form.lotteryId || !form.numero.trim() || !form.date || !form.hour) {
      Alert.alert('Requerido', 'Complete todos los campos.');
      return;
    }

    const game = lotteries.find(l => l.id === form.lotteryId);
    const displayNum = form.lotteryId === 'fechea' ? formatFecheaDate(form.numero) : form.numero.trim();

    // Primera confirmación
    Alert.alert(
      'Anunciar Ganador - Paso 1',
      `¿Deseas anunciar el número "${displayNum}" como ganador en ${game?.name || form.lotteryId} para el sorteo del ${formatDrawDate(form.date)} a las ${formatHourAmPm(form.hour)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Siguiente',
          onPress: () => {
            // Segunda confirmación
            Alert.alert(
              '⚠️ SEGUNDA VERIFICACIÓN - Paso 2',
              `¡ATENCIÓN! Al confirmar se marcarán todos los boletos ganadores automáticamente y se pagarán los premios. ¿Confirmar anuncio definitivo del ganador?`,
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Confirmar Anuncio',
                  style: 'destructive',
                  onPress: submitAnnounce
                }
              ]
            );
          }
        }
      ]
    );
  };

  const submitAnnounce = async () => {
    setSubmitting(true);
    try {
      const response = await api.post('/results.php', {
        lotteryId:     form.lotteryId,
        fechaSorteo:   form.date,
        horaSorteo:    form.hour,
        numeroGanador: form.numero.trim(),
      });
      const winnersCount = response && response.winners ? response.winners.length : 0;
      Alert.alert(
        '✅ Éxito',
        `Resultado anunciado. Los ganadores fueron marcados automáticamente.\n\nBoletos ganadores: ${winnersCount}`
      );
      setForm(f => ({ ...f, numero: f.lotteryId === 'fechea' ? '01/01' : '' }));
      await load();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (res) => {
    const isFecheaRes = (res.lotteryId || res.lottery_id) === 'fechea';
    const displayNum = isFecheaRes 
      ? formatFecheaDate(res.numero_ganador || res.numeroGanador) 
      : `#${res.numero_ganador || res.numeroGanador}`;

    Alert.alert(
      'Eliminar Resultado',
      `¿Eliminar el resultado ${res.lottery_name || res.lotteryId} - ${displayNum}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/results.php?id=${res.id}`);
              await load();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const lottery = lotteries.find(l => l.id === form.lotteryId);
  const lotteryHours = lottery?.drawHours
    ? lottery.drawHours.split(',').map(h => h.trim()).filter(Boolean)
    : ['12:00', '15:00', '18:00', '21:00'];

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.tabDesc}>Anuncia ganadores de sorteos. Se marcarán los boletos ganadores automáticamente.</Text>

      {/* Formulario de anuncio */}
      <GlassCard style={styles.innerCard}>
        <Text style={[styles.fieldLabel, { marginBottom: 10 }]}>Anunciar Ganador</Text>

        {/* Juego */}
        <Text style={styles.fieldLabel}>Juego</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
          {lotteries.map(l => (
            <TouchableOpacity
              key={l.id}
              style={[styles.gameChip, form.lotteryId === l.id && styles.gameChipActive]}
              onPress={() => setForm(f => ({ ...f, lotteryId: l.id, hour: '12:00', numero: l.id === 'fechea' ? '01/01' : '' }))}
            >
              {l.emoji ? <Text style={{ fontSize: 14 }}>{l.emoji}</Text> : null}
              <Text style={[styles.gameChipText, form.lotteryId === l.id && styles.gameChipTextActive]}>{l.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Fecha */}
        <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>Fecha del sorteo</Text>
        <TouchableOpacity
          style={styles.dropdownTrigger}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.dropdownTriggerText}>{formatDrawDate(form.date)}</Text>
          <ChevronLeft size={16} color={COLORS.textSecondary} style={{ transform: [{ rotate: '-90deg' }] }} />
        </TouchableOpacity>

        {/* Modal Dropdown para Fecha (Día, Mes, Año) */}
        <Modal visible={showDatePicker} transparent animationType="fade">
          <TouchableOpacity
            style={styles.passModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
          >
            <GlassCard style={[styles.passModalCard, { maxWidth: 320 }]}>
              <Text style={[styles.passModalTitle, { marginBottom: 15 }]}>Seleccionar Fecha de Sorteo</Text>
              
              <DrawDatePicker 
                value={form.date} 
                onChange={(newDate) => setForm(f => ({ ...f, date: newDate }))} 
              />
              
              <TouchableOpacity
                style={[styles.saveBtn, { marginTop: 15 }]}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.saveBtnText}>Aceptar</Text>
              </TouchableOpacity>
            </GlassCard>
          </TouchableOpacity>
        </Modal>

        {/* Hora */}
        <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>Hora del sorteo</Text>
        <TouchableOpacity
          style={styles.dropdownTrigger}
          onPress={() => setShowHourPicker(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.dropdownTriggerText}>{formatHourAmPm(form.hour)}</Text>
          <ChevronLeft size={16} color={COLORS.textSecondary} style={{ transform: [{ rotate: '-90deg' }] }} />
        </TouchableOpacity>

        {/* Modal Dropdown para Horas */}
        <Modal visible={showHourPicker} transparent animationType="fade">
          <TouchableOpacity
            style={styles.passModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowHourPicker(false)}
          >
            <GlassCard style={styles.passModalCard}>
              <Text style={[styles.passModalTitle, { marginBottom: 10 }]}>Seleccionar Hora de Sorteo</Text>
              {lotteryHours.map(h => (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.dropdownOption,
                    form.hour === h && styles.dropdownOptionActive
                  ]}
                  onPress={() => {
                    setForm(f => ({ ...f, hour: h }));
                    setShowHourPicker(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownOptionText,
                    form.hour === h && styles.dropdownOptionTextActive
                  ]}>
                    {formatHourAmPm(h)}
                  </Text>
                </TouchableOpacity>
              ))}
            </GlassCard>
          </TouchableOpacity>
        </Modal>

        {/* Número ganador o Fecha Ganadora */}
        {form.lotteryId === 'fechea' ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.fieldLabel}>Fecha Ganadora (Día/Mes)</Text>
            <View style={{ marginTop: 6 }}>
              <FecheaPicker
                value={form.numero || '01/01'}
                onChange={val => setForm(f => ({ ...f, numero: val }))}
              />
            </View>
          </View>
        ) : (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.fieldLabel}>Número Ganador</Text>
            <TextInput
              style={{
                height: 48,
                backgroundColor: '#111827',
                borderRadius: RADIUS.sm,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: 24,
                fontWeight: '900',
                textAlign: 'center',
              }}
              value={form.numero}
              onChangeText={v => setForm(f => ({ ...f, numero: v }))}
              placeholder="00"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
          onPress={handleAnnounce}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#fff" />
            : <View style={styles.btnInner}><Trophy size={14} color="#fff" /><Text style={styles.saveBtnText}>Anunciar Ganador</Text></View>}
        </TouchableOpacity>
      </GlassCard>

      {/* Historial de resultados */}
      <Text style={[styles.fieldLabel, { paddingHorizontal: 4 }]}>Historial reciente ({results.length})</Text>
      {loading
        ? <ActivityIndicator color={COLORS.primary} />
        : results.slice(0, 20).map(res => {
          const isFecheaRes = (res.lotteryId || res.lottery_id) === 'fechea';
          const displayResNum = isFecheaRes 
            ? formatFecheaDate(res.numero_ganador || res.numeroGanador) 
            : `#${res.numero_ganador || res.numeroGanador}`;
          return (
            <GlassCard key={res.id} style={[styles.innerCard, { paddingVertical: 10 }]}>
              <View style={styles.resultRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultGame}>{res.lottery_name || res.lotteryId}</Text>
                  <Text style={styles.resultMeta}>
                    {formatDrawDate(res.fecha_sorteo || res.fechaSorteo)} · {formatHourAmPm(res.hora_sorteo || res.horaSorteo)}
                  </Text>
                </View>
                <Text style={styles.resultNumber}>{displayResNum}</Text>
                <TouchableOpacity onPress={() => handleDelete(res)} style={{ padding: 4 }}>
                  <Trash2 size={14} color={COLORS.dangerLight} />
                </TouchableOpacity>
              </View>
            </GlassCard>
          );
        })}
    </View>
  );
};

const generatePreviewUsername = (fullName, existingUsers = []) => {
  let normalized = fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  normalized = normalized.replace(/[^a-z0-9\s]/g, "");
  const parts = normalized.split(/\s+/).filter(Boolean);
  
  if (parts.length < 2) return '';
  
  const firstName = parts[0];
  let lastName = '';
  if (parts.length === 2) {
    lastName = parts[1];
  } else if (parts.length === 3) {
    lastName = parts[1]; // primer apellido
  } else {
    lastName = parts[2]; // primer apellido asumiendo 2 nombres
  }
  
  const f = firstName;
  const l = lastName;
  
  const exists = (uname) => existingUsers.some(u => u.username?.toLowerCase() === uname.toLowerCase());
  
  // 1. Primera letra del nombre + apellido
  let candidate = f.charAt(0) + l;
  if (!exists(candidate)) return candidate;
  
  // 2. Dos letras del nombre + apellido
  if (f.length >= 2) {
    candidate = f.substring(0, 2) + l;
    if (!exists(candidate)) return candidate;
  }
  
  // 3. Dos letras del nombre + punto + apellido
  if (f.length >= 2) {
    candidate = f.substring(0, 2) + '.' + l;
    if (!exists(candidate)) return candidate;
  }
  
  // 4. Secuencial
  let i = 1;
  while (true) {
    candidate = f.substring(0, 2) + '.' + l + i;
    if (!exists(candidate)) return candidate;
    i++;
  }
};

// ─── Tab: Usuarios ────────────────────────────────────────────
const UsersTab = () => {
  const { getUsers, createUser, updateUser, deleteUser, user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'vendedor' });
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleNameChange = (val) => {
    const generated = generatePreviewUsername(val, users);
    setForm(f => ({ ...f, name: val, username: generated }));
  };

  // Estados para edición
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', password: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers((await getUsers()) || []); }
    catch { Alert.alert('Error', 'No se cargaron los usuarios.'); }
    finally { setLoading(false); }
  }, [getUsers]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (u) => {
    setEditingId(u.id);
    setEditForm({ name: u.name, password: '' });
  };

  const handleSaveEdit = async (userId) => {
    if (!editForm.name.trim()) {
      Alert.alert('Requerido', 'El nombre completo es requerido.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { name: editForm.name.trim() };
      if (editForm.password) {
        if (editForm.password.length < 6) {
          Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
          setSubmitting(false);
          return;
        }
        payload.password = editForm.password;
      }
      await updateUser(userId, payload);
      Alert.alert('Éxito', 'Usuario actualizado.');
      setEditingId(null);
      await load();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!form.password || !form.name.trim()) {
      Alert.alert('Requerido', 'Complete nombre y contraseña.');
      return;
    }
    const parts = form.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      Alert.alert('Requerido', 'Debe colocar al menos un apellido.');
      return;
    }
    setSubmitting(true);
    try {
      await createUser(form);
      Alert.alert('Éxito', 'Usuario creado.');
      setForm({ password: '', name: '', role: 'vendedor' });
      setShowForm(false);
      await load();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (u) => {
    if (u.id === me?.id) {
      Alert.alert('Aviso', 'No puedes desactivarte a ti mismo.');
      return;
    }
    try {
      await updateUser(u.id, { active: Number(u.active) === 1 ? 0 : 1 });
      await load();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDelete = (u) => {
    if (u.id === me?.id) { Alert.alert('No permitido', 'No puedes eliminarte a ti mismo.'); return; }
    Alert.alert(
      'Eliminar Usuario',
      `¿Eliminar a "${u.username}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try { await deleteUser(u.id); await load(); }
            catch (err) { Alert.alert('Error', err.message); }
          },
        },
      ]
    );
  };

  return (
    <View style={{ gap: 10 }}>
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: showForm ? '#374151' : COLORS.primary }]}
        onPress={() => setShowForm(v => !v)}
        activeOpacity={0.8}
      >
        <View style={styles.btnInner}>
          {showForm ? (
            <X size={15} color="#fff" />
          ) : (
            <UserPlus size={15} color="#fff" />
          )}
          <Text style={styles.saveBtnText}>
            {showForm ? 'Cancelar' : 'Agregar Usuario'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Formulario de creación */}
      {showForm && (
        <GlassCard style={styles.innerCard}>
          <Text style={[styles.fieldLabel, { marginBottom: 10, fontSize: 12 }]}>Nuevo Usuario</Text>
          <StrInput label="Nombre completo" value={form.name} onChange={handleNameChange} placeholder="María García" autoCapitalize="words" autoFocus />
          <View style={fi.group}>
            <Text style={fi.label}>Nombre de usuario (automático)</Text>
            <TextInput
              style={[fi.input, { backgroundColor: 'rgba(255,255,255,0.03)', color: COLORS.textMuted, fontWeight: '700' }]}
              value={form.username ? `@${form.username}` : ''}
              editable={false}
            />
          </View>
          <View style={fi.group}>
            <Text style={fi.label}>Contraseña</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={[fi.input, { flex: 1 }]}
                value={form.password}
                onChangeText={v => setForm(f => ({ ...f, password: v }))}
                placeholder="Mínimo 4 caracteres"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={{ padding: 8, marginLeft: 4 }}>
                {showPass ? <EyeOff size={16} color={COLORS.textMuted} /> : <Eye size={16} color={COLORS.textMuted} />}
              </TouchableOpacity>
            </View>
          </View>
          {/* Rol */}
          <Text style={fi.label}>Rol</Text>
          <View style={styles.roleRow}>
            {['vendedor', 'admin'].map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.roleChip, form.role === r && styles.roleChipActive]}
                onPress={() => setForm(f => ({ ...f, role: r }))}
              >
                {r === 'admin' ? <Shield size={12} color={form.role === r ? '#fff' : COLORS.textMuted} /> : <Users size={12} color={form.role === r ? '#fff' : COLORS.textMuted} />}
                <Text style={[styles.roleChipText, form.role === r && styles.roleChipTextActive]}>
                  {r === 'admin' ? 'Admin' : 'Vendedor'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { marginTop: 12 }, submitting && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <View style={styles.btnInner}><UserPlus size={14} color="#fff" /><Text style={styles.saveBtnText}>Crear Usuario</Text></View>}
          </TouchableOpacity>
        </GlassCard>
      )}

      {/* Lista de usuarios */}
      {loading
        ? <ActivityIndicator color={COLORS.primary} />
        : users.map(u => (
          <GlassCard key={u.id} style={[styles.innerCard, { opacity: u.active ? 1 : 0.65 }]}>
            {editingId === u.id ? (
              <View style={{ gap: 8 }}>
                <Text style={[styles.fieldLabel, { color: COLORS.primaryLight, marginBottom: 4 }]}>Editar Usuario</Text>
                <StrInput label="Nombre completo" value={editForm.name} onChange={v => setEditForm(f => ({ ...f, name: v }))} placeholder="Nombre" autoCapitalize="words" autoFocus />
                <StrInput label="Nueva contraseña (opcional)" value={editForm.password} onChange={v => setEditForm(f => ({ ...f, password: v }))} placeholder="Dejar en blanco para no cambiar" secureTextEntry />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingId(null)}>
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveEdit(u.id)}>
                    <Text style={styles.saveBtnText}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.userRow}>
                <View style={[styles.userIcon, u.role === 'admin' ? styles.userIconAdmin : styles.userIconVendor]}>
                  {u.role === 'admin' ? <Shield size={16} color="#a78bfa" /> : <Users size={16} color="#60a5fa" />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.userName}>{u.name}</Text>
                    {u.id === me?.id && <View style={styles.meBadge}><Text style={styles.meBadgeText}>Tú</Text></View>}
                    {!u.active && <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>Inactivo</Text></View>}
                  </View>
                  <Text style={styles.userSub}>@{u.username} · {u.role === 'admin' ? 'Administrador' : 'Vendedor'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <TouchableOpacity onPress={() => startEdit(u)} style={{ padding: 6 }}>
                    <Edit3 size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleToggleActive(u)} activeOpacity={0.7}>
                    {Number(u.active) === 1
                      ? <ToggleRight size={30} color={COLORS.successLight} />
                      : <ToggleLeft size={30} color={COLORS.textMuted} />}
                  </TouchableOpacity>
                  {u.id !== me?.id && (
                    <TouchableOpacity onPress={() => handleDelete(u)} style={{ padding: 6 }}>
                      <Trash2 size={14} color={COLORS.dangerLight} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </GlassCard>
        ))}
    </View>
  );
};

const getDefaultDatesForUser = (user) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const format = (d) => d.toISOString().split('T')[0];

  if (!user || user.salary_period === 'daily') {
    return { start: format(now), end: format(now) };
  }
  if (user.salary_period === 'weekly') {
    const past = new Date();
    past.setDate(now.getDate() - 6);
    return { start: format(past), end: format(now) };
  }
  if (user.salary_period === 'fortnightly') {
    const day = now.getDate();
    if (day <= 15) {
      const start = new Date(year, month, 1);
      const end = new Date(year, month, 15);
      return { start: format(start), end: format(end) };
    } else {
      const start = new Date(year, month, 16);
      const end = new Date(year, month + 1, 0);
      return { start: format(start), end: format(end) };
    }
  }
  if (user.salary_period === 'monthly') {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return { start: format(start), end: format(end) };
  }
  return { start: format(now), end: format(now) };
};

const SalariesTab = () => {
  const { updateUser } = useAuth();
  const [report, setReport] = useState([]);
  const [paymentsHistory, setPaymentsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  // Para la edición de salarios
  const [editingSalary, setEditingSalary] = useState({}); // { [userId]: { type, value, period } }
  const [savingId, setSavingId] = useState(null);

  const fetchReport = useCallback(async (sDate, eDate, showToast = false) => {
    setLoading(true);
    try {
      const res = await api.get(`/users.php?report=1&start_date=${sDate}&end_date=${eDate}`);
      const rData = res.report || [];
      setReport(rData);
      setPaymentsHistory(res.payments || []);

      // Auto-seleccionar primer usuario si no hay ninguno seleccionado o ya no existe
      setSelectedUserId(prev => {
        if (prev && rData.some(u => u.id === prev)) {
          return prev;
        }
        return rData.length > 0 ? rData[0].id : null;
      });

      if (showToast) {
        Alert.alert('Éxito', 'Reporte de salarios actualizado');
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo cargar el reporte: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const [prevSelectedUserId, setPrevSelectedUserId] = useState(null);

  // Carga inicial
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDateInput(today);
    setEndDateInput(today);
    fetchReport(today, today);
  }, [fetchReport]);

  // Al cambiar el vendedor seleccionado, resetear las fechas de consulta a su periodo por defecto
  useEffect(() => {
    if (report.length === 0) return;
    const activeUserId = selectedUserId || report[0].id;
    if (activeUserId !== prevSelectedUserId) {
      setPrevSelectedUserId(activeUserId);
      const u = report.find(x => x.id === activeUserId);
      if (u) {
        const dates = getDefaultDatesForUser(u);
        setStartDateInput(dates.start);
        setEndDateInput(dates.end);
        fetchReport(dates.start, dates.end);
      }
    }
  }, [selectedUserId, report, prevSelectedUserId, fetchReport]);

  const handleQuery = () => {
    if (startDateInput > endDateInput) {
      Alert.alert('Error', "La fecha 'Desde' tiene que ser menor o igual que la fecha 'Hasta'.");
      return;
    }
    fetchReport(startDateInput, endDateInput, true);
  };

  const handleSaveSalary = async (userId) => {
    const editData = editingSalary[userId];
    if (!editData) return;
    if (editData.value === undefined || editData.value === null || editData.value === '' || editData.value < 0) {
      Alert.alert('Error', 'Ingresa un valor válido para el salario (mínimo 0)');
      return;
    }
    setSavingId(userId);
    try {
      await updateUser(userId, {
        salary_type: editData.type,
        salary_value: parseFloat(editData.value),
        salary_period: editData.period
      });
      Alert.alert('Éxito', 'Salario actualizado con éxito');
      setEditingSalary(prev => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
      await fetchReport(startDateInput, endDateInput);
    } catch (err) {
      Alert.alert('Error', 'No se pudo actualizar el salario: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleCancelEdit = (userId) => {
    setEditingSalary(prev => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
  };

  const startEdit = (user) => {
    setEditingSalary(prev => ({
      ...prev,
      [user.id]: {
        type: user.salary_type || 'percentage',
        value: parseFloat(user.salary_value !== undefined ? user.salary_value : 10.00),
        period: user.salary_period || 'daily'
      }
    }));
  };

  if (loading) {
    return (
      <View style={styles.loaderBox}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={{ color: COLORS.textSecondary, marginTop: 10, fontSize: 13 }}>Cargando reporte de salarios...</Text>
      </View>
    );
  }

  if (report.length === 0) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: COLORS.textMuted }}>No hay usuarios registrados.</Text>
      </View>
    );
  }

  const u = report.find(x => x.id === selectedUserId) || report[0];
  const totalSold = parseFloat(u?.total_sold || 0);
  const ticketsSold = parseInt(u?.tickets_sold_count || 0);
  const prizesTotal = parseFloat(u?.prizes_total || 0);
  const prizesCount = parseInt(u?.prizes_count || 0);
  const daysActive = parseInt(u?.days_active || 0);

  // Calcular salario según tipo y periodo
  let calculatedSalary = 0;
  if (u?.salary_type === 'fixed') {
    if (u?.salary_period === 'daily') {
      calculatedSalary = daysActive * parseFloat(u?.salary_value || 0);
    } else {
      calculatedSalary = parseFloat(u?.salary_value || 0);
    }
  } else {
    calculatedSalary = totalSold * (parseFloat(u?.salary_value || 0) / 100);
  }

  // Total a entregar (caja) = Venta Total - Total Premios
  const totalToDeliver = totalSold - prizesTotal;
  const totalToDeliverMinusSalary = totalToDeliver - calculatedSalary;

  const formatNIO = (val) => {
    const absVal = Math.abs(val);
    const formatted = absVal.toFixed(2);
    return val < 0 ? `-NIO ${formatted}` : `NIO ${formatted}`;
  };

  const editState = editingSalary[u?.id];
  const isEditing = editState !== undefined;

  const isPeriodPaid = paymentsHistory.some(p => 
    p.seller_id === u?.id &&
    !(endDateInput < p.start_date || startDateInput > p.end_date)
  );

  const handlePaySalary = async () => {
    if (isPeriodPaid) {
      Alert.alert('Restringido', 'Este periodo ya ha sido liquidado.');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post('/users.php?pay=1', {
        seller_id: u.id,
        start_date: startDateInput,
        end_date: endDateInput,
        total_sold: totalSold,
        prizes_total: prizesTotal,
        commission_amount: calculatedSalary
      });
      Alert.alert('Éxito', res.message || 'Pago registrado con éxito.');
      await fetchReport(startDateInput, endDateInput);
    } catch (err) {
      Alert.alert('Error', 'No se pudo registrar el pago: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Encabezado descriptivo con botón refrescar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: COLORS.textSecondary, flex: 1, marginRight: 8, lineHeight: 15 }}>
          Supervisa las ventas del día, premios liquidados, comisiones/salarios y balance neto de cada vendedor.
        </Text>
        <TouchableOpacity
          style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#1f2937', borderRadius: RADIUS.sm, flexDirection: 'row', gap: 4, alignItems: 'center' }}
          onPress={() => fetchReport(startDateInput, endDateInput, true)}
        >
          <RefreshCw size={11} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Refrescar</Text>
        </TouchableOpacity>
      </View>

      {/* Carrusel horizontal de vendedores */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
        {report.map(usr => {
          const isSelected = selectedUserId === usr.id;
          return (
            <TouchableOpacity
              key={usr.id}
              style={[
                { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#1f2937', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
                isSelected && { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight }
              ]}
              onPress={() => setSelectedUserId(usr.id)}
            >
              {usr.role === 'admin' ? (
                <Shield size={12} color={isSelected ? '#fff' : '#a78bfa'} />
              ) : (
                <Users size={12} color={isSelected ? '#fff' : '#60a5fa'} />
              )}
              <Text style={{ color: isSelected ? '#fff' : COLORS.textSecondary, fontSize: 12, fontWeight: '700' }}>{usr.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Rango de Consulta de Fechas (Mobile) */}
      <GlassCard style={{ padding: 12, gap: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textSecondary }}>Rango de Consulta</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>Desde</Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#111827',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: 6,
                paddingHorizontal: 8,
                justifyContent: 'center',
                height: 32
              }}
              onPress={() => setShowStartPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 12, color: startDateInput ? '#fff' : COLORS.textMuted }}>
                {startDateInput || 'AAAA-MM-DD'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>Hasta</Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#111827',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: 6,
                paddingHorizontal: 8,
                justifyContent: 'center',
                height: 32
              }}
              onPress={() => setShowEndPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 12, color: endDateInput ? '#fff' : COLORS.textMuted }}>
                {endDateInput || 'AAAA-MM-DD'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={{
              backgroundColor: COLORS.primary,
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 6,
              justifyContent: 'center',
              alignItems: 'center',
              alignSelf: 'flex-end'
            }}
            onPress={handleQuery}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Consultar</Text>
          </TouchableOpacity>
        </View>

        {showStartPicker && (
          <DateTimePicker
            value={startDateInput ? new Date(startDateInput + 'T00:00:00') : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowStartPicker(false);
              if (date) {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                setStartDateInput(`${y}-${m}-${d}`);
              }
            }}
          />
        )}

        {showEndPicker && (
          <DateTimePicker
            value={endDateInput ? new Date(endDateInput + 'T00:00:00') : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowEndPicker(false);
              if (date) {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                setEndDateInput(`${y}-${m}-${d}`);
              }
            }}
          />
        )}
      </GlassCard>

      {/* Tarjeta de Vendedor Activo */}
      {u && (
        <GlassCard style={{ padding: 16, gap: 14, opacity: u.active ? 1 : 0.6 }}>
          {/* Fila del Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={[
                { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
                u.role === 'admin' ? { backgroundColor: 'rgba(168,85,247,0.15)' } : { backgroundColor: 'rgba(96,165,250,0.1)' }
              ]}>
                {u.role === 'admin' ? <Shield size={16} color="#a78bfa" /> : <Users size={16} color="#60a5fa" />}
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontWeight: '800', fontSize: 14, color: '#fff' }}>{u.name}</Text>
                  {!u.active && (
                    <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
                      <Text style={{ fontSize: 8, color: COLORS.dangerLight, fontWeight: '800' }}>Inactivo</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 1 }}>
                  @{u.username} · {u.role === 'admin' ? 'Administrador' : 'Vendedor'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', gap: 4, alignItems: 'center' },
                isEditing && { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }
              ]}
              onPress={() => {
                if (!u.active) {
                  Alert.alert('Restringido', 'Este usuario está inactivo.');
                  return;
                }
                isEditing ? handleCancelEdit(u.id) : startEdit(u);
              }}
              disabled={savingId === u.id}
            >
              <Text style={{ fontSize: 10, color: isEditing ? COLORS.dangerLight : COLORS.textSecondary, fontWeight: '800' }}>
                {isEditing ? 'Cancelar' : 'Establecer Salario'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Formulario de Configuración de Salario Inline */}
          {isEditing && (
            <View style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 12, gap: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.primaryLight }}>Ajustar Salario para {u.name}</Text>
              
              <View style={{ gap: 10 }}>
                {/* Tipo de Salario */}
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 9, color: COLORS.textMuted, fontWeight: '800', textTransform: 'uppercase' }}>Tipo de Salario</Text>
                  <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                    <TouchableOpacity
                      style={[{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 4 }, editState.type === 'percentage' && { backgroundColor: COLORS.primary }]}
                      onPress={() => setEditingSalary(prev => ({ ...prev, [u.id]: { ...prev[u.id], type: 'percentage' } }))}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Porcentaje</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[{ flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 4 }, editState.type === 'fixed' && { backgroundColor: COLORS.primary }]}
                      onPress={() => setEditingSalary(prev => ({ ...prev, [u.id]: { ...prev[u.id], type: 'fixed' } }))}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Fijo</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Frecuencia de Pago */}
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 9, color: COLORS.textMuted, fontWeight: '800', textTransform: 'uppercase' }}>Frecuencia de Pago</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {['daily', 'weekly', 'fortnightly', 'monthly'].map(p => {
                      const labels = { daily: 'Diario', weekly: 'Semanal', fortnightly: 'Quincenal', monthly: 'Mensual' };
                      const isSel = editState.period === p;
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[
                            { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6, backgroundColor: '#111827', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
                            isSel && { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight }
                          ]}
                          onPress={() => setEditingSalary(prev => ({ ...prev, [u.id]: { ...prev[u.id], period: p } }))}
                        >
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '850' }}>{labels[p]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Valor */}
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 9, color: COLORS.textMuted, fontWeight: '800', textTransform: 'uppercase' }}>
                    {editState.type === 'fixed' 
                      ? (editState.period === 'daily' ? 'Monto Diario (NIO)' : 'Monto Periodo (NIO)') 
                      : 'Comisión de Ventas (%)'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', height: 32, paddingHorizontal: 8 }}>
                    {editState.type === 'fixed' && <Text style={{ fontSize: 11, color: COLORS.textMuted, marginRight: 4 }}>NIO</Text>}
                    <TextInput
                      style={{ flex: 1, color: '#fff', fontSize: 12, fontWeight: '700', padding: 0, textAlign: 'right' }}
                      value={String(editState.value ?? '')}
                      onChangeText={val => {
                        const parsed = val === '' ? '' : parseFloat(val);
                        setEditingSalary(prev => ({ ...prev, [u.id]: { ...prev[u.id], value: parsed } }));
                      }}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textMuted}
                    />
                    {editState.type === 'percentage' && <Text style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 4 }}>%</Text>}
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  style={{ flex: 1, height: 34, backgroundColor: COLORS.primary, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => handleSaveSalary(u.id)}
                  disabled={savingId === u.id}
                >
                  {savingId === u.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Guardar</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, height: 34, backgroundColor: '#1f2937', borderRadius: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                  onPress={() => handleCancelEdit(u.id)}
                  disabled={savingId === u.id}
                >
                  <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: '800' }}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Grid de Métricas del Vendedor */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {/* Venta Total */}
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 8 }}>
                <Text style={{ fontSize: 8, color: COLORS.textMuted, fontWeight: '800', textTransform: 'uppercase' }}>Venta Total</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff', marginTop: 2 }}>{formatNIO(totalSold)}</Text>
                <Text style={{ fontSize: 9, color: COLORS.textSecondary, marginTop: 1 }}>{ticketsSold} boletos</Text>
              </View>

              {/* Total Premios */}
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 8 }}>
                <Text style={{ fontSize: 8, color: COLORS.textMuted, fontWeight: '800', textTransform: 'uppercase' }}>Total Premios</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: prizesTotal > 0 ? '#fbbf24' : '#fff', marginTop: 2 }}>{formatNIO(prizesTotal)}</Text>
                <Text style={{ fontSize: 9, color: COLORS.textSecondary, marginTop: 1 }}>{prizesCount} premiados</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {/* Días Activos */}
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 8 }}>
                <Text style={{ fontSize: 8, color: COLORS.textMuted, fontWeight: '800', textTransform: 'uppercase' }}>Días Activos</Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff', marginTop: 2 }}>{daysActive} día{daysActive !== 1 ? 's' : ''}</Text>
                <Text style={{ fontSize: 9, color: COLORS.textSecondary, marginTop: 1 }}>Con ventas en rango</Text>
              </View>

              {/* Salario Configurado */}
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 8 }}>
                <Text style={{ fontSize: 8, color: COLORS.textMuted, fontWeight: '800', textTransform: 'uppercase' }}>Salario Configurado</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.primaryLight, marginTop: 2 }}>
                  {u.salary_type === 'fixed' ? `${u.salary_value} Fijo` : `${u.salary_value}% com.`}
                </Text>
                <Text style={{ fontSize: 8, color: COLORS.textSecondary, marginTop: 1 }}>
                  Frec.: {u.salary_period === 'daily' ? 'Diario' : u.salary_period === 'weekly' ? 'Semanal' : u.salary_period === 'fortnightly' ? 'Quincenal' : 'Mensual'}
                </Text>
              </View>
            </View>
          </View>

          {/* Sueldo / Comisión Total a Pagar (Destacado) */}
          <View style={{
            backgroundColor: 'rgba(124,58,237,0.08)',
            borderWidth: 1.5,
            borderColor: COLORS.primary,
            borderRadius: 8,
            paddingVertical: 10,
            paddingHorizontal: 12,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '850', color: COLORS.primaryLight }}>Total Sueldo a Pagar</Text>
              <Text style={{ fontSize: 8, color: COLORS.textMuted, marginTop: 1 }}>Del {formatDrawDate(startDateInput)} al {formatDrawDate(endDateInput)}</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '900', color: COLORS.primaryLight }}>{formatNIO(calculatedSalary)}</Text>
          </View>

          {/* Resultados de Balance (Efectivo Neto / Caja) */}
          <View style={{ gap: 8, marginTop: 4 }}>
            {/* Total a entregar (Caja) */}
            <View style={[
              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
              totalToDeliver < 0
                ? { backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }
                : { backgroundColor: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }
            ]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>Total a Entregar (Caja)</Text>
                <Text style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 1 }}>Ventas del periodo menos premios pagados</Text>
              </View>
              <Text style={{
                fontSize: 15, fontWeight: '900',
                color: totalToDeliver < 0 ? COLORS.dangerLight : COLORS.successLight
              }}>{formatNIO(totalToDeliver)}</Text>
            </View>

            {/* Total a entregar descontando salario */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'transparent' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textSecondary }}>Neto Descontando Salario</Text>
                <Text style={{ fontSize: 8, color: COLORS.textMuted }}>Balance descontando la comisión/salario del vendedor</Text>
              </View>
              <Text style={{
                fontSize: 13, fontWeight: '800',
                color: totalToDeliverMinusSalary < 0 ? COLORS.dangerLight : COLORS.successLight
              }}>{formatNIO(totalToDeliverMinusSalary)}</Text>
            </View>
          </View>

          {/* Botón para Registrar Pago del Periodo */}
          <View style={{ marginTop: 4 }}>
            {isPeriodPaid ? (
              <View style={{
                backgroundColor: 'rgba(239,68,68,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.25)',
                borderRadius: 8,
                padding: 10,
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Text style={{ color: COLORS.dangerLight, fontSize: 10, fontWeight: '800' }}>
                  ✓ Periodo ya liquidado como pagado
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={{
                  height: 38,
                  backgroundColor: COLORS.primary,
                  borderRadius: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: (calculatedSalary === 0 && totalSold === 0) ? 0.5 : 1
                }}
                disabled={calculatedSalary === 0 && totalSold === 0}
                onPress={handlePaySalary}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                  Registrar Pago del Periodo
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Historial de Pagos de Salarios */}
          <View style={{ marginTop: 10, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingTop: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff', marginBottom: 8 }}>
              Historial de Pagos Registrados
            </Text>
            {(() => {
              const userPayments = paymentsHistory.filter(p => p.seller_id === u.id);
              if (userPayments.length === 0) {
                return (
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, fontStyle: 'italic' }}>
                    No hay pagos registrados para este vendedor.
                  </Text>
                );
              }
              return (
                <View style={{ gap: 6 }}>
                  {userPayments.map(p => (
                    <View key={p.id} style={{
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.05)',
                      borderRadius: 8,
                      padding: 8,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: '#fff', fontSize: 10 }}>
                          Periodo: {formatDrawDate(p.start_date)} al {formatDrawDate(p.end_date)}
                        </Text>
                        <Text style={{ fontSize: 8, color: COLORS.textMuted, marginTop: 2 }}>
                          Ventas: {formatNIO(parseFloat(p.total_sold))} · Premios: {formatNIO(parseFloat(p.prizes_total))}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontWeight: '800', color: COLORS.primaryLight, fontSize: 11 }}>
                          {formatNIO(parseFloat(p.commission_amount))}
                        </Text>
                        <Text style={{ fontSize: 8, color: COLORS.textMuted, marginTop: 2 }}>
                          {new Date(p.paid_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        </GlassCard>
      )}
    </View>
  );
};

// ─── Pantalla principal ───────────────────────────────────────
export const AdminPanelScreen = ({ onNavigate }) => {
  const { lotteries, loadAllData } = useApp();
  const [activeTab, setActiveTab] = useState('games');

  const renderTab = () => {
    switch (activeTab) {
      case 'games':   return <GamesTab lotteries={lotteries} loadAllData={loadAllData} />;
      case 'numbers': return <NumbersTab lotteries={lotteries} />;
      case 'results': return <ResultsTab lotteries={lotteries} />;
      case 'users':   return <UsersTab />;
      case 'salaries': return <SalariesTab />;
      default:        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        {/* NavBar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft size={24} color="#fff" />
            <Text style={styles.navTitle}>Panel Admin</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <HeaderClock />
            <TouchableOpacity onPress={() => loadAllData()} style={{ padding: 8 }}>
              <RefreshCw size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
  
        {/* Tabs */}
        <View style={styles.tabBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
            {TABS.map(({ id, label, Icon }) => (
              <TouchableOpacity
                key={id}
                style={[styles.tabBtn, activeTab === id && styles.tabBtnActive]}
                onPress={() => setActiveTab(id)}
                activeOpacity={0.75}
              >
                <Icon size={14} color={activeTab === id ? '#fff' : COLORS.textMuted} />
                <Text style={[styles.tabBtnText, activeTab === id && styles.tabBtnTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
  
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {renderTab()}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── Estilos ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgBase },
  navBar: {
    height: 56, backgroundColor: '#111827', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', height: '100%' },
  navTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginLeft: 8 },

  tabBar: {
    backgroundColor: '#111827',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: RADIUS.sm,
    backgroundColor: 'transparent',
  },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },
  tabBtnTextActive: { color: '#fff' },

  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingBottom: 48, gap: 8 },

  tabDesc: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },

  loaderBox: { padding: 40, alignItems: 'center' },

  // Game card
  gameCard: { padding: 12 },
  gameCardDisabled: { borderColor: 'rgba(239,68,68,0.15)', opacity: 0.8 },
  gameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  gameIconBox: {
    width: 42, height: 42, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  gameTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  gameName: { fontSize: 14, fontWeight: '800', color: '#fff' },
  gameDesc: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  gameMeta: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, lineHeight: 15 },
  gameActions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  iconBtn: { padding: 6 },

  customBadge: {
    backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
  },
  customBadgeText: { fontSize: 9, color: '#c084fc', fontWeight: '800' },
  disabledBadge: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  disabledBadgeText: { fontSize: 9, color: COLORS.dangerLight, fontWeight: '800' },

  // Edit form
  editForm: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    gap: 0,
  },
  editGrid: { flexDirection: 'row', gap: 10 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: RADIUS.sm,
    padding: 10, marginBottom: 10,
  },
  switchLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
  switchDesc: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  saveBtn: {
    flex: 1, height: 42, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  cancelBtn: {
    flex: 1, height: 42, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1f2937', borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 13 },

  createGameBtn: {
    height: 46, justifyContent: 'center', alignItems: 'center',
    borderRadius: RADIUS.md, backgroundColor: 'rgba(124,58,237,0.08)',
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(124,58,237,0.4)',
  },
  createGameBtnActive: { borderStyle: 'solid', backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.3)' },
  createGameBtnText: { color: '#c084fc', fontWeight: '800', fontSize: 13, marginLeft: 6 },
  createCard: { padding: 14, borderColor: 'rgba(124,58,237,0.3)' },
  createTitle: { fontSize: 14, fontWeight: '800', color: '#c084fc', marginBottom: 12 },

  // Numbers tab
  innerCard: { padding: 12 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  gameChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 32, paddingHorizontal: 12, borderRadius: RADIUS.full,
    backgroundColor: '#1f2937', marginRight: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  gameChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight },
  gameChipText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  gameChipTextActive: { color: '#fff' },
  blockRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  blockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.danger, borderRadius: RADIUS.sm, paddingHorizontal: 14, height: 40,
  },
  blockBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  blockedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  blockedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  blockedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  blockedChipText: { fontSize: 14, fontWeight: '800', color: '#f87171' },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 12 },

  // Results
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultGame: { fontSize: 13, fontWeight: '700', color: '#fff' },
  resultMeta: { fontSize: 11, color: COLORS.textSecondary },
  resultNumber: { fontSize: 20, fontWeight: '900', color: '#fbbf24' },

  // Users
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  userIcon: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  userIconAdmin: { backgroundColor: 'rgba(168,85,247,0.12)' },
  userIconVendor: { backgroundColor: 'rgba(96,165,250,0.1)' },
  userName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  userSub: { fontSize: 11, color: COLORS.textSecondary },
  meBadge: { backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  meBadgeText: { fontSize: 9, color: COLORS.successLight, fontWeight: '800' },
  inactiveBadge: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  inactiveBadgeText: { fontSize: 9, color: COLORS.dangerLight, fontWeight: '800' },
  roleRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 4 },
  roleChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    height: 38, borderRadius: RADIUS.sm, backgroundColor: '#1f2937',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  roleChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight },
  roleChipText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '700' },
  roleChipTextActive: { color: '#fff' },

  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Modal de contraseña
  passModalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  passModalCard: { width: '100%', maxWidth: 360, padding: 20 },
  passModalTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  passModalDesc: { fontSize: 12, color: COLORS.textSecondary },

  // Dropdown de Hora de Sorteo
  dropdownTrigger: {
    height: 40,
    backgroundColor: '#111827',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  dropdownTriggerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.sm,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  dropdownOptionActive: {
    backgroundColor: COLORS.primary,
  },
  dropdownOptionText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  dropdownOptionTextActive: {
    color: '#fff',
  },

  // Fechea/DrawDatePicker picker styles
  fecheaRow: { flexDirection: 'row', gap: 8, height: 100, marginTop: 8 },
  fecheaPicker: { flex: 1 },
  fecheaLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 2, textAlign: 'center' },
  fecheaScroll: { backgroundColor: 'rgba(17,24,39,0.7)', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  fecheaOpt: { paddingVertical: 6, alignItems: 'center' },
  fecheaOptActive: { backgroundColor: 'rgba(124,58,237,0.25)' },
  fecheaOptText: { color: COLORS.textSecondary, fontSize: 13 },
  fecheaOptTextActive: { color: COLORS.primaryLight, fontWeight: '800' },
});
