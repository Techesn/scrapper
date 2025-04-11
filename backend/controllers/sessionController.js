const sessionService = require('../services/sessionService');
const scraperService = require('../services/scraperService');
const logger = require('../utils/logger');
const Session = require('../models/session'); 
const Prospect = require('../models/prospect');
/**
 * Récupère toutes les sessions avec filtrage et pagination
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getSessions = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    
    const filters = {
      status,
      type,
      limit: parseInt(limit, 10),
      skip: (parseInt(page, 10) - 1) * parseInt(limit, 10)
    };
    
    const result = await sessionService.getSessions(filters);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des sessions: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la récupération des sessions: ${error.message}`
    });
  }
};

/**
 * Récupère une session spécifique par ID
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getSession = async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await sessionService.getSession(id);
    
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération de la session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la récupération de la session: ${error.message}`
    });
  }
};

/**
 * Crée une nouvelle session
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const createSession = async (req, res) => {
  try {
    const { name, type, sourceUrl, totalProspectsCount, metadata } = req.body;
    
    // Validation des données requises
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: 'Le nom et le type de session sont requis'
      });
    }
    
    // Validation pour les sessions de scraping
    if (type === 'scraping' && !sourceUrl) {
      return res.status(400).json({
        success: false,
        message: 'L\'URL source est requise pour les sessions de scraping'
      });
    }
    
    // Vérifier seulement si une session est en cours d'exécution (running), pas en pause
    const runningSessionCount = await Session.countDocuments({ status: 'running' });
    if (runningSessionCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Une session est en cours d\'exécution. Mettez-la en pause ou terminez-la avant d\'en créer une nouvelle.'
      });
    }
    
    // Créer la session
    const session = await sessionService.createSession({
      name,
      type,
      sourceUrl,
      totalProspectsCount,
      metadata,
      status: 'initializing'
    });
    
    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error(`Erreur lors de la création de la session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la création de la session: ${error.message}`
    });
  }
};

/**
 * Démarre une session de scraping
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const startSession = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si la session existe
    const session = await sessionService.getSession(id);
    
    // Vérifier si la session est de type scraping
    if (session.type !== 'scraping') {
      return res.status(400).json({
        success: false,
        message: 'Seules les sessions de scraping peuvent être démarrées via cette API'
      });
    }
    
    // Vérifier si la session est déjà en cours
    if (session.status === 'running') {
      return res.status(400).json({
        success: false,
        message: 'Cette session est déjà en cours d\'exécution'
      });
    }
    
    // Mettre à jour le statut de la session
    await sessionService.updateSessionStatus(id, 'running');
    
    // Démarrer le scraping de manière asynchrone
    res.status(200).json({
      success: true,
      message: 'Session démarrée',
      data: { sessionId: id }
    });
    
    // Si la session est nouvelle, initialiser et démarrer le scraping
    if (session.status === 'initializing') {
      await scraperService.startScraping(session.sourceUrl, session.name, id);
    } 
    // Si la session est en pause, la reprendre
    else if (session.status === 'paused') {
      await scraperService.loadSession(id);
      await scraperService.resumeScraping();
    }
    
  } catch (error) {
    logger.error(`Erreur lors du démarrage de la session: ${error.message}`);
    // Mettre à jour le statut de la session en cas d'erreur
    try {
      await sessionService.updateSession(req.params.id, {
        status: 'error',
        metadata: { error: error.message }
      });
    } catch (updateError) {
      logger.error(`Erreur lors de la mise à jour du statut de la session: ${updateError.message}`);
    }
    
    res.status(500).json({
      success: false,
      message: `Erreur lors du démarrage de la session: ${error.message}`
    });
  }
};

/**
 * Met en pause une session
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const pauseSession = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si la session existe
    const session = await sessionService.getSession(id);
    
    // Vérifier si la session est en cours
    if (session.status !== 'running') {
      return res.status(400).json({
        success: false,
        message: 'Seules les sessions en cours peuvent être mises en pause'
      });
    }
    
    // Mettre à jour le statut de la session
    await sessionService.updateSessionStatus(id, 'paused');
    
    // Si c'est une session de scraping, mettre en pause le scraper
    if (session.type === 'scraping') {
      await scraperService.pauseScraping();
    }
    
    res.status(200).json({
      success: true,
      message: 'Session mise en pause',
      data: { sessionId: id }
    });
  } catch (error) {
    logger.error(`Erreur lors de la mise en pause de la session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la mise en pause de la session: ${error.message}`
    });
  }
};

/**
 * Reprend une session en pause
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const resumeSession = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si la session existe
    const session = await sessionService.getSession(id);
    
    // Vérifier si la session est en pause
    if (session.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: 'Seules les sessions en pause peuvent être reprises'
      });
    }
    
    // Vérifier qu'aucune autre session n'est en cours
    const hasRunningSession = await Session.countDocuments({
      _id: { $ne: id },
      status: 'running'
    });
    
    if (hasRunningSession > 0) {
      return res.status(400).json({
        success: false,
        message: 'Une autre session est déjà en cours. Arrêtez-la avant de reprendre celle-ci.'
      });
    }
    
    // Mettre à jour le statut de la session
    await sessionService.updateSessionStatus(id, 'running');
    
    // Pour les sessions de scraping, reprendre via le service
    if (session.type === 'scraping') {
      // Charger la session si nécessaire
      await scraperService.loadSession(id);
      res.status(200).json({
        success: true,
        message: 'Session reprise',
        data: { sessionId: id }
      });
      
      // Reprendre après avoir envoyé la réponse (pour ne pas bloquer)
      await scraperService.resumeScraping();
    } else {
      res.status(200).json({
        success: true,
        message: 'Session reprise',
        data: { sessionId: id }
      });
    }
  } catch (error) {
    logger.error(`Erreur lors de la reprise de la session: ${error.message}`);
    // Remettre la session en pause en cas d'erreur
    try {
      await sessionService.updateSessionStatus(req.params.id, 'paused');
    } catch (updateError) {
      logger.error(`Erreur lors de la mise à jour du statut: ${updateError.message}`);
    }
    
    res.status(500).json({
      success: false,
      message: `Erreur lors de la reprise de la session: ${error.message}`
    });
  }
};

/**
 * Arrête une session
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const stopSession = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si la session existe
    const session = await sessionService.getSession(id);
    
    // Vérifier si la session peut être arrêtée
    if (session.status !== 'running' && session.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: 'Seules les sessions en cours ou en pause peuvent être arrêtées'
      });
    }
    
    // Mettre à jour le statut de la session
    await sessionService.updateSessionStatus(id, 'stopped');
    
    // Pour les sessions de scraping, arrêter via le service
    if (session.type === 'scraping') {
      await scraperService.close();
    }
    
    res.status(200).json({
      success: true,
      message: 'Session arrêtée',
      data: { sessionId: id }
    });
  } catch (error) {
    logger.error(`Erreur lors de l'arrêt de la session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erreur lors de l'arrêt de la session: ${error.message}`
    });
  }
};

/**
 * Récupère les statistiques des sessions
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getSessionStats = async (req, res) => {
  try {
    const stats = await sessionService.getStats();
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des statistiques: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la récupération des statistiques: ${error.message}`
    });
  }
};

/**
 * Récupère tous les prospects d'une session spécifique
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getSessionProspects = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 100 } = req.query;
    
    // Vérifier si la session existe
    const session = await sessionService.getSession(id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: `Session ${id} introuvable`
      });
    }
    
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Récupérer les prospects de la session
    const prospects = await Prospect.find({ sessionId: id })
      .sort({ scrapedAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    // Compter le nombre total de prospects pour la pagination
    const total = await Prospect.countDocuments({ sessionId: id });
    
    res.status(200).json({
      success: true,
      data: prospects,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des prospects de la session: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la récupération des prospects: ${error.message}`
    });
  }
};

module.exports = {
  getSessions,
  getSession,
  createSession,
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  getSessionStats,
  getSessionProspects
};