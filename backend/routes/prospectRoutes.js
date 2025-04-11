const express = require('express');
const router = express.Router();
const Prospect = require('../models/prospect');
const logger = require('../utils/logger');

/**
 * Recherche des prospects
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const searchProspects = async (req, res) => {
  try {
    const { criteria, company, jobTitle, page = 1, limit = 100 } = req.body;
    
    // Construire la requête de recherche
    let query = {};
    
    // Ajouter la recherche textuelle si spécifiée
    if (criteria && criteria.trim() !== '') {
      query.$text = { $search: criteria };
    }
    
    // Ajouter le filtre par entreprise si spécifié
    if (company && company.trim() !== '') {
      query.company = { $regex: company, $options: 'i' };
    }
    
    // Ajouter le filtre par titre de poste si spécifié
    if (jobTitle && jobTitle.trim() !== '') {
      query.jobTitle = { $regex: jobTitle, $options: 'i' };
    }
    
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    // Récupérer les prospects
    const prospects = await Prospect.find(query)
      .sort({ scrapedAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    // Compter le nombre total de prospects pour la pagination
    const total = await Prospect.countDocuments(query);
    
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
    logger.error(`Erreur lors de la recherche de prospects: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la recherche de prospects: ${error.message}`
    });
  }
};

/**
 * Récupère les entreprises distinctes pour les filtres
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getCompanies = async (req, res) => {
  try {
    const companies = await Prospect.distinct('company', { company: { $exists: true, $ne: '' } });
    
    res.status(200).json({
      success: true,
      data: companies.sort()
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des entreprises: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la récupération des entreprises: ${error.message}`
    });
  }
};

/**
 * Récupère les titres de poste distincts pour les filtres
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getJobTitles = async (req, res) => {
  try {
    const jobTitles = await Prospect.distinct('jobTitle', { jobTitle: { $exists: true, $ne: '' } });
    
    res.status(200).json({
      success: true,
      data: jobTitles.sort()
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des titres de poste: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la récupération des titres de poste: ${error.message}`
    });
  }
};

// Routes
router.post('/search', searchProspects);
router.get('/companies', getCompanies);
router.get('/job-titles', getJobTitles);

module.exports = router;