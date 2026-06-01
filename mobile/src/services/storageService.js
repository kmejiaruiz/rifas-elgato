// ============================================================
// storageService — Almacenamiento local para Móvil
// Encapsula AsyncStorage (general) y SecureStore (seguro para tokens)
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const storage = {
  // --- General (AsyncStorage) ---
  get: async (key) => {
    try {
      const val = await AsyncStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },

  set: async (key, val) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch {
      return false;
    }
  },

  remove: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  // --- Seguro (SecureStore) ---
  getSecure: async (key) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  setSecure: async (key, val) => {
    try {
      await SecureStore.setItemAsync(key, String(val));
      return true;
    } catch {
      return false;
    }
  },

  removeSecure: async (key) => {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch {
      return false;
    }
  },
};
