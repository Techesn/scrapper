const logger = require('../utils/logger');
const Session = require('../models/session');
const Prospect = require('../models/prospect');
const mongoose = require('mongoose');


/**
 * Service de gestion des sessions de scraping et autres opérations
 */
class SessionService {
  /**
   * Crée une nouvelle session
   * @param {Object} sessionData - Données de la session
   * @returns {Promise<Object>} Session créée
   */
  async createSession(sessionData) {
    try {
      logger.info(`Création d'une nouvelle session de type ${sessionData.type}`);
      
      // Vérifier si une session est en cours d'exécution (status = 'running')
      const runningSessionCount = await Session.countDocuments({ status: 'running' });
      if (runningSessionCount > 0 && sessionData.type === 'scraping') {
        throw new Error('Une session de scraping est déjà en cours d\'exécution. Terminez-la avant d\'en créer une nouvelle.');
      }
      
      // Créer la session
      const session = new Session({
        name: sessionData.name || `Session de ${sessionData.type} ${new Date().toLocaleDateString()}`,
        type: sessionData.type || 'scraping',
        status: sessionData.status || 'initializing',
        sourceUrl: sessionData.sourceUrl,
        totalProspectsCount: sessionData.totalProspectsCount || 0,
        scrapedProspectsCount: 0,
        currentPage: 1,
        lastProspectName: '',
        isCompleted: false,
        metadata: sessionData.metadata || {}
      });
      
      const savedSession = await session.save();
      logger.info(`Session créée avec l'ID: ${savedSession._id}`);
      
      return savedSession;
    } catch (error) {
      logger.error(`Erreur lors de la création de la session: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }
  /**
   * Met à jour une session
   * @param {string} sessionId - ID de la session
   * @param {Object} updateData - Données à mettre à jour
   * @returns {Promise<Object>} Session mise à jour
   */
  async updateSession(sessionId, updateData) {
    try {
      logger.info(`Mise à jour de la session ${sessionId}`);
      
      const session = await Session.findById(sessionId);
      if (!session) {
        throw new Error(`Session avec l'ID ${sessionId} introuvable`);
      }
      
      // Mise à jour des champs
      Object.keys(updateData).forEach(key => {
        if (session.schema.paths[key]) {
          session[key] = updateData[key];
        }
      });
      
      // Si la session est terminée, ajouter une date de fin
      if (updateData.status === 'completed' || updateData.status === 'stopped') {
        session.endDate = new Date();
        
        // Vérifier si tous les prospects ont été scrapés
        if (updateData.status === 'completed') {
          session.isCompleted = session.scrapedProspectsCount >= session.totalProspectsCount;
        }
      }
      
      const updatedSession = await session.save();
      logger.info(`Session ${sessionId} mise à jour avec succès`);
      
      return updatedSession;
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour de la session: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }
  
  /**
   * Met à jour le statut d'une session
   * @param {string} sessionId - ID de la session
   * @param {string} status - Nouveau statut
   * @returns {Promise<Object>} Session mise à jour
   */
  async updateSessionStatus(sessionId, status) {
    try {
      const validStatuses = ['initializing', 'running', 'paused', 'completed', 'error', 'stopped'];
      
      if (!validStatuses.includes(status)) {
        throw new Error(`Statut invalide: ${status}`);
      }
      
      const updateData = { status };
      
      // Si la session est terminée ou arrêtée, ajouter une date de fin
      if (status === 'completed' || status === 'stopped') {
        updateData.endDate = new Date();
      }
      
      return await this.updateSession(sessionId, updateData);
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour du statut de la session: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Vérifie si une session est active
   * @returns {Promise<boolean>} True si une session est active
   */
  async hasActiveSession() {
    try {
      return await Session.hasActiveSession();
    } catch (error) {
      logger.error(`Erreur lors de la vérification des sessions actives: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Récupère la session active
   * @returns {Promise<Object|null>} Session active ou null
   */
  async getActiveSession() {
    try {
      return await Session.getCurrentSession();
    } catch (error) {
      logger.error(`Erreur lors de la récupération de la session active: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Récupère toutes les sessions avec filtres optionnels
   * @param {Object} filters - Filtres (status, type, limit, skip)
   * @returns {Promise<Array>} Liste des sessions
   */
  async getSessions(filters = {}) {
    try {
      // Construire la requête avec les filtres
      const query = {};
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.type) {
        query.type = filters.type;
      }
      
      // Récupérer les sessions avec pagination si nécessaire
      const sessions = await Session.find(query)
        .sort({ startDate: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0);
      
      // Calculer le nombre total de sessions pour la pagination
      const total = await Session.countDocuments(query);
      
      return {
        sessions,
        pagination: {
          total,
          page: Math.floor(filters.skip / filters.limit) + 1 || 1,
          limit: filters.limit || 50,
          pages: Math.ceil(total / (filters.limit || 50))
        }
      };
    } catch (error) {
      logger.error(`Erreur lors de la récupération des sessions: ${error.message}`);
      return { sessions: [], pagination: { total: 0, page: 1, limit: 50, pages: 0 } };
    }
  }
  
  /**
   * Récupère une session par ID
   * @param {string} sessionId - ID de la session
   * @returns {Promise<Object>} Session avec statistiques
   */
  async getSession(sessionId) {
    try {
      const session = await Session.findById(sessionId);
      
      if (!session) {
        throw new Error(`Session avec l'ID ${sessionId} introuvable`);
      }
      
      // Récupérer le nombre de prospects associés à cette session
      const prospectsCount = await Prospect.countDocuments({ sessionId: session._id });
      
      // Retourner la session avec des statistiques supplémentaires
      return {
        ...session.toObject(),
        stats: {
          prospectsCount,
          completionRate: session.totalProspectsCount > 0 
            ? Math.round((session.scrapedProspectsCount / session.totalProspectsCount) * 100) 
            : 0
        }
      };
    } catch (error) {
      logger.error(`Erreur lors de la récupération de la session: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Récupère les statistiques globales des sessions
   * @returns {Promise<Object>} Statistiques
   */
  async getStats() {
    try {
      // Statistiques globales par type de session
      const typeStats = await Session.getStats();
      
      // Statistiques des sessions actives
      const activeSessions = await Session.countDocuments({
        status: { $in: ['running', 'paused'] }
      });
      
      // Sessions récentes
      const recentSessions = await Session.find()
        .sort({ startDate: -1 })
        .limit(5);
      
      return {
        byType: typeStats,
        activeSessions,
        recentSessions
      };
    } catch (error) {
      logger.error(`Erreur lors de la récupération des statistiques: ${error.message}`);
      return { byType: [], activeSessions: 0, recentSessions: [] };
    }
  }
  
  /**
   * Supprime une session et tous les prospects associés
   * @param {string} sessionId - ID de la session à supprimer
   * @returns {Promise<{deletedProspectsCount: number, deletedSession: boolean}>} Résultat de la suppression
   */
  async deleteSessionAndProspects(sessionId) {
    try {
      logger.info(`Tentative de suppression de la session ${sessionId} et de ses prospects`);
      
      // 1. Supprimer les prospects associés à la session
      const prospectDeletionResult = await Prospect.deleteMany({ sessionId: sessionId });
      const deletedProspectsCount = prospectDeletionResult.deletedCount;
      logger.info(`${deletedProspectsCount} prospects supprimés pour la session ${sessionId}`);
      
      // 2. Supprimer la session elle-même
      const sessionDeletionResult = await Session.findByIdAndDelete(sessionId);
      
      if (!sessionDeletionResult) {
        logger.warn(`Session ${sessionId} non trouvée lors de la tentative de suppression.`);
        return { deletedProspectsCount, deletedSession: false };
      }
      
      logger.info(`Session ${sessionId} supprimée avec succès`);
      return { deletedProspectsCount, deletedSession: true };
      
    } catch (error) {
      logger.error(`Erreur lors de la suppression de la session ${sessionId}: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }
}

module.exports = new SessionService();