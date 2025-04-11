// backend/routes/settingsRoutes.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

// Routes pour les paramètres
router.get('/', settingsController.getCurrentSettings);
router.put('/', settingsController.updateSettings);

// Validation du cookie
router.post('/validate-cookie', settingsController.validateCookie);

// Réinitialisation des paramètres
router.post('/reset', settingsController.resetSettingsToDefault);

module.exports = router;