// ============================================================
// Servicio de impresión Bluetooth vía Web Bluetooth API + ESC/POS
// Compatible con impresoras térmicas Bluetooth (Classic + BLE)
// ============================================================

import { formatLotteryNumber, getLotteryById } from '../data/lotteryTypes';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseDate, formatFecheaDate, getFecheaPlayValue } from '../utils/dateUtils';

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
const DOTS_WIDTH_48 = 48;                         // Caracteres por línea (58mm)

const formatHourAmPm = (hourStr) => {
  if (!hourStr) return '';
  let str = String(hourStr).trim().toLowerCase();
  str = str.replace(/(hrs|horas|hr|h)/g, '').trim();
  let h = 0, m = 0;
  if (str.includes(':')) {
    const parts = str.split(':');
    h = Number(parts[0]);
    m = Number(parts[1]);
  } else {
    h = Number(str);
    m = 0;
  }
  if (isNaN(h) || isNaN(m)) return hourStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  const displayM = String(m).padStart(2, '0');
  return `${displayH}:${displayM} ${ampm}`;
};

const getDrawHoursText = (sale) => {
  if (sale.multiHours && Array.isArray(sale.multiHours) && sale.multiHours.length > 0) {
    return sale.multiHours.map(formatHourAmPm).join(', ');
  }
  const hr = sale.horaSorteo || sale.hora_sorteo || sale.sorteo;
  return hr ? formatHourAmPm(hr) : '';
};


// ─── Perfil de servicio BLE (UUID genérico para impresoras térmicas) ───
const THERMAL_PRINTER_SERVICE = 0x18f0;
const THERMAL_PRINTER_CHARACTERISTIC = 0x2af1;

// ─── Estado del módulo ──────────────────────────────────────
let _device = null;
let _characteristic = null;
let _connected = false;

// ─── Helpers de texto ESC/POS ────────────────────────────────

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

const centerLine = (text) => {
  const padded = text.padStart(Math.floor((DOTS_WIDTH_48 + text.length) / 2));
  return line(padded);
};

// ─── Formateo del boleto para impresión ──────────────────────

