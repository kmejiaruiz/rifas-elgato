// ============================================================
// apiService — Cliente HTTP con soporte para servidor dinámico
// Carga la URL de API desde el almacenamiento local y maneja JWT
// ============================================================
import axios from 'axios';
import { storage } from './storageService';

const TOKEN_KEY = 'rifas_token';
const API_URL_KEY = 'rifas_api_url';
export const DEFAULT_API_URL = 'https://rifas-elgato.vercel.app/api'; // URL de producción en Vercel

let currentApiUrl = DEFAULT_API_URL;

// Cargar la URL guardada del almacenamiento local
export const initApiUrl = async () => {
  const saved = await storage.get(API_URL_KEY);
  if (saved) {
    currentApiUrl = saved;
  }
  return currentApiUrl;
};

export const getApiUrl = () => currentApiUrl;

export const setApiUrl = async (url) => {
  let cleaned = url.trim().replace(/\/+$/, ''); // Quita slashes al final
  // Asegura el sufijo /api si no está presente
  if (cleaned && !cleaned.endsWith('/api') && !cleaned.endsWith('/api.php')) {
    // Si contiene la extensión .php, la dejamos, sino agregamos /api
    if (!cleaned.includes('/api/')) {
      cleaned = `${cleaned}/api`;
    }
  }
  currentApiUrl = cleaned || DEFAULT_API_URL;
  await storage.set(API_URL_KEY, currentApiUrl);
};

// Crear cliente base de axios
const getClient = async () => {
  const token = await storage.getSecure(TOKEN_KEY);
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return axios.create({
    baseURL: currentApiUrl,
    headers,
    timeout: 10000,
  });
};

const handleRequest = async (method, path, data = null) => {
  try {
    const client = await getClient();
    const config = {
      method,
      url: path,
    };
    if (data) config.data = data;
    
    const response = await client(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const responseData = error.response.data || {};
      
      if (status === 401) {
        // Redirigir o emitir evento de expiración de sesión
        await storage.removeSecure(TOKEN_KEY);
        throw new Error(responseData.error || 'Sesión expirada. Inicie sesión nuevamente.');
      }
      
      throw new Error(responseData.error || `Error del servidor (${status})`);
    } else if (error.request) {
      throw new Error('No se pudo establecer conexión con el servidor. Verifique la dirección de la API y su red.');
    } else {
      throw new Error(error.message);
    }
  }
};

export const api = {
  get:    (path)       => handleRequest('GET',    path),
  post:   (path, data) => handleRequest('POST',   path, data),
  put:    (path, data) => handleRequest('PUT',    path, data),
  delete: (path)       => handleRequest('DELETE', path),
};
