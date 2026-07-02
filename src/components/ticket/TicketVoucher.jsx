import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, Share2, Eye, X, Check, QrCode, Sparkles, Printer } from 'lucide-react';
import { getLotteryById, formatLotteryNumber } from '../../data/lotteryTypes';
import { format } from 'date-fns';
import { parseDate, formatFecheaDate, getFecheaPlayValue } from '../../utils/dateUtils';
import toast from 'react-hot-toast';
import { usePrinter } from '../../context/PrinterContext';

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

const formatDrawDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateStr;
};

export const TicketVoucher = ({ sale, settings, onClose }) => {
  const voucherRef = useRef(null);
  const [theme, setTheme] = useState('digital'); // 'digital' | 'thermal'
  const [isExporting, setIsExporting] = useState(false);
  const { print, connected, printing, connect, connecting } = usePrinter();

  if (!sale) return null;

  const lottery = getLotteryById(sale.lotteryId);
  const payoutMultiplier = parseFloat(lottery?.payoutMultiplier || 80);
  const lines = sale.lines || [];

  // Formatear fecha y hora
  let dateStr = '—';
  let timeStr = '—';
  try {
    const pDate = parseDate(sale.createdAt);
    dateStr = format(pDate, 'dd/MM/yyyy');
    timeStr = format(pDate, 'HH:mm:ss');
  } catch (err) {
    console.error('Error parsing date:', err);
  }

  // Datos para el QR Code
  const qrValidationText = `--- TICKET OFICIAL ---\nID: ${sale.id?.split('_').pop()}\nEmpresa: ${settings.businessName}\nSorteo: ${lottery?.name || 'Rifa'}\nTotal: ${settings.currency} ${parseFloat(sale.monto).toFixed(2)}\nFecha: ${dateStr} ${timeStr}\nVendedor: ${sale.sellerName}\nSello: ORIGINAL_SECURE_VAL`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrValidationText)}&margin=10`;

  // Descargar Boleto como Imagen
  const handleDownloadImage = async () => {
    if (!voucherRef.current) return;
    setIsExporting(true);
    toast.loading('Generando imagen del boleto...', { id: 'export-image' });

    // Esperar a que la imagen del código QR y cualquier otra imagen estén cargadas al 100%
    const images = voucherRef.current.querySelectorAll('img');
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
    await Promise.all(imagePromises);

    // Guardar posición de scroll original de la ventana
    const originalScrollY = window.scrollY;
    const originalScrollX = window.scrollX;

    // Guardar estilos y posición de scroll del modal-sheet padre
    const parentSheet = voucherRef.current.parentElement;
    let originalParentScrollTop = 0;
    let originalParentMaxHeight = '';
    let originalParentOverflowY = '';

    if (parentSheet) {
      originalParentScrollTop = parentSheet.scrollTop;
      originalParentMaxHeight = parentSheet.style.maxHeight;
      originalParentOverflowY = parentSheet.style.overflowY;

      // Quitar límites de scroll del modal-sheet durante la captura
      parentSheet.scrollTop = 0;
      parentSheet.style.maxHeight = 'none';
      parentSheet.style.overflowY = 'visible';
    }

    // Desplazar la ventana al inicio para evitar líneas blancas o cortes debido al scroll
    window.scrollTo(0, 0);

    // Esperar un pequeño lapso para que los estilos de exportación y scroll se asienten
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const element = voucherRef.current;
      const canvas = await html2canvas(element, {
        useCORS: true,
        scale: 2.5, // 2.5x para nitidez ultra premium en texto
        backgroundColor: theme === 'digital' ? '#0f172a' : '#ffffff',
        logging: false,
        height: element.scrollHeight,
        windowHeight: element.scrollHeight,
      });

      // Exportar en formato JPEG de alta calidad (0.95) en lugar de PNG
      // Esto aplana las transparencias contra el color de fondo y erradica líneas blancas fantasma
      const image = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.href = image;
      link.download = `Boleto_${lottery?.name.replace(/\s+/g, '_')}_${sale.id?.split('_').pop()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('¡Imagen descargada con éxito!', { id: 'export-image' });
    } catch (err) {
      console.error('Error al generar imagen:', err);
      toast.error('Error al generar la imagen', { id: 'export-image' });
    } finally {
      // Restaurar estilos y scroll del modal-sheet padre
      if (parentSheet) {
        parentSheet.style.maxHeight = originalParentMaxHeight;
        parentSheet.style.overflowY = originalParentOverflowY;
        parentSheet.scrollTop = originalParentScrollTop;
      }
      // Restaurar scroll original del usuario en la ventana
      window.scrollTo(originalScrollX, originalScrollY);
      setIsExporting(false);
    }
  };

  // Compartir por WhatsApp (con imagen y texto)
  const handleShareWhatsApp = async () => {
    if (!voucherRef.current) return;
    setIsExporting(true);
    toast.loading('Preparando boleto e imagen para WhatsApp...', { id: 'share-whatsapp' });

    // Esperar a que la imagen del código QR y cualquier otra imagen estén cargadas al 100%
    const images = voucherRef.current.querySelectorAll('img');
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
    await Promise.all(imagePromises);

    // Guardar posición de scroll original
    const originalScrollY = window.scrollY;
    const originalScrollX = window.scrollX;

    // Guardar estilos y posición de scroll del modal-sheet padre
    const parentSheet = voucherRef.current.parentElement;
    let originalParentScrollTop = 0;
    let originalParentMaxHeight = '';
    let originalParentOverflowY = '';

    if (parentSheet) {
      originalParentScrollTop = parentSheet.scrollTop;
      originalParentMaxHeight = parentSheet.style.maxHeight;
      originalParentOverflowY = parentSheet.style.overflowY;

      // Quitar límites de scroll del modal-sheet durante la captura
      parentSheet.scrollTop = 0;
      parentSheet.style.maxHeight = 'none';
      parentSheet.style.overflowY = 'visible';
    }

    // Desplazar al inicio temporalmente para evitar líneas blancas o cortes
    window.scrollTo(0, 0);

    // Esperar un pequeño lapso para que los estilos de exportación y scroll se asienten
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const element = voucherRef.current;
      const canvas = await html2canvas(element, {
        useCORS: true,
        scale: 2.5, // 2.5x para nitidez ultra premium en texto
        backgroundColor: theme === 'digital' ? '#0f172a' : '#ffffff',
        logging: false,
        height: element.scrollHeight,
        windowHeight: element.scrollHeight,
      });

      // Obtener el Blob del canvas en formato JPEG
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) throw new Error('No se pudo generar el archivo de imagen.');

      // Crear archivo para Web Share API
      const fileName = `Boleto_${lottery?.name.replace(/\s+/g, '_')}_${sale.id?.split('_').pop()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      // Construir texto formateado para WhatsApp
      let whatsappText = `🎟️ *${settings.businessName.toUpperCase()}* 🎟️\n`;
      whatsappText += `━━━━━━━━━━━━━━━━━━━━━\n`;
      whatsappText += `*Boleto:* #${sale.id?.split('_').pop()}\n`;
      const hoursText = getDrawHoursText(sale);
      whatsappText += `*Sorteo:* ${lottery?.name || 'Rifa'} ${hoursText ? `(${hoursText})` : ''}\n`;
      whatsappText += `*Fecha Venta:* ${dateStr} ${timeStr}\n`;
      whatsappText += `*Fecha Sorteo:* ${formatDrawDate(sale.lines?.[0]?.fecha || sale.drawDate)}\n`;
      whatsappText += `*Vendedor:* ${sale.sellerName}\n`;
      if (sale.comprador) {
        whatsappText += `*Cliente:* ${sale.comprador}\n`;
      }
      whatsappText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
      if (lines.length > 10) {
        let rangeTxt = '';
        const unitM = parseFloat(lines[0]?.monto || 0);
        const winM = unitM * payoutMultiplier;
        
        if (sale.lotteryId === 'fechea') {
          rangeTxt = `${lines.length} Fechas`;
        } else {
          const nums = lines.map(l => parseInt(l.numero, 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
          if (nums.length > 0) {
            rangeTxt = `De ${formatLotteryNumber(sale.lotteryId, nums[0])} a ${formatLotteryNumber(sale.lotteryId, nums[nums.length-1])}`;
          } else {
            rangeTxt = `${lines.length} números`;
          }
        }
        
        whatsappText += `*RESUMEN DE COMPRA POR RANGO:*\n`;
        whatsappText += `👉 *Serie/Rango:* ${rangeTxt}\n`;
        whatsappText += `👉 *Cant. Números:* ${lines.length}\n`;
        whatsappText += `👉 *Inv. por Número:* ${settings.currency}${unitM.toFixed(2)}\n`;
        whatsappText += `👉 *Premio por Número Ganador:* ${settings.currency}${winM.toFixed(2)}\n`;
      } else {
        whatsappText += `*JUGADAS DETALLADAS:*\n`;
        lines.forEach((line, idx) => {
          const formattedNum = sale.lotteryId === 'fechea' ? formatFecheaDate(getFecheaPlayValue(line)) : `#${formatLotteryNumber(sale.lotteryId, line.numero)}`;
          const potentialWin = parseFloat(line.monto || 0) * payoutMultiplier;
          whatsappText += `👉 [${idx + 1}] *${formattedNum}* | Inv: ${settings.currency}${parseFloat(line.monto).toFixed(2)} | *Premio: ${settings.currency}${potentialWin.toFixed(2)}*\n`;
        });
      }

      whatsappText += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
      whatsappText += `*INVERSIÓN TOTAL:* ${settings.currency} ${parseFloat(sale.monto).toFixed(2)}\n`;
      whatsappText += `*Sello de Autenticidad:* Código QR Verificado ✓\n`;
      whatsappText += `_¡Mucha suerte! Revisa tus números en el portal oficial._`;

      // 1. Intentar compartir con Web Share API si es compatible (Móviles)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Boleto #${sale.id?.split('_').pop()}`,
          text: whatsappText,
        });
        toast.success('¡Boleto compartido con éxito!', { id: 'share-whatsapp' });
      } else {
        // 2. Fallback para Computadoras / Navegadores sin soporte de compartir archivos
        // Copiar la imagen en el portapapeles y abrir enlace
        try {
          const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
          ]);
          toast.success('¡Imagen copiada al portapapeles! Abre WhatsApp y pégala con Ctrl+V.', { id: 'share-whatsapp', duration: 7000 });
        } catch (clipErr) {
          console.warn('Clipboard write failed:', clipErr);
          toast.success('Imagen descargada. Abre WhatsApp y adjúntala.', { id: 'share-whatsapp', duration: 6000 });
          // Autodescargar imagen para que la adjunten
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        // Abrir ventana de WhatsApp con el texto
        const encodedText = encodeURIComponent(whatsappText);
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
        window.open(whatsappUrl, '_blank');
      }
    } catch (err) {
      console.error('Error al compartir por WhatsApp:', err);
      toast.error('Error al preparar el boleto para compartir', { id: 'share-whatsapp' });
    } finally {
      // Restaurar estilos y scroll del modal-sheet padre
      if (parentSheet) {
        parentSheet.style.maxHeight = originalParentMaxHeight;
        parentSheet.style.overflowY = originalParentOverflowY;
        parentSheet.scrollTop = originalParentScrollTop;
      }
      // Restaurar scroll original del usuario en la ventana
      window.scrollTo(originalScrollX, originalScrollY);
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1300 }} role="dialog" aria-modal="true">
      <div 
        className="modal-sheet" 
        style={{ 
          maxWidth: 420, 
          padding: '1.25rem',
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1rem',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-neon)'
        }}
      >
        {/* Controles del Modal (Ocultos en la exportación) */}
        {!isExporting && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button 
                onClick={() => setTheme('digital')}
                className={`btn ${theme === 'digital' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.72rem', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)' }}
              >
                Diseño Digital
              </button>
              <button 
                onClick={() => setTheme('thermal')}
                className={`btn ${theme === 'thermal' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.72rem', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)' }}
              >
                Térmico B/N
              </button>
            </div>
            <button 
              className="btn btn-ghost btn-icon" 
              onClick={onClose} 
              style={{ color: 'var(--text-secondary)' }}
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* CONTENEDOR DEL BOLETO A EXPORTAR */}
        <div 
          ref={voucherRef}
          style={{
            padding: theme === 'digital' ? '1.5rem' : '1.25rem 1rem',
            borderRadius: theme === 'digital' ? '16px' : '0px',
            background: theme === 'digital' ? (isExporting ? '#0f172a' : 'linear-gradient(145deg, #1e293b, #0f172a)') : '#ffffff',
            border: theme === 'digital' ? '2px solid #a855f7' : '2px solid #000000',
            color: theme === 'digital' ? '#ffffff' : '#000000',
            fontFamily: theme === 'digital' ? '"Outfit", sans-serif' : 'Courier, monospace',
            boxShadow: theme === 'digital' ? '0 10px 30px rgba(0,0,0,0.5), inset 0 1px 1px rgba(168, 85, 247, 0.15)' : 'none',
            position: 'relative',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {/* Fondo estético sutil (solo en diseño digital) */}
          {theme === 'digital' && (
            <div 
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                background: 'radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.05) 0%, transparent 60%)',
                pointerEvents: 'none',
                borderRadius: '14px'
              }}
            />
          )}

          {/* Encabezado del Boleto */}
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div 
              style={{ 
                fontSize: theme === 'digital' ? '1.35rem' : '1.5rem', 
                fontWeight: 900, 
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                background: theme === 'digital' ? 'linear-gradient(135deg, #a855f7, #a78bfa)' : 'none',
                WebkitBackgroundClip: theme === 'digital' ? 'text' : 'none',
                WebkitTextFillColor: theme === 'digital' ? 'transparent' : 'none',
                color: theme === 'digital' ? undefined : '#000000',
                marginBottom: '0.25rem'
              }}
            >
              {settings.businessName}
            </div>
            
            <div 
              style={{ 
                fontSize: '0.72rem', 
                fontWeight: 700, 
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                padding: '0.18rem 0.5rem',
                borderRadius: '50px',
                background: theme === 'digital' ? 'rgba(139, 92, 246, 0.15)' : 'none',
                border: theme === 'digital' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid #000000',
                color: theme === 'digital' ? '#a855f7' : '#000000',
                display: 'inline-block',
                marginTop: '0.25rem',
                marginBottom: '0.75rem'
              }}
            >
              Comprobante Oficial
            </div>

            <div style={{ fontSize: theme === 'digital' ? '0.78rem' : '0.85rem', color: theme === 'digital' ? '#94a3b8' : '#000000' }}>
              Boleto: <strong>#{sale.id?.split('_').pop()?.toUpperCase()}</strong>
            </div>
          </div>

          {/* Información del Sorteo y Venta */}
          <div 
            style={{ 
              fontSize: theme === 'digital' ? '0.82rem' : '0.88rem', 
              lineHeight: 1.45,
              background: theme === 'digital' ? 'rgba(255,255,255,0.03)' : 'none',
              padding: theme === 'digital' ? '0.85rem' : '0px',
              borderRadius: theme === 'digital' ? '12px' : '0px',
              border: theme === 'digital' ? '1px solid rgba(168, 85, 247, 0.15)' : 'none',
              marginBottom: '1rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme === 'digital' ? '#475569' : '#000000' }}>Sorteo:</span>
              <strong style={{ color: theme === 'digital' ? '#ffffff' : '#000000' }}>
                {lottery?.name || 'Rifa'} {getDrawHoursText(sale) ? `(${getDrawHoursText(sale)})` : ''}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme === 'digital' ? '#475569' : '#000000' }}>Fecha Venta:</span>
              <span style={{ fontWeight: 700 }}>{dateStr} {timeStr}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme === 'digital' ? '#475569' : '#000000' }}>Fecha Sorteo:</span>
              <span style={{ fontWeight: 700 }}>{formatDrawDate(sale.lines?.[0]?.fecha || sale.drawDate)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme === 'digital' ? '#475569' : '#000000' }}>Vendedor:</span>
              <span style={{ fontWeight: 700 }}>{sale.sellerName}</span>
            </div>
            {sale.comprador && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: theme === 'digital' ? '1px solid rgba(168, 85, 247, 0.15)' : '1px dotted #000000', marginTop: '0.4rem', paddingTop: '0.4rem' }}>
                <span style={{ color: theme === 'digital' ? '#475569' : '#000000' }}>Cliente:</span>
                <span style={{ fontWeight: 700 }}>{sale.comprador}</span>
              </div>
            )}
          </div>

          {/* Separador */}
          {theme === 'digital' ? (
            <div style={{ height: '1px', borderTop: '1px solid rgba(168, 85, 247, 0.25)', margin: '1.25rem 0' }} />
          ) : (
            <div style={{ fontSize: '0.85rem', textAlign: 'center', margin: '0.85rem 0', userSelect: 'none', color: '#000000', fontWeight: 'bold' }}>
              --------------------------------
            </div>
          )}

          {/* Sección de Jugadas o Resumen de Serie */}
          <div style={{ marginBottom: '1.25rem' }}>
            {lines.length > 10 ? (
              (() => {
                let rangeTxt = '';
                const unitM = parseFloat(lines[0]?.monto || 0);
                const winM = unitM * payoutMultiplier;
                
                if (sale.lotteryId === 'fechea') {
                  rangeTxt = `${lines.length} Fechas`;
                } else {
                  const nums = lines.map(l => parseInt(l.numero, 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
                  if (nums.length > 0) {
                    rangeTxt = `De ${formatLotteryNumber(sale.lotteryId, nums[0])} a ${formatLotteryNumber(sale.lotteryId, nums[nums.length-1])}`;
                  } else {
                    rangeTxt = `${lines.length} números`;
                  }
                }

                if (theme === 'digital') {
                  return (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      borderRadius: '14px',
                      padding: '1.15rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.8rem',
                      boxShadow: 'inset 0 1px 1px rgba(168, 85, 247, 0.1)',
                      position: 'relative'
                    }}>
                      <div style={{ textAlign: 'center', borderBottom: '1px solid rgba(168, 85, 247, 0.2)', paddingBottom: '0.6rem' }}>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          Serie / Rango Adquirido
                        </span>
                        <div style={{ fontSize: '1.45rem', fontWeight: 950, color: '#fbbf24', marginTop: '0.2rem', letterSpacing: '0.02em' }}>
                          {rangeTxt}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>Total Números:</span>
                          <strong style={{ color: '#ffffff', fontWeight: 800 }}>{lines.length} jugadas</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>Inv. por Número:</span>
                          <strong style={{ color: '#ffffff', fontWeight: 800 }}>{settings.currency}{unitM.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(168, 85, 247, 0.2)', paddingTop: '0.55rem' }}>
                          <span style={{ color: '#94a3b8', fontWeight: 700 }}>Premio por Ganador:</span>
                          <strong style={{ color: '#34d399', fontWeight: 950, fontSize: '1.15rem' }}>{settings.currency}{winM.toFixed(2)}</strong>
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '0.62rem', color: '#64748b', textAlign: 'center', fontStyle: 'italic', marginTop: '0.2rem' }}>
                        * Válido para toda la serie en el rango especificado
                      </div>
                    </div>
                  );
                } else {
                  // Térmico B/N
                  return (
                    <div style={{ padding: '0.25rem 0', fontFamily: 'Courier, monospace', color: '#000000' }}>
                      <div style={{ borderBottom: '1px solid #000000', paddingBottom: '0.4rem', marginBottom: '0.4rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>SERIE ADQUIRIDA</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{rangeTxt}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>CANTIDAD:</span>
                          <strong>{lines.length} NUMEROS</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>INV. POR NUMERO:</span>
                          <strong>{settings.currency}{unitM.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dotted #000000', paddingTop: '0.35rem' }}>
                          <span>PREMIO GANADOR:</span>
                          <strong>{settings.currency}{winM.toFixed(2)}</strong>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.68rem', textAlign: 'center', marginTop: '0.5rem', fontWeight: 'bold' }}>
                        * VALIDO PARA TODA LA SERIE ESPECIFICADA *
                      </div>
                    </div>
                  );
                }
              })()
            ) : (
              <>
                <div 
                  style={{ 
                    fontSize: '0.72rem', 
                    color: theme === 'digital' ? '#475569' : '#000000', 
                    fontWeight: 800, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.08em',
                    marginBottom: '0.6rem',
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 1.2fr',
                    paddingBottom: '0.35rem',
                    borderBottom: theme === 'digital' ? '1px solid rgba(168, 85, 247, 0.2)' : '1px solid #000000'
                  }}
                >
                  <span>{sale.lotteryId === 'fechea' ? 'Fecha' : 'Número'}</span>
                  <span style={{ textAlign: 'right' }}>Inversión</span>
                  <span style={{ textAlign: 'right' }}>Ganará</span>
                </div>

                {lines.map((line, idx) => {
                  const formattedNum = sale.lotteryId === 'fechea' ? formatFecheaDate(getFecheaPlayValue(line)) : `#${formatLotteryNumber(sale.lotteryId, line.numero)}`;
                  const potentialWin = parseFloat(line.monto || 0) * payoutMultiplier;

                  return (
                    <div 
                      key={line.id ?? idx} 
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1.2fr 1fr 1.2fr', 
                        alignItems: 'center',
                        padding: '0.55rem 0',
                        borderBottom: idx === lines.length - 1 ? 'none' : (theme === 'digital' ? '1px solid rgba(168, 85, 247, 0.15)' : '1px dashed #000000'),
                        fontSize: theme === 'digital' ? '0.88rem' : '0.95rem'
                      }}
                    >
                      <span 
                        style={{ 
                          fontWeight: 900, 
                          color: theme === 'digital' ? '#fbbf24' : '#000000',
                          fontSize: theme === 'digital' ? '1.05rem' : '1.1rem'
                        }}
                      >
                        {formattedNum}
                      </span>
                      <span style={{ textAlign: 'right', fontWeight: 700, color: theme === 'digital' ? '#f1f5f9' : '#000000' }}>
                        {settings.currency}{parseFloat(line.monto || 0).toFixed(2)}
                      </span>
                      <span 
                        style={{ 
                          textAlign: 'right', 
                          fontWeight: 950, 
                          color: theme === 'digital' ? '#34d399' : '#000000' 
                        }}
                      >
                        {settings.currency}{potentialWin.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Separador */}
          {theme === 'digital' ? (
            <div style={{ height: '1px', borderTop: '1px solid rgba(168, 85, 247, 0.3)', margin: '1.25rem 0' }} />
          ) : (
            <div style={{ fontSize: '0.85rem', textAlign: 'center', margin: '0.85rem 0', userSelect: 'none', color: '#000000', fontWeight: 'bold' }}>
              --------------------------------
            </div>
          )}

          {/* Sección del Total Invertido */}
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              background: theme === 'digital' ? 'rgba(16, 185, 129, 0.08)' : '#ffffff',
              padding: '0.85rem 1rem',
              borderRadius: theme === 'digital' ? '12px' : '0px',
              border: theme === 'digital' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #000000',
              marginBottom: '1.25rem'
            }}
          >
            <span style={{ fontWeight: 800, fontSize: theme === 'digital' ? '0.78rem' : '0.85rem', textTransform: 'uppercase', color: theme === 'digital' ? '#475569' : '#000000' }}>
              Total Invertido:
            </span>
            <span 
              style={{ 
                fontWeight: 950, 
                fontSize: '1.35rem', 
                color: theme === 'digital' ? '#34d399' : '#000000' 
              }}
            >
              {settings.currency} {parseFloat(sale.monto).toFixed(2)}
            </span>
          </div>

          {/* Validación y Sello QR */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
            <div 
              style={{ 
                padding: '6px', 
                background: '#ffffff', 
                borderRadius: '8px', 
                boxShadow: theme === 'digital' ? '0 0 15px rgba(168, 85, 247, 0.2)' : 'none',
                border: theme === 'digital' ? '1px solid rgba(168, 85, 247, 0.4)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img 
                src={qrCodeUrl} 
                alt="Autenticidad QR" 
                style={{ width: 120, height: 120, display: 'block' }} 
              />
            </div>
            
            <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
              <div 
                style={{ 
                  fontSize: '0.62rem', 
                  fontWeight: 900, 
                  letterSpacing: '0.08em', 
                  textTransform: 'uppercase',
                  color: theme === 'digital' ? '#34d399' : '#000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3
                }}
              >
                <Check size={11} strokeWidth={3} /> Sello de Autenticidad
              </div>
              <div 
                style={{ 
                  fontSize: '0.52rem', 
                  color: theme === 'digital' ? '#475569' : '#000000',
                  marginTop: '0.15rem',
                  fontFamily: 'monospace'
                }}
              >
                VERIFICADO POR RIFAS SEGURAS
              </div>
            </div>
          </div>
        </div>

        {/* BOTONES DE ACCIÓN (Ocultos en la exportación) */}
        {!isExporting && (
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
            <button 
              className="btn btn-secondary btn-full" 
              onClick={handleDownloadImage}
              style={{ gap: '0.4rem', fontSize: '0.85rem', padding: '0.65rem' }}
            >
              <Download size={15} /> Guardar Imagen
            </button>
            
            {theme === 'thermal' ? (
              connected ? (
                <button 
                  className="btn btn-primary btn-full" 
                  onClick={() => print(sale, settings.businessName)}
                  disabled={printing}
                  style={{ gap: '0.4rem', fontSize: '0.85rem', padding: '0.65rem' }}
                >
                  <Printer size={15} /> {printing ? 'Imprimiendo...' : 'Imprimir'}
                </button>
              ) : (
                <button 
                  className="btn btn-warning btn-full" 
                  onClick={async () => {
                    try {
                      await connect();
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  disabled={connecting}
                  style={{ 
                    gap: '0.4rem', 
                    fontSize: '0.85rem', 
                    padding: '0.65rem',
                    background: '#fbbf24', 
                    borderColor: '#fbbf24', 
                    color: '#000000' 
                  }}
                >
                  <Printer size={15} /> {connecting ? 'Conectando...' : 'Conectar Impresora'}
                </button>
              )
            ) : (
              <button 
                className="btn btn-primary btn-full" 
                onClick={handleShareWhatsApp}
                style={{ gap: '0.4rem', fontSize: '0.85rem', padding: '0.65rem', background: '#25D366', borderColor: '#25D366', color: '#ffffff' }}
              >
                <Share2 size={15} /> Enviar WhatsApp
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
