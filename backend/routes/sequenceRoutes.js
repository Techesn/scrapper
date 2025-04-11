const express = require('express');
const router = express.Router();
const sequenceController = require('../controllers/sequenceController');
const sequenceMessageController = require('../controllers/sequenceMessageController');

// Routes pour les séquences
router.get('/', sequenceController.getAllSequences);
router.post('/', sequenceController.createSequence);
router.get('/:id', sequenceController.getSequenceById);
router.put('/:id', sequenceController.updateSequence);
router.delete('/:id', sequenceController.deleteSequence);

// Routes pour les actions sur les séquences
router.post('/:id/activate', sequenceController.activateSequence);
router.post('/:id/pause', sequenceController.pauseSequence);
router.post('/:id/resume', sequenceController.resumeSequence);

// Routes pour la gestion des prospects dans les séquences
router.post('/:id/prospects', sequenceController.addProspectsToSequence);
router.delete('/:id/prospects/:prospectId', sequenceController.removeProspectFromSequence);

// Routes pour les messages des séquences
router.get('/:id/messages', sequenceMessageController.getMessagesForSequence);
router.post('/:id/messages', sequenceMessageController.addMessageToSequence);
router.put('/:id/messages/:messageId', sequenceMessageController.updateMessage);
router.delete('/:id/messages/:messageId', sequenceMessageController.deleteMessage);
router.post('/:id/messages/reorder', sequenceMessageController.reorderMessages);

module.exports = router;