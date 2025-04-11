/**
 * Script pour envoyer une demande de connexion LinkedIn
 * Usage: node send-connection.js https://www.linkedin.com/in/username
 */

const mongoose = require('mongoose');
const connectionManager = require('../services/connectionManager');
const Prospect = require('../models/prospect');
const logger = require('../utils/logger');
const config = require('../config/config'); // Importe votre fichier de configuration existant

/**
 * Fonction principale pour envoyer une demande de connexion
 * @param {string} linkedinProfileUrl - URL du profil LinkedIn
 */
async function sendConnectionRequest(linkedinProfileUrl) {
  try {
    // Valider l'URL LinkedIn
    if (!linkedinProfileUrl || !linkedinProfileUrl.includes('linkedin.com/in/')) {
      throw new Error('URL LinkedIn invalide. Format attendu: https://www.linkedin.com/in/username');
    }

    logger.info(`Tentative de connexion à: ${linkedinProfileUrl}`);

    // Vérifier la présence du cookie LinkedIn
    if (!config.linkedin || !config.linkedin.cookie) {
      throw new Error('Cookie LinkedIn non configuré dans le fichier de configuration');
    }

    // Extraire le nom d'utilisateur à partir de l'URL
    const usernameMatch = linkedinProfileUrl.match(/linkedin\.com\/in\/([^\/]+)/);
    const username = usernameMatch ? usernameMatch[1] : null;
    
    if (!username) {
      throw new Error('Impossible d\'extraire le nom d\'utilisateur de l\'URL LinkedIn');
    }

    // Rechercher si le prospect existe déjà
    let prospect = await Prospect.findOne({ linkedinProfileUrl });

    // Si le prospect n'existe pas, le créer
    if (!prospect) {
      logger.info(`Création d'un nouveau prospect pour ${linkedinProfileUrl}`);
      
      // Extraire le prénom si possible (première partie du nom d'utilisateur)
      let firstName = username.split('-')[0];
      // Mettre la première lettre en majuscule
      firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

      prospect = new Prospect({
        firstName : 'Alexandre',
        lastName: 'Hosek',  // Sera mis à jour lors du scraping
        email: '',    // Sera mis à jour lors du scraping
        linkedinProfileUrl,
        connectionStatus: 'not_connected',
        createdAt: new Date()
      });
      await prospect.save();
    }

    // Vérifier le statut de connexion actuel
    if (prospect.connectionStatus === 'connected') {
      logger.info(`Déjà connecté avec ${linkedinProfileUrl}`);
      return { success: true, message: 'Déjà connecté' };
    }

    if (prospect.connectionStatus === 'invitation_sent') {
      logger.info(`Invitation déjà envoyée à ${linkedinProfileUrl}`);
      return { success: false, message: 'Invitation déjà envoyée' };
    }

    // Initialiser le ConnectionManager
    await connectionManager.init();

    // Envoyer la demande de connexion
    const result = await connectionManager.sendConnectionRequest(prospect._id);
    
    logger.info(`Résultat de la demande: ${JSON.stringify(result)}`);
    
    // Démarrer le traitement des demandes en file d'attente
    if (result.success) {
      logger.info('Démarrage du traitement des demandes de connexion...');
      await connectionManager.startConnectionRequests();
      return { success: true, message: 'Demande de connexion ajoutée à la file d\'attente' };
    } else {
      return { success: false, message: result.error || 'Échec de l\'ajout à la file d\'attente' };
    }
  } catch (error) {
    logger.error(`Erreur lors de l'envoi de la demande de connexion: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fonction principale
 */
async function main() {
  try {
    // Récupérer l'URL LinkedIn à partir des arguments de ligne de commande
    const linkedinProfileUrl = process.argv[2];
    
    if (!linkedinProfileUrl) {
      console.error('Veuillez fournir une URL LinkedIn. Ex: node send-connection.js https://www.linkedin.com/in/username');
      process.exit(1);
    }

    // Vérifier rapidement la configuration
    if (!config.linkedin || !config.linkedin.cookie) {
      console.error('ERREUR: Cookie LinkedIn non configuré dans le fichier de configuration.');
      console.error('Veuillez ajouter votre cookie LinkedIn dans le fichier config.js ou définir la variable d\'environnement LINKEDIN_COOKIE');
      process.exit(1);
    } else {
      logger.info('Cookie LinkedIn trouvé dans la configuration');
    }

    // Connecter à MongoDB
    const mongoURI = config.db.uri;
    logger.info(`Connexion à la base de données: ${mongoURI}`);
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connecté à MongoDB');

    // Envoyer la demande de connexion
    const result = await sendConnectionRequest(linkedinProfileUrl);
    logger.info(result.success ? 'Opération réussie!' : `Échec: ${result.message || result.error}`);

    // Attendre que les demandes en file d'attente soient traitées (5 minutes max)
    if (result.success) {
      logger.info('Attente du traitement des demandes en file d\'attente (5 minutes max)...');
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      
      // Arrêter le traitement des demandes
      await connectionManager.stopConnectionRequests();
    }

    // Fermer la connexion MongoDB
    await mongoose.connection.close();
    logger.info('Déconnecté de MongoDB');
    
    process.exit(0);
  } catch (error) {
    logger.error(`Erreur générale: ${error.message}`);
    process.exit(1);
  }
}

// Exécuter le script
main().catch(error => {
  logger.error(`Erreur non gérée: ${error.message}`);
  process.exit(1);
});