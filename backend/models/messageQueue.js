const mongoose = require('mongoose');

/**
 * Schéma pour la file d'attente des messages
 */
const messageQueueSchema = new mongoose.Schema({
  prospectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prospect',
    required: true
  },
  prospectSequenceStatusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProspectSequenceStatus',
    required: true
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SequenceMessage',
    required: true
  },
  messageContent: {
    type: String,
    required: true
  },
  scheduledFor: {
    type: Date,
    required: true
  },
  priority: {
    type: Number,
    default: 0
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastAttemptAt: {
    type: Date,
    default: null
  },
  lastError: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'sent', 'failed', 'cancelled'],
    default: 'queued'
  },
  sentAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

/**
 * Index pour améliorer les performances de la recherche des messages en attente
 */
messageQueueSchema.index({ status: 1, scheduledFor: 1, priority: -1 });

/**
 * Méthodes statiques du schéma
 */
messageQueueSchema.statics = {
  /**
   * Récupère le prochain message à envoyer
   * @param {Date} now - Date actuelle
   * @returns {Promise<Object>} Message à envoyer
   */
  async getNextMessageToSend(now) {
    return this.findOneAndUpdate(
      { 
        status: 'queued',
        scheduledFor: { $lte: now }
      },
      { 
        $set: { 
          status: 'processing',
          lastAttemptAt: new Date()
        },
        $inc: { attempts: 1 }
      },
      { 
        sort: { priority: -1, scheduledFor: 1 },
        new: true
      }
    ).populate('prospectId').populate('messageId');
  },

  /**
   * Marque un message comme envoyé
   * @param {string} id - ID du message
   * @returns {Promise<Object>} Message mis à jour
   */
  async markAsSent(id) {
    return this.findByIdAndUpdate(
      id,
      { 
        status: 'sent',
        sentAt: new Date()
      },
      { new: true }
    );
  },

  /**
   * Marque un message comme échoué
   * @param {string} id - ID du message
   * @param {string} error - Message d'erreur
   * @returns {Promise<Object>} Message mis à jour
   */
  async markAsFailed(id, error) {
    return this.findByIdAndUpdate(
      id,
      { 
        status: 'failed',
        lastError: error
      },
      { new: true }
    );
  },

  /**
   * Annule tous les messages pour une séquence
   * @param {string} sequenceId - ID de la séquence
   * @returns {Promise<number>} Nombre de messages annulés
   */
  async cancelMessagesForSequence(sequenceId) {
    const result = await this.updateMany(
      { 
        'prospectSequenceStatusId.sequenceId': sequenceId,
        status: 'queued'
      },
      { status: 'cancelled' }
    );
    
    return result.nModified;
  }
};

const MessageQueue = mongoose.model('MessageQueue', messageQueueSchema);

module.exports = MessageQueue;