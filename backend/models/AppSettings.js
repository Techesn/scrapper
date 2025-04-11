// backend/models/AppSettings.js
const mongoose = require('mongoose');

/**
 * Schéma pour les paramètres globaux de l'application
 */
const AppSettingsSchema = new mongoose.Schema({
  // Clé unique pour identifier les paramètres
  key: {
    type: String,
    default: 'global',
    unique: true
  },
  
  // Paramètres LinkedIn généraux
  linkedin: {
    // Quotas journaliers
    quotas: {
      prospects: {
        type: Number,
        default: 1000,
        min: 1,
        max: 5000
      },
      messages: {
        type: Number,
        default: 100,
        min: 1,
        max: 500
      },
      connections: {
        type: Number,
        default: 50,
        min: 1,
        max: 200
      }
    },
    
    // Délais entre actions pour simuler un comportement humain
    delays: {
      min: {
        type: Number,
        default: 1000,
        min: 500,
        max: 10000
      },
      max: {
        type: Number,
        default: 3000,
        min: 1000,
        max: 15000
      }
    }
  },
  
  // Intervalles de rafraîchissement des services (en millisecondes)
  intervals: {
    // Vérification du cookie LinkedIn (par défaut 30 minutes)
    cookieCheck: {
      type: Number,
      default: 30 * 60 * 1000,
      min: 5 * 60 * 1000
    },
    
    // Vérification des connexions récentes (par défaut 1 heure)
    connectionCheck: {
      type: Number,
      default: 60 * 60 * 1000,
      min: 15 * 60 * 1000
    },
    
    // Traitement des demandes de connexion (par défaut 1 minute)
    connectionRequest: {
      type: Number,
      default: 60 * 1000,
      min: 30 * 1000
    },
    
    // Planification des messages de séquence (par défaut 15 minutes)
    sequenceScheduling: {
      type: Number,
      default: 15 * 60 * 1000,
      min: 5 * 60 * 1000
    },
    
    // Traitement des messages à envoyer (par défaut 1 minute)
    messageProcessing: {
      type: Number,
      default: 60 * 1000,
      min: 30 * 1000
    }
  },
  
  // Plages horaires de fonctionnement (heure de Paris)
  workingHours: {
    // Plage horaire pour les messages
    message: {
      start: {
        type: Number,
        default: 9,
        min: 0,
        max: 23
      },
      end: {
        type: Number,
        default: 19,
        min: 1,
        max: 24
      }
    },
    
    // Plage horaire pour les demandes de connexion
    connection: {
      start: {
        type: Number,
        default: 10,
        min: 0,
        max: 23
      },
      end: {
        type: Number,
        default: 20,
        min: 1,
        max: 24
      }
    }
  },
  
  // Paramètres de fuseau horaire
  timezone: {
    type: String,
    default: 'Europe/Paris'
  },
  
  // Date de la dernière mise à jour
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

/**
 * Récupère les paramètres globaux (singleton)
 * @returns {Promise<Object>} Paramètres globaux
 */
AppSettingsSchema.statics.getGlobalSettings = async function() {
  let settings = await this.findOne({ key: 'global' });
  
  if (!settings) {
    // Créer les paramètres par défaut si inexistants
    settings = await this.create({ key: 'global' });
  }
  
  return settings;
};

/**
 * Met à jour les paramètres globaux
 * @param {Object} updateData - Données à mettre à jour
 * @returns {Promise<Object>} Paramètres mis à jour
 */
AppSettingsSchema.statics.updateGlobalSettings = async function(updateData) {
  // Mettre à jour la date de modification
  updateData.updatedAt = new Date();
  
  // Mettre à jour ou créer les paramètres
  return await this.findOneAndUpdate(
    { key: 'global' },
    updateData,
    { 
      new: true,
      upsert: true,
      runValidators: true
    }
  );
};

// Utiliser mongoose.model uniquement si le modèle n'existe pas déjà
const AppSettings = mongoose.models.AppSettings || mongoose.model('AppSettings', AppSettingsSchema);

module.exports = AppSettings;