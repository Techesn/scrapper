const queueManager = require('./queueManager');
const messageService = require('./messageService');
const ProspectSequenceStatus = require('../models/prospectSequenceStatus');
const SequenceMessage = require('../models/sequenceMessage');
const DailyStats = require('../models/dailyStats');
const logger = require('../utils/logger');
const AppSettings = require('../models/AppSettings');
const timeService = require('../services/timeService');
const { sleep } = require('../utils/puppeteerUtils');

/**
 * Service de traitement des messages de la file d'attente
 */
class MessageProcessor {
  constructor() {
    this.isRunning = false;
    this.processingInterval = null;
    this.settings = null; // Pour stocker les paramètres
    
    // S'abonner aux événements de changement d'état du cookie
    const authService = require('../services/authService');
    authService.on('cookieBecameInvalid', async () => {
      logger.warn('Cookie LinkedIn devenu invalide - Arrêt du traitement des messages');
      await this.stopProcessing();
    });
  }

  /**
   * Initialise le processeur de messages
   */
  async init() {
    try {
      logger.info('Initialisation du processeur de messages');
      
      // Charger les paramètres
      await this._loadSettings();
      
      // S'assurer que le gestionnaire de file d'attente est initialisé
      await queueManager.init();
      
      logger.info('Processeur de messages initialisé avec succès');
    } catch (error) {
      logger.error(`Erreur lors de l'initialisation du processeur de messages: ${error.message}`);
      throw error;
    }
  }

  /**
   * Démarre le traitement automatique des messages
   * @param {number} interval - Intervalle en millisecondes entre chaque vérification (optionnel)
   */
  async startProcessing(interval = null) {
    if (this.isRunning) {
      logger.info('Le processeur de messages est déjà en cours d\'exécution');
      return;
    }
    
    try {
      // Initialiser si nécessaire
      if (!this.settings) {
        await this.init();
      }
      
      // Utiliser l'intervalle fourni ou celui des paramètres
      const processingInterval = interval || this.settings.intervals.messageProcessing || 60000;
      
      this.isRunning = true;
      
      logger.info(`Démarrage du traitement des messages avec un intervalle de ${processingInterval}ms`);
      
      // Vérifier si on est dans les plages horaires de travail
      if (!timeService.isInWorkingHours('message')) {
        logger.info('En dehors des plages horaires de travail pour les messages - Le traitement sera effectué lors de la prochaine période de travail');
      } else {
        // Traiter immédiatement un premier message
        await this.processNextMessage();
      }
      
      // Puis configurer l'intervalle pour les messages suivants
      this.processingInterval = setInterval(async () => {
        try {
          // Vérifier si on est dans les plages horaires de travail
          if (timeService.isInWorkingHours('message')) {
            await this.processNextMessage();
          } else {
            logger.debug('En dehors des plages horaires de travail pour les messages - Traitement reporté');
          }
        } catch (error) {
          logger.error(`Erreur dans l'intervalle de traitement: ${error.message}`);
        }
      }, processingInterval);
      
      logger.info('Processeur de messages démarré avec succès');
    } catch (error) {
      this.isRunning = false;
      logger.error(`Erreur lors du démarrage du processeur: ${error.message}`);
      throw error;
    }
  }

  /**
   * Arrête le traitement automatique des messages
   */
  async stopProcessing() {
    if (!this.isRunning) {
      logger.info('Le processeur de messages n\'est pas en cours d\'exécution');
      return;
    }
    
    logger.info('Arrêt du processeur de messages');
    
    // Arrêter l'intervalle
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    this.isRunning = false;
    logger.info('Processeur de messages arrêté avec succès');
  }

