// test-linkedin-message.js
const messageService = require('./services/messageService');
const logger = require('./utils/logger');

/**
 * Script de test pour envoyer un message à un profil LinkedIn
 * @param {string} profileUrl - URL du profil LinkedIn
 * @param {string} message - Message à envoyer
 */
async function testSendMessage(profileUrl, message = "Test") {
  try {
    logger.info(`==== DÉBUT DU TEST D'ENVOI DE MESSAGE ====`);
    logger.info(`Profil cible: ${profileUrl}`);
    logger.info(`Message à envoyer: "${message}"`);

    // 1. Initialiser le service
    logger.info('Initialisation du service de messagerie...');
    await messageService.initialize();
    
    // 2. Envoyer le message
    logger.info('Envoi du message...');
    const result = await messageService.sendMessage(profileUrl, message);
    
    // 3. Afficher le résultat
    if (result.success) {
      logger.info('✅ Message envoyé avec succès!');
    } else {
      logger.error(`❌ Échec de l'envoi du message: ${result.error}`);
    }
    
    // 4. Libérer les ressources
    logger.info('Libération des ressources...');
    await messageService.releaseResources();
    
    logger.info(`==== FIN DU TEST ====`);
    return result.success;
  } catch (error) {
    logger.error(`Erreur fatale lors du test: ${error.message}`);
    
    // Tenter de libérer les ressources en cas d'erreur
    try {
      await messageService.releaseResources();
    } catch (cleanupError) {
      logger.error(`Erreur lors du nettoyage: ${cleanupError.message}`);
    }
    
    return false;
  }
}

// Si le script est exécuté directement (et non importé)
if (require.main === module) {
  // Récupérer l'URL LinkedIn depuis les arguments de ligne de commande
  const profileUrl = process.argv[2];
  const message = process.argv[3] || "Test";
  
  if (!profileUrl) {
    console.error("Erreur: URL du profil LinkedIn manquante!");
    console.log("Utilisation: node test-linkedin-message.js <url_profil_linkedin> [message]");
    process.exit(1);
  }
  
  // Exécuter le test
  testSendMessage(profileUrl, message)
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(`Erreur non gérée: ${error.message}`);
      process.exit(1);
    });
} else {
  // Permettre l'importation comme module
  module.exports = testSendMessage;
}