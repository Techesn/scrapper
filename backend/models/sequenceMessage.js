const mongoose = require('mongoose');

/**
 * Schéma pour les messages de séquence LinkedIn
 */
const sequenceMessageSchema = new mongoose.Schema({
  sequenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sequence',
    required: true
  },
  position: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  content: {
    type: String,
    required: true
  },
  delayHours: {
    type: Number,
    default: 24,
    min: 0
  }
}, { timestamps: true });

/**
 * Méthodes statiques du schéma
 */
sequenceMessageSchema.statics = {
  /**
   * Récupère tous les messages d'une séquence, ordonnés par position
   * @param {string} sequenceId - ID de la séquence
   * @returns {Promise<Array>} Messages de la séquence
   */
  async getMessagesForSequence(sequenceId) {
    return this.find({ sequenceId }).sort({ position: 1 });
  },

  /**
   * Récupère un message spécifique d'une séquence
   * @param {string} sequenceId - ID de la séquence
   * @param {number} position - Position du message dans la séquence
   * @returns {Promise<Object>} Message de la séquence
   */
  async getMessageByPosition(sequenceId, position) {
    return this.findOne({ sequenceId, position });
  },

  /**
   * Met à jour le contenu d'un message
   * @param {string} id - ID du message
   * @param {string} content - Nouveau contenu
   * @param {number} delayHours - Nouveau délai en heures (optionnel)
   * @returns {Promise<Object>} Message mis à jour
   */
  async updateMessage(id, content, delayHours) {
    const updateData = { content };
    if (delayHours !== undefined) {
      updateData.delayHours = delayHours;
    }
    
    return this.findByIdAndUpdate(id, updateData, { new: true });
  }
};

const SequenceMessage = mongoose.model('SequenceMessage', sequenceMessageSchema);

module.exports = SequenceMessage;