// backend/services/cookieValidatorService.js
const axios = require('axios');
const logger = require('../utils/logger');

class CookieValidatorService {
  constructor() {
    // Cache pour stocker les résultats de validation par cookie
    this.cookieCache = {
      value: null,
      result: null,
      timestamp: null
    };
    
    // Durée de validité du cache en millisecondes (5 minutes)
    this.cacheDuration = 5 * 60 * 1000;
  }

  /**
   * Vérifie si un cookie LinkedIn est valide en interrogeant l'API voyager
   * @param {string} cookie - Cookie LinkedIn (li_at)
   * @returns {Promise<{valid: boolean, message: string, cached: boolean}>} Résultat de la validation
   */
  async validateLinkedInCookie(cookie) {
    if (!cookie || cookie.trim() === '') {
      return { valid: false, message: 'Cookie non fourni', cached: false };
    }
    
    // Vérifier si le même cookie est dans le cache et si le cache est encore valide
    const currentTime = Date.now();
    if (
      this.cookieCache.value === cookie &&
      this.cookieCache.result !== null &&
      this.cookieCache.timestamp !== null &&
      (currentTime - this.cookieCache.timestamp) < this.cacheDuration
    ) {
      logger.info('Utilisation du résultat en cache pour le cookie LinkedIn');
      return { ...this.cookieCache.result, cached: true };
    }
  
    try {
      // Requête simple à la page d'accueil LinkedIn
      const response = await axios.get('https://www.linkedin.com/feed/', {
        headers: {
          'Cookie': `li_at=${cookie}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
        },
        maxRedirects: 0,  // Ne pas suivre les redirections
        validateStatus: status => true  // Accepter tous les codes de statut
      });
      
      let result;
      
      // Si on n'est pas redirigé vers la page de login, le cookie est valide
      if (response.status === 200) {
        logger.info('Cookie LinkedIn valide - Accès à la page daccueil réussi');
        result = { valid: true, message: 'Cookie valide' };
      } 
      // Si on est redirigé, le cookie est invalide
      else if (response.status === 302 || response.status === 303) {
        const redirectUrl = response.headers.location || '';
        if (redirectUrl.includes('login')) {
          logger.warn('Cookie LinkedIn invalide - Redirection vers la page de connexion');
          result = { valid: false, message: 'Cookie invalide - Redirection vers login' };
        } else {
          logger.warn(`Cookie LinkedIn invalide - Redirection vers: ${redirectUrl}`);
          result = { valid: false, message: `Cookie invalide - Redirection vers: ${redirectUrl}` };
        }
      }
      // Autres cas d'erreur
      else {
        logger.warn(`Cookie LinkedIn invalide - Statut HTTP: ${response.status}`);
        result = { valid: false, message: `Cookie invalide (statut HTTP: ${response.status})` };
      }
      
      // Mettre à jour le cache avec le nouveau résultat
      this.cookieCache = {
        value: cookie,
        result: result,
        timestamp: currentTime
      };
      
      return { ...result, cached: false };
    } catch (error) {
      logger.error(`Erreur lors de la validation du cookie LinkedIn: ${error.message}`);
      const result = { valid: false, message: `Erreur lors de la validation: ${error.message}` };
      
      // Ne pas mettre en cache les erreurs techniques
      return { ...result, cached: false };
    }
  }
  
  /**
   * Efface le cache de validation des cookies
   */
  clearCache() {
    this.cookieCache = {
      value: null,
      result: null,
      timestamp: null
    };
    logger.info('Cache de validation des cookies LinkedIn effacé');
  }
}

module.exports = new CookieValidatorService();