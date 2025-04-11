/**
 * Service pour communiquer avec l'API de messagerie
 */
export class MessageAPI {
    /**
     * URL de base de l'API
     * @static
     * @type {string}
     */
    static baseUrl = '/api';
  
    /**
     * Initialise le service de messagerie
     * @static
     * @async
     * @returns {Promise<Object>} Réponse de l'API
     */
    static async initialize() {
      try {
        const response = await fetch(`${this.baseUrl}/messages/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        return await response.json();
      } catch (error) {
        console.error('Erreur lors de l\'initialisation du service de messagerie:', error);
        throw error;
      }
    }
  
    /**
     * Envoie un message à un profil LinkedIn
     * @static
     * @async
     * @param {Object} data - Données du message
     * @param {string} data.profileUrl - URL du profil LinkedIn
     * @param {string} data.message - Contenu du message
     * @returns {Promise<Object>} Réponse de l'API
     */
    static async sendMessage(data) {
      try {
        const response = await fetch(`${this.baseUrl}/messages/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        return await response.json();
      } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        throw error;
      }
    }
  
    /**
     * Ferme le service de messagerie
     * @static
     * @async
     * @returns {Promise<Object>} Réponse de l'API
     */
    static async close() {
      try {
        const response = await fetch(`${this.baseUrl}/messages/close`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        return await response.json();
      } catch (error) {
        console.error('Erreur lors de la fermeture du service de messagerie:', error);
        throw error;
      }
    }
  }