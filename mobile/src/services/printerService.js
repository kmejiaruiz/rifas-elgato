// ============================================================
// printerService — Formateador y Servicio de Impresión Móvil
// Totalmente optimizado para Impresoras Térmicas de 80mm (48 caracteres)
// ============================================================
import { Alert } from 'react-native';

const PAGE_WIDTH = 48; // Límite estándar para impresoras de 80mm (Font A)

// Auxiliar para centrar texto
const centerText = (text) => {
  if (!text) return '';
  const str = String(text);
  if (str.length >= PAGE_WIDTH) return str.substring(0, PAGE_WIDTH);
  const leftPadding = Math.floor((PAGE_WIDTH - str.length) / 2);
  return ' '.repeat(leftPadding) + str;
};

// Auxiliar para crear una fila con dos columnas alineadas a los extremos
const formatRowBetween = (left, right) => {
  const lStr = String(left || '');
  const rStr = String(right || '');
  const spaceNeeded = PAGE_WIDTH - lStr.length - rStr.length;
  if (spaceNeeded <= 0) return lStr + ' ' + rStr;
  return lStr + ' '.repeat(spaceNeeded) + rStr;
};

// Auxiliar para formatear filas con columnas específicas (alineación tabular)
// 80mm: NUM (6) + MOD (12) + DETALLE (18) + MONTO (12) = 48 chars
const formatPlayLine = (num, mod, details, amount) => {
  const cNum = String(num || '').padEnd(8, ' ');
  const cMod = String(mod || 'Regular').padEnd(12, ' ');
  const cDet = String(details || '').padEnd(16, ' ');
  const cAmt = String(amount || '0.00').padStart(12, ' ');
  return cNum + cMod + cDet + cAmt;
};

export const formatTicketText = (sale, settings) => {
  if (!sale) return '';
  const lines = [];

  const business = settings.businessName || 'Rifas Express';
  const currency = settings.currency || 'NIO';

  // --- Cabecera ---
  lines.push(centerText('*** ' + business.toUpperCase() + ' ***'));
  lines.push(centerText('BOLETO DE LOTERIA'));
  lines.push('-'.repeat(PAGE_WIDTH));

  // --- Info del Boleto ---
  lines.push(formatRowBetween(`Boleto ID: ${sale.id.substring(5, 17).toUpperCase()}`, `Fecha: ${new Date(sale.created_at).toLocaleDateString()}`));
  lines.push(formatRowBetween(`Vendedor: ${sale.seller_name || 'Móvil'}`, `Hora: ${new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`));
  lines.push(formatRowBetween(`Sorteo: ${sale.lottery_id.toUpperCase()}`, `Hora Sorteo: ${sale.hora_sorteo}`));
  if (sale.comprador) {
    lines.push(formatRowBetween(`Cliente: ${sale.comprador}`, ''));
  }
  lines.push('='.repeat(PAGE_WIDTH));

  // --- Encabezados de Columna ---
  lines.push(formatPlayLine('NÚMERO', 'MODALIDAD', 'DETALLES', 'MONTO'));
  lines.push('-'.repeat(PAGE_WIDTH));

  // --- Lista de Jugadas ---
  const saleLines = sale.lines || [];
  saleLines.forEach((ln) => {
    let numStr = ln.numero;
    if (sale.lottery_id === 'fechea') {
      // Formatea fecha en ticket
      numStr = ln.numero;
    } else {
      // Auto-pad
      const digits = sale.lottery_id === 'la_tica' || sale.lottery_id === 'la_hondurena' ? 2 : (sale.lottery_id === 'juega3' ? 3 : 4);
      numStr = String(ln.numero).padStart(digits, '0');
    }

    let detailStr = '';
    if (ln.serie) detailStr += `S:${ln.serie} `;
    if (ln.fraccion) detailStr += `F:${ln.fraccion} `;

    lines.push(formatPlayLine(
      numStr,
      ln.modalidad || 'Normal',
      detailStr.trim(),
      `${currency} ${parseFloat(ln.monto).toFixed(2)}`
    ));
  });

  lines.push('='.repeat(PAGE_WIDTH));

  // --- Total ---
  lines.push(formatRowBetween('CANTIDAD DE JUGADAS:', String(saleLines.length)));
  lines.push(formatRowBetween('TOTAL A PAGAR:', `${currency} ${parseFloat(sale.monto).toFixed(2)}`));
  lines.push('-'.repeat(PAGE_WIDTH));

  // --- Pie de ticket ---
  lines.push(centerText('¡MUCHISIMA SUERTE!'));
  lines.push(centerText('Revise su boleto. No se aceptan reclamos'));
  lines.push(centerText('después de iniciado el sorteo.'));
  lines.push(centerText('*** GRACIAS POR SU COMPRA ***'));
  lines.push('\n\n\n'); // Espacio de corte

  return lines.join('\n');
};

export const printTicket = async (sale, settings) => {
  try {
    const text = formatTicketText(sale, settings);
    
    // Simular la impresión en un dispositivo nativo.
    // Esto se puede reemplazar en producción con comandos Bluetooth ESC/POS:
    // Ex: BluetoothSerial.write(text);
    
    console.log('[Impresora 80mm]\n', text);
    
    Alert.alert(
      'Impresión Exitosa (80mm)',
      `El ticket del boleto se envió a la impresora térmica.\n\nContenido abreviado:\nTotal: ${settings.currency} ${parseFloat(sale.monto).toFixed(2)}\nLíneas: ${sale.lines?.length}`,
      [{ text: 'OK' }]
    );
    return true;
  } catch (err) {
    Alert.alert('Error de Impresión', err.message);
    return false;
  }
};
