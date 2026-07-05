// ============================================================
// printerService — Formateador y Servicio de Impresión Móvil
// Compatible con impresoras térmicas Bluetooth (Classic + BLE) vía Web Bluetooth API
// ============================================================
import { Alert, Platform, PermissionsAndroid } from 'react-native';
import { getLotteryById, formatLotteryNumber } from '../data/lotteryTypes';
import { formatHourAmPm } from './gameService';

// ─── Helpers para Fechas y Sorteos ─────────────────────────────
const getFecheaPlayValue = (line) => {
  if (!line) return '';
  if (line.numero && typeof line.numero === 'string' && line.numero.includes('/')) {
    return line.numero;
  }
  if (line.fecha && typeof line.fecha === 'string' && line.fecha.includes('/')) {
    return line.fecha;
  }
  return line.numero || '';
};

const formatFecheaDate = (str) => {
  if (!str || typeof str !== 'string') return '—';
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const parts = str.split('/');
  if (parts.length === 2) {
    const m = parseInt(parts[1], 10);
    return `${parts[0]} ${months[(m - 1)] || parts[1]}`;
  }
  return str;
};

const formatDrawDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateStr;
};

const getDrawHoursText = (sale) => {
  if (sale.multiHours && Array.isArray(sale.multiHours) && sale.multiHours.length > 0) {
    return sale.multiHours.map(formatHourAmPm).join(', ');
  }
  const hr = sale.horaSorteo || sale.hora_sorteo || sale.sorteo;
  return hr ? formatHourAmPm(hr) : '';
};

// Dynamic load of native printer module to prevent crash in Expo Go
let NativeBLEPrinter = null;
if (Platform.OS !== 'web') {
  try {
    const PrinterPkg = require('react-native-thermal-receipt-printer');
    NativeBLEPrinter = PrinterPkg.BLEPrinter;
  } catch (e) {
    console.log('[PrinterService] Native bluetooth printing library not available. Using web Bluetooth fallback.');
  }
}

// ─── Constantes ESC/POS ──────────────────────────────────────
const ESC = 0x1b;
const GS = 0x1d;
const INIT = [ESC, 0x40];                       // Inicializar impresora
const ALIGN_CENTER = [ESC, 0x61, 0x01];         // Centrar texto
const ALIGN_LEFT = [ESC, 0x61, 0x00];           // Alinear izquierda
const BOLD_ON = [ESC, 0x45, 0x01];              // Negrita ON
const BOLD_OFF = [ESC, 0x45, 0x00];             // Negrita OFF
const FONT_BIG = [GS, 0x21, 0x11];              // Texto 2x grande
const FONT_NORMAL = [GS, 0x21, 0x00];           // Texto normal
const CUT = [GS, 0x56, 0x41, 0x10];             // Cortar papel
const LINE_FEED = [0x0a];                         // Nueva línea
const DOTS_WIDTH_48 = 48;                         // Caracteres por línea (80mm)

// ─── Perfil de servicio BLE (UUID genérico para impresoras térmicas) ───
const THERMAL_PRINTER_SERVICE = 0x18f0;
const THERMAL_PRINTER_CHARACTERISTIC = 0x2af1;

// ─── Estado del módulo ──────────────────────────────────────
let _device = null;
let _characteristic = null;
let _connected = false;

// Helper para convertir texto a bytes
const textToBytes = (text) => {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(text));
};

const line = (text = '') => [...textToBytes(text), ...LINE_FEED];

const divider = (char = '-') => line(char.repeat(DOTS_WIDTH_48));

const paddedLine = (left, right, width = DOTS_WIDTH_48) => {
  const space = width - left.length - right.length;
  return line(left + ' '.repeat(Math.max(1, space)) + right);
};

