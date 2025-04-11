/**
 * Service API pour la gestion des séquences de messages
 */
export class SequenceAPI {
    /**
     * URL de base de l'API
     * @type {string}
     */
    static BASE_URL = '/api/sequences';
  
    /**
     * Récupère toutes les séquences
     * @returns {Promise<Object>} Liste des séquences
     */
    static async getAllSequences() {
      try {
        const response = await fetch(`${this.BASE_URL}`);
        return await response.json();
      } catch (error) {
        console.error('Erreur lors de la récupération des séquences:', error);
        throw error;
      }
    }
  
    /**
     * Récupère une séquence par son ID
     * @param {string} id - ID de la séquence
     * @returns {Promise<Object>} Détails de la séquence
     */
    static async getSequenceById(id) {
      try {
        const response = await fetch(`${this.BASE_URL}/${id}`);
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors de la récupération de la séquence ${id}:`, error);
        throw error;
      }
    }
  
    /**
     * Crée une nouvelle séquence
     * @param {Object} data - Données de la séquence
     * @param {string} data.name - Nom de la séquence
     * @param {string} data.description - Description de la séquence
     * @param {number} data.intervalDays - Intervalle en jours entre les messages
     * @returns {Promise<Object>} Séquence créée
     */
    static async createSequence(data) {
      try {
        const response = await fetch(`${this.BASE_URL}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        return await response.json();
      } catch (error) {
        console.error('Erreur lors de la création de la séquence:', error);
        throw error;
      }
    }
  
    /**
     * Met à jour une séquence existante
     * @param {string} id - ID de la séquence
     * @param {Object} data - Données à mettre à jour
     * @returns {Promise<Object>} Séquence mise à jour
     */
    static async updateSequence(id, data) {
      try {
        const response = await fetch(`${this.BASE_URL}/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors de la mise à jour de la séquence ${id}:`, error);
        throw error;
      }
    }
  
    /**
     * Supprime une séquence
     * @param {string} id - ID de la séquence
     * @returns {Promise<Object>} Résultat de la suppression
     */
    static async deleteSequence(id) {
      try {
        const response = await fetch(`${this.BASE_URL}/${id}`, {
          method: 'DELETE'
        });
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors de la suppression de la séquence ${id}:`, error);
        throw error;
      }
    }
  
    /**
     * Active une séquence
     * @param {string} id - ID de la séquence
     * @returns {Promise<Object>} Résultat de l'activation
     */
    static async activateSequence(id) {
      try {
        const response = await fetch(`${this.BASE_URL}/${id}/activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors de l'activation de la séquence ${id}:`, error);
        throw error;
      }
    }
  
    /**
     * Met en pause une séquence
     * @param {string} id - ID de la séquence
     * @returns {Promise<Object>} Résultat de la mise en pause
     */
    static async pauseSequence(id) {
      try {
        const response = await fetch(`${this.BASE_URL}/${id}/pause`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors de la mise en pause de la séquence ${id}:`, error);
        throw error;
      }
    }
  
    /**
     * Reprend une séquence mise en pause
     * @param {string} id - ID de la séquence
     * @returns {Promise<Object>} Résultat de la reprise
     */
    static async resumeSequence(id) {
      try {
        const response = await fetch(`${this.BASE_URL}/${id}/resume`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors de la reprise de la séquence ${id}:`, error);
        throw error;
      }
    }
  
    /**
     * Ajoute des prospects à une séquence
     * @param {string} id - ID de la séquence
     * @param {Array<string>} prospectIds - Liste des IDs des prospects
     * @returns {Promise<Object>} Résultat de l'ajout
     */
    static async addProspectsToSequence(id, prospectIds) {
      try {
        const response = await fetch(`${this.BASE_URL}/${id}/prospects`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prospectIds })  // Changez cette ligne
        });
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors de l'ajout des prospects à la séquence ${id}:`, error);
        throw error;
      }
    }
  
    /**
     * Retire un prospect d'une séquence
     * @param {string} sequenceId - ID de la séquence
     * @param {string} prospectId - ID du prospect
     * @returns {Promise<Object>} Résultat du retrait
     */
    static async removeProspectFromSequence(sequenceId, prospectId) {
      try {
        const response = await fetch(`${this.BASE_URL}/${sequenceId}/prospects/${prospectId}`, {
          method: 'DELETE'
        });
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors du retrait du prospect ${prospectId} de la séquence ${sequenceId}:`, error);
        throw error;
      }
    }
  
    /**
     * Récupère les messages d'une séquence
     * @param {string} id - ID de la séquence
     * @returns {Promise<Object>} Liste des messages
     */
    static async getSequenceMessages(id) {
      try {
        const response = await fetch(`${this.BASE_URL}/${id}/messages`);
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors de la récupération des messages de la séquence ${id}:`, error);
        throw error;
      }
    }
  
    /**
     * Ajoute un message à une séquence
     * @param {string} id - ID de la séquence
     * @param {Object} messageData - Données du message
     * @param {string} messageData.content - Contenu du message
     * @param {number} messageData.position - Position dans la séquence (1-5)
     * @param {number} messageData.delayHours - Délai en heures avant envoi
     * @returns {Promise<Object>} Message ajouté
     */
    static async addMessageToSequence(id, messageData) {
      try {
        const response = await fetch(`${this.BASE_URL}/${id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(messageData)
        });
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors de l'ajout du message à la séquence ${id}:`, error);
        throw error;
      }
    }
  
    /**
     * Met à jour un message de séquence
     * @param {string} sequenceId - ID de la séquence
     * @param {string} messageId - ID du message
     * @param {Object} messageData - Données à mettre à jour
     * @returns {Promise<Object>} Message mis à jour
     */
    static async updateSequenceMessage(sequenceId, messageId, messageData) {
      try {
        const response = await fetch(`${this.BASE_URL}/${sequenceId}/messages/${messageId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(messageData)
        });
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors de la mise à jour du message ${messageId}:`, error);
        throw error;
      }
    }
  
    /**
     * Supprime un message de séquence
     * @param {string} sequenceId - ID de la séquence
     * @param {string} messageId - ID du message
     * @returns {Promise<Object>} Résultat de la suppression
     */
    static async deleteSequenceMessage(sequenceId, messageId) {
      try {
        const response = await fetch(`${this.BASE_URL}/${sequenceId}/messages/${messageId}`, {
          method: 'DELETE'
        });
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors de la suppression du message ${messageId}:`, error);
        throw error;
      }
    }
  
    /**
     * Réorganise les messages d'une séquence
     * @param {string} id - ID de la séquence
     * @param {Array<Object>} messageOrder - Ordre des messages
     * @returns {Promise<Object>} Résultat de la réorganisation
     */
    static async reorderSequenceMessages(id, messageOrder) {
      try {
        const response = await fetch(`${this.BASE_URL}/${id}/messages/reorder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ messageOrder })
        });
        return await response.json();
      } catch (error) {
        console.error(`Erreur lors de la réorganisation des messages de la séquence ${id}:`, error);
        throw error;
      }
    }
  }