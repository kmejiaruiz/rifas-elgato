// ============================================================
// AuthContext — Gestión de Autenticación para Móvil
// ============================================================
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { api, initApiUrl } from '../services/apiService';
import { storage } from '../services/storageService';

const TOKEN_KEY = 'rifas_token';
const initialState = { user: null, loading: true };

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':  return { user: action.payload, loading: false };
    case 'LOGOUT': return { user: null,           loading: false };
    case 'LOADED': return { ...state,             loading: false };
    default: return state;
  }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Restaurar sesión desde token seguro guardado al iniciar
  const restoreSession = useCallback(async () => {
    try {
      await initApiUrl(); // Asegurar cargar API URL primero
      const token = await storage.getSecure(TOKEN_KEY);
      if (!token) {
        dispatch({ type: 'LOADED' });
        return;
      }
      const { user } = await api.get('/auth.php');
      dispatch({ type: 'LOGIN', payload: user });
    } catch {
      await storage.removeSecure(TOKEN_KEY);
      dispatch({ type: 'LOADED' });
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (username, password) => {
    try {
      const { token, user } = await api.post('/auth.php', { username, password });
      await storage.setSecure(TOKEN_KEY, token);
      dispatch({ type: 'LOGIN', payload: user });
      return user;
    } catch (err) {
      Alert.alert('Error de Acceso', err.message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.delete('/auth.php');
    } catch {}
    await storage.removeSecure(TOKEN_KEY);
    dispatch({ type: 'LOGOUT' });
    Alert.alert('Sesión Cerrada', 'Hasta luego');
  }, []);

  // --- Métodos Administrativos de Gestión de Usuarios ---

  const getUsers = useCallback(async () => {
    const { users } = await api.get('/users.php');
    return users;
  }, []);

  const createUser = useCallback(async (data) => {
    const { user } = await api.post('/users.php', data);
    return user;
  }, []);

  const updateUser = useCallback(async (id, data) => {
    const { user } = await api.put(`/users.php?id=${id}`, data);
    return user;
  }, []);

  const deleteUser = useCallback(async (id) => {
    await api.delete(`/users.php?id=${id}`);
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, restoreSession, getUsers, createUser, updateUser, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
