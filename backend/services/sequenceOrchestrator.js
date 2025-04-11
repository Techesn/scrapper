const queueManager = require('./queueManager');
const messageProcessor = require('./messageProcessor');
const connectionManager = require('./connectionManager');
const sequenceScheduler = require('./sequenceScheduler');
const Sequence = require('../models/sequence');
const ProspectSequenceStatus = require('../models/prospectSequenceStatus');
const Prospect = require('../models/prospect');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const connectionChecker = require('./connectionChecker');
const { sleep } = require('../utils/puppeteerUtils');
const AppSettings = require('../models/AppSettings');

/**
 * Service d'orchestration des séquences de messages LinkedIn
 */
class SequenceOrchestrator {
  constructor() {
    this.isInitialized = false;
    this.isRunning = false;
    this.settings = null; // Pour stocker les paramètres
    
    // S'abonner aux événements de changement d'état du cookie
    const authService = require('../services/authService');
    authService.on('cookieBecameInvalid', async () => {
      logger.warn('Cookie LinkedIn devenu invalide - Arrêt de l\'orchestrateur de séquences');
      await this.stop();
    });
    
    authService.on('cookieBecameValid', async () => {
      logger.info('Cookie LinkedIn redevenu valide - L\'orchestrateur peut être redémarré');
      // Redémarrer automatiquement l'orchestrateur
      await this.start();
    });
  }

  /**
   * Initialise l'orchestrateur
   */
  async init() {
    if (this.isInitialized) return;
    
    try {
      logger.info('Initialisation de l\'orchestrateur de séquences');
      
      // Charger les paramètres
      await this._loadSettings();
      
      // Vérifier d'abord la validité du cookie
      const Cookie = require('../models/Cookie');
      const cookieRecord = await Cookie.findOne({ name: 'linkedin_li_at' });
      
      if (!cookieRecord || !cookieRecord.isValid) {
        logger.error('Cookie LinkedIn invalide ou expiré - Orchestrateur ne peut pas démarrer');
        throw new Error('Cookie LinkedIn invalide ou expiré');
      }
      
      // Initialiser tous les services nécessaires
      await queueManager.init();
      await messageProcessor.init();
      await connectionManager.init();
      
      this.isInitialized = true;
      logger.info('Orchestrateur de séquences initialisé avec succès');
    } catch (error) {
      logger.error(`Erreur lors de l'initialisation de l'orchestrateur: ${error.message}`);
      throw error;
    }
  }