const buildTicketBytes = (sale, businessName = 'Amaranto') => {
  const lottery = getLotteryById(sale.lotteryId);
  if (!lottery) throw new Error('Tipo de rifa inválido');

  const bytes = [];
  const push = (...cmds) => cmds.forEach((cmd) => bytes.push(...cmd));

  const now = parseDate(sale.createdAt);
  const dateStr = format(now, "dd/MM/yyyy HH:mm", { locale: es });

  // ─ Encabezado ─
  push(
    INIT,
    ALIGN_CENTER,
    BOLD_ON,
    FONT_BIG,
    line(businessName),
    FONT_NORMAL,
    BOLD_OFF,
    line(lottery.name + (getDrawHoursText(sale) ? " (" + getDrawHoursText(sale) + ")" : "")),
    divider('='),
    ALIGN_LEFT,
  );

  push(...paddedLine('Fecha venta:', dateStr));
  if (sale.comprador) push(...paddedLine('Comprador:', sale.comprador));
  push(...divider());

  // ─ Jugadas ─
  const lines = sale.lines || [];
  if (lines.length > 10) {
    // Boleto resumido por rango
    let rangeTxt = '';
    const unitM = parseFloat(lines[0]?.monto || 0);
    const winM = unitM * parseFloat(lottery.payoutMultiplier || 80);
    
    if (sale.lotteryId === 'fechea') {
      rangeTxt = `${lines.length} Fechas`;
    } else {
      const nums = lines.map(l => parseInt(l.numero, 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
      if (nums.length > 0) {
        rangeTxt = `De ${formatLotteryNumber(sale.lotteryId, nums[0])} a ${formatLotteryNumber(sale.lotteryId, nums[nums.length-1])}`;
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
    push(...paddedLine('Inversion por numero:', `${lottery.priceLabel}${unitM.toFixed(2)}`));
    push(BOLD_ON);
    push(...paddedLine('PREMIO POR NUMERO GANADOR:', `${lottery.priceLabel}${winM.toFixed(2)}`));
    push(BOLD_OFF, divider());
    push(BOLD_ON);
    push(...paddedLine('INVERSION TOTAL:', `${lottery.priceLabel}${parseFloat(sale.monto).toFixed(2)}`));
    push(BOLD_OFF);
  } else if (lines.length === 1) {
    // Una sola jugada — mostrar grande
    const l = lines[0];
    push(ALIGN_CENTER, BOLD_ON, FONT_BIG);
    if (sale.lotteryId === 'fechea') {
      push(...line(`${formatFecheaDate(getFecheaPlayValue(l))}`));
    } else {
      push(...line(`# ${formatLotteryNumber(sale.lotteryId, l.numero)}`));
    }
    push(FONT_NORMAL, BOLD_OFF, ALIGN_LEFT);
    if (l.modalidad) push(...paddedLine('Modalidad:', l.modalidad.toUpperCase()));
    if (l.serie)     push(...paddedLine('Serie:', l.serie));
    if (l.fraccion)  push(...paddedLine('Fracción:', String(l.fraccion)));
    if (l.fecha && sale.lotteryId !== 'fechea') push(...paddedLine('Sorteo:', l.fecha));
    push(...divider());
    push(BOLD_ON);
    push(...paddedLine('MONTO:', `${lottery.priceLabel}${parseFloat(l.monto).toFixed(2)}`));
    push(BOLD_OFF);
  } else {
    // Múltiples jugadas — listar en tabla
    lines.forEach((l, i) => {
      const numStr = sale.lotteryId === 'fechea'
        ? formatFecheaDate(getFecheaPlayValue(l))
        : `#${formatLotteryNumber(sale.lotteryId, l.numero)}`;
      const montoStr = `${lottery.priceLabel}${parseFloat(l.monto).toFixed(2)}`;
      const dateStr2 = (l.fecha && sale.lotteryId !== 'fechea') ? ` (${l.fecha})` : '';
      push(...paddedLine(`${i + 1}. ${numStr}${dateStr2}`, montoStr));
    });
    push(...divider());
    push(BOLD_ON);
    push(...paddedLine('TOTAL:', `${lottery.priceLabel}${parseFloat(sale.monto).toFixed(2)}`));
    push(BOLD_OFF);
  }

  // ─ ID de venta ─
  push(...divider());
  push(ALIGN_CENTER);
  push(...line(`ID: ${sale.id?.split('_')[1] || sale.id}`));
  push(...line('¡Buena suerte!'));

  // ─ Corte ─
  push(LINE_FEED, LINE_FEED, LINE_FEED, CUT);

  return new Uint8Array(bytes.flat());
};

// ─── Conexión Bluetooth ──────────────────────────────────────

/**
 * Solicita y conecta a una impresora térmica Bluetooth.
 * @returns {Object} Información del dispositivo conectado
 */
export const connectPrinter = async () => {
  if (!navigator.bluetooth) {
    throw new Error('Este navegador no soporta Bluetooth. Usa Chrome en Android.');
  }

  try {
    // Intentar con BLE (Bluetooth Low Energy)
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
    } catch {
      // Algunos dispositivos usan servicios propietarios — intentamos sin característica específica
      // La impresión se hará enviando datos raw al dispositivo
      console.warn('[Printer] No se pudo obtener característica estándar, usando modo raw');
      _characteristic = null;
    }

    _connected = true;

    return {
      name: _device.name || 'Impresora desconocida',
      id: _device.id,
      connected: true,
    };
  } catch (err) {
    _connected = false;
    throw new Error(`No se pudo conectar: ${err.message}`);
  }
};

/**
 * Desconecta la impresora actual.
 */
export const disconnectPrinter = () => {
  if (_device && _device.gatt.connected) {
    _device.gatt.disconnect();
  }
  _device = null;
  _characteristic = null;
  _connected = false;
};

/**
 * Retorna true si hay una impresora conectada.
 */
export const isPrinterConnected = () => _connected && _device !== null;

/**
 * Retorna info del dispositivo conectado.
 */
export const getConnectedDevice = () =>
  _device ? { name: _device.name || 'Impresora', id: _device.id } : null;

// ─── Envío de datos ──────────────────────────────────────────

const CHUNK_SIZE = 512; // Bytes por paquete (límite BLE)

const sendChunked = async (data) => {
  if (!_characteristic) throw new Error('Impresora no conectada o sin característica disponible');

  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    await _characteristic.writeValueWithoutResponse(chunk);
    await new Promise((r) => setTimeout(r, 50)); // Pausa entre paquetes
  }
};

// ─── API Pública ─────────────────────────────────────────────

/**
 * Imprime un boleto de rifa.
 * @param {Object} sale - Datos de la venta
 * @param {string} businessName - Nombre del negocio (aparece en el encabezado)
 */
export const printTicket = async (sale, businessName = 'Amaranto') => {
  if (!isPrinterConnected()) {
    throw new Error('No hay impresora conectada. Ve a Configuración > Impresora.');
  }

  const bytes = buildTicketBytes(sale, businessName);
  await sendChunked(bytes);
};

/**
 * Imprime una página de prueba.
 */
export const printTestPage = async () => {
  if (!isPrinterConnected()) {
    throw new Error('No hay impresora conectada.');
  }

  const encoder = new TextEncoder();
  const testText = [
    ...Array.from([0x1b, 0x40]),          // INIT
    ...Array.from([0x1b, 0x61, 0x01]),    // CENTER
    ...Array.from(encoder.encode('=== PRUEBA DE IMPRESION ===')),
    0x0a,
    ...Array.from(encoder.encode('Amaranto')),
    0x0a,
    ...Array.from(encoder.encode('Impresora conectada OK')),
    0x0a, 0x0a, 0x0a,
    ...Array.from([0x1d, 0x56, 0x41, 0x10]), // CUT
  ];

  await sendChunked(new Uint8Array(testText));
};

/**
 * Genera una vista previa en texto plano del boleto (para mostrar en pantalla).
 * @param {Object} sale
 * @param {string} businessName
 * @returns {string}
 */
export const getTicketPreviewText = (sale, businessName = 'Amaranto') => {
  const lottery = getLotteryById(sale.lotteryId);
  if (!lottery) return '';

  const now = parseDate(sale.createdAt);
  const dateStr = format(now, "dd/MM/yyyy HH:mm", { locale: es });

  const lines = [
    '================================',
    `        ${businessName}`,
    `    ${lottery.name}${getDrawHoursText(sale) ? ` (${getDrawHoursText(sale)})` : ''}`,
    '================================',
  ];

  if (sale.sorteo) {
    const draw = lottery.draws?.find((d) => d.value === sale.sorteo);
    lines.push(`Sorteo: ${draw?.label || sale.sorteo}`);
  }

  lines.push(`Fecha: ${dateStr}`);
  if (sale.comprador) lines.push(`Comprador: ${sale.comprador}`);
  lines.push('--------------------------------');

  const saleLines = sale.lines || [];
  if (saleLines.length > 10) {
    let rangeTxt = '';
    const unitM = parseFloat(saleLines[0]?.monto || 0);
    const winM = unitM * parseFloat(lottery.payoutMultiplier || 80);
    
    if (sale.lotteryId === 'fechea') {
      rangeTxt = `${saleLines.length} Fechas`;
    } else {
      const nums = saleLines.map(l => parseInt(l.numero, 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
      if (nums.length > 0) {
        rangeTxt = `De ${formatLotteryNumber(sale.lotteryId, nums[0])} a ${formatLotteryNumber(sale.lotteryId, nums[nums.length-1])}`;
      } else {
        rangeTxt = `${saleLines.length} números`;
      }
    }
    
    lines.push('   *** COMPRA EN RANGO / SERIE ***');
    lines.push(`   RANGO: ${rangeTxt}`);
    lines.push(`   Cant. Números: ${saleLines.length}`);
    lines.push(`   Inv. por Número: ${lottery.priceLabel}${unitM.toFixed(2)}`);
    lines.push(`   PREMIO GANADOR: ${lottery.priceLabel}${winM.toFixed(2)}`);
    lines.push('--------------------------------');
    lines.push(`INVERSION TOTAL: ${lottery.priceLabel}${parseFloat(sale.monto || 0).toFixed(2)}`);
  } else if (saleLines.length === 1) {
    const l = saleLines[0];
    if (sale.lotteryId === 'fechea') {
      lines.push(`   FECHA: ${formatFecheaDate(getFecheaPlayValue(l))}`);
    } else {
      lines.push(`   # ${formatLotteryNumber(sale.lotteryId, l.numero)}`);
    }
    if (l.modalidad) lines.push(`Modalidad: ${l.modalidad.toUpperCase()}`);
    if (l.serie)     lines.push(`Serie: ${l.serie}`);
    if (l.fraccion)  lines.push(`Fracción: ${l.fraccion}`);
    if (l.fecha && sale.lotteryId !== 'fechea') lines.push(`Fecha sorteo: ${l.fecha}`);
    lines.push('--------------------------------');
    lines.push(`MONTO: ${lottery.priceLabel}${parseFloat(l.monto || 0).toFixed(2)}`);
  } else {
    saleLines.forEach((l, i) => {
      const numStr = sale.lotteryId === 'fechea'
        ? formatFecheaDate(getFecheaPlayValue(l))
        : `#${formatLotteryNumber(sale.lotteryId, l.numero)}`;
      const dateTag = (l.fecha && sale.lotteryId !== 'fechea') ? ` (${l.fecha})` : '';
      lines.push(`${i + 1}. ${numStr}${dateTag}  ${lottery.priceLabel}${parseFloat(l.monto || 0).toFixed(2)}`);
    });
    lines.push('--------------------------------');
    lines.push(`TOTAL: ${lottery.priceLabel}${parseFloat(sale.monto || 0).toFixed(2)}`);
  }

  lines.push('================================');
  lines.push('        ¡Buena suerte!');

  return lines.join('\n');
};
