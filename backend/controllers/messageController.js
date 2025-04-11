const messageService = require('../services/messageService');
const logger = require('../utils/logger');

/**
 * Initialise le service de messagerie
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const initializeMessaging = async (req, res) => {
  try {
    await messageService.initialize();
    res.status(200).json({ 
      success: true, 
      message: 'Service de messagerie initialisé avec succès' 
    });
  } catch (error) {
    logger.error(`Erreur lors de l'initialisation du service de messagerie: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de l'initialisation: ${error.message}`
    });
  }
};

/**
 * Envoie un message à un profil LinkedIn
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const sendMessage = async (req, res) => {
  try {
    const { profileUrl, message } = req.body;
    
    if (!profileUrl || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL du profil et message requis' 
      });
    }
    
    // Vérifier le format de l'URL
    if (!profileUrl.includes('linkedin.com/')) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL LinkedIn invalide' 
      });
    }
    
    // Envoyer le message
    const result = await messageService.sendMessage(profileUrl, message);
    
    if (!result.success) {
      return res.status(400).json({ 
        success: false, 
        message: result.error || 'Échec de l\'envoi du message'
      });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Message envoyé avec succès'
    });
    
  } catch (error) {
    logger.error(`Erreur lors de l'envoi du message: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de l'envoi du message: ${error.message}`
    });
  }
};

/**
 * Ferme le service de messagerie
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const closeMessaging = async (req, res) => {
  try {
    await messageService.close();
    res.status(200).json({ 
      success: true, 
      message: 'Service de messagerie fermé avec succès'
    });
  } catch (error) {
    logger.error(`Erreur lors de la fermeture du service de messagerie: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la fermeture: ${error.message}`
    });
  }
};

module.exports = {
  initializeMessaging,
  sendMessage,
  closeMessaging
};