process.env.TZ = 'America/Managua';
const express = require('express');
const cors = require('cors');
const { getDB } = require('./src/config/db');
require('dotenv').config();

const path = require('path');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Inicializar la base de datos
getDB().then(() => {
  console.log('Base de datos y tablas inicializadas con éxito.');
}).catch(err => {
  console.error('Error crítico de base de datos:', err.message);
});

// Importar rutas
const authRouter = require('./src/routes/auth');
const gamesRouter = require('./src/routes/games');
const blockedRouter = require('./src/routes/blocked');
const usersRouter = require('./src/routes/users');
const salesRouter = require('./src/routes/sales');
const settingsRouter = require('./src/routes/settings');
const resultsRouter = require('./src/routes/results');
const notificationsRouter = require('./src/routes/notifications');
const uploadRouter = require('./src/routes/upload');
const rootRouter = require('./src/routes/root');

// Montar Rutas (Soporta extensión antigua .php para evitar reescribir URLs en el front/móvil)
app.use(['/api/auth', '/api/auth.php'], authRouter);
app.use(['/api/games', '/api/games.php'], gamesRouter);
app.use(['/api/blocked', '/api/blocked.php'], blockedRouter);
app.use(['/api/users', '/api/users.php'], usersRouter);
app.use(['/api/sales', '/api/sales.php'], salesRouter);
app.use(['/api/settings', '/api/settings.php'], settingsRouter);
app.use(['/api/results', '/api/results.php'], resultsRouter);
app.use(['/api/notifications', '/api/notifications.php'], notificationsRouter);
app.use(['/api/upload', '/api/upload.php'], uploadRouter);
app.use(['/api/root', '/api/root.php'], rootRouter);

// Ruta de estado general
app.get(['/api/health', '/api/health.php'], (req, res) => {
  res.json({ status: 'ok', serverTime: new Date() });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error detectado:', err.stack);
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

// Escuchar puerto en local (para Vercel se exporta el módulo app)
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Servidor local corriendo en puerto ${PORT}`);
  });
}

module.exports = app;
