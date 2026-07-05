import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList,
  TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, Platform
} from 'react-native';
import { Trash2, Edit2, X, Calendar, Clock, Save, RefreshCw, AlertTriangle, ShieldAlert, Check } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS, SHADOWS } from '../styles/theme';
import { LOTTERY_LIST } from '../data/lotteryTypes';

export const OfflineSalesQueueModal = ({ isOpen, onClose }) => {
  const {
    offlineQueue, updateOfflineSale, deleteOfflineSale,
    forceSyncSale, syncOfflineDataManual, isServerConnected
  } = useApp();

  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editHour, setEditHour] = useState('');
  const [syncing, setSyncing] = useState(false);
  
  // Date Picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerVal, setDatePickerVal] = useState(new Date());

  const handleDiscard = (id) => {
    Alert.alert(
      'Descartar Boleto',
      '¿Estás seguro de descartar este boleto de la cola local? No se registrará en el servidor.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: async () => {
            await deleteOfflineSale(id);
          }
        }
      ]
    );
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    const itemDate = item.data.drawDate || new Date().toLocaleDateString('sv-SE');
    setEditDate(itemDate);
    setEditHour(item.data.horaSorteo || '12:00');
    
    // Parse date for native picker
    try {
      const parts = itemDate.split('-');
      if (parts.length === 3) {
        setDatePickerVal(new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
      } else {
        setDatePickerVal(new Date());
      }
    } catch {
      setDatePickerVal(new Date());
    }
  };

  const handleSaveEdit = async (id) => {
    if (!editDate || !editHour) {
      Alert.alert('Error', 'Por favor selecciona una fecha y hora válidas.');
      return;
    }

    const item = offlineQueue.find(q => q.id === id);
    if (!item) return;

    const updatedJugadas = (item.data.jugadas || []).map(j => ({
      ...j,
      fecha: editDate,
    }));

    const updatedData = {
      drawDate: editDate,
      horaSorteo: editHour,
      jugadas: updatedJugadas,
    };

    const ok = await updateOfflineSale(id, updatedData);
    if (ok) {
      setEditingId(null);
      Alert.alert('Éxito', 'Boleto reprogramado correctamente. Se intentará sincronizar si hay conexión.');
    } else {
      Alert.alert('Error', 'No se pudo actualizar el boleto.');
    }
  };

  const handleForceSyncItem = async (item) => {
    setSyncing(true);
    await forceSyncSale(item);
    setSyncing(false);
  };

  const triggerSync = async () => {
    setSyncing(true);
    await syncOfflineDataManual();
    setSyncing(false);
  };

  const getLotteryName = (lotteryId) => {
    const lot = LOTTERY_LIST.find(l => l.id === lotteryId);
    return lot ? lot.name : lotteryId;
  };

  const getValidHoursForLottery = (lotteryId) => {
    const lot = LOTTERY_LIST.find(l => l.id === lotteryId);
    return lot && lot.drawHours
      ? lot.drawHours.split(',').map(h => h.trim())
      : ['12:00', '15:00', '18:00', '21:00'];
  };

  const renderItem = ({ item }) => {
    const data = item.data || {};
    const isEditing = editingId === item.id;
    const formattedDate = data.drawDate ? data.drawDate.split('-').reverse().join('/') : '';
    const ticketTotal = (data.jugadas || []).reduce((sum, j) => sum + parseFloat(j.monto || 0), 0);

    const drawDateTimeStr = `${data.drawDate || ''}T${data.horaSorteo || '12:00'}:00-06:00`;
    const drawTime = new Date(drawDateTimeStr).getTime();
    const currentTime = Date.now();
    const isWithin24h = (currentTime - drawTime) <= 24 * 60 * 60 * 1000;
    const hasPassed = currentTime >= drawTime;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.lotteryName}>{getLotteryName(data.lotteryId)}</Text>
            {data.comprador ? (
              <Text style={styles.clientName}>Cliente: {data.comprador}</Text>
            ) : null}
          </View>
          <Text style={styles.amount}>NIO {ticketTotal.toFixed(2)}</Text>
        </View>

        <View style={styles.jugadasBox}>
          <Text style={styles.jugadasText}>
            Números: {(data.jugadas || []).map(j => `${j.numero} (x${Number(j.monto).toFixed(0)})`).join(', ')}
          </Text>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Calendar size={12} color={COLORS.textMuted} />
            <Text style={styles.detailText}>{formattedDate}</Text>
          </View>
          <View style={styles.detailItem}>
            <Clock size={12} color={COLORS.textMuted} />
            <Text style={styles.detailText}>{data.horaSorteo}</Text>
          </View>
        </View>

        {hasPassed && (
          <View style={[
            styles.alertBadge,
            {
              backgroundColor: isWithin24h ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)',
              borderColor: isWithin24h ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)'
            }
          ]}>
            <ShieldAlert size={12} color={isWithin24h ? '#fbbf24' : '#f87171'} />
            <Text style={[styles.alertBadgeText, { color: isWithin24h ? '#fbbf24' : '#f87171' }]}>
              {isWithin24h
                ? 'Sorteo cerrado. Forzar sincronización disponible.'
                : 'Excedió límite 24h. Obligatorio cambiar sorteo.'}
            </Text>
          </View>
        )}

        {item.error && !isEditing && (
          <View style={styles.errorBox}>
            <AlertTriangle size={12} color="#f87171" style={{ marginTop: 2 }} />
            <Text style={styles.errorText}>Error: {item.error}</Text>
          </View>
        )}

        {isEditing && (
          <View style={styles.editBox}>
            <Text style={styles.editTitle}>Reprogramar sorteo:</Text>
            
            <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 }}>
              Monto del boleto: <Text style={{ color: '#fff', fontWeight: '800' }}>NIO {ticketTotal.toFixed(2)}</Text>
            </Text>

            <Text style={styles.label}>Nueva Fecha</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={styles.dateSelectorBtn}
              activeOpacity={0.7}
            >
              <Calendar size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                {editDate ? editDate.split('-').reverse().join('/') : 'Seleccionar Fecha'}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={datePickerVal}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setDatePickerVal(selectedDate);
                    setEditDate(selectedDate.toLocaleDateString('sv-SE'));
                  }
                }}
              />
            )}

            <Text style={styles.label}>Nueva Hora (Selecciona de la lista)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginVertical: 6 }}>
              {getValidHoursForLottery(data.lotteryId).map(h => (
                <TouchableOpacity
                  key={h}
                  onPress={() => setEditHour(h)}
                  style={[
                    styles.hourPill,
                    editHour === h && styles.hourPillActive
                  ]}
                >
                  <Text style={[styles.hourPillText, editHour === h && styles.hourPillTextActive]}>{h}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.editActions}>
              <TouchableOpacity onPress={() => setEditingId(null)} style={styles.btnCancel}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSaveEdit(item.id)} style={styles.btnSave}>
                <Save size={12} color="#fff" />
                <Text style={styles.btnSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!isEditing && (
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => handleDiscard(item.id)} style={styles.actionBtn}>
              <Trash2 size={12} color={COLORS.dangerLight} />
              <Text style={[styles.actionBtnText, { color: COLORS.dangerLight }]}>Descartar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => startEditing(item)} style={styles.actionBtn}>
              <Edit2 size={12} color={COLORS.textSecondary} />
              <Text style={[styles.actionBtnText, { color: COLORS.textSecondary }]}>Cambiar</Text>
            </TouchableOpacity>
            {hasPassed && isWithin24h && (
              <TouchableOpacity
                onPress={() => handleForceSyncItem(item)}
                disabled={!isServerConnected}
                style={[styles.actionBtnPrimary, !isServerConnected && { opacity: 0.5 }]}
              >
                <Check size={12} color="#fff" />
                <Text style={styles.actionBtnPrimaryText}>Forzar Sincro</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={isOpen} onRequestClose={onClose} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Ventas Pendientes ({offlineQueue.length})</Text>
              <Text style={styles.subtitle}>Boletos guardados offline sin subir</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* List */}
          {offlineQueue.length === 0 ? (
            <View style={styles.emptyBox}>
              <Clock size={36} color={COLORS.successLight} />
              <Text style={styles.emptyTitle}>¡Cola limpia!</Text>
              <Text style={styles.emptyText}>No hay ventas pendientes por sincronizar.</Text>
            </View>
          ) : (
            <FlatList
              data={offlineQueue}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 16 }}
            />
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.btnClose}>
              <Text style={styles.btnCloseText}>Cerrar</Text>
            </TouchableOpacity>
            {offlineQueue.length > 0 ? (
              <TouchableOpacity
                onPress={triggerSync}
                disabled={syncing || !isServerConnected}
                style={[
                  styles.btnSync,
                  (!isServerConnected || syncing) && { backgroundColor: 'rgba(255,255,255,0.05)' }
                ]}
              >
                <RefreshCw size={14} color={isServerConnected && !syncing ? '#fff' : COLORS.textMuted} />
                <Text style={[
                  styles.btnSyncText,
                  (!isServerConnected || syncing) && { color: COLORS.textMuted }
                ]}>
                  {syncing ? 'Sincronizando...' : 'Reintentar Todo'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 21, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    ...SHADOWS.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  closeBtn: {
    padding: 4,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  lotteryName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryLight,
  },
  clientName: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  amount: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  jugadasBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginVertical: 4,
  },
  jugadasText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginVertical: 4,
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
    borderRadius: RADIUS.sm,
    padding: 6,
    marginTop: 6,
  },
  errorText: {
    fontSize: 10,
    color: COLORS.dangerLight,
    flex: 1,
    lineHeight: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 8,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
  },
  actionBtnPrimaryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  editBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.md,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  editTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 4,
  },
  dateSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 2,
    marginBottom: 8,
  },
  hourPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 6,
  },
  hourPillActive: {
    backgroundColor: COLORS.primary,
  },
  hourPillText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  hourPillTextActive: {
    color: '#fff',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  btnCancel: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  btnCancelText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  btnSave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
  },
  btnSaveText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 12,
  },
  btnClose: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  btnCloseText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  btnSync: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.lg,
  },
  btnSyncText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '800',
  },
});
