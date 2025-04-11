const Company = require('../models/company');
const Prospect = require('../models/prospect');
const logger = require('../utils/logger');

// Récupérer les entreprises nécessitant un format d'email
const getCompaniesToFormat = async (req, res) => {
  try {
    // Trouver toutes les entreprises uniques des prospects qui n'ont pas de format d'email
    const companies = await Prospect.aggregate([
      // Grouper par entreprise unique
      { $group: { _id: '$company', count: { $sum: 1 } } },
      // Exclure les entreprises vides
      { $match: { _id: { $ne: null, $ne: '' } } },
      // Vérifier qu'aucun format n'existe pour ces entreprises
      {
        $lookup: {
          from: 'companies', // Assurez-vous que c'est le bon nom de collection
          localField: '_id',
          foreignField: 'name',
          as: 'companyFormat'
        }
      },
      { $match: { 'companyFormat.0': { $exists: false } } },
      // Formater le résultat
      {
        $project: {
          name: '$_id',
          prospectCount: '$count'
        }
      }
    ]);

    res.status(200).json({
      success: true,
      companies
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des entreprises: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la récupération des entreprises: ${error.message}`
    });
  }
};

// Définir le format d'email pour une entreprise
const setCompanyEmailFormat = async (req, res) => {
  try {
    const { companyName, emailFormat, emailDomain } = req.body;

    // Valider les données
    if (!companyName || !emailFormat) {
      return res.status(400).json({
        success: false,
        message: 'Nom de l\'entreprise et format d\'email sont requis'
      });
    }

    // Trouver ou créer l'entreprise
    let company = await Company.findOne({ name: companyName });
    
    if (!company) {
      company = new Company({ 
        name: companyName,
        emailFormat,
        emailDomain: emailDomain || `${companyName.toLowerCase().replace(/\s+/g, '-')}.com`
      });
    } else {
      company.emailFormat = emailFormat;
      company.emailDomain = emailDomain || company.emailDomain;
    }

    await company.save();

    // Mettre à jour tous les prospects de cette entreprise
    const prospects = await Prospect.find({ company: companyName });
    
    for (const prospect of prospects) {
      prospect.email = company.generateEmail(prospect.firstName, prospect.lastName);
      await prospect.save();
    }

    res.status(200).json({
      success: true,
      message: 'Format d\'email mis à jour',
      company,
      updatedProspectsCount: prospects.length
    });
  } catch (error) {
    logger.error(`Erreur lors de la mise à jour du format d'email: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la mise à jour du format d'email: ${error.message}`
    });
  }
};

// Récupérer les entreprises avec format d'email déjà défini
const getCompaniesWithEmailFormat = async (req, res) => {
  try {
    const companies = await Company.find({ emailFormat: { $exists: true } });
    
    res.status(200).json({
      success: true,
      companies
    });
  } catch (error) {
    logger.error(`Erreur lors de la récupération des entreprises: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      message: `Erreur lors de la récupération des entreprises: ${error.message}`
    });
  }
};

module.exports = {
  getCompaniesToFormat,
  setCompanyEmailFormat,
  getCompaniesWithEmailFormat
};