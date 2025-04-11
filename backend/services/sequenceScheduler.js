const queueManager = require('./queueManager');
const ProspectSequenceStatus = require('../models/prospectSequenceStatus');
const SequenceMessage = require('../models/sequenceMessage');
const Sequence = require('../models/sequence');
const logger = require('../utils/logger');
const AppSettings = require('../models/AppSettings');
const timeService = require('../services/timeService');

/**
 * Service de planification des messages dans les séquences
 */
class SequenceScheduler {
  constructor() {
    this.schedulingInterval = null;
    this.isRunning = false;
    this.settings = null; // Pour stocker les paramètres
    
    // S'abonner aux événements de changement d'état du cookie
    const authService = require('../services/authService');
    authService.on('cookieBecameInvalid', async () => {
      logger.warn('Cookie LinkedIn devenu invalide - Arrêt de la planification automatique');
      await this.stopScheduling();
    });
  }

 /**
 * Planifie le prochain message pour un prospect dans une séquence
 * @param {string} prospectSequenceStatusId - ID du statut de séquence du prospect
 * @returns {Promise<boolean>} True si un message a été planifié
 */
async scheduleNextMessageForProspect(prospectSequenceStatusId) {
  try {
    // Charger les paramètres si nécessaire
    if (!this.settings) {
      await this._loadSettings();
    }
    
    // Récupérer le statut actuel du prospect dans la séquence
    const prospectStatus = await ProspectSequenceStatus.findById(prospectSequenceStatusId)
      .populate('sequenceId');
    
    if (!prospectStatus) {
      logger.error(`Statut de séquence ${prospectSequenceStatusId} introuvable`);
      return false;
    }
    
    // Vérifier si la séquence est active
    if (prospectStatus.sequenceId.status !== 'active') {
      logger.info(`La séquence ${prospectStatus.sequenceId._id} n'est pas active, pas de planification`);
      return false;
    }
    
    // Vérifier si le prospect est en pause ou déjà terminé
    if (prospectStatus.status !== 'active') {
      logger.info(`Le prospect ${prospectStatus.prospectId} n'est pas actif dans la séquence ${prospectStatus.sequenceId._id}`);
      return false;
    }
    
    // Déterminer la prochaine étape
    const nextStep = prospectStatus.currentStep +1;
    
    // Récupérer tous les messages de la séquence
    const sequenceMessages = await SequenceMessage.getMessagesForSequence(prospectStatus.sequenceId._id);
    
    // Vérifier si nous avons atteint la fin de la séquence
    if (nextStep > sequenceMessages.length) {
      logger.info(`Fin de la séquence ${prospectStatus.sequenceId._id} pour le prospect ${prospectStatus.prospectId}`);
      
      // Marquer comme terminé
      await ProspectSequenceStatus.findByIdAndUpdate(prospectStatus._id, {
        status: 'completed',
        completedAt: new Date()
      });
      
      return false;
    }
    
    // Récupérer le message correspondant à l'étape suivante
    const nextMessage = sequenceMessages.find(msg => msg.position === nextStep);
    
    if (!nextMessage) {
      logger.error(`Message de position ${nextStep} introuvable pour la séquence ${prospectStatus.sequenceId._id}`);
      return false;
    }
    
    // Calculer la date d'envoi du prochain message
    const lastMessageDate = prospectStatus.lastMessageSentAt || new Date();
    
    // Utiliser timeService pour calculer la date optimale
    const nextSendDate = this.calculateNextSendTime(nextMessage, lastMessageDate);
    
    logger.info(`Planification du message ${nextMessage._id} pour le prospect ${prospectStatus.prospectId} à ${nextSendDate.toISOString()}`);
    
    // Mettre à jour la date du prochain message
    await ProspectSequenceStatus.findByIdAndUpdate(prospectStatus._id, {
      nextMessageScheduledAt: nextSendDate
    });
    
    // Ajouter le message à la file d'attente
    await queueManager.addToQueue(
      prospectStatus._id,
      nextMessage._id,
      nextMessage.content,
      nextSendDate
    );
    
    return true;
  } catch (error) {
    logger.error(`Erreur lors de la planification du prochain message: ${error.message}`);
    return false;
  }
}

