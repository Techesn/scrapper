const MessageQueue = require('../models/messagequeue');
const DailyStats = require('../models/dailyStats');
const logger = require('../utils/logger');
const AppSettings = require('../models/AppSettings');
const timeService = require('../services/timeService');

/**
 * Service de gestion de la file d'attente des messages
 */
class QueueManager {
  constructor() {
    this.isInitialized = false;
    this.settings = null; // Pour stocker les paramètres
  }

  /**
   * Initialise le gestionnaire de file d'attente
   */
  async init() {
    if (this.isInitialized) return;
    
    try {
      logger.info('Initialisation du gestionnaire de file d\'attente');
      
      // Charger les paramètres
      await this._loadSettings();
      
      // Nettoyer les messages bloqués en état "processing"
      await this._resetStuckMessages();
      
      this.isInitialized = true;
      logger.info('Gestionnaire de file d\'attente initialisé avec succès');
    } catch (error) {
      logger.error(`Erreur lors de l'initialisation du gestionnaire de file d'attente: ${error.message}`);
      throw error;
    }
  }

    /**
     * Ajoute un message à la file d'attente
     * @param {string} prospectSequenceStatusId - ID du statut du prospect dans la séquence
     * @param {string} messageId - ID du message à envoyer
     * @param {string} content - Contenu du message
     * @param {Date} scheduledDate - Date prévue d'envoi
     * @param {number} priority - Priorité du message (par défaut 0)
     * @returns {Promise<Object>} Message ajouté
     */
    async addToQueue(prospectSequenceStatusId, messageId, content, scheduledDate, priority = 0) {
      try {
        logger.info(`Ajout d'un message à la file d'attente pour le messageId ${messageId}`);
        
        const prospectStatus = await require('mongoose').model('ProspectSequenceStatus').findById(prospectSequenceStatusId);
        if (!prospectStatus) {
          throw new Error(`Statut de prospect ${prospectSequenceStatusId} introuvable`);
        }
        
        // Récupérer le prospect pour avoir son prénom
        const prospect = await require('mongoose').model('Prospect').findById(prospectStatus.prospectId);
        if (!prospect) {
          throw new Error(`Prospect ${prospectStatus.prospectId} introuvable`);
        }
        
        // Vérifier et optimiser la date planifiée
        // Si elle est en dehors des plages horaires de travail, la déplacer
        if (scheduledDate && !timeService.isTimeInWorkingHours(scheduledDate, 'message')) {
          logger.info(`Date d'envoi initialement prévue (${scheduledDate.toISOString()}) en dehors des plages horaires de travail`);
          
          // Calculer une date optimale à partir de la date prévue
          scheduledDate = timeService.calculateOptimalSendTime(scheduledDate, 0);
          logger.info(`Date d'envoi recalculée: ${scheduledDate.toISOString()}`);
        }
        
        // Ajouter le préfixe au message
        const prefixedContent = `Bonjour ${prospect.firstName},\n\nJ'espère que vous allez bien.\n\n${content}`;
        
        // Ajouter le message à la file d'attente
        const queuedMessage = await MessageQueue.create({
          prospectId: prospectStatus.prospectId,
          prospectSequenceStatusId,
          messageId,
          messageContent: prefixedContent,
          scheduledFor: scheduledDate,
          priority,
          status: 'queued'
        });
        
        logger.info(`Message ajouté à la file d'attente avec l'ID ${queuedMessage._id}, planifié pour ${scheduledDate}`);
        return queuedMessage;
      } catch (error) {
        logger.error(`Erreur lors de l'ajout d'un message à la file d'attente: ${error.message}`);
        throw error;
      }
    }

