const mongoose = require('mongoose');
const logger = require('../utils/logger');
const AppSettings = require('../models/AppSettings');
const timeService = require('../services/timeService');


// Définir un modèle pour la file d'attente de connexions
const ConnectionQueue = mongoose.model('ConnectionQueue', new mongoose.Schema({
  prospectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prospect',
    required: true
  },
  sequenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sequence',
    required: false
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'failed'],
    default: 'pending'
  },
  scheduledAt: {
    type: Date,
    default: Date.now
  },
  processingStartedAt: Date,
  completedAt: Date,
  error: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
}));

class ConnectionQueueManager {
  constructor() {
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      logger.info('Initialisation du gestionnaire de file d\'attente de connexions');
      this.isInitialized = true;
      logger.info('Gestionnaire de file d\'attente de connexions initialisé avec succès');
    } catch (error) {
      logger.error(`Erreur lors de l'initialisation du gestionnaire de file d'attente: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ajoute une demande de connexion à la file d'attente
   * @param {string} prospectId - ID du prospect
   * @param {string} [sequenceId] - ID de la séquence (optionnel)
   * @param {Date} [scheduledAt] - Date planifiée pour l'envoi
   * @returns {Promise<Object>} La demande de connexion créée
   */
  async addToQueue(prospectId, sequenceId = null, scheduledAt = null) {
    try {
      if (!this.isInitialized) {
        await this.init();
      }
      
      logger.info(`Ajout d'une demande de connexion à la file d'attente pour le prospect ${prospectId}`);
      
      // Vérifier les quotas quotidiens
      if (!timeService.checkQuotaAvailability('connections')) {
        logger.warn('Quota journalier de connexions atteint, planification pour le jour suivant');
        // Planifier pour le lendemain
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0); // 10h du matin le lendemain
        scheduledAt = tomorrow;
      }
      
      // Si aucune date n'est fournie, utiliser la date courante ou calculer une date optimale
      if (!scheduledAt) {
        // Calculer une date optimale pour l'envoi (dans les plages horaires configurées)
        scheduledAt = timeService.calculateOptimalSendTime(new Date(), 0);
      }
      
      // Vérifier si une demande est déjà en attente pour ce prospect
      const existingRequest = await ConnectionQueue.findOne({
        prospectId,
        status: { $in: ['pending', 'processing'] }
      });
      
      if (existingRequest) {
        logger.info(`Une demande de connexion est déjà en attente pour le prospect ${prospectId}`);
        return existingRequest;
      }
      
      // Créer une nouvelle demande
      const connectionRequest = await ConnectionQueue.create({
        prospectId,
        sequenceId,
        scheduledAt,
        status: 'pending'
      });
      
      logger.info(`Demande de connexion ajoutée à la file d'attente avec l'ID ${connectionRequest._id}, planifiée pour ${scheduledAt}`);
      return connectionRequest;
    } catch (error) {
      logger.error(`Erreur lors de l'ajout à la file d'attente: ${error.message}`);
      throw error;
    }
  }

  /**
   * Récupère la prochaine demande de connexion à traiter
   * @returns {Promise<Object|null>} La prochaine demande ou null si aucune n'est disponible
   */
  async getNextConnectionRequest() {
    try {
      if (!this.isInitialized) {
        await this.init();
      }
      
      const now = new Date();
      
      // Vérifier si nous sommes dans les plages horaires autorisées
      if (!timeService.isInWorkingHours('connection')) {
        logger.debug('En dehors des plages horaires de travail pour les connexions - Récupération reportée');
        return null;
      }
      
      // Vérifier si les quotas quotidiens ont été atteints
      if (!timeService.checkQuotaAvailability('connections')) {
        logger.debug('Quota journalier de connexions atteint - Récupération reportée');
        return null;
      }
      
      // Trouver la prochaine demande à traiter (planifiée pour maintenant ou avant)
      const nextRequest = await ConnectionQueue.findOneAndUpdate(
        {
          status: 'pending',
          scheduledAt: { $lte: now }
        },
        {
          status: 'processing',
          processingStartedAt: now
        },
        {
          new: true,
          sort: { scheduledAt: 1 },
          populate: {
            path: 'prospectId',
            select: 'firstName lastName email linkedinProfileUrl connectionStatus'
          }
        }
      );
      
      if (nextRequest) {
        logger.info(`Prochaine demande de connexion récupérée: ${nextRequest._id} pour ${nextRequest.prospectId._id}`);
      } else {
        logger.debug('Aucune demande de connexion en attente actuellement');
      }
      
      return nextRequest;
    } catch (error) {
      logger.error(`Erreur lors de la récupération de la prochaine demande: ${error.message}`);
      return null;
    }
  }
}

module.exports = new ConnectionQueueManager();