  /**
   * Planifie les messages pour tous les prospects en attente
   * @returns {Promise<number>} Nombre de messages planifiés
   */
  async scheduleAllPendingMessages() {
    try {
      logger.info('Planification des messages en attente pour toutes les séquences actives');
      
      // Récupérer toutes les séquences actives
      const activeSequences = await Sequence.getActiveSequences();
      
      if (activeSequences.length === 0) {
        logger.info('Aucune séquence active trouvée');
        return 0;
      }
      
      let scheduledCount = 0;
      
      // Pour chaque séquence active
      for (const sequence of activeSequences) {
        // Récupérer tous les prospects actifs sans prochain message planifié
        const prospectsToSchedule = await ProspectSequenceStatus.find({
          sequenceId: sequence._id,
          status: 'active',
          $or: [
            { nextMessageScheduledAt: null },
            { nextMessageScheduledAt: { $exists: false } }
          ]
        });
        
        if (prospectsToSchedule.length === 0) {
          logger.info(`Aucun prospect à planifier dans la séquence ${sequence._id}`);
          continue;
        }
        
        logger.info(`Planification pour ${prospectsToSchedule.length} prospects dans la séquence ${sequence._id}`);
        
        // Planifier pour chaque prospect
        for (const prospectStatus of prospectsToSchedule) {
          const scheduled = await this.scheduleNextMessageForProspect(prospectStatus._id);
          if (scheduled) {
            scheduledCount++;
          }
        }
      }
      
      logger.info(`${scheduledCount} messages planifiés au total`);
      return scheduledCount;
    } catch (error) {
      logger.error(`Erreur lors de la planification des messages en attente: ${error.message}`);
      throw error;
    }
  }

 /**
 * Calcule la prochaine date d'envoi optimale
 * @param {Object} sequenceMessage - Message de la séquence
 * @param {Date} lastSent - Date du dernier message envoyé
 * @returns {Date} Date optimale pour l'envoi
 */
calculateNextSendTime(sequenceMessage, lastSent) {
  try {
    // Utiliser le timeService pour calculer la date optimale
    const nextDate = timeService.calculateOptimalSendTime(
      lastSent,
      sequenceMessage.delayHours
    );
    
    logger.info(`Date d'envoi optimale calculée: ${nextDate.toISOString()}`);
    return nextDate;
  } catch (error) {
    logger.error(`Erreur lors du calcul de la prochaine date d'envoi: ${error.message}`);
    // En cas d'erreur, retourner une date par défaut (+24h)
    return new Date(lastSent.getTime() + (24 * 60 * 60 * 1000));
  }
}