  /**
   * Récupère le prochain message à traiter dans la file d'attente
   * @returns {Promise<Object|null>} Message à traiter ou null si aucun message disponible
   */
  async getNextMessage() {
    try {
      // Vérifier si on est dans les plages horaires de travail
      if (!timeService.isInWorkingHours('message')) {
        logger.info('En dehors des plages horaires de travail pour les messages - Récupération reportée');
        return null;
      }
      
      // Vérifier si les quotas journaliers ont été atteints
      if (!timeService.checkQuotaAvailability('messages')) {
        logger.info('Quota journalier de messages atteint - Récupération reportée');
        return null;
      }
      
      // Récupérer le prochain message
      const now = new Date();
      const message = await MessageQueue.getNextMessageToSend(now);
      
      if (!message) {
        logger.debug('Aucun message en attente dans la file d\'attente');
        return null;
      }
      
      logger.info(`Récupération du message ${message._id} de la file d'attente pour traitement`);
      return message;
    } catch (error) {
      logger.error(`Erreur lors de la récupération du prochain message: ${error.message}`);
      return null;
    }
  }

/**
 * Met à jour le statut d'un message dans la file d'attente
 * @param {string} messageId - ID du message
 * @param {string} status - Nouveau statut ('sent' ou 'failed')
 * @param {string} result - Résultat du traitement (en cas d'échec)
 * @returns {Promise<Object>} Message mis à jour
 */
async updateMessageStatus(messageId, status, result = null) {
  try {
    logger.info(`Mise à jour du statut du message ${messageId} à "${status}"`);
    
    let updatedMessage;
    
    if (status === 'sent') {
      updatedMessage = await MessageQueue.markAsSent(messageId);
      
      // Incrémenter le compteur de messages envoyés dans les stats
      await DailyStats.incrementMessagesSent();
    } else if (status === 'failed') {
      // Vérifier si l'erreur est "Session déconnectée"
      if (result && (result.includes('Session déconnectée') || result.includes('disconnected'))) {
        logger.info(`Erreur de session déconnectée détectée pour le message ${messageId}, reprogrammation...`);
        
        // Récupérer le message actuel
        const message = await MessageQueue.findById(messageId);
        if (!message) {
          throw new Error(`Message ${messageId} introuvable`);
        }
        
        // Calculer une nouvelle date d'envoi (dans 15 minutes)
        const newScheduledDate = new Date();
        newScheduledDate.setMinutes(newScheduledDate.getMinutes() + 15);
        
        // Ajuster la date pour qu'elle soit dans les plages horaires
        const optimizedDate = timeService.calculateOptimalSendTime(newScheduledDate, 0);
        
        // Mettre à jour le message (le remettre en file d'attente)
        updatedMessage = await MessageQueue.findByIdAndUpdate(messageId, {
          status: 'queued',
          scheduledFor: optimizedDate,
          // Ne pas incrémenter le compteur d'essais car c'est une erreur de session
          // et non une erreur liée au message lui-même
          lastError: result
        }, { new: true });
        
        logger.info(`Message ${messageId} reprogrammé pour ${optimizedDate.toISOString()} suite à une déconnexion de session`);
      } else {
        // Pour les autres types d'erreurs, marquer comme échoué normalement
        updatedMessage = await MessageQueue.markAsFailed(messageId, result);
      }
    } else {
      throw new Error(`Statut invalide: ${status}`);
    }
    
    return updatedMessage;
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour du statut du message: ${error.message}`);
    throw error;
  }
}

  /**
   * Replanifie les messages échoués avec un backoff exponentiel
   * @returns {Promise<number>} Nombre de messages replanifiés
   */
  async rescheduleMessages() {
    try {
      logger.info('Replanification des messages échoués');
      
      // Charger les paramètres si nécessaire
      if (!this.settings) {
        await this._loadSettings();
      }
      
      const maxRetries = this.settings.quotas?.messages?.maxRetries || 3; // Nombre maximal de tentatives
      const now = new Date();
      
      // Récupérer tous les messages en erreur avec moins de maxRetries tentatives
      const failedMessages = await MessageQueue.find({
        status: 'failed',
        attempts: { $lt: maxRetries }
      });
      
      let rescheduledCount = 0;
      
      for (const message of failedMessages) {
        // Calculer le délai de backoff exponentiel (30 min, 2h, 8h)
        const backoffMinutes = Math.pow(4, message.attempts) * 30;
        
        // Nouvelle date planifiée (sans tenir compte des plages horaires pour l'instant)
        let newScheduledDate = new Date(now.getTime() + backoffMinutes * 60000);
        
        // Ajuster la date pour qu'elle soit dans les plages horaires
        newScheduledDate = timeService.calculateOptimalSendTime(newScheduledDate, 0);
        
        // Mettre à jour le message
        await MessageQueue.findByIdAndUpdate(message._id, {
          status: 'queued',
          scheduledFor: newScheduledDate
        });
        
        rescheduledCount++;
      }
      
      logger.info(`${rescheduledCount} messages replanifiés`);
      return rescheduledCount;
    } catch (error) {
      logger.error(`Erreur lors de la replanification des messages: ${error.message}`);
      throw error;
    }
  }

  /**
   * Vérifie et nettoie la file d'attente (messages bloqués, expirés, etc.)
   * @returns {Promise<void>}
   */
  async checkAndCleanQueue() {
    try {
      logger.info('Vérification et nettoyage de la file d\'attente');
      
      // Réinitialiser les messages bloqués en état "processing"
      await this._resetStuckMessages();
      
      // Marquer comme échoués les messages trop anciens (plus de 3 jours)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const oldMessages = await MessageQueue.find({
        status: 'queued',
        scheduledFor: { $lt: threeDaysAgo }
      });
      
      for (const message of oldMessages) {
        await MessageQueue.markAsFailed(message._id, 'Message expiré (plus de 3 jours)');
      }
      
      logger.info(`${oldMessages.length} messages expirés marqués comme échoués`);
    } catch (error) {
      logger.error(`Erreur lors du nettoyage de la file d'attente: ${error.message}`);
    }
  }

