const SequenceMessage = require('../models/sequenceMessage');
const Sequence = require('../models/sequence');
const logger = require('../utils/logger');

/**
 * Contrôleur pour la gestion des messages de séquence
 */
const sequenceMessageController = {
  /**
   * Récupère tous les messages d'une séquence
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  getMessagesForSequence: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      
      // Vérifier que la séquence existe
      const sequence = await Sequence.findById(sequenceId);
      
      if (!sequence) {
        return res.status(404).json({
          success: false,
          message: `Séquence avec l'ID ${sequenceId} introuvable`
        });
      }
      
      // Récupérer les messages
      const messages = await SequenceMessage.find({ sequenceId }).sort({ position: 1 });
      
      res.status(200).json({
        success: true,
        count: messages.length,
        data: messages
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des messages de la séquence: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des messages',
        error: error.message
      });
    }
  },

  /**
   * Ajoute un message à une séquence
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  addMessageToSequence: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      const { content, position, delayHours } = req.body;
      
      // Valider les données
      if (!content) {
        return res.status(400).json({
          success: false,
          message: 'Le contenu du message est requis'
        });
      }
      
      if (!position || position < 1 || position > 5) {
        return res.status(400).json({
          success: false,
          message: 'La position doit être un nombre entre 1 et 5'
        });
      }
      
      // Vérifier que la séquence existe
      const sequence = await Sequence.findById(sequenceId);
      
      if (!sequence) {
        return res.status(404).json({
          success: false,
          message: `Séquence avec l'ID ${sequenceId} introuvable`
        });
      }
      
      // Vérifier s'il existe déjà un message à cette position
      const existingMessage = await SequenceMessage.findOne({ sequenceId, position });
      
      if (existingMessage) {
        return res.status(409).json({
          success: false,
          message: `Un message existe déjà à la position ${position}`,
          data: existingMessage
        });
      }
      
      // Créer le message
      const message = await SequenceMessage.create({
        sequenceId,
        position,
        content,
        delayHours: delayHours || 24
      });
      
      // Mettre à jour le compteur de messages dans la séquence
      const messageCount = await SequenceMessage.countDocuments({ sequenceId });
      await Sequence.findByIdAndUpdate(sequenceId, { messageTotalCount: messageCount });
      
      res.status(201).json({
        success: true,
        message: 'Message ajouté à la séquence avec succès',
        data: message
      });
    } catch (error) {
      logger.error(`Erreur lors de l'ajout du message à la séquence: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de l\'ajout du message',
        error: error.message
      });
    }
  },

  /**
   * Met à jour un message de séquence
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  updateMessage: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      const messageId = req.params.messageId;
      const { content, delayHours } = req.body;
      
      // Vérifier que la séquence existe
      const sequence = await Sequence.findById(sequenceId);
      
      if (!sequence) {
        return res.status(404).json({
          success: false,
          message: `Séquence avec l'ID ${sequenceId} introuvable`
        });
      }
      
      // Vérifier que le message appartient à la séquence
      const message = await SequenceMessage.findOne({ _id: messageId, sequenceId });
      
      if (!message) {
        return res.status(404).json({
          success: false,
          message: `Message avec l'ID ${messageId} introuvable dans la séquence ${sequenceId}`
        });
      }
      
      // Mettre à jour le message
      const updatedMessage = await SequenceMessage.findByIdAndUpdate(
        messageId,
        {
          content: content || message.content,
          delayHours: delayHours !== undefined ? delayHours : message.delayHours
        },
        { new: true }
      );
      
      res.status(200).json({
        success: true,
        message: 'Message mis à jour avec succès',
        data: updatedMessage
      });
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour du message: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la mise à jour du message',
        error: error.message
      });
    }
  },

  /**
   * Supprime un message de séquence
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  deleteMessage: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      const messageId = req.params.messageId;
      
      // Vérifier que la séquence existe
      const sequence = await Sequence.findById(sequenceId);
      
      if (!sequence) {
        return res.status(404).json({
          success: false,
          message: `Séquence avec l'ID ${sequenceId} introuvable`
        });
      }
      
      // Vérifier que le message appartient à la séquence
      const message = await SequenceMessage.findOne({ _id: messageId, sequenceId });
      
      if (!message) {
        return res.status(404).json({
          success: false,
          message: `Message avec l'ID ${messageId} introuvable dans la séquence ${sequenceId}`
        });
      }
      
      // Supprimer le message
      await SequenceMessage.findByIdAndDelete(messageId);
      
      // Mettre à jour le compteur de messages
      const messageCount = await SequenceMessage.countDocuments({ sequenceId });
      await Sequence.findByIdAndUpdate(sequenceId, { messageTotalCount: messageCount });
      
      res.status(200).json({
        success: true,
        message: 'Message supprimé avec succès'
      });
    } catch (error) {
      logger.error(`Erreur lors de la suppression du message: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la suppression du message',
        error: error.message
      });
    }
  },

  /**
   * Réorganise les positions des messages d'une séquence
   * @param {Object} req - Requête Express
   * @param {Object} res - Réponse Express
   * @returns {Promise<void>}
   */
  reorderMessages: async (req, res) => {
    try {
      const sequenceId = req.params.id;
      const { messageOrder } = req.body;
      
      if (!messageOrder || !Array.isArray(messageOrder)) {
        return res.status(400).json({
          success: false,
          message: 'Format invalide pour la réorganisation des messages'
        });
      }
      
      // Vérifier que la séquence existe
      const sequence = await Sequence.findById(sequenceId);
      
      if (!sequence) {
        return res.status(404).json({
          success: false,
          message: `Séquence avec l'ID ${sequenceId} introuvable`
        });
      }
      
      // Vérifier que tous les messages existent
      for (const item of messageOrder) {
        if (!item.id || !item.position || item.position < 1 || item.position > 5) {
          return res.status(400).json({
            success: false,
            message: 'Format invalide pour la réorganisation des messages'
          });
        }
        
        const message = await SequenceMessage.findOne({ _id: item.id, sequenceId });
        
        if (!message) {
          return res.status(404).json({
            success: false,
            message: `Message avec l'ID ${item.id} introuvable dans la séquence ${sequenceId}`
          });
        }
      }
      
      // Mettre à jour les positions
      const updatePromises = messageOrder.map(item => 
        SequenceMessage.findByIdAndUpdate(item.id, { position: item.position })
      );
      
      await Promise.all(updatePromises);
      
      // Récupérer les messages mis à jour
      const updatedMessages = await SequenceMessage.find({ sequenceId }).sort({ position: 1 });
      
      res.status(200).json({
        success: true,
        message: 'Messages réorganisés avec succès',
        data: updatedMessages
      });
    } catch (error) {
      logger.error(`Erreur lors de la réorganisation des messages: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la réorganisation des messages',
        error: error.message
      });
    }
  }
};

module.exports = sequenceMessageController;