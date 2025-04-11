const express = require('express');
const router = express.Router();
const scraperController = require('../controllers/scraperController');

// Routes pour le scraper
router.get('/status', scraperController.getStatus);
router.post('/initialize', scraperController.initializeScraper);
router.post('/start', scraperController.startScraping);
router.post('/pause', scraperController.pauseScraping);
router.post('/resume', scraperController.resumeScraping);
router.post('/stop', scraperController.stopScraping);
router.get('/prospects', scraperController.getProspects);
router.get('/stats', scraperController.getStats);
router.get('/prospects/export', scraperController.exportProspectsCSV);

module.exports = router;