  /**
   * Réinitialise les messages bloqués en état "processing"
   * @private
   * @returns {Promise<number>} Nombre de messages réinitialisés
   */
  async _resetStuckMessages() {
    try {
      // Les messages en état "processing" depuis plus de 30 minutes sont considérés comme bloqués
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
      
      const result = await MessageQueue.updateMany(
        {
          status: 'processing',
          lastAttemptAt: { $lt: thirtyMinutesAgo }
        },
        {
          status: 'queued'
        }
      );
      
      const resetCount = result.nModified;
      if (resetCount > 0) {
        logger.info(`${resetCount} messages bloqués ont été réinitialisés`);
      }
      
      return resetCount;
    } catch (error) {
      logger.error(`Erreur lors de la réinitialisation des messages bloqués: ${error.message}`);
      return 0;
    }
  }
  /**
 * Annule tous les messages en attente pour une séquence spécifique
 * @param {string} sequenceId - ID de la séquence
 * @returns {Promise<number>} Nombre de messages annulés
 */
async cancelMessagesForSequence(sequenceId) {
  try {
    logger.info(`Annulation des messages en attente pour la séquence ${sequenceId}`);
    
    // Trouver tous les statuts de prospects dans cette séquence
    const ProspectSequenceStatus = require('../models/prospectSequenceStatus');
    const statuses = await ProspectSequenceStatus.find({ sequenceId });
    
    if (statuses.length === 0) {
      logger.info(`Aucun prospect trouvé dans la séquence ${sequenceId}`);
      return 0;
    }
    
    // Récupérer tous les IDs des statuts
    const statusIds = statuses.map(status => status._id);
    
    // Supprimer les messages en attente pour ces statuts
    const result = await MessageQueue.deleteMany({
      prospectSequenceStatusId: { $in: statusIds },
      status: 'queued'
    });
    
    const deletedCount = result.deletedCount || 0;
    logger.info(`${deletedCount} messages supprimés pour la séquence ${sequenceId}`);
    
    return deletedCount;
  } catch (error) {
    logger.error(`Erreur lors de l'annulation des messages pour la séquence ${sequenceId}: ${error.message}`);
    throw error;
  }
}
/**
 * Charge les paramètres globaux de l'application
 * @private
 * @returns {Promise<Object>} Paramètres de l'application
 */
async _loadSettings() {
  try {
    this.settings = await AppSettings.getGlobalSettings();
    logger.debug('Paramètres de l\'application chargés avec succès');
    return this.settings;
  } catch (error) {
    logger.error(`Erreur lors du chargement des paramètres: ${error.message}`);
    // Valeurs par défaut
    this.settings = {
      intervals: { messageProcessing: 60000 },
      quotas: { messages: { max: 100 } }
    };
    return this.settings;
  }
}
}

module.exports = new QueueManager();