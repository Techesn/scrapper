const mongoose = require('mongoose');

/**
 * Schéma pour les séquences de messages LinkedIn
 */
const sequenceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'draft'],
    default: 'draft'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  intervalDays: {
    type: Number,
    default: 1,
    min: 0
  },
  messageTotalCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

/**
 * Méthodes statiques du schéma
 */
sequenceSchema.statics = {
  /**
   * Récupère toutes les séquences actives
   * @returns {Promise<Array>} Liste des séquences actives
   */
  async getActiveSequences() {
    return this.find({ status: 'active' }).sort({ createdAt: -1 });
  },

  /**
   * Récupère une séquence par son ID
   * @param {string} id - ID de la séquence
   * @returns {Promise<Object>} Détails de la séquence
   */
  async getSequenceById(id) {
    return this.findById(id);
  },

  /**
   * Change le statut d'une séquence
   * @param {string} id - ID de la séquence
   * @param {string} status - Nouveau statut
   * @returns {Promise<Object>} Séquence mise à jour
   */
  async updateStatus(id, status) {
    return this.findByIdAndUpdate(
      id, 
      { status, updatedAt: Date.now() },
      { new: true }
    );
  }
};

const Sequence = mongoose.model('Sequence', sequenceSchema);

module.exports = Sequence;