const mongoose = require('mongoose');

// Schéma pour les prospects LinkedIn
const prospectSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    required: false,
    trim: true
  },
  jobTitle: {
    type: String,
    required: false,
    trim: true
  },
  jobDescription: {
    type: String,
    required: false,
    trim: true
  },
  linkedinProfileUrl: {
    type: String,
    required: false,
    trim: true
  },
  scrapedAt: {
    type: Date,
    default: Date.now
  },
  // Référence à la session
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: false
  },
  // Métadonnées additionnelles pour les statistiques et le suivi
  metadata: {
    source: {
      type: String,
      default: 'Sales Navigator'
    },
    listUrl: {
      type: String,
      required: false
    },
    scrapingSessionId: {
      type: String,
      required: false
    }
  },
  email: {
    type: String,
    required: false,
    trim: true,
    lowercase: true,
    unique: false  // Car on peut avoir des emails similaires
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false
  },
  
  // Champs pour le système de séquençage de messages
  connectionStatus: {
    type: String,
    enum: ['not_connected', 'invitation_sent', 'connected', 'error', 'not_available'],
    default: 'not_connected'
  },
  invitationSentAt: {
    type: Date,
    default: null
  },
  lastConnectionCheckAt: {
    type: Date,
    default: null
  },
  currentSequenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sequence',
    default: null
  }
}, { 
  timestamps: true,
  // Indexation pour améliorer les performances des requêtes
  indexes: [
    { scrapedAt: 1 },
    { company: 1 },
    { sessionId: 1 },
    { 'metadata.scrapingSessionId': 1 },
    { connectionStatus: 1 }, // Nouvel index pour les requêtes sur le statut de connexion
    { currentSequenceId: 1 }  // Nouvel index pour les filtres par séquence
  ]
});

// Index texte pour la recherche full-text
prospectSchema.index({
  firstName: 'text',
  lastName: 'text',
  company: 'text',
  jobTitle: 'text',
  jobDescription: 'text'
});

// Méthode pour obtenir le nombre de prospects scrapés aujourd'hui
prospectSchema.statics.countScrapedToday = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return await this.countDocuments({
    scrapedAt: { $gte: today }
  });
};

// Méthode pour compter les prospects par session
prospectSchema.statics.countBySession = async function(sessionId) {
  return await this.countDocuments({ sessionId });
};

// Méthode pour récupérer les prospects en attente d'invitation
prospectSchema.statics.getPendingConnectionProspects = async function(limit = 10) {
  return await this.find({
    connectionStatus: 'not_connected',
    linkedinProfileUrl: { $ne: null, $ne: '' }
  }).limit(limit);
};

// Méthode pour récupérer les prospects avec invitation en attente
prospectSchema.statics.getPendingInvitationProspects = async function(limit = 50) {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  return await this.find({
    connectionStatus: 'invitation_sent',
    invitationSentAt: { $lte: oneDayAgo }
  }).limit(limit);
};

// Méthode pour mettre à jour le statut de connexion
prospectSchema.statics.updateConnectionStatus = async function(prospectId, status, date = new Date()) {
  const updateData = { connectionStatus: status };
  
  // Ajouter la date d'envoi de l'invitation si applicable
  if (status === 'invitation_sent') {
    updateData.invitationSentAt = date;
  }
  
  // Mettre à jour la date de dernière vérification
  updateData.lastConnectionCheckAt = date;
  
  return await this.findByIdAndUpdate(
    prospectId,
    { $set: updateData },
    { new: true }
  );
};

const Prospect = mongoose.model('Prospect', prospectSchema);

module.exports = Prospect;