// ─── Formateo del boleto para impresión binaria ───────────────────
const buildTicketBytes = (sale, settings) => {
  const lotteryId = sale.lotteryId || sale.lottery_id;
  const lottery = getLotteryById(lotteryId);
  if (!lottery) throw new Error('Tipo de rifa inválido');

  const businessName = settings.businessName || 'Zentric';
  const currency = settings.currency || 'NIO';

  const bytes = [];
  const push = (...cmds) => cmds.forEach((cmd) => bytes.push(...cmd));

  // Parsear fecha
  const dateObj = new Date(sale.createdAt || sale.created_at || Date.now());
  const dateStr = dateObj.toLocaleDateString('es-ES') + ' ' + dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // ─ Encabezado ─
  push(
    INIT,
    ALIGN_CENTER,
    BOLD_ON,
    FONT_BIG,
    line(businessName.toUpperCase()),
    FONT_NORMAL,
    BOLD_OFF,
    line(lottery.name),
    divider('='),
    ALIGN_LEFT,
  );

  push(...paddedLine('Fecha venta:', dateStr));
  push(...paddedLine('Fecha sorteo:', formatDrawDate(sale.lines?.[0]?.fecha || sale.drawDate)));
  const drawHoursText = getDrawHoursText(sale);
  if (drawHoursText) {
    push(...paddedLine('Sorteo Hora:', drawHoursText));
  }
  push(...paddedLine('Cliente:', sale.comprador || '—'));
  push(...divider());

  // ─ Jugadas ─
  const lines = sale.lines || [];
  if (lines.length > 5) {
    // Boleto resumido por rango
    let rangeTxt = '';
    const unitM = parseFloat(lines[0]?.monto || 0);
    const winM = unitM * parseFloat(lottery.payoutMultiplier || 80);
    
    if (lotteryId === 'fechea') {
      rangeTxt = `${lines.length} Fechas`;
    } else {
      const nums = lines.map(l => parseInt(l.numero, 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
      if (nums.length > 0) {
        rangeTxt = `De ${nums[0]} a ${nums[nums.length-1]}`;
      } else {
        rangeTxt = `${lines.length} numeros`;
      }
    }
    
    push(
      ALIGN_CENTER,
      BOLD_ON,
      line('*** COMPRA EN RANGO / SERIE ***'),
      LINE_FEED,
      FONT_BIG,
      line(rangeTxt),
      FONT_NORMAL,
      BOLD_OFF,
      ALIGN_LEFT,
      divider(),
    );
    push(...paddedLine('Cantidad de jugadas:', `${lines.length} numeros`));
    push(...paddedLine('Inversion por numero:', `${currency} ${unitM.toFixed(2)}`));
    push(BOLD_ON);
    push(...paddedLine('PREMIO POR JUGADA GANADORA:', `${currency} ${winM.toFixed(2)}`));
    push(BOLD_OFF, divider());
    push(BOLD_ON);
    push(...paddedLine('INVERSION TOTAL:', `${currency} ${parseFloat(sale.monto).toFixed(2)}`));
    push(BOLD_OFF);
  } else if (lines.length === 1) {
    // Una sola jugada — mostrar grande
    const l = lines[0];
    push(ALIGN_CENTER, BOLD_ON, FONT_BIG);
    if (lotteryId === 'fechea') {
      push(...line(formatFecheaDate(getFecheaPlayValue(l))));
    } else {
      push(...line(`# ${formatLotteryNumber(lotteryId, l.numero)}`));
    }
    push(FONT_NORMAL, BOLD_OFF, ALIGN_LEFT);
    if (l.modalidad) push(...paddedLine('Modalidad:', l.modalidad.toUpperCase()));
    if (l.serie)     push(...paddedLine('Serie:', l.serie));
    if (l.fraccion)  push(...paddedLine('Fracción:', String(l.fraccion)));
    if (l.fecha && lotteryId !== 'fechea') push(...paddedLine('Sorteo:', l.fecha));
    push(...divider());
    push(BOLD_ON);
    push(...paddedLine('MONTO:', `${currency} ${parseFloat(l.monto).toFixed(2)}`));
    push(BOLD_OFF);
  } else {
    // Múltiples jugadas — listar
    lines.forEach((l, i) => {
      const numStr = lotteryId === 'fechea'
        ? formatFecheaDate(getFecheaPlayValue(l))
        : `#${formatLotteryNumber(lotteryId, l.numero)}`;
      const montoStr = `${currency} ${parseFloat(l.monto).toFixed(2)}`;
      const dateStr2 = (l.fecha && lotteryId !== 'fechea') ? ` (${l.fecha})` : '';
      push(...paddedLine(`${i + 1}. ${numStr}${dateStr2}`, montoStr));
    });
    push(...divider());
    push(BOLD_ON);
    push(...paddedLine('TOTAL:', `${currency} ${parseFloat(sale.monto).toFixed(2)}`));
    push(BOLD_OFF);
  }

  // ─ ID de venta y sello ─
  push(...divider());
  push(ALIGN_CENTER);
  push(...line(`ID: ${sale.id?.split('_').pop()?.toUpperCase()}`));
  push(...line('¡Buena suerte!'));

  // ─ Corte ─
  push(LINE_FEED, LINE_FEED, LINE_FEED, CUT);

  return new Uint8Array(bytes.flat());
};

// Helper para convertir Uint8Array a Base64 de forma compatible con cualquier entorno
const uint8ToBase64 = (arr) => {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(arr).toString('base64');
};

// Helper para solicitar permisos de Bluetooth en Android de forma asíncrona
const requestBluetoothPermission = async () => {
  if (Platform.OS === 'android') {
    try {
      const apiLevel = parseInt(Platform.Version, 10);
      if (apiLevel >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return (
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn('[PrinterService] Error al solicitar permisos de Bluetooth:', err);
      return false;
    }
  }
  return true;
};

// ─── Conexión Bluetooth Web API y Nativo ───────────────────────
export const connectPrinter = async () => {
  if (Platform.OS !== 'web') {
    if (NativeBLEPrinter) {
      try {
        const hasPermission = await requestBluetoothPermission();
        if (!hasPermission) {
          throw new Error('Permisos de Bluetooth denegados. Actívelos en los ajustes del teléfono.');
        }

        await NativeBLEPrinter.init();
        const devices = await NativeBLEPrinter.getDeviceList();
        if (devices && devices.length > 0) {
          const dev = devices[0];
          await NativeBLEPrinter.connectPrinter(dev.inner_mac_address || dev.address);
          _connected = true;
          _device = {
            name: dev.device_name || dev.name || 'Impresora térmica',
            id: dev.inner_mac_address || dev.address,
          };
          return _device;
        } else {
          throw new Error('No se encontraron impresoras vinculadas en este teléfono.');
        }
      } catch (err) {
        _connected = false;
        console.warn('[PrinterService] Error de Bluetooth nativo:', err);
        const errMsg = typeof err === 'string' ? err : (err?.message || JSON.stringify(err) || 'Error de inicialización nativa');
        throw new Error(`Error de Bluetooth nativo: ${errMsg}`);
      }
    } else {
      throw new Error(
        'Expo Go no soporta Bluetooth nativo.\n\n' +
        'Para probar la impresora en modo desarrollo:\n' +
        '1. Ejecute la app en el navegador de su teléfono (Expo Web) usando Google Chrome.\n' +
        '2. O genere una Build de Desarrollo / APK de producción de la app.'
      );
    }
  }

  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error('Este navegador o dispositivo no soporta Bluetooth Web API.');
  }

  try {
    _device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [THERMAL_PRINTER_SERVICE, 'generic_attribute'],
    });

    _device.addEventListener('gattserverdisconnected', () => {
      _connected = false;
      _characteristic = null;
      console.log('[Printer] Desconectado');
    });

    const server = await _device.gatt.connect();
    
    try {
      const service = await server.getPrimaryService(THERMAL_PRINTER_SERVICE);
      _characteristic = await service.getCharacteristic(THERMAL_PRINTER_CHARACTERISTIC);
    } catch (err) {
      console.warn('[Printer] No se pudo obtener característica estándar, usando modo raw:', err.message);
      _characteristic = null;
    }

    _connected = true;

    return {
      name: _device.name || 'Impresora térmica',
      id: _device.id,
      connected: true,
    };
  } catch (err) {
    _connected = false;
    throw new Error(`No se pudo conectar: ${err.message}`);
  }
};

export const disconnectPrinter = () => {
  if (Platform.OS !== 'web' && NativeBLEPrinter) {
    try {
      NativeBLEPrinter.closeConn && NativeBLEPrinter.closeConn();
    } catch (e) {}
    _device = null;
    _characteristic = null;
    _connected = false;
    return;
  }

  if (_device && _device.gatt.connected) {
    _device.gatt.disconnect();
  }
  _device = null;
  _characteristic = null;
  _connected = false;
};

export const isPrinterConnected = () => _connected && _device !== null;

export const getConnectedDevice = () =>
  _device ? { name: _device.name || 'Impresora', id: _device.id } : null;

// Envío en paquetes
const CHUNK_SIZE = 512;
const sendChunked = async (data) => {
  if (!_characteristic) throw new Error('Impresora no conectada o sin característica disponible.');

  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    await _characteristic.writeValueWithoutResponse(chunk);
    await new Promise((r) => setTimeout(r, 50));
  }
};

