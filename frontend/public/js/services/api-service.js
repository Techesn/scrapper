// URL de base pour l'API
const API_BASE_URL = '/api';

/**
 * Effectue une requête API avec fetch
 * @param {string} endpoint - Point de terminaison de l'API
 * @param {Object} options - Options de la requête fetch
 * @returns {Promise<Object>} - Promesse résolue avec les données de la réponse
 */
async function fetchAPI(endpoint, options = {}) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Options par défaut pour les requêtes
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    // Vérifier si la réponse est au format JSON
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    // Extraire les données de la réponse
    const data = isJson ? await response.json() : await response.text();
    
    // Gérer les erreurs HTTP
    if (!response.ok) {
      const error = new Error(isJson ? data.message || 'Erreur API' : 'Erreur API');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Erreur API:', error);
    throw error;
  }
}

/**
 * Services API pour le scraper
 */
export const ScraperAPI = {
  // Initialiser le scraper
  initialize: async () => {
    return fetchAPI('/scraper/initialize', {
      method: 'POST'
    });
  },
  
  // Démarrer le scraping
  start: async (listUrl, sessionName = "") => {
    return fetchAPI('/scraper/start', {
      method: 'POST',
      body: JSON.stringify({ listUrl, sessionName })
    });
  },
  
  // Mettre en pause le scraping
  pause: async () => {
    return fetchAPI('/scraper/pause', {
      method: 'POST'
    });
  },
  
  // Reprendre le scraping
  resume: async () => {
    return fetchAPI('/scraper/resume', {
      method: 'POST'
    });
  },
  
  // Arrêter le scraping
  stop: async () => {
    return fetchAPI('/scraper/stop', {
      method: 'POST'
    });
  },
  
  // Obtenir le statut actuel
  getStatus: async () => {
    return fetchAPI('/status');
  },
  
  // Obtenir les statistiques du scraper
  getStats: async () => {
    return fetchAPI('/scraper/stats');
  },
  
  // Nouvelles méthodes pour la gestion des sessions
  
  // Récupérer toutes les sessions avec filtrage et pagination
  getSessions: async (filters = {}) => {
    const queryParams = new URLSearchParams();
    
    if (filters.page) queryParams.append('page', filters.page);
    if (filters.limit) queryParams.append('limit', filters.limit);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.type) queryParams.append('type', filters.type);
    
    const queryString = queryParams.toString();
    return fetchAPI(`/sessions${queryString ? '?' + queryString : ''}`);
  },
  
  // Récupérer une session spécifique
  getSession: async (sessionId) => {
    return fetchAPI(`/sessions/${sessionId}`);
  },
  
  // Créer une nouvelle session
  createSession: async (sessionData) => {
    return fetchAPI('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData)
    });
  },
  
  // Démarrer une session
  startSession: async (sessionId) => {
    return fetchAPI(`/sessions/${sessionId}/start`, {
      method: 'POST'
    });
  },
  
  // Mettre en pause une session
  pauseSession: async (sessionId) => {
    return fetchAPI(`/sessions/${sessionId}/pause`, {
      method: 'POST'
    });
  },
  
  // Reprendre une session en pause
  resumeSession: async (sessionId) => {
    return fetchAPI(`/sessions/${sessionId}/resume`, {
      method: 'POST'
    });
  },
  
  // Arrêter une session
  stopSession: async (sessionId) => {
    return fetchAPI(`/sessions/${sessionId}/stop`, {
      method: 'POST'
    });
  },
  
  // Obtenir les statistiques des sessions
  getSessionStats: async () => {
    return fetchAPI('/sessions/stats');
  }
};

/**
 * Services API pour les prospects
 */
export const ProspectsAPI = {
  // Récupérer les prospects avec pagination
  getProspects: async (page = 1, limit = 50, sort = 'scrapedAt', order = 'desc', search = '', sessionId = null) => {
    const params = new URLSearchParams({
      page,
      limit,
      sort,
      order,
      ...(search ? { search } : {}),
      ...(sessionId ? { sessionId } : {})
    });
    
    return fetchAPI(`/scraper/prospects?${params.toString()}`);
  },
  
  // Récupérer les statistiques
  getStats: async () => {
    // Mise à jour pour utiliser le nouveau chemin
    return fetchAPI('/scraper/stats');
  },
  
  // Exporter les prospects au format CSV
  exportCSV: async (search = '', sessionId = null) => {
    const params = new URLSearchParams({
      ...(search ? { search } : {}),
      ...(sessionId ? { sessionId } : {})
    });
    
    window.location.href = `${API_BASE_URL}/scraper/prospects/export?${params.toString()}`;
  }
};

/**
 * Services API pour les séquences de messages
 */
export const SequenceAPI = {
  // Récupère toutes les séquences
  getAllSequences: async () => {
    return fetchAPI('/sequences');
  },

  // Récupère une séquence par son ID
  getSequenceById: async (id) => {
    return fetchAPI(`/sequences/${id}`);
  },

  // Crée une nouvelle séquence
  createSequence: async (data) => {
    return fetchAPI('/sequences', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Met à jour une séquence existante
  updateSequence: async (id, data) => {
    return fetchAPI(`/sequences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Supprime une séquence
  deleteSequence: async (id) => {
    return fetchAPI(`/sequences/${id}`, {
      method: 'DELETE'
    });
  },

  // Active une séquence
  activateSequence: async (id) => {
    return fetchAPI(`/sequences/${id}/activate`, {
      method: 'POST'
    });
  },

  // Met en pause une séquence
  pauseSequence: async (id) => {
    return fetchAPI(`/sequences/${id}/pause`, {
      method: 'POST'
    });
  },

  // Reprend une séquence mise en pause
  resumeSequence: async (id) => {
    return fetchAPI(`/sequences/${id}/resume`, {
      method: 'POST'
    });
  },

  // Ajoute des prospects à une séquence
  addProspectsToSequence: async (id, prospectIds) => {
    return fetchAPI(`/sequences/${id}/prospects`, {
      method: 'POST',
      body: JSON.stringify({ prospectIds })
    });
  },

  // Retire un prospect d'une séquence
  removeProspectFromSequence: async (sequenceId, prospectId) => {
    return fetchAPI(`/sequences/${sequenceId}/prospects/${prospectId}`, {
      method: 'DELETE'
    });
  },

  // Récupère les messages d'une séquence
  getSequenceMessages: async (id) => {
    return fetchAPI(`/sequences/${id}/messages`);
  },

  // Ajoute un message à une séquence
  addMessageToSequence: async (id, messageData) => {
    return fetchAPI(`/sequences/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify(messageData)
    });
  },

  // Met à jour un message de séquence
  updateSequenceMessage: async (sequenceId, messageId, messageData) => {
    return fetchAPI(`/sequences/${sequenceId}/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify(messageData)
    });
  },

  // Supprime un message de séquence
  deleteSequenceMessage: async (sequenceId, messageId) => {
    return fetchAPI(`/sequences/${sequenceId}/messages/${messageId}`, {
      method: 'DELETE'
    });
  },

  // Réorganise les messages d'une séquence
  reorderSequenceMessages: async (id, messageOrder) => {
    return fetchAPI(`/sequences/${id}/messages/reorder`, {
      method: 'POST',
      body: JSON.stringify({ messageOrder })
    });
  }
};