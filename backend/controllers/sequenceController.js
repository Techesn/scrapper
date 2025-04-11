const Sequence = require('../models/sequence');
const SequenceMessage = require('../models/sequenceMessage');
const sequenceOrchestrator = require('../services/sequenceOrchestrator');
const logger = require('../utils/logger');

/**
 * Contrôleur pour la gestion des séquences
 */
const sequenceController = {
  /**
   * Récupère toutes les séquences
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  getAllSequences: async (req, res) => {
    try {
      const sequences = await Sequence.find().sort({ createdAt: -1 });
      
      // Ajouter les statistiques pour chaque séquence
      const sequencesWithStats = await Promise.all(sequences.map(async (sequence) => {
        const stats = await sequenceOrchestrator.getSequenceStats(sequence._id);
        return {
          ...sequence.toObject(),
          stats
        };
      }));
      
      res.status(200).json({
        success: true,
        count: sequencesWithStats.length,
        data: sequencesWithStats
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des séquences: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des séquences',
        error: error.message
      });
    }
  },

  /**
   * Récupère une séquence par son ID
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  getSequenceById: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      
      // Récupérer la séquence
      const sequence = await Sequence.findById(sequenceId);
      
      if (!sequence) {
        return res.status(404).json({
          success: false,
          message: `Séquence avec l'ID ${sequenceId} introuvable`
        });
      }
      
      // Récupérer les messages de la séquence
      const messages = await SequenceMessage.find({ sequenceId }).sort({ position: 1 });
      
      // Récupérer les statistiques de la séquence
      const stats = await sequenceOrchestrator.getSequenceStats(sequenceId);
      
      // Récupérer tous les prospects (actifs et en attente)
      const ProspectSequenceStatus = require('../models/prospectSequenceStatus');
      const activeProspects = await ProspectSequenceStatus.find({ 
        sequenceId, 
        status: 'active' 
      }).populate('prospectId');
      
      const pendingProspects = await ProspectSequenceStatus.find({ 
        sequenceId, 
        status: 'pending' 
      }).populate('prospectId');
      
      res.status(200).json({
        success: true,
        data: {
          sequence,
          messages,
          stats,
          activeProspects: activeProspects.map(pss => ({
            ...pss.prospectId.toObject(),
            sequenceStatus: {
              currentStep: pss.currentStep,
              status: pss.status,
              connectionStatus: pss.connectionStatus
            }
          })),
          pendingProspects: pendingProspects.map(pss => ({
            ...pss.prospectId.toObject(),
            sequenceStatus: {
              currentStep: pss.currentStep,
              status: pss.status,
              connectionStatus: pss.connectionStatus
            }
          }))
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération de la séquence: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération de la séquence',
        error: error.message
      });
    }
  },

  /**
   * Crée une nouvelle séquence
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  createSequence: async (req, res) => {
    try {
      const { name, description, intervalDays } = req.body;
      
      // Valider les données
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Le nom de la séquence est requis'
        });
      }
      
      // Créer la séquence
      const sequence = await Sequence.create({
        name,
        description,
        intervalDays: intervalDays || 1,
        status: 'draft'
      });
      
      res.status(201).json({
        success: true,
        message: 'Séquence créée avec succès',
        data: sequence
      });
    } catch (error) {
      logger.error(`Erreur lors de la création de la séquence: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la création de la séquence',
        error: error.message
      });
    }
  },

  /**
   * Met à jour une séquence existante
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  updateSequence: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      const { name, description, intervalDays } = req.body;
      
      // Vérifier que la séquence existe
      const sequence = await Sequence.findById(sequenceId);
      
      if (!sequence) {
        return res.status(404).json({
          success: false,
          message: `Séquence avec l'ID ${sequenceId} introuvable`
        });
      }
      
      // Mettre à jour la séquence
      const updatedSequence = await Sequence.findByIdAndUpdate(
        sequenceId,
        {
          name: name || sequence.name,
          description: description !== undefined ? description : sequence.description,
          intervalDays: intervalDays || sequence.intervalDays,
          updatedAt: Date.now()
        },
        { new: true }
      );
      
      res.status(200).json({
        success: true,
        message: 'Séquence mise à jour avec succès',
        data: updatedSequence
      });
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour de la séquence: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la mise à jour de la séquence',
        error: error.message
      });
    }
  },

  /**
   * Supprime une séquence
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  deleteSequence: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      
      // Vérifier que la séquence existe
      const sequence = await Sequence.findById(sequenceId);
      
      if (!sequence) {
        return res.status(404).json({
          success: false,
          message: `Séquence avec l'ID ${sequenceId} introuvable`
        });
      }
      
      // Supprimer les messages de la séquence
      await SequenceMessage.deleteMany({ sequenceId });
      
      // Retirer tous les prospects de la séquence
      const ProspectSequenceStatus = require('../models/prospectSequenceStatus');
      await ProspectSequenceStatus.deleteMany({ sequenceId });
      
      // Supprimer les messages en file d'attente pour cette séquence
      const MessageQueue = require('../models/messageQueue');
      await MessageQueue.deleteMany({ 'prospectSequenceStatusId.sequenceId': sequenceId });
      
      // Supprimer la séquence
      await Sequence.findByIdAndDelete(sequenceId);
      
      res.status(200).json({
        success: true,
        message: 'Séquence supprimée avec succès'
      });
    } catch (error) {
      logger.error(`Erreur lors de la suppression de la séquence: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la suppression de la séquence',
        error: error.message
      });
    }
  },

  /**
   * Active une séquence
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  activateSequence: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      
      // Vérifier que la séquence existe
      const sequence = await Sequence.findById(sequenceId);
      
      if (!sequence) {
        return res.status(404).json({
          success: false,
          message: `Séquence avec l'ID ${sequenceId} introuvable`
        });
      }
      
      // Vérifier que la séquence a au moins un message
      const messageCount = await SequenceMessage.countDocuments({ sequenceId });
      
      if (messageCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Impossible d\'activer une séquence sans messages'
        });
      }
      
      // Mettre à jour le statut de la séquence
      const updatedSequence = await Sequence.updateStatus(sequenceId, 'active');
      
      // Activer également les prospects connectés dans cette séquence
      const ProspectSequenceStatus = require('../models/prospectSequenceStatus');
      await ProspectSequenceStatus.updateMany(
        {
          sequenceId,
          connectionStatus: 'connected',
          status: 'pending'
        },
        {
          status: 'active'
        }
      );
      
      const sequenceScheduler = require('../services/sequenceScheduler');
      
      // Récupérer tous les prospects actifs de cette séquence
      const activeProspects = await ProspectSequenceStatus.find({
        sequenceId,
        status: 'active'
      });
      
      logger.info(`Planification des messages pour ${activeProspects.length} prospects actifs dans la séquence ${sequenceId}`);
      
      // Planifier le prochain message pour chaque prospect actif
      let scheduledCount = 0;
      for (const prospectStatus of activeProspects) {
        const scheduled = await sequenceScheduler.scheduleNextMessageForProspect(prospectStatus._id);
        if (scheduled) {
          scheduledCount++;
        }
      }
      
      logger.info(`${scheduledCount} messages planifiés pour la séquence ${sequenceId}`);
      
      res.status(200).json({
        success: true,
        message: 'Séquence activée avec succès',
        data: {
          sequence: updatedSequence,
          scheduledMessagesCount: scheduledCount
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de l'activation de la séquence: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de l\'activation de la séquence',
        error: error.message
      });
    }
  },

  /**
   * Met en pause une séquence
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  pauseSequence: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      
      // Déléguer à l'orchestrateur
      const result = await sequenceOrchestrator.pauseSequence(sequenceId);
      
      res.status(200).json({
        success: true,
        message: 'Séquence mise en pause avec succès',
        data: result
      });
    } catch (error) {
      logger.error(`Erreur lors de la mise en pause de la séquence: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la mise en pause de la séquence',
        error: error.message
      });
    }
  },

  /**
   * Reprend une séquence en pause
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  resumeSequence: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      
      // Déléguer à l'orchestrateur
      const result = await sequenceOrchestrator.resumeSequence(sequenceId);
      
      res.status(200).json({
        success: true,
        message: 'Séquence reprise avec succès',
        data: result
      });
    } catch (error) {
      logger.error(`Erreur lors de la reprise de la séquence: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la reprise de la séquence',
        error: error.message
      });
    }
  },

  /**
   * Ajoute des prospects à une séquence
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  addProspectsToSequence: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      const { prospectIds } = req.body;
      
      if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Liste de prospects invalide'
        });
      }
      
      // Vérifier que la séquence existe
      const sequence = await Sequence.findById(sequenceId);
      
      if (!sequence) {
        return res.status(404).json({
          success: false,
          message: `Séquence avec l'ID ${sequenceId} introuvable`
        });
      }
      
      // Ajouter les prospects à la séquence
      const result = await sequenceOrchestrator.addProspectsToSequence(prospectIds, sequenceId);
      
      res.status(200).json({
        success: true,
        message: 'Prospects ajoutés à la séquence avec succès',
        data: result
      });
    } catch (error) {
      logger.error(`Erreur lors de l'ajout des prospects à la séquence: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de l\'ajout des prospects à la séquence',
        error: error.message
      });
    }
  },

  /**
   * Retire un prospect d'une séquence
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  removeProspectFromSequence: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      const prospectId = req.params.prospectId;
      
      // Vérifier que la séquence existe
      const sequence = await Sequence.findById(sequenceId);
      
      if (!sequence) {
        return res.status(404).json({
          success: false,
          message: `Séquence avec l'ID ${sequenceId} introuvable`
        });
      }
      
      // Retirer le prospect de la séquence
      const result = await sequenceOrchestrator.removeProspectFromSequence(prospectId, sequenceId);
      
      res.status(200).json({
        success: true,
        message: 'Prospect retiré de la séquence avec succès',
        data: {
          removedCount: result
        }
      });
    } catch (error) {
      logger.error(`Erreur lors du retrait du prospect de la séquence: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors du retrait du prospect de la séquence',
        error: error.message
      });
    }
  }
};

module.exports = sequenceController;