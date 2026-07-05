// ============================================================
// Cliente HTTP para la API Node.js/Express
// Maneja token Bearer, errores y redirección por sesión expirada
// ============================================================

const TOKEN_KEY = 'rifas_token';

export const getToken   = () => localStorage.getItem(TOKEN_KEY);
export const setToken   = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Returns the base origin for constructing asset URLs (e.g. /uploads/carousel_xxx.jpg)
export const getApiUrl  = () => {
  const base = getBaseApiUrl();
  if (base.startsWith('http')) return base;
  return window.location.origin + base;
};


export const getBaseApiUrl = () => {
  return import.meta.env.DEV ? '/api' : 'https://rifas-elgato.vercel.app/api';
};

const request = async (method, path, body = null) => {
  const headers = { 'Content-Type': 'application/json' };

  // Adjuntar Bearer token
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token; // fallback para FastCGI (InfinityFree elimina Authorization)
  }

  const opts = { method, headers };
  if (body !== null) opts.body = JSON.stringify(body);

  let res;
  try {
    const base = getBaseApiUrl();
    let url;
    if (base.startsWith('http')) {
      const urlObj = new URL(base);
      url = `${urlObj.origin}${`${urlObj.pathname}/${path}`.replace(/\/+/g, '/')}`;
    } else {
      url = `${base}${path}`.replace(/\/+/g, '/');
    }
    res = await fetch(url, opts);
  } catch {
    throw new Error('Sin conexión con el servidor. Verifica que el backend esté activo.');
  }

  // Token expirado → limpiar sesión
  if (res.status === 401) {
    const data401 = await res.json().catch(() => ({}));
    const hadToken = !!getToken();
    clearToken();
    if (hadToken) {
      window.dispatchEvent(new Event('rifas:session-expired'));
    }
    throw new Error(data401.error || 'Sesión expirada. Inicia sesión nuevamente.');
  }


  let data = {};
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  } else {
    const text = await res.text().catch(() => '');
    if (text.includes('Cookies are not enabled') || text.includes('__test')) {
      throw new Error('El sistema de seguridad del hosting está bloqueando la conexión. Por favor, recarga la página.');
    }
    throw new Error(`Respuesta inválida del servidor (formato no JSON: ${res.status}).`);
  }

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