// Imprimir ticket de venta
export const printTicket = async (sale, settings) => {
  if (Platform.OS !== 'web' && NativeBLEPrinter) {
    if (!_connected) throw new Error('No hay impresora conectada.');
    const bytes = buildTicketBytes(sale, settings);
    await NativeBLEPrinter.printRawData(uint8ToBase64(bytes));
    return true;
  }

  if (!isPrinterConnected()) {
    throw new Error('No hay impresora conectada.');
  }

  const bytes = buildTicketBytes(sale, settings);
  await sendChunked(bytes);
  return true;
};

// Imprimir página de prueba
export const printTestPage = async () => {
  const encoder = new TextEncoder();
  const testText = [
    ...Array.from([0x1b, 0x40]),          // INIT
    ...Array.from([0x1b, 0x61, 0x01]),    // CENTER
    ...Array.from(encoder.encode('=== PRUEBA DE IMPRESION ===')),
    0x0a,
    ...Array.from(encoder.encode('Conexion Exitosa ✓')),
    0x0a,
    ...Array.from(encoder.encode('Zentric')),
    0x0a, 0x0a, 0x0a,
    ...Array.from([0x1d, 0x56, 0x41, 0x10]), // CUT
  ];

  if (Platform.OS !== 'web' && NativeBLEPrinter) {
    if (!_connected) throw new Error('No hay impresora conectada.');
    await NativeBLEPrinter.printRawData(uint8ToBase64(new Uint8Array(testText)));
    return;
  }

  if (!isPrinterConnected()) {
    throw new Error('No hay impresora conectada.');
  }

  await sendChunked(new Uint8Array(testText));
};

