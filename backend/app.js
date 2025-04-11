const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const config = require('./config/config');
const logger = require('./utils/logger');
const scraperService = require('./services/scraperService');

// Import du service d'authentification et du middleware
const authService = require('./services/authService');
const requireValidCookie = require('./middleware/requireValidCookie');

// Importation des fichiers de routes
const indexRoutes = require('./routes/indexRoutes');
const scraperRoutes = require('./routes/scraperRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const companyRoutes = require('./routes/companyRoutes');
const messageRoutes = require('./routes/messageRoutes');
const sequenceRoutes = require('./routes/sequenceRoutes');
const prospectRoutes = require('./routes/prospectRoutes');

// Initialiser l'application Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration du moteur de template EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/views'));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Connexion à MongoDB
mongoose.connect(config.db.uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  logger.info('Connexion à MongoDB établie');
  
  // Démarrer le service d'authentification après connexion à MongoDB
  authService.startPeriodicCheck();
  logger.info('Service de vérification des cookies LinkedIn démarré');
  
  // Écouter les événements de changement d'état du cookie
  authService.on('cookieBecameInvalid', () => {
    logger.warn('ALERTE: Le cookie LinkedIn est devenu invalide. Les services de scraping seront affectés.');
    
    // Émettre un événement WebSocket pour informer le client
    io.emit('cookie_status', { 
      valid: false, 
      message: 'Cookie LinkedIn invalide ou expiré. Veuillez le mettre à jour.',
      timestamp: new Date()
    });
  });
  
  authService.on('cookieBecameValid', () => {
    logger.info('Le cookie LinkedIn est valide. Les services de scraping peuvent fonctionner normalement.');
    
    // Émettre un événement WebSocket pour informer le client
    io.emit('cookie_status', { 
      valid: true, 
      message: 'Cookie LinkedIn valide',
      timestamp: new Date()
    });
  });
})
.catch(err => {
  logger.error(`Erreur de connexion à MongoDB: ${err.message}`);
  process.exit(1);
});

// Routes qui ne nécessitent pas de cookie valide
app.use('/', indexRoutes);
app.use('/api/settings', settingsRoutes);

// Routes qui nécessitent un cookie LinkedIn valide
app.use('/api/scraper', requireValidCookie, scraperRoutes);
app.use('/api/sessions', requireValidCookie, sessionRoutes);
app.use('/api/companies', requireValidCookie, companyRoutes);
app.use('/api/messages', requireValidCookie, messageRoutes);
app.use('/api/sequences', requireValidCookie, sequenceRoutes);
app.use('/api/prospects', requireValidCookie, prospectRoutes);

// Route spéciale pour /api/status qui maintient sa compatibilité avec l'ancienne API
app.get('/api/status', requireValidCookie, (req, res) => {
  require('./controllers/scraperController').getStatus(req, res);
});

// Route pour vérifier le statut du cookie
app.get('/api/cookie-status', async (req, res) => {
  try {
    const isValid = await authService.checkCookieValidity();
    res.status(200).json({
      valid: isValid,
      message: isValid ? 'Cookie LinkedIn valide' : 'Cookie LinkedIn invalide ou expiré',
      timestamp: new Date()
    });
  } catch (error) {
    logger.error(`Erreur lors de la vérification du cookie: ${error.message}`);
    res.status(500).json({
      valid: false,
      message: 'Erreur lors de la vérification du cookie',
      error: error.message
    });
  }
});

// Gestion des WebSockets
io.on('connection', (socket) => {
  logger.info(`Nouvelle connexion WebSocket: ${socket.id}`);
  
  // Envoyer le statut actuel au nouveau client
  scraperService.getStatus()
    .then(status => {
      socket.emit('status_update', status);
      
      // Envoyer également le statut du cookie
      socket.emit('cookie_status', { 
        valid: authService.isCookieValid(), 
        message: authService.isCookieValid() ? 'Cookie LinkedIn valide' : 'Cookie LinkedIn invalide ou expiré',
        timestamp: new Date()
      });
    })
    .catch(err => {
      logger.error(`Erreur lors de l'envoi du statut: ${err.message}`);
    });
  
  // Gérer les événements de déconnexion
  socket.on('disconnect', () => {
    logger.info(`Déconnexion WebSocket: ${socket.id}`);
  });
});

// Configurer le callback de progression du scraper pour émettre des mises à jour par WebSocket
scraperService.currentProgressCallback = (progress) => {
  io.emit('scraping_progress', progress);
};

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  logger.error(`Erreur globale: ${err.message}`, { stack: err.stack });
  res.status(500).json({
    success: false,
    message: 'Une erreur interne est survenue'
  });
});

// Gestion des routes non trouvées
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

module.exports = { app, server, io };