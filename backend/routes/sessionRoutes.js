const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

// Routes pour les sessions
router.get('/', sessionController.getSessions);
router.get('/:id/prospects', sessionController.getSessionProspects);
router.get('/:id', sessionController.getSession);
router.post('/', sessionController.createSession);
router.post('/:id/start', sessionController.startSession);
router.post('/:id/pause', sessionController.pauseSession);
router.post('/:id/resume', sessionController.resumeSession);
router.post('/:id/stop', sessionController.stopSession);
router.get('/stats', sessionController.getSessionStats);


module.exports = router;