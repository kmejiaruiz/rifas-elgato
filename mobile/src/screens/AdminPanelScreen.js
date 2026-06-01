// ============================================================
// AdminPanelScreen — Panel Administrativo para Móvil
// Gestión de usuarios, juegos, números cerrados y ganadores
// ============================================================
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, Modal } from 'react-native';
import { ChevronLeft, UserPlus, Gamepad2, Slash, Trophy, ShieldAlert, Plus, Trash2 } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { COLORS, RADIUS } from '../styles/theme';
import { GlassCard } from '../components/GlassCard';
import { CustomButton } from '../components/CustomButton';
import { FormInput } from '../components/FormInput';
import { api } from '../services/apiService';

export const AdminPanelScreen = ({ onNavigate }) => {
  const { getUsers, createUser, deleteUser } = useAuth();
  const { lotteries, loadAllData, settings } = useApp();

  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'games' | 'blocks' | 'results'
  const [loading, setLoading] = useState(false);

  // --- Estados de Datos ---
  const [usersList, setUsersList] = useState([]);
  const [blockedNums, setBlockedNums] = useState([]);
  const [winningNums, setWinningNums] = useState([]);

  // --- Estados de Modales ---
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('vendedor'); // 'admin' | 'vendedor'

  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [blockGameId, setBlockGameId] = useState('');
  const [blockNumberInput, setBlockNumberInput] = useState('');

  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [resultGameId, setResultGameId] = useState('');
  const [resultNumberInput, setResultNumberInput] = useState('');
  const [resultDate, setResultDate] = useState(new Date().toISOString().split('T')[0]);
  const [resultHour, setResultHour] = useState('12:00');

  // --- Cargadores ---
  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsersList(data || []);
    } catch (err) {
      Alert.alert('Error', 'No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  const loadBlockedNumbers = async () => {
    setLoading(true);
    try {
      // Bloqueados de todos los juegos
      const list = [];
      for (const game of lotteries) {
        const { blocked } = await api.get(`/blocked.php?lottery_id=${game.id}`);
        if (blocked) {
          blocked.forEach(num => {
            list.push({ gameId: game.id, gameName: game.name, number: num });
          });
        }
      }
      setBlockedNums(list);
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  };

  const loadWinningResults = async () => {
    setLoading(true);
    try {
      const { results } = await api.get('/results.php');
      setWinningNums(results || []);
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'blocks') loadBlockedNumbers();
    if (activeTab === 'results') loadWinningResults();
  }, [activeTab, lotteries]);

  // --- Acciones de Usuarios ---
  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newPassword || !newName.trim()) {
      Alert.alert('Requerido', 'Complete todos los campos del nuevo usuario.');
      return;
    }
    try {
      await createUser({
        username: newUsername.trim(),
        password: newPassword,
        name: newName.trim(),
        role: newRole,
      });
      setUserModalVisible(false);
      loadUsers();
      Alert.alert('Éxito', 'Usuario creado.');
    } catch (err) {
      Alert.alert('Error al crear', err.message);
    }
  };

  const handleDeleteUserPress = (userId, userName) => {
    Alert.alert(
      'Eliminar Usuario',
      `¿Está seguro que desea eliminar a ${userName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(userId);
              loadUsers();
              Alert.alert('Éxito', 'Usuario eliminado.');
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  // --- Acciones de Bloqueos ---
  const handleBlockNumber = async () => {
    if (!blockGameId || !blockNumberInput.trim()) {
      Alert.alert('Requerido', 'Seleccione un juego e ingrese un número.');
      return;
    }
    try {
      await api.post('/blocked.php', {
        lottery_id: blockGameId,
        numero: blockNumberInput.trim(),
      });
      setBlockModalVisible(false);
      setBlockNumberInput('');
      loadBlockedNumbers();
      Alert.alert('Completado', 'Número bloqueado.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleUnblockNumber = async (gameId, num) => {
    try {
      await api.delete(`/blocked.php?lottery_id=${gameId}&numero=${encodeURIComponent(num)}`);
      loadBlockedNumbers();
      Alert.alert('Completado', 'Número desbloqueado.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // --- Acciones de Ganadores ---
  const handleRegisterResult = async () => {
    if (!resultGameId || !resultNumberInput.trim() || !resultDate || !resultHour) {
      Alert.alert('Requerido', 'Complete todos los campos del resultado.');
      return;
    }
    try {
      await api.post('/results.php', {
        lottery_id: resultGameId,
        fecha_sorteo: resultDate,
        numero_ganador: resultNumberInput.trim(),
        hora_sorteo: resultHour,
      });
      setResultModalVisible(false);
      setResultNumberInput('');
      loadWinningResults();
      Alert.alert('Éxito', 'Resultado registrado correctamente.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDeleteResult = async (resId) => {
    Alert.alert(
      'Eliminar Ganador',
      '¿Desea eliminar este resultado?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/results.php?id=${resId}`);
              loadWinningResults();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  // --- Toggle habilitar juego ---
  const toggleGameEnabled = async (gameId, currentVal) => {
    try {
      await api.put(`/games.php?id=${gameId}`, { enabled: !currentVal });
      await loadAllData();
      Alert.alert('Éxito', 'Juego actualizado.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Barra superior */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => onNavigate('dashboard')} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#fff" />
          <Text style={styles.navTitle}>Panel Administrativo</Text>
        </TouchableOpacity>
      </View>

      {/* Selector de pestañas */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'users' ? styles.tabItemActive : null]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' ? styles.tabTextActive : null]}>Usuarios</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'games' ? styles.tabItemActive : null]}
          onPress={() => setActiveTab('games')}
        >
          <Text style={[styles.tabText, activeTab === 'games' ? styles.tabTextActive : null]}>Juegos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'blocks' ? styles.tabItemActive : null]}
          onPress={() => setActiveTab('blocks')}
        >
          <Text style={[styles.tabText, activeTab === 'blocks' ? styles.tabTextActive : null]}>Cierres</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'results' ? styles.tabItemActive : null]}
          onPress={() => setActiveTab('results')}
        >
          <Text style={[styles.tabText, activeTab === 'results' ? styles.tabTextActive : null]}>Ganadores</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* ================= PESTAÑA: USUARIOS ================= */}
          {activeTab === 'users' && (
            <View>
              <CustomButton
                title="Registrar Vendedor"
                variant="primary"
                icon={UserPlus}
                onPress={() => {
                  setNewUsername('');
                  setNewPassword('');
                  setNewName('');
                  setNewRole('vendedor');
                  setUserModalVisible(true);
                }}
                style={styles.actionBtn}
              />

              {usersList.map(item => (
                <GlassCard key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.badge}>{item.role.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.itemSub}>Usuario: {item.username}</Text>
                  
                  {item.role !== 'admin' && (
                    <TouchableOpacity
                      onPress={() => handleDeleteUserPress(item.id, item.name)}
                      style={styles.deleteLink}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={14} color={COLORS.dangerLight} style={{ marginRight: 4 }} />
                      <Text style={styles.deleteLinkText}>Eliminar Vendedor</Text>
                    </TouchableOpacity>
                  )}
                </GlassCard>
              ))}
            </View>
          )}

          {/* ================= PESTAÑA: JUEGOS ================= */}
          {activeTab === 'games' && (
            <View>
              {lotteries.map(item => (
                <GlassCard key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Switch
                      value={item.enabled !== false}
                      onValueChange={() => toggleGameEnabled(item.id, item.enabled !== false)}
                      trackColor={{ false: '#374151', true: COLORS.primaryLight }}
                      thumbColor={item.enabled !== false ? COLORS.primary : '#9ca3af'}
                    />
                  </View>
                  <Text style={styles.itemSub}>{item.description}</Text>
                  <Text style={styles.itemSub}>
                    Precio por Defecto: {settings.currency} {parseFloat(item.defaultPrice || 100).toFixed(2)}
                  </Text>
                </GlassCard>
              ))}
            </View>
          )}

          {/* ================= PESTAÑA: BLOQUEOS ================= */}
          {activeTab === 'blocks' && (
            <View>
              <CustomButton
                title="Cerrar Número (Bloquear)"
                variant="primary"
                icon={Plus}
                onPress={() => {
                  setBlockGameId(lotteries[0]?.id || '');
                  setBlockNumberInput('');
                  setBlockModalVisible(true);
                }}
                style={styles.actionBtn}
              />

              {blockedNums.map((item, index) => (
                <GlassCard key={index} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>Número: {item.number}</Text>
                    <TouchableOpacity
                      onPress={() => handleUnblockNumber(item.gameId, item.number)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={18} color={COLORS.dangerLight} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemSub}>Juego: {item.gameName}</Text>
                </GlassCard>
              ))}
            </View>
          )}

          {/* ================= PESTAÑA: GANADORES ================= */}
          {activeTab === 'results' && (
            <View>
              <CustomButton
                title="Anunciar Número Ganador"
                variant="primary"
                icon={Trophy}
                onPress={() => {
                  setResultGameId(lotteries[0]?.id || '');
                  setResultNumberInput('');
                  setResultModalVisible(true);
                }}
                style={styles.actionBtn}
              />

              {winningNums.map(item => (
                <GlassCard key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={[styles.itemTitle, { color: COLORS.successLight }]}>
                      Ganador: {item.numero_ganador}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteResult(item.id)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={18} color={COLORS.dangerLight} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemSub}>Juego: {item.lottery_id.toUpperCase()}</Text>
                  <Text style={styles.itemSub}>Sorteo: {item.hora_sorteo}</Text>
                  <Text style={styles.itemSub}>Fecha: {item.fecha_sorteo}</Text>
                </GlassCard>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ================= MODALES DE REGISTRO ================= */}

      {/* Modal Crear Usuario */}
      <Modal visible={userModalVisible} animationType="slide" transparent>
        <View style={styles.backdrop}>
          <GlassCard style={styles.modalCard}>
            <Text style={styles.modalHeading}>Nuevo Vendedor</Text>
            <FormInput label="Nombre Completo" value={newName} onChangeText={setNewName} placeholder="Nombre" />
            <FormInput label="Nombre de Usuario" value={newUsername} onChangeText={setNewUsername} placeholder="usuario" />
            <FormInput label="Contraseña" value={newPassword} onChangeText={setNewPassword} placeholder="••••••" secureTextEntry />
            
            <View style={styles.modalButtons}>
              <CustomButton title="Cancelar" variant="secondary" onPress={() => setUserModalVisible(false)} style={styles.mBtn} />
              <CustomButton title="Guardar" variant="primary" onPress={handleCreateUser} style={styles.mBtn} />
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal Bloquear Número */}
      <Modal visible={blockModalVisible} animationType="slide" transparent>
        <View style={styles.backdrop}>
          <GlassCard style={styles.modalCard}>
            <Text style={styles.modalHeading}>Bloquear Número</Text>
            
            <Text style={styles.selectLabel}>Juego de Lotería</Text>
            <ScrollView horizontal style={styles.rowSel}>
              {lotteries.map(l => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.selTab, blockGameId === l.id ? styles.selTabActive : null]}
                  onPress={() => setBlockGameId(l.id)}
                >
                  <Text style={[styles.selText, blockGameId === l.id ? styles.selTextActive : null]}>{l.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FormInput
              label="Número a Bloquear"
              value={blockNumberInput}
              onChangeText={setBlockNumberInput}
              placeholder="00"
              keyboardType="numeric"
            />
            
            <View style={styles.modalButtons}>
              <CustomButton title="Cancelar" variant="secondary" onPress={() => setBlockModalVisible(false)} style={styles.mBtn} />
              <CustomButton title="Bloquear" variant="primary" onPress={handleBlockNumber} style={styles.mBtn} />
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Modal Registrar Ganador */}
      <Modal visible={resultModalVisible} animationType="slide" transparent>
        <View style={styles.backdrop}>
          <GlassCard style={styles.modalCard}>
            <Text style={styles.modalHeading}>Anunciar Ganador</Text>
            
            <Text style={styles.selectLabel}>Juego de Lotería</Text>
            <ScrollView horizontal style={styles.rowSel}>
              {lotteries.map(l => (
                <TouchableOpacity
                  key={l.id}
                  style={[styles.selTab, resultGameId === l.id ? styles.selTabActive : null]}
                  onPress={() => setResultGameId(l.id)}
                >
                  <Text style={[styles.selText, resultGameId === l.id ? styles.selTextActive : null]}>{l.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FormInput
              label="Número Ganador"
              value={resultNumberInput}
              onChangeText={setResultNumberInput}
              placeholder="00"
              keyboardType="numeric"
            />

            <FormInput
              label="Hora de Sorteo"
              value={resultHour}
              onChangeText={setResultHour}
              placeholder="12:00"
            />

            <FormInput
              label="Fecha de Sorteo (YYYY-MM-DD)"
              value={resultDate}
              onChangeText={setResultDate}
              placeholder="2026-05-24"
            />
            
            <View style={styles.modalButtons}>
              <CustomButton title="Cancelar" variant="secondary" onPress={() => setResultModalVisible(false)} style={styles.mBtn} />
              <CustomButton title="Anunciar" variant="primary" onPress={handleRegisterResult} style={styles.mBtn} />
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabItem: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabItemActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  actionBtn: {
    height: 46,
    marginBottom: 16,
  },
  itemCard: {
    padding: 14,
    marginVertical: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  badge: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primaryLight,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginVertical: 1,
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  deleteLinkText: {
    color: COLORS.dangerLight,
    fontSize: 11,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 20,
  },
  mBtn: {
    flex: 1,
    height: 42,
  },
  selectLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  rowSel: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  selTab: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  selTabActive: {
    backgroundColor: COLORS.primary,
  },
  selText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  selTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
});
