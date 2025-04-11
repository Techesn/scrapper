const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

/**
 * Routes pour le service de messagerie LinkedIn
 */

// Route pour initialiser le service de messagerie
router.post('/initialize', messageController.initializeMessaging);

// Route pour envoyer un message
router.post('/send', messageController.sendMessage);

// Route pour fermer le service de messagerie
router.post('/close', messageController.closeMessaging);

module.exports = router;