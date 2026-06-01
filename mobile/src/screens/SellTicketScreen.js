// ============================================================
// SellTicketScreen — Pantalla de Ventas para Móvil
// Realiza validaciones estrictas y formatea tickets térmicos
// ============================================================
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { ChevronLeft, Plus, Trash2, Printer } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS, SHADOWS } from '../styles/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomButton } from '../components/CustomButton';
import { validateJugada, formatLotteryNumber } from '../data/lotteryTypes';
import { printTicket } from '../services/printerService';

export const SellTicketScreen = ({ onNavigate }) => {
  const { lotteries, addSale, settings, loading: dataLoading } = useApp();

  const [selectedType, setSelectedType] = useState('');
  const [selectedHour, setSelectedHour] = useState('12:00');
  const [comprador, setComprador] = useState('');
  const [jugadas, setJugadas] = useState([{ id: '1', numero: '', monto: '' }]);
  const [loading, setLoading] = useState(false);

  // Seleccionar la primera lotería activa por defecto
  useEffect(() => {
    const active = lotteries.filter(l => l.enabled !== false);
    if (active.length > 0 && !selectedType) {
      setSelectedType(active[0].id);
    }
  }, [lotteries, selectedType]);

  const activeLottery = lotteries.find(l => l.id === selectedType);
  const isFechea = selectedType === 'fechea';

  // Cambiar de tipo de sorteo restablece jugadas básicas
  const handleTypeChange = (typeId) => {
    setSelectedType(typeId);
    const game = lotteries.find(l => l.id === typeId);
    setJugadas([{ id: '1', numero: '', monto: String(game?.defaultPrice || 100) }]);
  };

  const addLine = () => {
    setJugadas([
      ...jugadas,
      { id: String(Date.now()), numero: '', monto: String(activeLottery?.defaultPrice || 100) }
    ]);
  };

  const removeLine = (id) => {
    if (jugadas.length === 1) {
      setJugadas([{ id: '1', numero: '', monto: String(activeLottery?.defaultPrice || 100) }]);
    } else {
      setJugadas(jugadas.filter(j => j.id !== id));
    }
  };

  const updateLine = (id, field, val) => {
    setJugadas(
      jugadas.map(j => j.id === id ? { ...j, [field]: val } : j)
    );
  };

  const totalAmount = jugadas.reduce((sum, j) => sum + parseFloat(j.monto || 0), 0);

  const handleSellPress = async () => {
    if (!activeLottery) return;
    
    // 1. Validar las jugadas estrictamente
    const validatedJugadas = [];
    
    for (let i = 0; i < jugadas.length; i++) {
      const j = jugadas[i];
      const errors = validateJugada(selectedType, {
        numero: j.numero,
        monto: j.monto,
      });

      if (errors.length > 0) {
        Alert.alert(`Fila ${i + 1} - Datos inválidos`, errors[0]);
        return;
      }

      validatedJugadas.push({
        numero: isFechea ? '' : j.numero,
        monto: parseFloat(j.monto),
        fecha: isFechea ? j.numero : '', // Fechea usa la fecha en lugar del número
      });
    }

    setLoading(true);
    try {
      const saleData = {
        lotteryId: selectedType,
        comprador: comprador.trim() || null,
        horaSorteo: selectedHour,
        jugadas: validatedJugadas,
      };

      const sale = await addSale(saleData);

      // Impresión de ticket 80mm
      if (settings.autoprint) {
        await printTicket(sale, settings);
      }

      Alert.alert('Venta Completada', 'Boleto registrado exitosamente en el servidor.', [
        {
          text: 'OK',
          onPress: () => {
            setJugadas([{ id: '1', numero: '', monto: String(activeLottery?.defaultPrice || 100) }]);
            setComprador('');
            onNavigate('dashboard');
          }
        }
      ]);
    } catch (err) {
      // Alertado en Context
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const allowedHours = activeLottery?.drawHours 
    ? activeLottery.drawHours.split(',').map(h => h.trim())
    : ['12:00', '15:00', '18:00', '21:00'];

  return (
    <View style={styles.container}>
      {/* Barra de cabecera */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#fff" />
          <Text style={styles.navTitle}>Venta de Boletos</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Selector de Juego */}
        <Text style={styles.sectionLabel}>Seleccionar Lotería</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gameCarousel}>
          {lotteries.filter(l => l.enabled !== false).map(game => (
            <TouchableOpacity
              key={game.id}
              style={[
                styles.gameTab,
                selectedType === game.id ? styles.gameTabActive : null
              ]}
              onPress={() => handleTypeChange(game.id)}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.gameTabText,
                selectedType === game.id ? styles.gameTabTextActive : null
              ]}>
                {game.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Selector de Hora */}
        <Text style={styles.sectionLabel}>Hora del Sorteo</Text>
        <View style={styles.hoursGrid}>
          {allowedHours.map(hour => (
            <TouchableOpacity
              key={hour}
              style={[
                styles.hourChip,
                selectedHour === hour ? styles.hourChipActive : null
              ]}
              onPress={() => setSelectedHour(hour)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.hourChipText,
                selectedHour === hour ? styles.hourChipTextActive : null
              ]}>
                {hour}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cliente / Comprador */}
        <TextInput
          style={styles.clientInput}
          value={comprador}
          onChangeText={setComprador}
          placeholder="Nombre del comprador (Opcional)"
          placeholderTextColor={COLORS.textMuted}
        />

        {/* Listado de jugadas */}
        <View style={styles.playsHeader}>
          <Text style={styles.sectionLabel}>Jugadas del Boleto</Text>
          <TouchableOpacity onPress={addLine} style={styles.addBtn} activeOpacity={0.7}>
            <Plus size={16} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.addBtnText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        {jugadas.map((jugada, index) => (
          <GlassCard key={jugada.id} style={styles.playCard}>
            <Text style={styles.playIndex}>#{index + 1}</Text>
            
            <View style={styles.playInputsRow}>
              {/* Número o fecha */}
              <View style={styles.numCol}>
                <TextInput
                  style={styles.playInput}
                  value={jugada.numero}
                  onChangeText={(val) => updateLine(jugada.id, 'numero', val)}
                  placeholder={isFechea ? "Día/Mes" : (activeLottery?.numberRange ? `${activeLottery.numberRange.min}-${activeLottery.numberRange.max}` : "0-99")}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType={isFechea ? "default" : "numeric"}
                  textAlign="center"
                  maxLength={isFechea ? 5 : activeLottery?.numberDigits || 2}
                />
              </View>

              {/* Monto */}
              <View style={styles.amountCol}>
                <Text style={styles.currencyPrefix}>{settings.currency}</Text>
                <TextInput
                  style={[styles.playInput, { paddingLeft: 30 }]}
                  value={jugada.monto}
                  onChangeText={(val) => updateLine(jugada.id, 'monto', val)}
                  placeholder="Monto"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  textAlign="left"
                />
              </View>

              {/* Botón borrar */}
              <TouchableOpacity
                onPress={() => removeLine(jugada.id)}
                style={styles.deleteBtn}
                activeOpacity={0.7}
              >
                <Trash2 size={18} color={COLORS.dangerLight} />
              </TouchableOpacity>
            </View>
          </GlassCard>
        ))}

        {/* Resumen e Impresión */}
        <GlassCard style={styles.checkoutCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total del Boleto:</Text>
            <Text style={styles.totalValue}>
              {settings.currency} {parseFloat(totalAmount || 0).toFixed(2)}
            </Text>
          </View>

          <CustomButton
            title="Realizar Venta"
            onPress={handleSellPress}
            loading={loading}
            icon={Printer}
          />
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgBase,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: COLORS.bgBase,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBar: {
    height: 56,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gameCarousel: {
    marginBottom: 16,
  },
  gameTab: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: '#1f2937',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  gameTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryLight,
  },
  gameTabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  gameTabTextActive: {
    color: '#ffffff',
  },
  hoursGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  hourChip: {
    flex: 1,
    minWidth: '22%',
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hourChipActive: {
    backgroundColor: COLORS.info,
  },
  hourChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  hourChipTextActive: {
    color: '#ffffff',
  },
  clientInput: {
    height: 48,
    backgroundColor: '#1f2937',
    borderRadius: RADIUS.md,
    color: '#fff',
    paddingHorizontal: 16,
    fontSize: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 20,
  },
  playsHeader: {
    flexDirection: 'row',
    justifyContent: 'span-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: RADIUS.sm,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  playCard: {
    padding: 12,
    marginVertical: 4,
    position: 'relative',
  },
  playIndex: {
    position: 'absolute',
    left: 8,
    top: 4,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  playInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  numCol: {
    flex: 3,
  },
  amountCol: {
    flex: 4,
    position: 'relative',
    justifyContent: 'center',
  },
  currencyPrefix: {
    position: 'absolute',
    left: 10,
    zIndex: 1,
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  playInput: {
    height: 44,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    borderRadius: RADIUS.sm,
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
  },
  deleteBtn: {
    width: 36,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkoutCard: {
    marginTop: 20,
    padding: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.successLight,
  },
});
