// backend/services/timeService.js
const logger = require('../utils/logger');
const Settings = require('../models/AppSettings');


class TimeService {
  constructor() {
    // Initialiser avec des valeurs par défaut
    // Ces valeurs seront remplacées lors du chargement des paramètres
    this.timezone = 'Europe/Paris';
    this.intervals = {
      cookieCheck: 30 * 60 * 1000,      // 30 minutes
      connectionCheck: 60 * 60 * 1000,   // 1 heure
      connectionRequest: 60 * 1000,      // 1 minute
      sequenceScheduling: 15 * 60 * 1000, // 15 minutes
      messageProcessing: 60 * 1000       // 1 minute
    };
    this.workingHours = {
      message: { start: 9, end: 19 },
      connection: { start: 10, end: 20 }
    };
    
    // Charger les paramètres au démarrage
    this.loadSettings();
  }
  
  /**
   * Charge les paramètres depuis la base de données
   */
  async loadSettings() {
    try {
      const settings = await Settings.getGlobalSettings();
      this.updateFromSettings(settings);
      logger.info('Paramètres de temps chargés depuis la base de données');
    } catch (error) {
      logger.error(`Erreur lors du chargement des paramètres de temps: ${error.message}`);
      logger.info('Utilisation des paramètres de temps par défaut');
    }
  }
  
  /**
   * Recharge les paramètres avec les valeurs fournies
   * @param {Object} settings - Paramètres à utiliser
   */
  reloadSettings(settings) {
    this.updateFromSettings(settings);
    logger.info('Paramètres de temps rechargés');
  }
  
  /**
   * Met à jour les propriétés du service à partir des paramètres
   * @param {Object} settings - Paramètres à utiliser
   */
  updateFromSettings(settings) {
    if (settings) {
      if (settings.timezone) {
        this.timezone = settings.timezone;
      }
      
      if (settings.intervals) {
        Object.assign(this.intervals, settings.intervals);
      }
      
      if (settings.workingHours) {
        Object.assign(this.workingHours, settings.workingHours);
      }
      
      logger.info(`Service de temps configuré avec fuseau horaire: ${this.timezone}`);
      logger.debug(`Intervalles configurés: ${JSON.stringify(this.intervals)}`);
      logger.debug(`Heures de travail configurées: ${JSON.stringify(this.workingHours)}`);
    }
  }
  
  /**
   * Obtient l'heure actuelle au format Date avec le fuseau horaire configuré
   * @returns {Date} Date actuelle
   */
  getCurrentDate() {
    return new Date();
  }
  
  /**
   * Obtient l'heure actuelle dans le fuseau horaire configuré
   * @returns {number} Heure (0-23)
   */
  getCurrentHour() {
    const now = new Date();
    return this.getHourInTimezone(now);
  }
  
  /**
   * Obtient l'heure d'une date dans le fuseau horaire configuré
   * @param {Date} date - Date à convertir
   * @returns {number} Heure (0-23)
   */
  getHourInTimezone(date) {
    return this.getDateInTimezone(date).getHours();
  }
  