  /**
   * Traite le prochain message de la file d'attente
   * @returns {Promise<boolean>} True si un message a été traité
   */
  async processNextMessage() {
    try {
      // Vérifier d'abord la validité du cookie
      const Cookie = require('../models/Cookie');
      const cookieRecord = await Cookie.findOne({ name: 'linkedin_li_at' });
      
      if (!cookieRecord || !cookieRecord.isValid) {
        logger.error('Cookie LinkedIn invalide ou expiré, traitement des messages suspendu');
        return false;
      }
      
      // Vérifier les quotas avant de récupérer un message
      const isQuotaReached = await this.checkQuotas();
      if (isQuotaReached) {
        logger.info('Quota journalier atteint, traitement suspendu');
        return false;
      }
      
      // Délai avant de récupérer le message
      let shortDelay = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
      logger.info(`⏳ Délai action (MsgProc - Pre-GetNext): ${Math.round(shortDelay / 1000)}s`);
      await sleep(shortDelay);

      // Récupérer le prochain message à traiter
      const message = await queueManager.getNextMessage();
      
      if (!message) {
        // Aucun message à traiter pour le moment
        return false;
      }
      
      logger.info(`Traitement du message ${message._id} pour le prospect ${message.prospectId._id}`);
      
      // Vérifier si le messageService est initialisé
      if (!messageService.browser || !messageService.page) {
        logger.info('Service de messagerie non initialisé, initialisation...');
        await messageService.initialize();
      }
      
      // Obtenir l'URL du profil LinkedIn du prospect
      const profileUrl = message.prospectId.linkedinProfileUrl;
      
      if (!profileUrl) {
        logger.error(`URL LinkedIn manquante pour le prospect ${message.prospectId._id}`);
        // Dans ce cas spécifique (URL manquante), marquer comme échoué
        await queueManager.updateMessageStatus(message._id, 'failed', 'URL LinkedIn manquante');
        
        // Mettre à jour l'historique du prospect si nécessaire
        const prospectStatus = await ProspectSequenceStatus.findById(message.prospectSequenceStatusId);
        if (prospectStatus) {
          const historyEntry = {
            step: prospectStatus.currentStep,
            status: 'failed',
            sentAt: new Date(),
            error: 'URL LinkedIn manquante'
          };
          
          await ProspectSequenceStatus.addHistoryEntry(prospectStatus._id, historyEntry);
        }
        
        return false;
      }
      
      // Récupérer le prénom pour la personnalisation
      // Utiliser 'Prospect' comme fallback si le prénom n'est pas disponible
      const firstName = message.prospectId.firstName || '';
      const greeting = `Bonjour ${firstName},\nJ\'espère que vous allez bien\n\n`;
      const fullMessageContent = greeting + message.messageContent;

      // Délai avant l'envoi
      shortDelay = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
      logger.info(`⏳ Délai action (MsgProc - Pre-Send): ${Math.round(shortDelay / 1000)}s`);
      await sleep(shortDelay);

      // Envoyer le message
      const result = await messageService.sendMessage(profileUrl, fullMessageContent);
      
      // Délai après l'envoi
      shortDelay = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
      logger.info(`⏳ Délai action (MsgProc - Post-Send): ${Math.round(shortDelay / 1000)}s`);
      await sleep(shortDelay);

      // Mettre à jour le statut du message
      if (result.success) {
        // Message envoyé avec succès
        
        // Délai avant mise à jour statut (Succès)
        shortDelay = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
        logger.info(`⏳ Délai action (MsgProc - Pre-Sent): ${Math.round(shortDelay / 1000)}s`);
        await sleep(shortDelay);
        
        await queueManager.updateMessageStatus(message._id, 'sent');
        
        // Mettre à jour le statut du prospect dans la séquence
        const prospectStatus = await ProspectSequenceStatus.findById(message.prospectSequenceStatusId);
        
        if (prospectStatus) {
          // Ajouter une entrée dans l'historique
          const historyEntry = {
            step: prospectStatus.currentStep,
            status: 'sent',
            sentAt: new Date(),
            error: null
          };
          
          // Mettre à jour le statut du prospect en incrémentant le currentStep
          const updatedStatus = await ProspectSequenceStatus.findByIdAndUpdate(
            prospectStatus._id,
            {
              currentStep: prospectStatus.currentStep + 1,
              lastMessageSentAt: new Date(),
              $push: { history: historyEntry }
            },
            { new: true } // Retourner le document mis à jour
          );
          
          // Planifier le prochain message avec le currentStep mis à jour
          await this._scheduleNextMessage(updatedStatus);
        }
        
        logger.info(`Message ${message._id} envoyé avec succès`);
        return true;
      } else {
        // Échec de l'envoi
        logger.error(`Échec de l\'envoi du message ${message._id}: ${result.error}`);
        
        // Délai avant mise à jour statut (Échec)
        shortDelay = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
        logger.info(`⏳ Délai action (MsgProc - Pre-Failed): ${Math.round(shortDelay / 1000)}s`);
        await sleep(shortDelay);
        
        // Marquer le message comme échoué au lieu de le laisser en file d'attente
        await queueManager.updateMessageStatus(message._id, 'failed', result.error);
        return false;
      }
    } catch (error) {
      logger.error(`Erreur lors du traitement du message: ${error.message}`);
      // Marquer le message comme échoué au lieu de le laisser en file d'attente
      if (message) {
        await queueManager.updateMessageStatus(message._id, 'failed', error.message);
      }
      return false;
    } finally {
      // Fermer le navigateur et libérer la session
      await messageService.close();
    }
  }

