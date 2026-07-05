const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { requireAdmin } = require('../utils/helpers');

// Configuración de almacenamiento en memoria con Multer para compatibilidad con Vercel/Serverless
const storage = multer.memoryStorage();

// Filtro de extensiones y límite de tamaño
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!allowed.includes(ext)) {
      return cb(new Error('Formato de imagen no permitido (solo JPG, PNG, GIF, WEBP).'), false);
    }
    cb(null, true);
  }
}).single('image');

// ─── POST /api/upload ➔ Subir imagen del carrusel y convertir a Base64 (Admin/Root) ────────
router.post('/', requireAdmin, (req, res) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'La imagen supera el límite permitido de 5MB.' });
      }
      return res.status(400).json({ error: `Error de carga: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ninguna imagen.' });
    }

    try {
      // Convertir el buffer de la imagen a un Data URL Base64 para guardarlo en la base de datos de forma persistente
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      res.json({ url: base64Image });
    } catch (parseErr) {
      console.error('Error al codificar imagen a Base64:', parseErr.message);
      res.status(500).json({ error: 'Error interno al procesar la imagen.' });
    }
  });
});

module.exports = router;