// Formatear texto simple para vista previa en pantalla (Móvil)
export const formatTicketText = (sale, settings) => {
  if (!sale) return '';
  const lines = [];
  const business = settings.businessName || 'Zentric';
  const currency = settings.currency || 'NIO';

  const centerText = (text) => {
    if (!text) return '';
    const str = String(text);
    if (str.length >= DOTS_WIDTH_48) return str.substring(0, DOTS_WIDTH_48);
    const leftPadding = Math.floor((DOTS_WIDTH_48 - str.length) / 2);
    return ' '.repeat(leftPadding) + str;
  };

  const formatRowBetween = (left, right) => {
    const lStr = String(left || '');
    const rStr = String(right || '');
    const spaceNeeded = DOTS_WIDTH_48 - lStr.length - rStr.length;
    if (spaceNeeded <= 0) return lStr + ' ' + rStr;
    return lStr + ' '.repeat(spaceNeeded) + rStr;
  };

  lines.push(centerText('*** ' + business.toUpperCase() + ' ***'));
  lines.push(centerText('BOLETO DE LOTERIA'));
  lines.push('-'.repeat(DOTS_WIDTH_48));

  lines.push(formatRowBetween(`Boleto ID: ${sale.id?.split('_').pop()?.toUpperCase()}`, `Fecha Venta: ${new Date(sale.createdAt || sale.created_at).toLocaleDateString('es-ES')}`));
  lines.push(formatRowBetween(`Fecha Sorteo: ${formatDrawDate(sale.lines?.[0]?.fecha || sale.drawDate)}`, ''));
  lines.push(formatRowBetween(`Vendedor: ${sale.sellerName || 'Móvil'}`, `Hora: ${new Date(sale.createdAt || sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`));
  const drawHoursText = getDrawHoursText(sale);
  const game = getLotteryById(sale.lotteryId || sale.lottery_id) || {};
  lines.push(formatRowBetween(`Sorteo: ${game.name || 'Rifa'}`, drawHoursText ? `Hora: ${drawHoursText}` : ''));
  lines.push(formatRowBetween(`Cliente: ${sale.comprador || '—'}`, ''));
  lines.push('='.repeat(DOTS_WIDTH_48));

  // Lista jugadas
  const saleLines = sale.lines || [];
  saleLines.forEach((ln, idx) => {
    const numStr = (sale.lotteryId || sale.lottery_id) === 'fechea'
      ? formatFecheaDate(getFecheaPlayValue(ln))
      : `#${formatLotteryNumber(sale.lotteryId || sale.lottery_id, ln.numero)}`;
    lines.push(`${idx + 1}. ${numStr}  ${currency} ${parseFloat(ln.monto).toFixed(2)}`);
  });

  lines.push('=').repeat(DOTS_WIDTH_48);
  lines.push(formatRowBetween('TOTAL A PAGAR:', `${currency} ${parseFloat(sale.monto).toFixed(2)}`));
  lines.push('-'.repeat(DOTS_WIDTH_48));
  lines.push(centerText('¡MUCHISIMA SUERTE!'));
  lines.push('\n\n\n');

  return lines.join('\n');
};