  /**
   * Vérifie les quotas journaliers
   * @returns {Promise<boolean>} True si les quotas sont atteints
   */
  async checkQuotas() {
    try {
      // Vérifier si on est dans les plages horaires autorisées
      if (!timeService.isInWorkingHours('message')) {
        logger.info('En dehors des plages horaires autorisées pour les messages');
        return true;
      }
      
      // Vérifier les quotas via timeService
      if (!timeService.checkQuotaAvailability('messages')) {
        logger.info('Quota journalier de messages atteint');
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Erreur lors de la vérification des quotas: ${error.message}`);
      return false;
    }
  }

  /**
   * Planifie le prochain message d'une séquence pour un prospect
   * @private
   * @param {Object} prospectStatus - Statut actuel du prospect dans la séquence
   * @returns {Promise<boolean>} True si un message a été planifié
   */
  async _scheduleNextMessage(prospectStatus) {
    try {
      // Vérifier si la séquence est terminée
      const nextStep = prospectStatus.currentStep + 1;
      const sequenceMessages = await SequenceMessage.getMessagesForSequence(prospectStatus.sequenceId);
      
      // Si tous les messages ont été envoyés, marquer comme terminé
      if (nextStep > sequenceMessages.length) {
        await ProspectSequenceStatus.findByIdAndUpdate(prospectStatus._id, {
          status: 'completed',
          completedAt: new Date()
        });
        
        logger.info(`Séquence terminée pour le prospect ${prospectStatus.prospectId}`);
        return false;
      }
      
      // Récupérer le prochain message en utilisant la position exacte
      const nextMessage = await SequenceMessage.getMessageByPosition(prospectStatus.sequenceId, nextStep);
      
      if (!nextMessage) {
        logger.error(`Message de position ${nextStep} introuvable pour la séquence ${prospectStatus.sequenceId}`);
        return false;
      }
      
      // Calculer la date d'envoi du prochain message en utilisant timeService
      const lastSentDate = prospectStatus.lastMessageSentAt || new Date();
      const nextDate = timeService.calculateOptimalSendTime(lastSentDate, nextMessage.delayHours);
      
      // Mettre à jour la date du prochain message prévu
      await ProspectSequenceStatus.findByIdAndUpdate(prospectStatus._id, {
        nextMessageScheduledAt: nextDate
      });
      
      // Ajouter le message à la file d'attente
      await queueManager.addToQueue(
        prospectStatus._id,
        nextMessage._id,
        nextMessage.content,
        nextDate
      );
      
      logger.info(`Prochain message planifié pour le prospect ${prospectStatus.prospectId} à ${nextDate.toISOString()}`);
      return true;
    } catch (error) {
      logger.error(`Erreur lors de la planification du prochain message: ${error.message}`);
      return false;
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
        quotas: { messages: { max: 100, delay: 60000 } }
      };
      return this.settings;
    }
  }
}

module.exports = new MessageProcessor();