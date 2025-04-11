// backend/services/authService.js
const { EventEmitter } = require('events');
const cookieValidatorService = require('./cookieValidatorService');
const Cookie = require('../models/Cookie');
const logger = require('../utils/logger'); // Utiliser votre logger existant

// Créer un émetteur d'événements pour les changements d'état du cookie
const cookieEvents = new EventEmitter();

class AuthService {
  constructor() {
    // Initialiser l'état du cookie
    this.cookieValid = false;
    this.cookieCheckInterval = null;
  }
  
  /**
   * Démarre une vérification périodique du cookie
   * @param {number} interval - Intervalle en millisecondes (par défaut 30 minutes)
   */
  startPeriodicCheck(interval = 30 * 60 * 1000) {
    // Arrêter l'intervalle existant s'il y en a un
    if (this.cookieCheckInterval) {
      clearInterval(this.cookieCheckInterval);
    }
    
    // Vérifier immédiatement
    this.checkCookieValidity();
    
    // Configurer la vérification périodique
    this.cookieCheckInterval = setInterval(() => {
      this.checkCookieValidity();
    }, interval);
    
    logger.info(`Vérification périodique du cookie LinkedIn configurée (toutes les ${interval/60000} minutes)`);
  }
  
  /**
   * Arrête la vérification périodique du cookie
   */
  stopPeriodicCheck() {
    if (this.cookieCheckInterval) {
      clearInterval(this.cookieCheckInterval);
      this.cookieCheckInterval = null;
      logger.info('Vérification périodique du cookie LinkedIn arrêtée');
    }
  }
  
 /**
 * Vérifie la validité du cookie actuel
 * @returns {Promise<{isValid: boolean, cached: boolean, lastChecked: Date}>}
 */
async checkCookieValidity() {
  try {
    // Récupérer le cookie de la base de données
    const cookieRecord = await Cookie.findOne({ name: 'linkedin_li_at' });
    
    if (!cookieRecord || !cookieRecord.value) {
      logger.info('Aucun cookie LinkedIn trouvé dans la base de données');
      this.updateCookieState(false);
      return { 
        isValid: false, 
        cached: false, 
        lastChecked: new Date() 
      };
    }
    
    // Vérifier la validité du cookie
    const validationResult = await cookieValidatorService.validateLinkedInCookie(cookieRecord.value);
    
    // Mettre à jour l'état du cookie dans la BD
    await Cookie.findOneAndUpdate(
      { name: 'linkedin_li_at' },
      { 
        isValid: validationResult.valid,
        lastChecked: new Date()
      }
    );
    
    // Mettre à jour l'état interne et émettre un événement si l'état change
    this.updateCookieState(validationResult.valid);
    
    logger.info(`Cookie LinkedIn vérifié: ${validationResult.valid ? 'Valide' : 'Invalide'} ${validationResult.cached ? '(depuis le cache)' : ''}`);
    
    return {
      isValid: validationResult.valid,
      cached: validationResult.cached || false,
      lastChecked: new Date()
    };
  } catch (error) {
    logger.error(`Erreur lors de la vérification du cookie LinkedIn: ${error.message}`);
    this.updateCookieState(false);
    return {
      isValid: false,
      cached: false,
      lastChecked: new Date(),
      error: error.message
    };
  }
}
  
  /**
   * Met à jour l'état du cookie et émet un événement si l'état change
   * @param {boolean} isValid - Nouvel état de validité
   */
  updateCookieState(isValid) {
    // Détecter un changement d'état
    const stateChanged = this.cookieValid !== isValid;
    
    // Mettre à jour l'état
    this.cookieValid = isValid;
    
    // Émettre un événement si l'état a changé
    if (stateChanged) {
      cookieEvents.emit('cookieStateChanged', isValid);
      
      if (isValid) {
        cookieEvents.emit('cookieBecameValid');
      } else {
        cookieEvents.emit('cookieBecameInvalid');
      }
    }
  }
  
  /**
   * Vérifie si le cookie est actuellement valide
   * @returns {boolean} État actuel du cookie
   */
  isCookieValid() {
    return this.cookieValid;
  }
  
  /**
   * Récupère le cookie LinkedIn pour les opérations de scraping
   * @returns {Promise<string|null>} Cookie LinkedIn ou null si non valide
   */
  async getValidCookie() {
    // Vérifier d'abord si nous pensons que le cookie est valide
    if (!this.cookieValid) {
      // Double vérification au cas où l'état serait obsolète
      const isValid = await this.checkCookieValidity();
      if (!isValid) {
        return null;
      }
    }
    
    // Récupérer le cookie de la base de données
    try {
      const cookieRecord = await Cookie.findOne({ name: 'linkedin_li_at' });
      return cookieRecord ? cookieRecord.value : null;
    } catch (error) {
      logger.error(`Erreur lors de la récupération du cookie LinkedIn: ${error.message}`);
      return null;
    }
  }
  
  /**
   * S'abonne aux événements de changement d'état du cookie
   * @param {string} event - Nom de l'événement ('cookieStateChanged', 'cookieBecameValid', 'cookieBecameInvalid')
   * @param {Function} callback - Fonction de rappel
   */
  on(event, callback) {
    cookieEvents.on(event, callback);
  }
  
  /**
   * Se désabonne des événements de changement d'état du cookie
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction de rappel
   */
  off(event, callback) {
    cookieEvents.off(event, callback);
  }
}

module.exports = new AuthService();