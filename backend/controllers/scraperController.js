const scraperService = require('../services/scraperService');
const Prospect = require('../models/prospect');
const logger = require('../utils/logger');

/**
 * Initialise le service de scraping
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const initializeScraper = async (req, res) => {
  try {
    await scraperService.initialize();
    res.status(200).json({ 
      success: true, 
      message: 'Service de scraping initialisé avec succès' 
    });
  } catch (error) {
    logger.error(`Erreur lors de l'initialisation: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de l'initialisation: ${error.message}`
    });
  }
};

/**
 * Exporte les prospects au format CSV
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const exportProspectsCSV = async (req, res) => {
  try {
    // Récupérer tous les prospects (ou filtrer selon les paramètres de requête)
    const { search, sessionId } = req.query;
    
    // Construire la requête
    let query = {};
    
    // Ajouter la recherche si spécifiée
    if (search) {
      query.$text = { $search: search };
    }
    
    // Ajouter le filtre par sessionId si spécifié
    if (sessionId) {
      query.sessionId = sessionId;
    }
    
    // Récupérer les prospects
    const prospects = await Prospect.find(query).sort({ scrapedAt: -1 });
    
    if (prospects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucun prospect à exporter'
      });
    }
    
    // Définir les en-têtes CSV
    const headers = [
      'Prénom',
      'Nom',
      'Entreprise',
      'Poste',
      'Description du poste',
      'URL LinkedIn',
      'Email',           // Ajout de l'email dans les en-têtes
      'Date d\'extraction'
    ];
    
    // Convertir les données en format CSV
    let csvContent = headers.join(',') + '\n';
    
    // Ajouter chaque prospect au CSV
    prospects.forEach(prospect => {
      // Échapper les virgules et les guillemets dans les valeurs
      const row = [
        escapeCSV(prospect.firstName || ''),
        escapeCSV(prospect.lastName || ''),
        escapeCSV(prospect.company || ''),
        escapeCSV(prospect.jobTitle || ''),
        escapeCSV(prospect.jobDescription || ''),
        escapeCSV(prospect.linkedinProfileUrl || ''),
        escapeCSV(prospect.email || ''),     // Ajout de l'email dans les données
        new Date(prospect.scrapedAt).toLocaleString('fr-FR')
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    // Configurer les en-têtes de réponse pour le téléchargement du fichier
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=prospects.csv');
    
    // Envoyer le contenu CSV
    res.status(200).send(csvContent);
    
  } catch (error) {
    logger.error(`Erreur lors de l'exportation CSV: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erreur lors de l'exportation CSV: ${error.message}`
    });
  }
};

/**
 * Échappe les caractères spéciaux dans les valeurs CSV
 * @param {string} value - Valeur à échapper
 * @returns {string} - Valeur échappée
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  
  // Convertir en chaîne de caractères
  const strValue = String(value);
  
  // Si la valeur contient des virgules, des guillemets ou des sauts de ligne,
  // l'entourer de guillemets et échapper les guillemets internes
  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
    return '"' + strValue.replace(/"/g, '""') + '"';
  }
  
  return strValue;
}
/**
 * Démarre le processus de scraping
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const startScraping = async (req, res) => {
  try {
    const { listUrl } = req.body;
    
    if (!listUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL de liste Sales Navigator requise' 
      });
    }
    
    // Vérifier si le service est déjà en cours d'exécution
    const status = await scraperService.getStatus();
    if (status.isRunning) {
      return res.status(400).json({ 
        success: false, 
        message: 'Un processus de scraping est déjà en cours' 
      });
    }
    
    // Vérifier le quota journalier
    const todayCount = await Prospect.countScrapedToday();
    const dailyLimit = scraperService.dailyLimit;
    
    if (todayCount >= dailyLimit) {
      return res.status(400).json({ 
        success: false, 
        message: `Limite quotidienne de ${dailyLimit} profils atteinte` 
      });
    }
    
    // Démarrer le scraping de manière asynchrone
    res.status(200).json({ 
      success: true, 
      message: 'Scraping démarré',
      sessionId: scraperService.sessionId || null
    });
    
    // Exécuter le scraping sans bloquer la réponse
    scraperService.startScraping(listUrl).catch(error => {
      logger.error(`Erreur pendant le scraping: ${error.message}`);
    });
    
  } catch (error) {
    logger.error(`Erreur lors du démarrage du scraping: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors du démarrage du scraping: ${error.message}`
    });
  }
};

/**
 * Met en pause le processus de scraping
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const pauseScraping = async (req, res) => {
  try {
    const status = await scraperService.getStatus();
    
    if (!status.isRunning) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aucun processus de scraping en cours' 
      });
    }
    
    scraperService.pauseScraping();
    
    const updatedStatus = await scraperService.getStatus();
    res.status(200).json({ 
      success: true, 
      message: 'Scraping mis en pause',
      status: updatedStatus
    });
  } catch (error) {
    logger.error(`Erreur lors de la mise en pause: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la mise en pause: ${error.message}`
    });
  }
};

/**
 * Reprend le processus de scraping
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const resumeScraping = async (req, res) => {
  try {
    const status = await scraperService.getStatus();
    
    if (!status.isPaused) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le scraping n\'est pas en pause' 
      });
    }
    
    // Envoyer une réponse immédiate
    const currentStatus = await scraperService.getStatus();
    res.status(200).json({ 
      success: true, 
      message: 'Reprise du scraping',
      status: currentStatus
    });
    
    // Reprendre le scraping de manière asynchrone
    scraperService.resumeScraping().catch(error => {
      logger.error(`Erreur pendant la reprise du scraping: ${error.message}`);
    });
    
  } catch (error) {
    logger.error(`Erreur lors de la reprise: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la reprise: ${error.message}`
    });
  }
};

/**
 * Arrête le processus de scraping
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const stopScraping = async (req, res) => {
  try {
    await scraperService.close();
    
    const status = await scraperService.getStatus();
    res.status(200).json({ 
      success: true, 
      message: 'Scraping arrêté',
      status: status
    });
  } catch (error) {
    logger.error(`Erreur lors de l'arrêt: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de l'arrêt: ${error.message}`
    });
  }
};

/**
 * Obtient le statut actuel du scraping
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getStatus = async (req, res) => {
  try {
    const status = await scraperService.getStatus();
    
    res.status(200).json({ 
      success: true, 
      status
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération du statut: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la récupération du statut: ${error.message}`
    });
  }
};

/**
 * Récupère les prospects scrapés
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getProspects = async (req, res) => {
  try {
    const { page = 1, limit = 50, sort = 'scrapedAt', order = 'desc', search, sessionId } = req.query;
    
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Construire les options de tri
    const sortOption = {};
    sortOption[sort] = order === 'desc' ? -1 : 1;
    
    // Construire la requête
    let query = {};
    
    // Ajouter la recherche si spécifiée
    if (search) {
      query.$text = { $search: search };
    }
    
    // Ajouter le filtre par sessionId si spécifié
    if (sessionId) {
      query.sessionId = sessionId;
    }
    
    // Compter le nombre total de prospects pour la pagination
    const total = await Prospect.countDocuments(query);
    
    // Récupérer les prospects
    const prospects = await Prospect.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);
    
    res.status(200).json({
      success: true,
      data: {
        prospects,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des prospects: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la récupération des prospects: ${error.message}`
    });
  }
};

/**
 * Récupère les statistiques de scraping
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getStats = async (req, res) => {
  try {
    // Nombre total de prospects
    const totalProspects = await Prospect.countDocuments();
    
    // Nombre de prospects scrapés aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayProspects = await Prospect.countDocuments({
      scrapedAt: { $gte: today }
    });
    
    // Top 5 des entreprises
    const topCompanies = await Prospect.aggregate([
      { $match: { company: { $exists: true, $ne: '' } } },
      { $group: { _id: '$company', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Top 5 des titres de poste
    const topJobTitles = await Prospect.aggregate([
      { $match: { jobTitle: { $exists: true, $ne: '' } } },
      { $group: { _id: '$jobTitle', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    res.status(200).json({
      success: true,
      stats: {
        totalProspects,
        todayProspects,
        dailyLimit: scraperService.dailyLimit,
        topCompanies,
        topJobTitles
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des statistiques: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la récupération des statistiques: ${error.message}`
    });
  }
};

module.exports = {
  initializeScraper,
  startScraping,
  pauseScraping,
  resumeScraping,
  stopScraping,
  getStatus,
  getProspects,
  getStats,
  exportProspectsCSV
};