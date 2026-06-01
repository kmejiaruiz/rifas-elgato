/**
 * Parsea un string de fecha MySQL ("2026-05-19 09:34:35") de forma segura.
 * new Date("2026-05-19 09:34:35") falla en Safari/Firefox — reemplaza el espacio por T.
 */
export const parseDate = (dateStr) => {
  if (!dateStr) return new Date();
  // MySQL: "2026-05-19 09:34:35" → ISO: "2026-05-19T09:34:35"
  return new Date(String(dateStr).replace(' ', 'T'));
};

/**
 * Formatea un string de fecha de Fechea ("DD/MM", ej. "25/12") a formato legible (ej. "25 Ene")
 */
export const formatFecheaDate = (fechaStr) => {
  if (!fechaStr || typeof fechaStr !== 'string') return fechaStr;
  const parts = fechaStr.split('/');
  if (parts.length !== 2) return fechaStr;
  const day = parseInt(parts[0], 10);
  const monthVal = parseInt(parts[1], 10);
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  if (isNaN(day) || isNaN(monthVal) || monthVal < 1 || monthVal > 12) return fechaStr;
  return `${day} ${months[monthVal - 1]}`;
};

/**
 * Obtiene de forma retrocompatible el valor de la jugada de Fechea (DD/MM) de una línea de venta.
 * En registros anteriores se guardaba en "fecha". En registros nuevos se guarda en "numero".
 */
export const getFecheaPlayValue = (line) => {
  if (!line) return '';
  if (line.numero && typeof line.numero === 'string' && line.numero.includes('/')) {
    return line.numero;
  }
  if (line.fecha && typeof line.fecha === 'string' && line.fecha.includes('/')) {
    return line.fecha;
  }
  return line.numero || '';
};
