const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAdmin } = require('../utils/helpers');

// Ruta física para guardar las imágenes (al mismo nivel que la carpeta web / uploads)
const uploadDir = path.join(__dirname, '../../../uploads'); // c:\xampp\htdocs\app\uploads

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de almacenamiento en disco con Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    cb(null, `carousel_${uniqueSuffix}${ext}`);
  }
});

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

// ─── POST /api/upload ➔ Subir imagen del carrusel (Admin) ────────
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

    // Retornamos la ruta relativa para el navegador
    // Formato: /uploads/carousel_xxx.jpg
    const relativePath = `/uploads/${req.file.filename}`;
    res.json({ url: relativePath });
  });
});

module.exports = router;
