// ─── Página: Configuración ────────────────────────────────────
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PrinterConnect } from '../components/printer/PrinterStatus';
import { Settings as SettingsIcon, Store, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDialog } from '../components/ui/DialogProvider';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../services/apiService';

export const Settings = () => {
  const { settings, updateSettings, installPwa } = useApp();
  const [form, setForm] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const { dialog } = useDialog();
  const { user } = useAuth();
  
  const [localFile, setLocalFile] = useState(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const buildImageUrl = (url) => {
    if (!url) return url;
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) return url;
    try {
      const apiUrl = getApiUrl(); // window.location.origin
      return apiUrl.replace(/\/+$/, '') + url;
    } catch { return url; }
  };

  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="page-content">
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.5rem' }}>
          Configuración
        </h1>

        {/* Impresora Bluetooth */}
        <p className="section-title">Impresora Bluetooth</p>
        <PrinterConnect />

        {installPwa && (
          <>
            <div className="divider" style={{ margin: '1.5rem 0' }} />
            <p className="section-title">Aplicación Web (PWA)</p>
            <div className="card">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Instala Zentric en tu dispositivo para ingresar rápidamente desde el escritorio y usar soporte sin conexión.
              </p>
              <button className="btn btn-primary btn-full" onClick={installPwa}>
                Instalar Aplicación
              </button>
            </div>
          </>
        )}

        <div style={{ height: '2rem' }} />
      </div>
    );
  }

  const handleSave = async () => {
    await updateSettings(form);
    setSaved(true);
    toast.success('Configuración guardada');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearData = async () => {
    const ok = await dialog.danger(
      'Se eliminarán TODOS los registros de ventas de la base de datos. Esta acción es irreversible.',
      { title: 'Borrar todos los datos', confirmLabel: 'Sí, eliminar todo' }
    );
    if (!ok) return;
    try {
      const { api } = await import('../services/apiService');
      await api.delete('/sales');
      toast.success('Todos los datos eliminados');
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error('No se pudo eliminar. Verifica permisos.');
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes.');
      return;
    }

    setLocalFile(file);
    setLocalPreviewUrl(URL.createObjectURL(file));
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffsetX(e.clientX - dragStart.x);
    setOffsetY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX - offsetX, y: touch.clientY - offsetY });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffsetX(touch.clientX - dragStart.x);
    setOffsetY(touch.clientY - dragStart.y);
  };

  const confirmAndUploadImage = async () => {
    if (!localFile || !localPreviewUrl) return;
    setUploading(true);
    
    try {
      const img = new Image();
      img.src = localPreviewUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // 21:9 Aspect Ratio (e.g. 1200x514)
      canvas.width = 1200;
      canvas.height = 514;

      // Fill canvas background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const imgRatio = img.width / img.height;
      const targetRatio = canvas.width / canvas.height;
      
      let baseWidth, baseHeight;
      if (imgRatio > targetRatio) {
        baseHeight = canvas.height;
        baseWidth = canvas.height * imgRatio;
      } else {
        baseWidth = canvas.width;
        baseHeight = canvas.width / imgRatio;
      }

      const w = baseWidth * zoom;
      const h = baseHeight * zoom;

      // Centered position
      const cx = (canvas.width - w) / 2;
      const cy = (canvas.height - h) / 2;

      // Translate pan offset based on container scale factor
      const wrapper = document.querySelector('.preview-crop-container');
      const wrapperWidth = wrapper ? wrapper.clientWidth : 800;
      const scaleFactor = canvas.width / wrapperWidth;

      const px = offsetX * scaleFactor;
      const py = offsetY * scaleFactor;

      ctx.drawImage(img, cx + px, cy + py, w, h);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('No se pudo procesar el recorte de la imagen');
        }
        
        const fileToUpload = new File([blob], localFile.name, { type: localFile.type });
        const formData = new FormData();
        formData.append('image', fileToUpload);

        toast.loading('Subiendo imagen recortada...', { id: 'upload' });
        const { getToken, getBaseApiUrl } = await import('../services/apiService');
        const token = getToken();
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          headers['X-Auth-Token'] = token;
        }
        
        const base = getBaseApiUrl();
        let url;
        if (base.startsWith('http')) {
          const urlObj = new URL(base);
          url = `${urlObj.origin}${`${urlObj.pathname}/upload`.replace(/\/+/g, '/')}`;
        } else {
          url = `${base}/upload`.replace(/\/+/g, '/');
        }
        
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: formData
        });
        
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Error al subir la imagen');
        }
        
        const currentImages = JSON.parse(form.carousel_images || '[]');
        const newImages = [...currentImages, data.url];
        
        setForm(f => ({ ...f, carousel_images: JSON.stringify(newImages) }));
        toast.success('Imagen subida y recortada con éxito', { id: 'upload' });
        
        setLocalFile(null);
        if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
        setZoom(1);
        setOffsetX(0);
        setOffsetY(0);
      }, localFile.type, 0.9);

    } catch (err) {
      toast.error(err.message || 'Error al subir la imagen', { id: 'upload' });
    } finally {
      setUploading(false);
    }
  };

  const cancelLocalPreview = () => {
    setLocalFile(null);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  const handleDeleteImage = (indexToDelete) => {
    const currentImages = JSON.parse(form.carousel_images || '[]');
    const newImages = currentImages.filter((_, idx) => idx !== indexToDelete);
    setForm(f => ({ ...f, carousel_images: JSON.stringify(newImages) }));
  };

  return (
    <div className="page-content">
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.5rem' }}>
        Configuración
      </h1>

      {/* Impresora Bluetooth */}
      <p className="section-title">Impresora Bluetooth</p>
      <PrinterConnect />

      <div className="divider" style={{ margin: '1.5rem 0' }} />

      {/* Negocio */}
      <p className="section-title">Datos del negocio</p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label htmlFor="business-name-input">
            <Store size={12} style={{ display: 'inline', marginRight: 4 }} />
            Nombre del negocio
          </label>
          <input
            id="business-name-input"
            className="form-control"
            value={form.businessName}
            onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            placeholder="Ej: Zentric"
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Aparece en el encabezado del boleto impreso
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="currency-input">Símbolo de moneda</label>
          <input
            id="currency-input"
            className="form-control"
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            placeholder="₡ / L / $ "
            style={{ maxWidth: 120 }}
          />
        </div>
      </div>

      <div className="divider" style={{ margin: '1.5rem 0' }} />

      {/* Preferencias */}
      <p className="section-title">Preferencias</p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setForm((f) => ({ ...f, autoprint: !f.autoprint }))}
          id="autoprint-toggle"
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Imprimir automáticamente</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Imprime el boleto al confirmar la venta
            </div>
          </div>
          {form.autoprint
            ? <ToggleRight size={36} color="var(--accent-light)" />
            : <ToggleLeft size={36} color="var(--text-muted)" />
          }
        </div>

        <div className="divider" style={{ margin: '0.25rem 0' }} />

        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="close-minutes-input">Minutos de cierre antes del sorteo</label>
          <input
            id="close-minutes-input"
            className="form-control"
            type="number"
            min="0"
            max="120"
            value={form.drawCloseMinutes ?? 10}
            onChange={(e) => setForm((f) => ({ ...f, drawCloseMinutes: parseInt(e.target.value, 10) || 0 }))}
            placeholder="10"
            style={{ maxWidth: 120 }}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Tiempo límite en minutos para desactivar la venta antes de cada hora de sorteo
          </span>
        </div>
      </div>

      <div className="divider" style={{ margin: '1.5rem 0' }} />

      {/* Carrusel de imágenes */}
      <p className="section-title">Carrusel de anuncios</p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          Sube imágenes para mostrar anuncios o promociones en la pantalla de inicio de todos los usuarios.
        </p>
        <span style={{ fontSize: '0.74rem', color: 'var(--accent-light)', fontWeight: 600, marginTop: '-0.25rem' }}>
          💡 Para un ajuste óptimo en PC y móvil, se recomienda subir imágenes horizontales (panorámicas) con una proporción de 21:9 o resolución de 1200 x 500 píxeles.
        </span>
        
        {/* Vista previa de imágenes actuales */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {JSON.parse(form.carousel_images || '[]').map((url, idx) => (
            <div key={idx} style={{ position: 'relative', width: 80, height: 80, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={buildImageUrl(url)} alt={`Slide ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button 
                type="button"
                onClick={() => handleDeleteImage(idx)}
                style={{ 
                  position: 'absolute', top: 2, right: 2, 
                  background: 'rgba(239, 68, 68, 0.9)', 
                  border: 'none', borderRadius: '50%', 
                  width: 18, height: 18, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  color: '#fff', cursor: 'pointer', fontSize: '10px' 
                }}
              >
                ✕
              </button>
            </div>
          ))}
          {JSON.parse(form.carousel_images || '[]').length === 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
              No hay imágenes en el carrusel.
            </div>
          )}
        </div>

        {/* Botón de subir archivo */}
        <div style={{ marginTop: '0.5rem' }}>
          <label 
            htmlFor="upload-carousel-file"
            className="btn btn-ghost" 
            style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem', 
              fontSize: '0.8rem', padding: '0.5rem 1rem', cursor: 'pointer',
              border: '1px dashed var(--border)'
            }}
          >
            Seleccionar Imagen
          </label>
          <input 
            type="file" 
            id="upload-carousel-file" 
            accept="image/*" 
            onChange={handleImageSelect} 
            style={{ display: 'none' }} 
            key={localPreviewUrl || 'input'} /* Reset input on clear */
          />
        </div>

        {/* Vista previa real dinámica */}
        {localPreviewUrl && (
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-light)', marginBottom: '0.25rem' }}>
              Ajustar Imagen (Arrastra para centrar, usa el deslizador para zoom)
            </p>
            
            <div 
              className="preview-crop-container carousel-wrapper" 
              style={{ 
                border: '2px solid var(--accent-light)', 
                marginBottom: '0.75rem', 
                position: 'relative',
                overflow: 'hidden',
                userSelect: 'none'
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            >
              <div className="carousel-slide" style={{ width: '100%', height: '100%' }}>
                <img
                  src={localPreviewUrl}
                  alt="Previsualización real"
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    transition: isDragging ? 'none' : 'transform 0.1s ease',
                    userDrag: 'none'
                  }}
                  draggable={false}
                />
              </div>
            </div>

            {/* Slider de Zoom */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Zoom:</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent-light)' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '35px', textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmAndUploadImage}
                disabled={uploading}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}
              >
                {uploading ? 'Procesando...' : 'Confirmar y Subir'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelLocalPreview}
                disabled={uploading}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="divider" style={{ margin: '1.5rem 0' }} />

      {/* Guardar */}
      <button
        className="btn btn-primary btn-full"
        onClick={handleSave}
        id="save-settings-btn"
        style={{ padding: '1rem', marginBottom: '1.5rem' }}
      >
        <SettingsIcon size={16} />
        {saved ? 'Guardado' : 'Guardar configuración'}
      </button>

      {/* PWA */}
      {installPwa && (
        <>
          <p className="section-title">Aplicación Web (PWA)</p>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Instala Zentric en tu dispositivo para ingresar rápidamente desde el escritorio y usar soporte sin conexión.
            </p>
            <button className="btn btn-primary btn-full" onClick={installPwa}>
              Instalar Aplicación
            </button>
          </div>
        </>
      )}

      {/* Peligro */}
      <div style={{ marginTop: '1rem' }}>
        <p className="section-title" style={{ color: 'var(--neon-red)' }}>Zona de peligro</p>
        <div className="card" style={{ borderColor: 'rgba(248,113,113,0.3)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Elimina todos los registros de ventas guardados localmente en este dispositivo.
          </p>
          <button
            className="btn btn-danger btn-full"
            onClick={handleClearData}
            id="clear-data-btn"
          >
            <Trash2 size={16} /> Borrar todos los datos
          </button>
        </div>
      </div>

      <div style={{ height: '2rem' }} />
    </div>
  );
};
