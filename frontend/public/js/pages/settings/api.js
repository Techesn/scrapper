/**
 * Module d'API pour les paramètres
 * Utilise l'architecture d'API existante
 */

// URL de base pour l'API
const API_BASE_URL = '/api/settings';

/**
 * Effectue une requête API avec fetch
 * @param {string} endpoint - Point de terminaison de l'API
 * @param {Object} options - Options de la requête fetch
 * @returns {Promise<Object>} - Promesse résolue avec les données de la réponse
 */
async function fetchSettingsAPI(endpoint = '', options = {}) {
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
    console.error('Erreur API Settings:', error);
    throw error;
  }
}

/**
 * Récupère les paramètres actuels depuis le serveur
 * @returns {Promise<Object>} Paramètres actuels
 */
export async function fetchSettings() {
  try {
    return await fetchSettingsAPI();
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error);
    throw error;
  }
}

/**
 * Met à jour un groupe spécifique de paramètres
 * @param {string} section - Section à mettre à jour ('linkedin', 'intervals', 'workingHours', 'timezone')
 * @param {Object} data - Données à mettre à jour
 * @returns {Promise<Object>} Paramètres mis à jour
 */
export async function updateSettings(section, data) {
  try {
    // Construire l'objet de mise à jour en fonction de la section
    const updateData = {};
    updateData[section] = data;
    
    return await fetchSettingsAPI('', {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  } catch (error) {
    console.error(`Erreur lors de la mise à jour des paramètres ${section}:`, error);
    throw error;
  }
}

/**
 * Met à jour le cookie LinkedIn
 * @param {string} cookie - Valeur du cookie
 * @returns {Promise<Object>} Résultat de la mise à jour
 */
export async function updateLinkedInCookie(cookie) {
  try {
    return await fetchSettingsAPI('', {
      method: 'PUT',
      body: JSON.stringify({ linkedinCookie: cookie })
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du cookie LinkedIn:', error);
    throw error;
  }
}

/**
 * Valide le cookie LinkedIn
 * @param {string} cookie - Cookie à valider
 * @returns {Promise<Object>} Résultat de la validation
 */
export async function validateLinkedInCookie(cookie) {
  try {
    return await fetchSettingsAPI('/validate-cookie', {
      method: 'POST',
      body: JSON.stringify({ cookie })
    });
  } catch (error) {
    console.error('Erreur lors de la validation du cookie LinkedIn:', error);
    throw error;
  }
}

/**
 * Réinitialise tous les paramètres aux valeurs par défaut
 * @returns {Promise<Object>} Paramètres par défaut
 */
export async function resetSettings() {
  try {
    return await fetchSettingsAPI('/reset', {
      method: 'POST'
    });
  } catch (error) {
    console.error('Erreur lors de la réinitialisation des paramètres:', error);
    throw error;
  }
}