// backend/middleware/requireValidCookie.js
const authService = require('../services/authService');

/**
 * Middleware qui vérifie si le cookie LinkedIn est valide avant d'autoriser l'accès à une route
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction de passage à la suite
 */
const requireValidCookie = async (req, res, next) => {
  // Vérifier la validité du cookie
  try {
    const { isValid, cached, lastChecked } = await authService.checkCookieValidity();
    
    if (!isValid) {
      return res.status(401).json({
        message: 'Cookie LinkedIn invalide ou expiré',
        cookieStatus: {
          isValid: false,
          lastChecked: lastChecked || new Date(),
          cached: cached || false
        }
      });
    }
    
    // Si valide, passer à la suite
    next();
  } catch (error) {
    // Gérer les erreurs potentielles de vérification
    console.error('Erreur lors de la vérification du cookie:', error);
    return res.status(500).json({
      message: 'Erreur lors de la vérification du cookie',
      error: error.message
    });
  }
};

module.exports = requireValidCookie;