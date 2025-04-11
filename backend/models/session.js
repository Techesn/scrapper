const mongoose = require('mongoose');

// Schéma pour les sessions de scraping et autres opérations
const sessionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['scraping', 'enrichment', 'export'], // Types de sessions possibles
    default: 'scraping'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['initializing', 'running', 'paused', 'completed', 'error', 'stopped'],
    default: 'initializing'
  },
  sourceUrl: {
    type: String,
    trim: true,
    required: function() { return this.type === 'scraping'; } // Requis uniquement pour le scraping
  },
  totalProspectsCount: {
    type: Number,
    default: 0
  },
  scrapedProspectsCount: {
    type: Number,
    default: 0
  },
  currentPage: {
    type: Number,
    default: 1
  },
  lastProspectName: {
    type: String,
    default: ''
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { 
  timestamps: true,
  // Indexation pour améliorer les performances des requêtes
  indexes: [
    { startDate: -1 },
    { status: 1 },
    { type: 1 }
  ]
});

// Méthode pour obtenir la session en cours
sessionSchema.statics.getCurrentSession = async function() {
  return await this.findOne({
    status: { $in: ['running', 'paused'] }
  }).sort({ startDate: -1 });
};

// Méthode pour obtenir toutes les sessions actives
sessionSchema.statics.getActiveSessions = async function() {
  return await this.find({
    status: { $in: ['running', 'paused'] }
  }).sort({ startDate: -1 });
};

// Méthode pour vérifier s'il y a une session active
sessionSchema.statics.hasActiveSession = async function() {
  const count = await this.countDocuments({
    status: { $in: ['running', 'paused'] }
  });
  return count > 0;
};

// Méthode pour obtenir les statistiques des sessions
sessionSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    { 
      $group: { 
        _id: "$type", 
        count: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$isCompleted", true] }, 1, 0] } },
        totalProspects: { $sum: "$totalProspectsCount" },
        scrapedProspects: { $sum: "$scrapedProspectsCount" }
      } 
    }
  ]);
  
  return stats;
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;