  /**
   * Convertit une date au fuseau horaire configuré
   * @param {Date} date - Date à convertir
   * @returns {Date} Date convertie
   */
  getDateInTimezone(date) {
    // Utilise la méthode Intl.DateTimeFormat pour obtenir l'heure dans le fuseau horaire configuré
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      timeZone: this.timezone,
      hour: 'numeric',
      hour12: false
    });
    
    // Extraire l'heure du résultat formaté
    const hour = parseInt(formatter.format(date));
    
    // Créer une nouvelle date avec l'heure ajustée
    const result = new Date(date);
    
    // Si on veut vraiment modifier l'objet date pour refléter le fuseau horaire
    // (cela peut être utile pour les calculs mais attention aux effets de bord)
    result.setHours(hour);
    
    return result;
  }
  
  /**
   * Vérifie si une date correspond à un jour ouvrable (lundi-vendredi)
   * @param {Date} date - Date à vérifier (par défaut: date actuelle)
   * @returns {boolean} True si c'est un jour ouvrable (lundi-vendredi)
   */
  isWorkingDay(date = this.getCurrentDate()) {
    const day = date.getDay();
    // 0 = dimanche, 6 = samedi
    return day !== 0 && day !== 6;
  }
  
  /**
   * Vérifie si l'heure actuelle est dans la plage horaire spécifiée
   * @param {string} type - Type de plage horaire ('message' ou 'connection')
   * @returns {boolean} True si dans la plage
   */
  isInWorkingHours(type = 'message') {
    // Vérifier d'abord si c'est un jour ouvrable
    if (!this.isWorkingDay()) {
      return false;
    }
    
    // Ensuite vérifier l'heure comme avant
    const currentHour = this.getCurrentHour();
    const range = this.workingHours[type] || this.workingHours.message;
    
    return currentHour >= range.start && currentHour < range.end;
  }
  
  /**
   * Calcule une date optimale pour un prochain envoi basée sur un délai
   * @param {Date} lastDate - Date de référence
   * @param {number} delayHours - Délai en heures
   * @returns {Date} Date optimale pour le prochain envoi
   */
  calculateOptimalSendTime(lastDate, delayHours) {
    // Convertir le délai d'heures en millisecondes
    const delayMs = delayHours * 60 * 60 * 1000;
    
    // Date de base avec délai appliqué
    const baseDate = new Date(lastDate.getTime() + delayMs);
    
    // Obtenir l'heure dans le fuseau horaire configuré
    const baseHour = this.getHourInTimezone(baseDate);
    
    let adjustedDate = new Date(baseDate);
    
    // Plage horaire de travail pour les messages
    const { start, end } = this.workingHours.message;
    
    // Si l'heure est avant l'heure de début, repousser à l'heure de début + aléatoire
    if (baseHour < start) {
      adjustedDate.setHours(start + Math.random());
      adjustedDate.setMinutes(Math.floor(Math.random() * 30));
    }
    
    // Si l'heure est après l'heure de fin, repousser au lendemain à l'heure de début + aléatoire
    if (baseHour >= end) {
      adjustedDate.setHours(start + Math.random());
      adjustedDate.setMinutes(Math.floor(Math.random() * 30));
      adjustedDate.setDate(adjustedDate.getDate() + 1);
    }
    
    // Vérifier si la date ajustée tombe un weekend
    if (!this.isWorkingDay(adjustedDate)) {
      // Si c'est un samedi ou dimanche, reporter au lundi suivant
      while (!this.isWorkingDay(adjustedDate)) {
        adjustedDate.setDate(adjustedDate.getDate() + 1);
      }
      
      // Réinitialiser l'heure au début de la plage horaire + aléatoire
      adjustedDate.setHours(start + Math.random());
      adjustedDate.setMinutes(Math.floor(Math.random() * 30));
    }
    
    // Ajouter un délai aléatoire supplémentaire entre 0 et 30 minutes
    const randomMinutes = Math.floor(Math.random() * 30);
    adjustedDate = new Date(adjustedDate.getTime() + (randomMinutes * 60 * 1000));
    
    return adjustedDate;
  }
  
  /**
   * Calcule un délai humain aléatoire
   * @param {number} minSeconds - Délai minimum en secondes
   * @param {number} maxSeconds - Délai maximum en secondes
   * @returns {number} Délai en millisecondes
   */
  getRandomDelay(minSeconds = 1, maxSeconds = 5) {
    return (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000;
  }
  
  /**
   * Vérifie si les quotas journaliers sont disponibles
   * @param {string} type - Type de quota ('connections', 'messages', etc.)
   * @returns {Promise<boolean>} True si les quotas sont disponibles
   */
  async checkQuotaAvailability(type) {
    try {
      // Vérifier d'abord si c'est un jour ouvrable
      if (!this.isWorkingDay()) {
        logger.info('Weekend détecté - quotas non disponibles');
        return false;
      }
      
      const DailyStats = require('../models/dailyStats');
      const stats = await DailyStats.getOrCreateTodayStats();
      
      let quotaMax;
      let quotaUsed;
      
      switch (type) {
        case 'connections':
          quotaMax = this.settings?.linkedin?.quotas?.connections || 50;
          quotaUsed = stats.connectionRequestsSent || 0;
          break;
        case 'messages':
          quotaMax = this.settings?.linkedin?.quotas?.messages || 100;
          quotaUsed = stats.messagesSent || 0;
          break;
        default:
          return true; // Par défaut, considérer qu'il n'y a pas de limite
      }
      
      return quotaUsed < quotaMax;
    } catch (error) {
      logger.error(`Erreur lors de la vérification des quotas: ${error.message}`);
      return false; // En cas d'erreur, par sécurité, considérer que les quotas sont atteints
    }
  }
  
  /**
   * Vérifie si une date spécifique est dans les plages horaires de travail
   * @param {Date} date - Date à vérifier
   * @param {string} type - Type de plage horaire ('message' ou 'connection')
   * @returns {boolean} True si dans la plage
   */
  isTimeInWorkingHours(date, type = 'message') {
    // Vérifier d'abord si c'est un jour ouvrable
    if (!this.isWorkingDay(date)) {
      return false;
    }
    
    // Vérifier l'heure comme avant
    const hour = this.getHourInTimezone(date);
    const range = this.workingHours[type] || this.workingHours.message;
    
    return hour >= range.start && hour < range.end;
  }
}

module.exports = new TimeService();