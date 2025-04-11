import { updateSettings } from '../api.js';
import { showMessage } from '../utils/toastMessages.js';

/**
 * Composant pour la section de gestion des intervalles de rafraîchissement
 * @param {HTMLElement} container - Conteneur pour le composant
 * @param {Object} settings - Paramètres actuels
 */
export function IntervalsSection(container, settings) {
  // Extraire les intervalles
  const intervals = settings.intervals || {
    cookieCheck: 30 * 60 * 1000, // 30 minutes
    connectionCheck: 60 * 60 * 1000, // 1 heure
    connectionRequest: 60 * 1000, // 1 minute
    sequenceScheduling: 15 * 60 * 1000, // 15 minutes
    messageProcessing: 60 * 1000 // 1 minute
  };
  
  // Rendu HTML
  container.innerHTML = `
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold mb-4">Intervalles de rafraîchissement</h2>
      
      <form id="intervals-form" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label for="cookie-check-interval" class="block text-sm font-medium text-gray-700 mb-1">
              Vérification du cookie (minutes)
            </label>
            <input type="number" id="cookie-check-interval" name="cookie-check-interval" min="5" max="120"
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value="${intervals.cookieCheck / 60000}">
            <p class="mt-1 text-sm text-gray-500">
              Fréquence de vérification du cookie LinkedIn
            </p>
          </div>
          
          <div>
            <label for="connection-check-interval" class="block text-sm font-medium text-gray-700 mb-1">
              Vérification des connexions (minutes)
            </label>
            <input type="number" id="connection-check-interval" name="connection-check-interval" min="15" max="240"
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value="${intervals.connectionCheck / 60000}">
            <p class="mt-1 text-sm text-gray-500">
              Fréquence de vérification des nouvelles connexions
            </p>
          </div>
          
          <div>
            <label for="connection-request-interval" class="block text-sm font-medium text-gray-700 mb-1">
              Traitement des demandes de connexion (secondes)
            </label>
            <input type="number" id="connection-request-interval" name="connection-request-interval" min="30" max="300"
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value="${intervals.connectionRequest / 1000}">
            <p class="mt-1 text-sm text-gray-500">
              Fréquence de traitement des demandes de connexion
            </p>
          </div>
          
          <div>
            <label for="sequence-scheduling-interval" class="block text-sm font-medium text-gray-700 mb-1">
              Planification des séquences (minutes)
            </label>
            <input type="number" id="sequence-scheduling-interval" name="sequence-scheduling-interval" min="5" max="60"
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value="${intervals.sequenceScheduling / 60000}">
            <p class="mt-1 text-sm text-gray-500">
              Fréquence de planification des messages de séquence
            </p>
          </div>
          
          <div>
            <label for="message-processing-interval" class="block text-sm font-medium text-gray-700 mb-1">
              Traitement des messages (secondes)
            </label>
            <input type="number" id="message-processing-interval" name="message-processing-interval" min="30" max="300"
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value="${intervals.messageProcessing / 1000}">
            <p class="mt-1 text-sm text-gray-500">
              Fréquence de traitement des messages à envoyer
            </p>
          </div>
        </div>
        
        <div class="pt-2">
          <button type="submit" id="save-intervals-btn" 
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
            <i class="fas fa-save mr-2"></i> Enregistrer les intervalles
          </button>
        </div>
      </form>
    </div>
  `;
  
  // Attacher les écouteurs d'événements
  attachEventListeners(container);
}

/**
 * Attache les écouteurs d'événements aux éléments de la section
 * @param {HTMLElement} container - Conteneur pour le composant
 */
function attachEventListeners(container) {
  // Formulaire des intervalles
  const intervalsForm = container.querySelector('#intervals-form');
  if (intervalsForm) {
    intervalsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleIntervalsSave(container);
    });
  }
}

/**
 * Gère la sauvegarde des intervalles de rafraîchissement
 * @param {HTMLElement} container - Conteneur du composant 
 */
async function handleIntervalsSave(container) {
  // Récupérer les valeurs du formulaire
  const cookieCheckMin = parseInt(container.querySelector('#cookie-check-interval').value) || 30;
  const connectionCheckMin = parseInt(container.querySelector('#connection-check-interval').value) || 60;
  const connectionRequestSec = parseInt(container.querySelector('#connection-request-interval').value) || 60;
  const sequenceSchedulingMin = parseInt(container.querySelector('#sequence-scheduling-interval').value) || 15;
  const messageProcessingSec = parseInt(container.querySelector('#message-processing-interval').value) || 60;
  
  // Convertir en millisecondes
  const intervals = {
    cookieCheck: cookieCheckMin * 60 * 1000,
    connectionCheck: connectionCheckMin * 60 * 1000,
    connectionRequest: connectionRequestSec * 1000,
    sequenceScheduling: sequenceSchedulingMin * 60 * 1000,
    messageProcessing: messageProcessingSec * 1000
  };
  
  // Afficher un indicateur de chargement
  const saveButton = container.querySelector('#save-intervals-btn');
  const originalButtonText = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enregistrement...';
  saveButton.disabled = true;
  
  try {
    // Mettre à jour les paramètres
    await updateSettings('intervals', intervals);
    
    // Afficher un message de succès
    showMessage(container, 'Intervalles de rafraîchissement enregistrés avec succès', 'success');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des intervalles:', error);
    showMessage(container, `Erreur: ${error.message}`, 'error');
  } finally {
    // Restaurer le bouton
    saveButton.innerHTML = originalButtonText;
    saveButton.disabled = false;
  }
}