  /**
   * Gère la mise en pause d'une séquence
   * @param {string} sequenceId - ID de la séquence
   * @returns {Promise<number>} Nombre de prospects affectés
   */
  async handleSequencePause(sequenceId) {
    try {
      logger.info(`Mise en pause de la séquence ${sequenceId}`);
      
      // Mettre à jour le statut de la séquence
      await Sequence.updateStatus(sequenceId, 'paused');
      
      // Supprimer les messages en attente
      await queueManager.cancelMessagesForSequence(sequenceId);
      
      // Ne pas modifier le statut des prospects
      // Ou commentez cette partie si vous souhaitez conserver le statut "active" pour les prospects
      /* 
      const result = await ProspectSequenceStatus.updateMany(
        {
          sequenceId,
          status: 'active'
        },
        {
          status: 'paused'
        }
      );
      
      logger.info(`${result.nModified} prospects mis en pause dans la séquence ${sequenceId}`);
      return result.nModified;
      */
      
      logger.info(`Séquence ${sequenceId} mise en pause, messages supprimés, statuts des prospects inchangés`);
      return 0;
    } catch (error) {
      logger.error(`Erreur lors de la mise en pause de la séquence ${sequenceId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gère la reprise d'une séquence
   * @param {string} sequenceId - ID de la séquence
   * @returns {Promise<number>} Nombre de prospects réactivés
   */
  async handleSequenceResume(sequenceId) {
    try {
      logger.info(`Reprise de la séquence ${sequenceId}`);
      
      // Mettre à jour le statut de la séquence
      await Sequence.updateStatus(sequenceId, 'active');
      
      // Mettre à jour le statut de tous les prospects en pause dans cette séquence
      const result = await ProspectSequenceStatus.updateMany(
        {
          sequenceId,
          status: 'paused'
        },
        {
          status: 'active'
        }
      );
      
      // Récupérer tous les prospects actifs qui ont besoin d'un nouveau message planifié
      const prospectsToSchedule = await ProspectSequenceStatus.find({
        sequenceId,
        status: 'active',
        $or: [
          { nextMessageScheduledAt: null },
          { nextMessageScheduledAt: { $exists: false } }
        ]
      });
      
      // Planifier les prochains messages
      let scheduledCount = 0;
      for (const prospectStatus of prospectsToSchedule) {
        const scheduled = await this.scheduleNextMessageForProspect(prospectStatus._id);
        if (scheduled) {
          scheduledCount++;
        }
      }
      
      logger.info(`${result.nModified} prospects réactivés et ${scheduledCount} messages planifiés dans la séquence ${sequenceId}`);
      return result.nModified;
    } catch (error) {
      logger.error(`Erreur lors de la reprise de la séquence ${sequenceId}: ${error.message}`);
      throw error;
    }
  }

 /**
 * Démarre la planification automatique des messages
 * @param {number} interval - Intervalle en millisecondes (optionnel)
 */
async startScheduling(interval = null) {
  if (this.isRunning) {
    logger.info('La planification automatique est déjà en cours');
    return;
  }
  
  try {
    // Charger les paramètres si nécessaire
    if (!this.settings) {
      await this._loadSettings();
    }
    
    // Utiliser l'intervalle fourni ou celui des paramètres
    const schedulingInterval = interval || this.settings.intervals.sequenceScheduling || (15 * 60 * 1000);
    
    // Vérifier d'abord la validité du cookie
    const Cookie = require('../models/Cookie');
    const cookieRecord = await Cookie.findOne({ name: 'linkedin_li_at' });
    
    if (!cookieRecord || !cookieRecord.isValid) {
      logger.error('Cookie LinkedIn invalide ou expiré - Planification impossible');
      throw new Error('Cookie LinkedIn invalide ou expiré');
    }
    
    logger.info(`Démarrage de la planification automatique avec un intervalle de ${schedulingInterval}ms`);
    
    this.isRunning = true;
    
    // Planifier immédiatement
    await this.scheduleAllPendingMessages();
    await this.activateConnectedProspects();
    
    // Configurer l'intervalle pour les prochaines planifications
    this.schedulingInterval = setInterval(async () => {
      try {
        await this.scheduleAllPendingMessages();
        await this.activateConnectedProspects();
      } catch (error) {
        logger.error(`Erreur dans l'intervalle de planification: ${error.message}`);
      }
    }, schedulingInterval);
    
    logger.info('Planification automatique démarrée avec succès');
  } catch (error) {
    this.isRunning = false;
    logger.error(`Erreur lors du démarrage de la planification automatique: ${error.message}`);
    throw error;
  }
}
  /**
   * Arrête la planification automatique des messages
   */
  async stopScheduling() {
    if (!this.isRunning) {
      logger.info('La planification automatique n\'est pas en cours');
      return;
    }
    
    logger.info('Arrêt de la planification automatique');
    
    // Arrêter l'intervalle
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
      this.schedulingInterval = null;
    }
    
    this.isRunning = false;
    logger.info('Planification automatique arrêtée avec succès');
  }
  /**
 * Active tous les prospects connectés dans les séquences actives
 */
async activateConnectedProspects() {
  try {
    logger.info('Activation des prospects connectés dans les séquences actives');
    
    // Récupérer toutes les séquences actives
    const activeSequences = await Sequence.getActiveSequences();
    
    let activatedCount = 0;
    
    // Pour chaque séquence active
    for (const sequence of activeSequences) {
      // Trouver les prospects connectés mais encore en pending
      const prospectsToActivate = await ProspectSequenceStatus.find({
        sequenceId: sequence._id,
        status: 'pending',
        connectionStatus: 'connected'
      });
      
      // Activer chaque prospect et planifier le premier message
      for (const status of prospectsToActivate) {
        await ProspectSequenceStatus.findByIdAndUpdate(status._id, {
          status: 'active'
        });
        
        const scheduled = await this.scheduleNextMessageForProspect(status._id);
        if (scheduled) {
          activatedCount++;
        }
      }
    }
    
    if (activatedCount > 0) {
      logger.info(`${activatedCount} prospects connectés activés dans des séquences`);
    }
    
    return activatedCount;
  } catch (error) {
    logger.error(`Erreur lors de l'activation des prospects connectés: ${error.message}`);
    return 0;
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
    return null;
  }
}
}

module.exports = new SequenceScheduler();