  /**
   * Démarre l'orchestrateur et tous ses services
   */
  async start() {
    try {
      // Vérifier d'abord la validité du cookie
      const authService = require('../services/authService');
      const isValid = await authService.checkCookieValidity();
      
      if (!isValid) {
        logger.error('Cookie LinkedIn invalide - Orchestrateur ne peut pas démarrer');
        throw new Error('Cookie LinkedIn invalide');
      }
      
      // S'assurer que l'orchestrateur est initialisé
      if (!this.isInitialized) {
        await this.init();
      }
      if (this.isRunning) {
        logger.info('L\'orchestrateur est déjà en cours d\'exécution');
        return;
      }
      
      logger.info('Démarrage de l\'orchestrateur de séquences');
      
      // Démarrer tous les services avec les intervalles configurés
      const messageInterval = this.settings?.intervals?.messageProcessing;
      const connectionRequestInterval = this.settings?.intervals?.connectionRequest;
      const connectionCheckInterval = this.settings?.intervals?.connectionCheck;
      const sequenceSchedulingInterval = this.settings?.intervals?.sequenceScheduling;
      
      // Démarrer en série avec des délais entre chaque service
      // Pour éviter de démarrer trop rapidement et potentiellement surcharger le système
      await messageProcessor.startProcessing(messageInterval);
      await sleep(2000);
      
      await connectionManager.startConnectionRequests(connectionRequestInterval);
      await sleep(2000);
      
      await connectionChecker.startChecking(connectionCheckInterval);
      await sleep(2000);
      
      await sequenceScheduler.startScheduling(sequenceSchedulingInterval);
      
      this.isRunning = true;
      logger.info('Orchestrateur de séquences démarré avec succès');
    } catch (error) {
      logger.error(`Erreur lors du démarrage de l'orchestrateur: ${error.message}`);
      
      // Tenter d'arrêter les services qui auraient pu démarrer
      try {
        await this.stop();
      } catch (stopError) {
        logger.error(`Erreur lors de l'arrêt d'urgence: ${stopError.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Arrête l'orchestrateur et tous ses services
   */
  async stop() {
    if (!this.isRunning) {
      logger.info('L\'orchestrateur n\'est pas en cours d\'exécution');
      return;
    }
    
    logger.info('Arrêt de l\'orchestrateur de séquences');
    
    try {
      // Arrêter tous les services
      await messageProcessor.stopProcessing();
      await connectionManager.stopConnectionChecks();
      await sequenceScheduler.stopScheduling();
      await connectionManager.stopConnectionRequests(); 
      await connectionChecker.stopChecking();
      this.isRunning = false;
      logger.info('Orchestrateur de séquences arrêté avec succès');
    } catch (error) {
      logger.error(`Erreur lors de l'arrêt de l'orchestrateur: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ajoute un prospect à une séquence
   * @param {string} prospectId - ID du prospect
   * @param {string} sequenceId - ID de la séquence
   * @returns {Promise<Object>} Statut créé
   */
  async addProspectToSequence(prospectId, sequenceId) {
    try {
      logger.info(`Ajout du prospect ${prospectId} à la séquence ${sequenceId}`);
      
      // Vérifier que la séquence existe
      const sequence = await Sequence.getSequenceById(sequenceId);
      if (!sequence) {
        throw new Error(`Séquence ${sequenceId} introuvable`);
      }
      
      // Vérifier que le prospect existe
      const prospect = await Prospect.findById(prospectId);
      if (!prospect) {
        throw new Error(`Prospect ${prospectId} introuvable`);
      }
      
      // Vérifier si le prospect est déjà dans cette séquence
      const existingStatus = await ProspectSequenceStatus.findOne({
        prospectId,
        sequenceId
      });
      
      if (existingStatus) {
        logger.info(`Le prospect ${prospectId} est déjà dans la séquence ${sequenceId}`);
        return existingStatus;
      }
      
      // Définir le statut initial
      let initialStatus = 'pending';
      
      // Si la séquence est active, définir le statut sur 'active' si le prospect est connecté
        if (prospect.connectionStatus === 'connected') {
          initialStatus = 'active';
        } else {
          // Ajouter à la file d'attente de connexions en incluant l'ID de la séquence
          await connectionManager.sendConnectionRequest(prospectId, sequenceId);
        }
      
      // Créer le statut du prospect dans la séquence
      const prospectStatus = await ProspectSequenceStatus.create({
        prospectId,
        sequenceId,
        currentStep: 0,
        status: initialStatus,
        connectionStatus: prospect.connectionStatus || 'not_connected'
      });
      
      // Si le prospect est actif, planifier immédiatement le premier message
      if (initialStatus === 'active') {
        await sequenceScheduler.scheduleNextMessageForProspect(prospectStatus._id);
      }
      
      logger.info(`Prospect ${prospectId} ajouté à la séquence ${sequenceId} avec le statut ${initialStatus}`);
      return prospectStatus;
    } catch (error) {
      logger.error(`Erreur lors de l'ajout du prospect à la séquence: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retire un prospect d'une séquence
   * @param {string} prospectId - ID du prospect
   * @param {string} [sequenceId] - ID de la séquence (optionnel, toutes les séquences si non spécifié)
   * @returns {Promise<number>} Nombre de statuts supprimés
   */
  async removeProspectFromSequence(prospectId, sequenceId = null) {
    try {
      if (sequenceId) {
        logger.info(`Retrait du prospect ${prospectId} de la séquence ${sequenceId}`);
      } else {
        logger.info(`Retrait du prospect ${prospectId} de toutes les séquences`);
      }
      
      // Construire la requête
      const query = { prospectId };
      if (sequenceId) {
        query.sequenceId = sequenceId;
      }
      
      // Supprimer les statuts correspondants
      const result = await ProspectSequenceStatus.deleteMany(query);
      
      // Supprimer également les messages en file d'attente
      // (cette opération pourrait être améliorée pour plus d'efficacité)
      const messageQueue = require('../models/messageQueue');
      await messageQueue.deleteMany({ prospectId });
      
      logger.info(`${result.deletedCount} statut(s) supprimé(s) pour le prospect ${prospectId}`);
      return result.deletedCount;
    } catch (error) {
      logger.error(`Erreur lors du retrait du prospect de la séquence: ${error.message}`);
      throw error;
    }
  }

  /**
   * Met en pause une séquence
   * @param {string} sequenceId - ID de la séquence
   * @returns {Promise<Object>} Résultat de la mise en pause
   */
  async pauseSequence(sequenceId) {
    try {
      logger.info(`Mise en pause de la séquence ${sequenceId}`);
      
      // Déléguer au SequenceScheduler
      const affectedProspects = await sequenceScheduler.handleSequencePause(sequenceId);
      
      return {
        success: true,
        sequenceId,
        affectedProspects
      };
    } catch (error) {
      logger.error(`Erreur lors de la mise en pause de la séquence: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reprend une séquence mise en pause
   * @param {string} sequenceId - ID de la séquence
   * @returns {Promise<Object>} Résultat de la reprise
   */
  async resumeSequence(sequenceId) {
    try {
      logger.info(`Reprise de la séquence ${sequenceId}`);
      
      // Déléguer au SequenceScheduler
      const affectedProspects = await sequenceScheduler.handleSequenceResume(sequenceId);
      
      return {
        success: true,
        sequenceId,
        affectedProspects
      };
    } catch (error) {
      logger.error(`Erreur lors de la reprise de la séquence: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ajoute plusieurs prospects à une séquence
   * @param {Array<string>} prospectIds - Liste des IDs de prospects
   * @param {string} sequenceId - ID de la séquence
   * @returns {Promise<Object>} Résultat de l'opération
   */
  async addProspectsToSequence(prospectIds, sequenceId) {
    try {
      logger.info(`Ajout de ${prospectIds.length} prospects à la séquence ${sequenceId}`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const prospectId of prospectIds) {
        try {
          await this.addProspectToSequence(prospectId, sequenceId);
          successCount++;
        } catch (error) {
          logger.error(`Erreur pour le prospect ${prospectId}: ${error.message}`);
          errorCount++;
        }
      }
      
      return {
        success: true,
        total: prospectIds.length,
        successCount,
        errorCount
      };
    } catch (error) {
      logger.error(`Erreur lors de l'ajout des prospects à la séquence: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtient les statistiques d'une séquence
   * @param {string} sequenceId - ID de la séquence
   * @returns {Promise<Object>} Statistiques de la séquence
   */
  async getSequenceStats(sequenceId) {
    try {
      logger.info(`Récupération des statistiques pour la séquence ${sequenceId}`);
      
      // Récupérer la séquence
      const sequence = await Sequence.getSequenceById(sequenceId);
      if (!sequence) {
        throw new Error(`Séquence ${sequenceId} introuvable`);
      }
      
      // Compter les prospects par statut
      const activeCount = await ProspectSequenceStatus.countDocuments({
        sequenceId,
        status: 'active'
      });
      
      const pendingCount = await ProspectSequenceStatus.countDocuments({
        sequenceId,
        status: 'pending'
      });
      
      const pausedCount = await ProspectSequenceStatus.countDocuments({
        sequenceId,
        status: 'paused'
      });
      
      const completedCount = await ProspectSequenceStatus.countDocuments({
        sequenceId,
        status: 'completed'
      });
      
      const failedCount = await ProspectSequenceStatus.countDocuments({
        sequenceId,
        status: 'failed'
      });
      
    // Récupérer le nombre de messages par étape
    const messageStats = await ProspectSequenceStatus.aggregate([
        { $match: { sequenceId: new mongoose.Types.ObjectId(sequenceId) } },
        { $group: {
            _id: '$currentStep',
            count: { $sum: 1 }
        }
        },
        { $sort: { _id: 1 } }
    ]);
      
      // Reformater les statistiques des messages
      const messageStepStats = messageStats.map(stat => ({
        step: stat._id,
        count: stat.count
      }));
      
      return {
        sequenceId,
        totalProspects: activeCount + pendingCount + pausedCount + completedCount + failedCount,
        statusCounts: {
          active: activeCount,
          pending: pendingCount,
          paused: pausedCount,
          completed: completedCount,
          failed: failedCount
        },
        messageSteps: messageStepStats
      };
    } catch (error) {
      logger.error(`Erreur lors de la récupération des statistiques de la séquence: ${error.message}`);
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
      return null;
    }
  }
}

module.exports = new SequenceOrchestrator();