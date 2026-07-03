// ============================================================
// AuthContext — usa API PHP + MySQL para autenticación
// Gestiona Bearer token + CSRF token en memoria
// ============================================================
import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { api, getToken, setToken, clearToken } from '../services/apiService';
import toast from 'react-hot-toast';

const initialState = { user: null, loading: true };

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      if (action.payload) {
        localStorage.setItem('rifas_user', JSON.stringify(action.payload));
      }
      return { user: action.payload, loading: false };
    case 'LOGOUT':
      localStorage.removeItem('rifas_user');
      return { user: null,           loading: false };
    case 'LOADED': return { ...state,             loading: false };
    default: return state;
  }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Restaurar sesión desde token guardado
  useEffect(() => {
    const restore = async () => {
      const token = getToken();
      if (!token) { dispatch({ type: 'LOADED' }); return; }
      
      // Si no hay red, usar cache directamente
      if (!navigator.onLine) {
        const cachedUser = localStorage.getItem('rifas_user');
        if (cachedUser) {
          dispatch({ type: 'LOGIN', payload: JSON.parse(cachedUser) });
          return;
        }
      }

      try {
        const { user } = await api.get('/auth');
        dispatch({ type: 'LOGIN', payload: user });
      } catch (err) {
        // En caso de fallar por conexión (sin internet)
        if (!navigator.onLine || err.message?.includes('Sin conexión') || err.message?.includes('Failed to fetch')) {
          const cachedUser = localStorage.getItem('rifas_user');
          if (cachedUser) {
            dispatch({ type: 'LOGIN', payload: JSON.parse(cachedUser) });
            return;
          }
        }
        clearToken();
        dispatch({ type: 'LOADED' });
      }
    };
    restore();

    // Escuchar evento de sesión expirada desde apiService
    const onExpired = () => {
      dispatch({ type: 'LOGOUT' });
    };
    window.addEventListener('rifas:session-expired', onExpired);
    return () => window.removeEventListener('rifas:session-expired', onExpired);
  }, []);

  const login = useCallback(async (username, password) => {
    // POST /auth devuelve token + csrfToken + user
    const { token, user } = await api.post('/auth', { username, password });
    setToken(token);
    dispatch({ type: 'LOGIN', payload: user });
    toast.success(`Bienvenido, ${user.name}`);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.delete('/auth'); } catch {}
    clearToken();
    dispatch({ type: 'LOGOUT' });
    toast.success('Sesión cerrada');
  }, []);

  // ─── Gestión de usuarios (solo admin) ───────────────────────

  const getUsers = useCallback(async () => {
    const { users } = await api.get('/users');
    return users;
  }, []);

  const createUser = useCallback(async (data) => {
    const { user } = await api.post('/users', data);
    return user;
  }, []);

  const updateUser = useCallback(async (id, data) => {
    const { user } = await api.put(`/users?id=${id}`, data);
    return user;
  }, []);

  const deleteUser = useCallback(async (id) => {
    await api.delete(`/users?id=${id}`);
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, getUsers, createUser, updateUser, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};

// Re-export desde utils para compatibilidad con imports existentes
export { can } from '../utils/permissions';
