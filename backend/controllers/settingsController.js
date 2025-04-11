// backend/controllers/settingsController.js
const Settings = require('../models/AppSettings');
const Cookie = require('../models/Cookie');
const cookieValidatorService = require('../services/cookieValidatorService');
const timeService = require('../services/timeService');
const logger = require('../utils/logger');

class SettingsController {
  constructor() {
    // Binder les méthodes pour préserver le contexte 'this'
    this.getCurrentSettings = this.getCurrentSettings.bind(this);
    this.updateSettings = this.updateSettings.bind(this);
    this.validateCookie = this.validateCookie.bind(this);
    this.getLinkedInCookieFromDB = this.getLinkedInCookieFromDB.bind(this);
    this.saveLinkedInCookieToDB = this.saveLinkedInCookieToDB.bind(this);
    this.getValidLinkedInCookie = this.getValidLinkedInCookie.bind(this);
    this.resetSettingsToDefault = this.resetSettingsToDefault.bind(this);
  }

  /**
   * Récupère les paramètres actuels
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  async getCurrentSettings(req, res) {
    try {
      // Récupérer les paramètres globaux
      const settings = await Settings.getGlobalSettings();
      
      // Récupérer le cookie depuis la base de données
      const linkedinCookie = await this.getLinkedInCookieFromDB();
      
      // Combiner les informations
      const response = {
        // Paramètres LinkedIn
        linkedin: settings.linkedin,
        
        // Intervalles de rafraîchissement
        intervals: settings.intervals,
        
        // Plages horaires
        workingHours: settings.workingHours,
        
        // Fuseau horaire
        timezone: settings.timezone,
        
        // Date de mise à jour
        updatedAt: settings.updatedAt,
        
        // Information sur le cookie LinkedIn
        cookie: {
          exists: !!linkedinCookie,
          status: linkedinCookie ? {
            isValid: linkedinCookie.isValid,
            lastChecked: linkedinCookie.lastChecked
          } : null
        }
      };
      
      res.status(200).json(response);
    } catch (error) {
      logger.error(`Erreur lors de la récupération des paramètres: ${error.message}`);
      res.status(500).json({
        message: 'Erreur lors de la récupération des paramètres',
        error: error.message
      });
    }
  }

  /**
   * Met à jour les paramètres de l'application
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  async updateSettings(req, res) {
    try {
      const { linkedin, intervals, workingHours, timezone, linkedinCookie } = req.body;

      // Mettre à jour le cookie dans la base de données si fourni
      if (linkedinCookie) {
        await this.saveLinkedInCookieToDB(linkedinCookie);
      }

      // Construire l'objet de mise à jour
      const updateData = {};
      
      if (linkedin) updateData.linkedin = linkedin;
      if (intervals) updateData.intervals = intervals;
      if (workingHours) updateData.workingHours = workingHours;
      if (timezone) updateData.timezone = timezone;

      // Mettre à jour les paramètres globaux
      const updatedSettings = await Settings.updateGlobalSettings(updateData);
      
      // Recharger le service de gestion du temps pour prendre en compte les nouveaux paramètres
      timeService.reloadSettings(updatedSettings);

      // Récupérer le statut actuel du cookie
      const cookieRecord = await this.getLinkedInCookieFromDB();

      res.status(200).json({
        message: 'Paramètres mis à jour avec succès',
        settings: updatedSettings,
        cookie: {
          exists: !!cookieRecord,
          status: cookieRecord ? {
            isValid: cookieRecord.isValid,
            lastChecked: cookieRecord.lastChecked
          } : null
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour des paramètres: ${error.message}`);
      res.status(500).json({
        message: 'Erreur lors de la mise à jour des paramètres',
        error: error.message
      });
    }
  }

  /**
   * Réinitialise tous les paramètres aux valeurs par défaut
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  async resetSettingsToDefault(req, res) {
    try {
      // Supprimer les paramètres actuels pour forcer la création des valeurs par défaut
      await Settings.deleteOne({ key: 'global' });
      
      // Récupérer les nouveaux paramètres par défaut
      const defaultSettings = await Settings.getGlobalSettings();
      
      // Recharger le service de gestion du temps
      timeService.reloadSettings(defaultSettings);
      
      res.status(200).json({
        message: 'Paramètres réinitialisés aux valeurs par défaut',
        settings: defaultSettings
      });
    } catch (error) {
      logger.error(`Erreur lors de la réinitialisation des paramètres: ${error.message}`);
      res.status(500).json({
        message: 'Erreur lors de la réinitialisation des paramètres',
        error: error.message
      });
    }
  }

  /**
   * Vérifie la validité du cookie LinkedIn actuel ou fourni
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   */
  async validateCookie(req, res) {
    try {
      // Utiliser le cookie fourni ou récupérer celui de la BD
      let cookie = req.body.cookie;
      
      if (!cookie) {
        const cookieRecord = await this.getLinkedInCookieFromDB();
        if (!cookieRecord) {
          return res.status(400).json({
            message: 'Aucun cookie LinkedIn n\'est configuré'
          });
        }
        cookie = cookieRecord.value;
      }

      // Vérifier la validité du cookie
      const validationResult = await cookieValidatorService.validateLinkedInCookie(cookie);
      
      // Mettre à jour le statut dans la base de données
      if (validationResult.valid || !req.body.cookie) {
        await Cookie.findOneAndUpdate(
          { name: 'linkedin_li_at' },
          { 
            isValid: validationResult.valid,
            lastChecked: new Date()
          },
          { new: true, upsert: true }
        );
      }

      res.status(200).json({
        ...validationResult,
        lastChecked: new Date()
      });
    } catch (error) {
      logger.error(`Erreur lors de la validation du cookie: ${error.message}`);
      res.status(500).json({
        message: 'Erreur lors de la validation du cookie',
        error: error.message
      });
    }
  }

  /**
   * Récupère le cookie LinkedIn depuis la base de données
   * @returns {Promise<Object|null>} Cookie LinkedIn ou null si non trouvé
   */
  async getLinkedInCookieFromDB() {
    try {
      return await Cookie.findOne({ name: 'linkedin_li_at' });
    } catch (error) {
      logger.error(`Erreur lors de la récupération du cookie LinkedIn: ${error.message}`);
      return null;
    }
  }

  /**
   * Enregistre le cookie LinkedIn dans la base de données
   * @param {string} cookieValue - Valeur du cookie LinkedIn
   * @returns {Promise<Object>} Cookie enregistré
   */
  async saveLinkedInCookieToDB(cookieValue) {
    try {
      // Vérifier d'abord la validité du cookie
      const validationResult = await cookieValidatorService.validateLinkedInCookie(cookieValue);
      
      // Mettre à jour ou créer le cookie dans la base de données
      return await Cookie.findOneAndUpdate(
        { name: 'linkedin_li_at' },
        {
          value: cookieValue,
          isValid: validationResult.valid,
          lastChecked: new Date(),
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      logger.error(`Erreur lors de l'enregistrement du cookie LinkedIn: ${error.message}`);
      throw error;
    }
  }

  /**
   * Récupère le cookie LinkedIn pour les opérations de scraping
   * @returns {Promise<string|null>} Cookie LinkedIn ou null si non valide
   */
  async getValidLinkedInCookie() {
    try {
      const cookieRecord = await this.getLinkedInCookieFromDB();
      
      if (!cookieRecord || !cookieRecord.isValid) {
        return null;
      }
      
      return cookieRecord.value;
    } catch (error) {
      logger.error(`Erreur lors de la récupération du cookie LinkedIn valide: ${error.message}`);
      return null;
    }
  }
}

module.exports = new SettingsController();