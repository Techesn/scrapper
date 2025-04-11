const mongoose = require('mongoose');
const timeService = require('../services/timeService');
const logger = require('../utils/logger');

/**
 * Schéma pour les statistiques quotidiennes
 */
const dailyStatsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true
  },
  messagesSent: {
    type: Number,
    default: 0
  },
  connectionRequestsSent: {
    type: Number,
    default: 0
  },
  messagesQuota: {
    type: Number,
    default: 100
  },
  connectionRequestsQuota: {
    type: Number,
    default: 25
  }
}, { timestamps: true });

/**
 * Méthodes statiques du schéma
 */
dailyStatsSchema.statics = {
  /**
   * Récupère ou crée les statistiques pour aujourd'hui
   * @returns {Promise<Object>} Statistiques du jour
   */
  async getOrCreateTodayStats() {
    // Obtenir la date d'aujourd'hui à 8h du matin dans le fuseau horaire configuré
    const today = timeService.getDateInTimezone(new Date());
    today.setHours(8, 0, 0, 0);
    
    try {
      // Chercher les stats d'aujourd'hui
      let stats = await this.findOne({ date: today });
      
      // Si elles n'existent pas, les créer
      if (!stats) {
        try {
          stats = await this.create({
            date: today,
            messagesSent: 0,
            connectionRequestsSent: 0,
            messagesQuota: 100,
            connectionRequestsQuota: 25
          });
        } catch (createError) {
          // Si l'erreur est une duplication de clé, réessayer de récupérer les stats
          if (createError.code === 11000) {
            stats = await this.findOne({ date: today });
            if (!stats) {
              throw createError; // Si toujours pas de stats, propager l'erreur
            }
          } else {
            throw createError; // Propager les autres erreurs
          }
        }
      }
      
      return stats;
    } catch (error) {
      logger.error(`Erreur lors de la vérification des quotas: ${error.message}`);
      throw error;
    }
  },

  /**
   * Incrémente le compteur de messages envoyés
   * @returns {Promise<Object>} Statistiques mises à jour
   */
  async incrementMessagesSent() {
    const today = timeService.getDateInTimezone(new Date());
    today.setHours(8, 0, 0, 0);
    
    // D'abord s'assurer que les stats existent
    await this.getOrCreateTodayStats();
    
    // Puis incrémenter
    return this.findOneAndUpdate(
      { date: today },
      { $inc: { messagesSent: 1 } },
      { new: true }
    );
  },

  /**
   * Incrémente le compteur de demandes de connexion envoyées
   * @returns {Promise<Object>} Statistiques mises à jour
   */
  async incrementConnectionRequestsSent() {
    const today = timeService.getDateInTimezone(new Date());
    today.setHours(8, 0, 0, 0);
    
    // D'abord s'assurer que les stats existent
    await this.getOrCreateTodayStats();
    
    // Puis incrémenter
    return this.findOneAndUpdate(
      { date: today },
      { $inc: { connectionRequestsSent: 1 } },
      { new: true }
    );
  },

  /**
   * Vérifie si le quota de messages a été atteint
   * @returns {Promise<boolean>} True si le quota est atteint
   */
  async isMessageQuotaReached() {
    const stats = await this.getOrCreateTodayStats();
    return stats.messagesSent >= stats.messagesQuota;
  },

  /**
   * Vérifie si le quota de demandes de connexion a été atteint
   * @returns {Promise<boolean>} True si le quota est atteint
   */
  async isConnectionRequestQuotaReached() {
    const stats = await this.getOrCreateTodayStats();
    return stats.connectionRequestsSent >= stats.connectionRequestsQuota;
  }
};

const DailyStats = mongoose.model('DailyStats', dailyStatsSchema);

module.exports = DailyStats;