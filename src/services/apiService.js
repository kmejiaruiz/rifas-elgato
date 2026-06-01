// ============================================================
// Cliente HTTP para la API PHP/MySQL
// Maneja token Bearer, errores y redirección por sesión expirada
// ============================================================

const TOKEN_KEY = 'rifas_token';

export const getToken  = () => localStorage.getItem(TOKEN_KEY);
export const setToken  = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const request = async (method, path, body = null) => {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body !== null) opts.body = JSON.stringify(body);

  let res;
  try {
    const base = import.meta.env.DEV ? '/api' : `${import.meta.env.BASE_URL || '/'}api`;
    const url = `${base}${path}`.replace(/\/+/g, '/');
    res = await fetch(url, opts);
  } catch {
    throw new Error('Sin conexión con el servidor. Verifica que el backend esté activo.');
  }

  // Token expirado → limpiar sesión solo si ya había sesión activa
  if (res.status === 401) {
    const data401 = await res.json().catch(() => ({}));
    const hadToken = !!getToken();
    clearToken();
    if (hadToken) {
      window.dispatchEvent(new Event('rifas:session-expired'));
    }
    throw new Error(data401.error || 'Sesión expirada. Inicia sesión nuevamente.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }

  return data;
};

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),
};
