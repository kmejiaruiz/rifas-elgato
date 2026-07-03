// ============================================================
// storageService — usa la API Node.js/Express con soporte PWA Offline
// Mantiene la misma interfaz, con fallback a localStorage cuando no hay conexión
// ============================================================
import { api } from './apiService';
import toast from 'react-hot-toast';

// Helper to check online status
const isOnline = () => navigator.onLine;

// ─── Ventas ──────────────────────────────────────────────────

export const saveSale = async (saleData) => {
  try {
    const res = await api.post('/sales', saleData);
    return res.sales ? res.sales[0] : res.sale;
  } catch (err) {
    // Modo offline como fallback si falla la conexión
    const queue = JSON.parse(localStorage.getItem('offline_sales_queue') || '[]');
    const tempId = `temp_sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Obtener usuario autenticado en offline
    const userStr = localStorage.getItem('rifas_user');
    const user = userStr ? JSON.parse(userStr) : { id: 0, name: 'Vendedor Offline' };
    
    const totalMonto = saleData.jugadas.reduce((sum, j) => sum + parseFloat(j.monto || 0), 0);
    
    const mockSale = {
      id: tempId,
      lotteryId: saleData.lotteryId,
      comprador: saleData.comprador || '',
      monto: totalMonto,
      sellerId: user.id,
      sellerName: user.name,
      horaSorteo: saleData.horaSorteo || '12:00',
      status: 'active',
      createdAt: new Date().toISOString(),
      prizePaid: 0,
      isOffline: true,
      lines: saleData.jugadas.map((j, idx) => ({
        id: `temp_line_${Date.now()}_${idx}`,
        saleId: tempId,
        lotteryId: saleData.lotteryId,
        numero: saleData.lotteryId === 'fechea' ? (j.fecha || '') : (j.numero || ''),
        monto: parseFloat(j.monto || 0),
        fecha: j.fecha || new Date().toISOString().split('T')[0],
        status: 'active'
      }))
    };
    
    // Encolar datos para sincronización
    queue.push({ id: tempId, data: saleData });
    localStorage.setItem('offline_sales_queue', JSON.stringify(queue));
    
    // Guardar temporalmente en ventas locales en cache para que persista en refrescos offline
    const cachedSales = JSON.parse(localStorage.getItem('cached_sales') || '[]');
    cachedSales.unshift(mockSale);
    localStorage.setItem('cached_sales', JSON.stringify(cachedSales));
    
    return mockSale;
  }
};

export const getAllSales = async () => {
  if (!isOnline()) {
    return JSON.parse(localStorage.getItem('cached_sales') || '[]');
  }
  try {
    const { sales } = await api.get('/sales');
    const list = sales || [];
    localStorage.setItem('cached_sales', JSON.stringify(list));
    return list;
  } catch (err) {
    // Fallback en caso de error de conexión insospechado
    return JSON.parse(localStorage.getItem('cached_sales') || '[]');
  }
};

export const getTodaySales = async () => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  if (!isOnline()) {
    const all = JSON.parse(localStorage.getItem('cached_sales') || '[]');
    return all.filter(s => s.createdAt && s.createdAt.startsWith(today));
  }
  try {
    const { sales } = await api.get(`/sales?date=${today}`);
    return sales || [];
  } catch {
    const all = JSON.parse(localStorage.getItem('cached_sales') || '[]');
    return all.filter(s => s.createdAt && s.createdAt.startsWith(today));
  }
};

export const getSalesByFilter = async (filters = {}) => {
  if (!isOnline()) {
    let all = JSON.parse(localStorage.getItem('cached_sales') || '[]');
    if (filters.date) {
      all = all.filter(s => s.createdAt && s.createdAt.startsWith(filters.date));
    }
    if (filters.lotteryId) {
      all = all.filter(s => s.lotteryId === filters.lotteryId);
    }
    if (filters.status) {
      if (filters.status === 'winner') {
        all = all.filter(s => s.lines && s.lines.some(l => l.status === 'winner'));
      } else {
        all = all.filter(s => s.status === filters.status);
      }
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      all = all.filter(s => 
        (s.comprador && s.comprador.toLowerCase().includes(q)) || 
        (s.lines && s.lines.some(l => l.numero && l.numero.toString().includes(q))) ||
        (s.id && s.id.toString().toLowerCase().includes(q))
      );
    }
    return all;
  }
  try {
    const params = new URLSearchParams();
    if (filters.date)       params.set('date',       filters.date);
    if (filters.lotteryId)  params.set('lottery_id', filters.lotteryId);
    if (filters.status)     params.set('status',     filters.status);
    if (filters.search)     params.set('search',     filters.search);
    if (filters.sellerId)   params.set('seller_id',  filters.sellerId);
    const { sales } = await api.get(`/sales?${params.toString()}`);
    return sales || [];
  } catch {
    // Fallback offline local
    let all = JSON.parse(localStorage.getItem('cached_sales') || '[]');
    if (filters.date) {
      all = all.filter(s => s.createdAt && s.createdAt.startsWith(filters.date));
    }
    if (filters.lotteryId) {
      all = all.filter(s => s.lotteryId === filters.lotteryId);
    }
    return all;
  }
};

export const cancelSale = async (id, adminCreds = null) => {
  if (!isOnline()) {
    throw new Error('No se pueden anular boletos en modo offline.');
  }
  const { sale } = await api.put(`/sales?id=${encodeURIComponent(id)}`, adminCreds);
  return sale;
};

export const paySalePrize = async (id) => {
  if (!isOnline()) {
    throw new Error('No se pueden pagar premios en modo offline.');
  }
  const { sale } = await api.put(`/sales?id=${encodeURIComponent(id)}&pay_prize=1`);
  return sale;
};

export const getSaleById = async (id) => {
  if (!isOnline()) {
    const all = JSON.parse(localStorage.getItem('cached_sales') || '[]');
    return all.find((s) => s.id === id) || null;
  }
  try {
    const { sales } = await api.get(`/sales?search=${encodeURIComponent(id)}`);
    return sales.find((s) => s.id === id) || null;
  } catch {
    const all = JSON.parse(localStorage.getItem('cached_sales') || '[]');
    return all.find((s) => s.id === id) || null;
  }
};

export const getDailySummary = async () => {
  if (!isOnline()) {
    return JSON.parse(localStorage.getItem('cached_summary') || JSON.stringify({ total: 0, count: 0, byType: {}, cancelled: 0 }));
  }
  try {
    const summary = await api.get('/sales?summary=1');
    localStorage.setItem('cached_summary', JSON.stringify(summary));
    return summary;
  } catch {
    return JSON.parse(localStorage.getItem('cached_summary') || JSON.stringify({ total: 0, count: 0, byType: {}, cancelled: 0 }));
  }
};

// ─── Configuración de la app ──────────────────────────────────

export const getSettings = async () => {
  if (!isOnline()) {
    return JSON.parse(localStorage.getItem('cached_settings') || JSON.stringify({
      businessName: 'Zentric', currency: 'NIO', autoprint: true, drawCloseMinutes: 10,
      appStatus: 'active', appDisableAt: 'never', isBlocked: false,
      carousel_images: '[]'
    }));
  }
  try {
    const { settings } = await api.get('/settings');
    const result = {
      businessName:     settings.businessName || 'Zentric',
      currency:         settings.currency     || 'NIO',
      autoprint:        settings.autoprint === 'true',
      drawCloseMinutes: Number(settings.drawCloseMinutes || 10),
      appStatus:        settings.appStatus    ?? 'active',
      appDisableAt:     settings.appDisableAt ?? 'never',
      isBlocked:        settings.isBlocked    === true || settings.isBlocked === 'true',
      carousel_images:  settings.carousel_images || '[]',
    };
    localStorage.setItem('cached_settings', JSON.stringify(result));
    return result;
  } catch {
    return JSON.parse(localStorage.getItem('cached_settings') || JSON.stringify({
      businessName: 'Zentric', currency: 'NIO', autoprint: true, drawCloseMinutes: 10,
      appStatus: 'active', appDisableAt: 'never', isBlocked: false,
      carousel_images: '[]'
    }));
  }
};

export const saveSettings = async (settings) => {
  if (!isOnline()) {
    throw new Error('No se puede guardar la configuración en modo offline.');
  }
  const payload = {
    ...settings,
    autoprint: String(settings.autoprint ?? true),
    drawCloseMinutes: String(settings.drawCloseMinutes ?? 10),
  };
  await api.put('/settings', payload);
  localStorage.setItem('cached_settings', JSON.stringify(settings));
};

// ─── Resultados / Ganadores ───────────────────────────────────

export const getResults = async () => {
  if (!isOnline()) {
    return JSON.parse(localStorage.getItem('cached_results') || '[]');
  }
  try {
    const { results } = await api.get('/results');
    const list = results || [];
    localStorage.setItem('cached_results', JSON.stringify(list));
    return list;
  } catch {
    return JSON.parse(localStorage.getItem('cached_results') || '[]');
  }
};

export const announceResult = async (payload) => {
  if (!isOnline()) {
    // Modo offline
    const queue = JSON.parse(localStorage.getItem('offline_results_queue') || '[]');
    const tempId = `temp_res_${Date.now()}`;
    
    const mockResult = {
      id: tempId,
      lotteryId: payload.lotteryId,
      fechaSorteo: payload.fechaSorteo || new Date().toISOString().split('T')[0],
      numeroGanador: payload.numeroGanador,
      horaSorteo: payload.horaSorteo || '12:00',
      announcedBy: 'Admin Offline',
      announcedAt: new Date().toISOString(),
      isOffline: true
    };
    
    queue.push({ id: tempId, data: payload });
    localStorage.setItem('offline_results_queue', JSON.stringify(queue));
    
    // Guardar en cache local para listados offline
    const cachedResults = JSON.parse(localStorage.getItem('cached_results') || '[]');
    cachedResults.unshift(mockResult);
    localStorage.setItem('cached_results', JSON.stringify(cachedResults));
    
    // Mostrar alerta nativa requerida por el usuario
    alert("Los resultados anunciados en offline se cargarán luego al servidor cuando se conecte a la red.");
    
    return { result: mockResult, winners: [], isOffline: true };
  }

  // Modo online
  return await api.post('/results', payload);
};

export const deleteResult = async (id) => {
  if (!isOnline()) {
    throw new Error('No se pueden eliminar resultados en modo offline.');
  }
  return await api.delete(`/results?id=${id}`);
};

export const checkWinners = async () => {
  if (!isOnline()) {
    return [];
  }
  try {
    const { winners } = await api.get('/results?check=1');
    return winners || [];
  } catch {
    return [];
  }
};

// ─── Sincronización de Datos Offline ───────────────────────

export const syncOfflineData = async (dispatch) => {
  if (!isOnline()) return;

  const salesQueue = JSON.parse(localStorage.getItem('offline_sales_queue') || '[]');
  const resultsQueue = JSON.parse(localStorage.getItem('offline_results_queue') || '[]');

  if (salesQueue.length === 0 && resultsQueue.length === 0) return;

  // Notificar al usuario sobre el restablecimiento y el inicio de la sincronización
  toast.success('Conexión restablecida', { duration: 3000 });
  const toastId = toast.loading('Sincronizando documentos pendientes en el servidor, favor espere...');

  let syncedSalesCount = 0;
  let syncedResultsCount = 0;
  let totalMonto = 0.00;

  // Sincronizar Ventas
  const remainingSales = [];
  for (const item of salesQueue) {
    try {
      const res = await api.post('/sales', item.data);
      const sale = res.sales ? res.sales[0] : res.sale;
      syncedSalesCount++;
      totalMonto += parseFloat(sale.monto || 0);
      if (dispatch) {
        dispatch({ type: 'SYNC_SALE', payload: { tempId: item.id, realSale: sale } });
      }
    } catch (err) {
      console.error('[Sync] Error al sincronizar venta:', err);
      // Se mantiene en la cola si es un error de conexión transitorio
      remainingSales.push(item);
    }
  }
  localStorage.setItem('offline_sales_queue', JSON.stringify(remainingSales));

  // Sincronizar Resultados
  const remainingResults = [];
  for (const item of resultsQueue) {
    try {
      await api.post('/results', item.data);
      syncedResultsCount++;
    } catch (err) {
      console.error('[Sync] Error al sincronizar resultado:', err);
      remainingResults.push(item);
    }
  }
  localStorage.setItem('offline_results_queue', JSON.stringify(remainingResults));

  // Actualizar la cache local de ventas y resultados después de sincronizar con éxito
  try {
    if (syncedSalesCount > 0) {
      const { sales } = await api.get('/sales');
      if (sales) {
        localStorage.setItem('cached_sales', JSON.stringify(sales));
        if (dispatch) {
          dispatch({ type: 'LOAD_SALES', payload: sales });
        }
      }
    }
    if (syncedResultsCount > 0) {
      const { results } = await api.get('/results');
      if (results) {
        localStorage.setItem('cached_results', JSON.stringify(results));
      }
    }
    
    // Recargar resumen diario
    const summary = await api.get('/sales?summary=1');
    if (summary && dispatch) {
      localStorage.setItem('cached_summary', JSON.stringify(summary));
      dispatch({ type: 'SET_DAILY_SUMMARY', payload: summary });
    }
  } catch (refreshErr) {
    console.error('[Sync] Error al refrescar datos sincronizados:', refreshErr);
  }

  // Quitar el toast de carga
  toast.dismiss(toastId);

  // Notificar al usuario con el formato solicitado
  if (syncedSalesCount > 0) {
    toast.success(`${syncedSalesCount} ventas sincronizadas con un total de NIO ${totalMonto.toFixed(2)} en el servidor.`, { duration: 5000 });
  } else if (syncedResultsCount > 0) {
    toast.success(`${syncedResultsCount} resultados sincronizados en el servidor.`, { duration: 5000 });
  }
};
