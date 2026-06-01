// ============================================================
// SalesHistoryScreen — Historial de Boletos para Móvil
// Soporta búsquedas, reimpresiones de 80mm y anulación con credenciales
// ============================================================
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { ChevronLeft, Search, RefreshCw, X, Printer, ShieldAlert } from 'lucide-react-native';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS } from '../styles/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomButton } from '../components/CustomButton';
import { FormInput } from '../components/FormInput';
import { printTicket } from '../services/printerService';
import { api } from '../services/apiService';

export const SalesHistoryScreen = ({ onNavigate }) => {
  const { sales, annulSale, paySalePrize, refreshSummary, loadAllData, settings, loading } = useApp();
  const { user } = useAuth();

  const [searchText, setSearchText] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);

  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Filtrar ventas por búsqueda
  const filteredSales = sales.filter(s => {
    const q = searchText.toLowerCase();
    return s.id.toLowerCase().includes(q) || (s.comprador && s.comprador.toLowerCase().includes(q));
  });

  const handleOpenDetail = (sale) => {
    setSelectedSale(sale);
    setDetailVisible(true);
  };

  const handleReprint = async () => {
    if (selectedSale) {
      await printTicket(selectedSale, settings);
    }
  };

  const handleAnnulClick = () => {
    if (user?.role === 'admin') {
      // Admin directo sin solicitar credenciales secundarias
      confirmAnnulment(null);
    } else {
      // Vendedor requiere credenciales de administrador
      setAdminUser('');
      setAdminPass('');
      setAuthVisible(true);
    }
  };

  const handleAdminAuthSubmit = async () => {
    if (!adminUser.trim() || !adminPass) {
      Alert.alert('Campos requeridos', 'Por favor complete las credenciales de administrador');
      return;
    }

    setAuthLoading(true);
    try {
      // Validar credenciales de administrador contra el endpoint
      const res = await api.post('/auth.php', { username: adminUser.trim(), password: adminPass });
      if (res.user && res.user.role === 'admin') {
        setAuthVisible(false);
        confirmAnnulment({ adminUsername: adminUser.trim(), adminPassword: adminPass });
      } else {
        Alert.alert('Permiso denegado', 'Las credenciales ingresadas no corresponden a un administrador.');
      }
    } catch (err) {
      Alert.alert('Fallo de Autenticación', err.message || 'Credenciales de administrador incorrectas');
    } finally {
      setAuthLoading(false);
    }
  };

  const confirmAnnulment = (adminCreds) => {
    Alert.alert(
      'Confirmar Anulación',
      `¿Está seguro que desea anular el boleto #${selectedSale.id.substring(5, 12).toUpperCase()}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Anular',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await annulSale(selectedSale.id, adminCreds);
              setSelectedSale(updated);
              setDetailVisible(false);
              Alert.alert('Completado', 'El boleto ha sido anulado.');
            } catch {}
          }
        }
      ]
    );
  };

  const renderSaleItem = ({ item }) => {
    const isCancelled = item.status === 'cancelled';
    const firstPlay = item.lines && item.lines[0];
    const totalLinesCount = item.lines ? item.lines.length : 0;

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => handleOpenDetail(item)}
      >
        <GlassCard style={[styles.saleCard, isCancelled ? styles.saleCardCancelled : null]}>
          <View style={styles.saleHeader}>
            <Text style={styles.saleId}>#{item.id.substring(5, 13).toUpperCase()}</Text>
            <Text style={[styles.statusText, isCancelled ? styles.statusCancelled : styles.statusActive]}>
              {isCancelled ? 'ANULADO' : 'ACTIVO'}
            </Text>
          </View>

          <View style={styles.saleDetails}>
            <Text style={styles.detailLabel}>Juego: {item.lottery_id.toUpperCase()}</Text>
            <Text style={styles.detailLabel}>
              {item.comprador ? `Cliente: ${item.comprador}` : 'Sin Cliente'}
            </Text>
            <Text style={styles.detailLabel}>
              {totalLinesCount} {totalLinesCount === 1 ? 'jugada' : 'jugadas'} | Sorteo: {item.hora_sorteo}
            </Text>
          </View>

          <View style={styles.saleFooter}>
            <Text style={styles.saleTime}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.saleMonto}>
              {settings.currency} {parseFloat(item.monto).toFixed(2)}
            </Text>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Cabecera */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#fff" />
          <Text style={styles.navTitle}>Historial de Boletos</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={loadAllData} style={styles.refreshBtn} activeOpacity={0.7}>
          <RefreshCw size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Buscador */}
      <View style={styles.searchBar}>
        <Search size={18} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Buscar por ID de boleto o comprador..."
          placeholderTextColor={COLORS.textMuted}
        />
      </View>

      {/* Listado */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredSales}
          keyExtractor={(item) => item.id}
          renderItem={renderSaleItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No se encontraron boletos en el historial.</Text>
            </View>
          }
          onRefresh={loadAllData}
          refreshing={loading}
        />
      )}

      {/* Modal de Detalle */}
      <Modal
        visible={detailVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Detalle del Boleto #{selectedSale?.id.substring(5, 13).toUpperCase()}
              </Text>
              <TouchableOpacity onPress={() => setDetailVisible(false)} activeOpacity={0.7}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedSale && (
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                {/* Cabecera info */}
                <GlassCard style={styles.modalInfoCard}>
                  <Text style={styles.infoRow}>Juego: {selectedSale.lottery_id.toUpperCase()}</Text>
                  <Text style={styles.infoRow}>Sorteo: {selectedSale.hora_sorteo}</Text>
                  <Text style={styles.infoRow}>Vendedor: {selectedSale.seller_name}</Text>
                  <Text style={styles.infoRow}>Cliente: {selectedSale.comprador || 'Sin Cliente'}</Text>
                  <Text style={styles.infoRow}>Fecha: {new Date(selectedSale.created_at).toLocaleString()}</Text>
                  <Text style={[styles.infoRow, { fontWeight: '700' }]}>
                    Estado: {selectedSale.status === 'cancelled' ? 'ANULADO' : 'ACTIVO'}
                  </Text>
                </GlassCard>

                {/* Jugadas del boleto */}
                <Text style={styles.modalSub}>Líneas del Boleto</Text>
                {selectedSale.lines?.map((line, index) => (
                  <View key={index} style={styles.modalLine}>
                    <Text style={styles.lineNum}>#{line.numero}</Text>
                    <Text style={styles.lineMod}>{line.modalidad || 'Normal'}</Text>
                    <Text style={styles.lineMonto}>
                      {settings.currency} {parseFloat(line.monto).toFixed(2)}
                    </Text>
                  </View>
                ))}

                <View style={styles.modalTotalContainer}>
                  <Text style={styles.modalTotalLabel}>Total:</Text>
                  <Text style={styles.modalTotalValue}>
                    {settings.currency} {parseFloat(selectedSale.monto).toFixed(2)}
                  </Text>
                </View>

                {/* Botones de acción */}
                <View style={styles.modalActions}>
                  <CustomButton
                    title="Reimprimir Ticket"
                    variant="primary"
                    icon={Printer}
                    onPress={handleReprint}
                    style={styles.modalActBtn}
                  />

                  {selectedSale.status !== 'cancelled' && (
                    <CustomButton
                      title="Anular Boleto"
                      variant="danger"
                      icon={ShieldAlert}
                      onPress={handleAnnulClick}
                      style={styles.modalActBtn}
                    />
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Validación de Credenciales de Administrador */}
      <Modal
        visible={authVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAuthVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <GlassCard style={styles.authModalCard}>
            <View style={styles.authHeader}>
              <ShieldAlert size={24} color={COLORS.dangerLight} style={{ marginRight: 8 }} />
              <Text style={styles.authTitle}>Validación Requerida</Text>
            </View>
            <Text style={styles.authDesc}>
              Para anular este boleto, se requieren credenciales de administrador.
            </Text>

            <FormInput
              label="Usuario Administrador"
              value={adminUser}
              onChangeText={setAdminUser}
              placeholder="admin"
              autoCapitalize="none"
            />

            <FormInput
              label="Contraseña"
              value={adminPass}
              onChangeText={setAdminPass}
              placeholder="••••••••"
              secureTextEntry
            />

            <View style={styles.authActions}>
              <CustomButton
                title="Cancelar"
                variant="secondary"
                onPress={() => setAuthVisible(false)}
                style={styles.authBtn}
              />
              <CustomButton
                title="Verificar"
                variant="danger"
                onPress={handleAdminAuthSubmit}
                loading={authLoading}
                style={styles.authBtn}
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBar: {
    height: 56,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  refreshBtn: {
    padding: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    margin: 12,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  saleCard: {
    padding: 14,
    marginVertical: 4,
  },
  saleCardCancelled: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
    opacity: 0.7,
  },
  saleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saleId: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusActive: {
    color: COLORS.successLight,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusCancelled: {
    color: COLORS.dangerLight,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  saleDetails: {
    marginBottom: 10,
  },
  detailLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginVertical: 1,
  },
  saleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    paddingTop: 8,
  },
  saleTime: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  saleMonto: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.successLight,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContainer: {
    width: '100%',
    height: '85%',
    backgroundColor: COLORS.bgBase,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 40,
  },
  modalInfoCard: {
    padding: 14,
    gap: 4,
  },
  infoRow: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  modalSub: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginVertical: 12,
  },
  modalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 10,
    borderRadius: RADIUS.sm,
    marginVertical: 3,
  },
  lineNum: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  lineMod: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  lineMonto: {
    color: COLORS.successLight,
    fontWeight: '700',
  },
  modalTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  modalTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.successLight,
  },
  modalActions: {
    marginTop: 24,
    gap: 8,
  },
  modalActBtn: {
    height: 48,
  },
  authModalCard: {
    width: '90%',
    maxWidth: 360,
    padding: 20,
    alignSelf: 'center',
  },
  authHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  authTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  authDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 16,
  },
  authActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
  },
  authBtn: {
    flex: 1,
    height: 40,
  },
});
