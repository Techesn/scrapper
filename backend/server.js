const { server } = require('./app');
const config = require('./config/config');
const logger = require('./utils/logger');
const sequenceOrchestrator = require('./services/sequenceOrchestrator');
const authService = require('./services/authService');
const browserPoolService = require('./services/browserPoolService'); // Ajoutez cette ligne
const browserUtils = require('./utils/browserUtils');
// Démarrer le serveur
const PORT = config.app.port;

server.listen(PORT, async () => {
  logger.info(`Serveur démarré sur le port ${PORT} en mode ${config.app.nodeEnv}`);
  logger.info(`Dashboard accessible à l'adresse: http://localhost:${PORT}`);
  
  // Initialiser le pool de navigateurs
  try {
    await browserPoolService.init();
    logger.info('Pool de navigateurs initialisé avec succès');
  } catch (error) {
    logger.error(`Erreur lors de l'initialisation du pool de navigateurs: ${error.message}`);
  }

  // Surveiller périodiquement l'état du pool de navigateurs
  const poolMonitorInterval = setInterval(() => {
    const poolStatus = browserUtils.getPoolStatus();
    logger.info(`État du pool de navigateurs: ${poolStatus.available} disponibles, ${poolStatus.inUse} utilisés (dont ${poolStatus.temporary} temporaires), ${poolStatus.total}/${poolStatus.maxSessions} total`);
  }, 60000); // Vérifier toutes les minutes
  
  // Démarrer l'orchestrateur de séquences
  try {
    await sequenceOrchestrator.init();
    await sequenceOrchestrator.start();
    logger.info('Orchestrateur de séquences démarré avec succès');
  } catch (error) {
    logger.error(`Erreur lors du démarrage de l'orchestrateur: ${error.message}`);
  }
});

// Fonction pour un arrêt propre
const gracefulShutdown = async () => {
  logger.info('Arrêt du serveur...');
  
  // Arrêter la vérification périodique des cookies
  authService.stopPeriodicCheck();
  logger.info('Service de vérification des cookies arrêté');
  
  // Arrêter l'orchestrateur si nécessaire
  if (sequenceOrchestrator.isRunning) {
    await sequenceOrchestrator.stop();
    logger.info('Orchestrateur de séquences arrêté');
  }
  clearInterval(poolMonitorInterval);
  logger.info('Surveillance du pool de navigateurs arrêtée');
  // Fermer le pool de navigateurs
  try {
    await browserPoolService.closeAll();
    logger.info('Pool de navigateurs fermé');
  } catch (error) {
    logger.error(`Erreur lors de la fermeture du pool de navigateurs: ${error.message}`);
  }
  
  process.exit(0);
};

// Gestion des arrêts propres
process.on('SIGINT', async () => {
  logger.info('Arrêt du serveur (SIGINT)');
  await gracefulShutdown();
});

process.on('SIGTERM', async () => {
  logger.info('Arrêt du serveur (SIGTERM)');
  await gracefulShutdown();
});

process.on('uncaughtException', (err) => {
  logger.error(`Exception non gérée: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Promesse rejetée non gérée: ${reason}`, { stack: reason.stack });
});