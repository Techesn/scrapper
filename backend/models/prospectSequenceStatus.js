const mongoose = require('mongoose');

/**
 * Schéma pour le statut d'un prospect dans une séquence
 */
const prospectSequenceStatusSchema = new mongoose.Schema({
  prospectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prospect',
    required: true
  },
  sequenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sequence',
    required: true
  },
  currentStep: {
    type: Number,
    default: 1 // 1 = premier message
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'paused', 'completed', 'failed'],
    default: 'pending'
  },
  connectionStatus: {
    type: String,
    enum: ['not_connected', 'invitation_sent', 'connected'],
    default: 'not_connected'
  },
  invitationSentAt: {
    type: Date,
    default: null
  },
  nextMessageScheduledAt: {
    type: Date,
    default: null
  },
  lastMessageSentAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  history: [{
    step: Number,
    status: String,
    sentAt: Date,
    error: String
  }]
}, { timestamps: true });

/**
 * Index composites pour améliorer les performances des requêtes fréquentes
 */
prospectSequenceStatusSchema.index({ prospectId: 1, sequenceId: 1 }, { unique: true });
prospectSequenceStatusSchema.index({ sequenceId: 1, status: 1 });
prospectSequenceStatusSchema.index({ nextMessageScheduledAt: 1, status: 1 });

/**
 * Méthodes statiques du schéma
 */
prospectSequenceStatusSchema.statics = {
  /**
   * Récupère tous les prospects actifs dans une séquence
   * @param {string} sequenceId - ID de la séquence
   * @returns {Promise<Array>} Liste des statuts des prospects
   */
  async getActiveProspectsInSequence(sequenceId) {
    return this.find({ 
      sequenceId, 
      status: 'active'
    }).populate('prospectId');
  },

  /**
   * Récupère les prospects dont le prochain message est prévu
   * @param {Date} before - Date limite
   * @returns {Promise<Array>} Liste des statuts des prospects
   */
  async getProspectsWithScheduledMessages(before) {
    return this.find({
      nextMessageScheduledAt: { $lte: before },
      status: 'active'
    }).populate('prospectId').populate('sequenceId');
  },

  /**
   * Met à jour l'historique d'un prospect
   * @param {string} id - ID du statut
   * @param {Object} historyEntry - Entrée d'historique à ajouter
   * @returns {Promise<Object>} Statut mis à jour
   */
  async addHistoryEntry(id, historyEntry) {
    return this.findByIdAndUpdate(
      id,
      { $push: { history: historyEntry } },
      { new: true }
    );
  },

  /**
   * Met à jour le statut de connexion d'un prospect
   * @param {string} prospectId - ID du prospect
   * @param {string} connectionStatus - Nouveau statut de connexion
   * @returns {Promise<Object>} Statut mis à jour
   */
  async updateConnectionStatus(prospectId, connectionStatus) {
    const updateData = { connectionStatus };
    
    if (connectionStatus === 'invitation_sent') {
      updateData.invitationSentAt = new Date();
    }
    
    return this.updateMany(
      { prospectId },
      { $set: updateData }
    );
  }
};

const ProspectSequenceStatus = mongoose.model('ProspectSequenceStatus', prospectSequenceStatusSchema);

module.exports = ProspectSequenceStatus;