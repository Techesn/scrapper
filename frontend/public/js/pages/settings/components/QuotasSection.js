import { updateSettings } from '../api.js';
import { showMessage } from '../utils/toastMessages.js';

/**
 * Composant pour la section de gestion des quotas LinkedIn
 * @param {HTMLElement} container - Conteneur pour le composant
 * @param {Object} settings - Paramètres actuels
 */
export function QuotasSection(container, settings) {
  // Extraire les paramètres LinkedIn
  const quotas = settings.linkedin?.quotas || { prospects: 1000, messages: 100, connections: 50 };
  const delays = settings.linkedin?.delays || { min: 1000, max: 3000 };
  
  // Rendu HTML
  container.innerHTML = `
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold mb-4">Quotas LinkedIn</h2>
      
      <form id="quotas-form" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="daily-prospect-limit" class="block text-sm font-medium text-gray-700 mb-1">
              Limite quotidienne de prospects
            </label>
            <input type="number" id="daily-prospect-limit" name="daily-prospect-limit" min="1" max="5000"
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value="${quotas.prospects}">
            <p class="mt-1 text-sm text-gray-500">
              Prospects à extraire par jour
            </p>
          </div>
          
          <div>
            <label for="daily-message-limit" class="block text-sm font-medium text-gray-700 mb-1">
              Limite quotidienne de messages
            </label>
            <input type="number" id="daily-message-limit" name="daily-message-limit" min="1" max="500"
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value="${quotas.messages}">
            <p class="mt-1 text-sm text-gray-500">
              Messages à envoyer par jour
            </p>
          </div>
          
          <div>
            <label for="daily-connection-limit" class="block text-sm font-medium text-gray-700 mb-1">
              Limite quotidienne de connexions
            </label>
            <input type="number" id="daily-connection-limit" name="daily-connection-limit" min="1" max="200"
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value="${quotas.connections}">
            <p class="mt-1 text-sm text-gray-500">
              Demandes de connexion par jour
            </p>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label for="min-delay" class="block text-sm font-medium text-gray-700 mb-1">
              Délai minimum entre actions (ms)
            </label>
            <input type="number" id="min-delay" name="min-delay" min="500" max="10000"
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value="${delays.min}">
            <p class="mt-1 text-sm text-gray-500">
              Délai minimum pour simuler un comportement humain
            </p>
          </div>
          
          <div>
            <label for="max-delay" class="block text-sm font-medium text-gray-700 mb-1">
              Délai maximum entre actions (ms)
            </label>
            <input type="number" id="max-delay" name="max-delay" min="1000" max="15000"
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value="${delays.max}">
            <p class="mt-1 text-sm text-gray-500">
              Délai maximum pour simuler un comportement humain
            </p>
          </div>
        </div>
        
        <div class="pt-2">
          <button type="submit" id="save-quotas-btn" 
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
            <i class="fas fa-save mr-2"></i> Enregistrer les quotas
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
  // Formulaire des quotas
  const quotasForm = container.querySelector('#quotas-form');
  if (quotasForm) {
    quotasForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleQuotasSave(container);
    });
  }
}

/**
 * Gère la sauvegarde des quotas LinkedIn
 * @param {HTMLElement} container - Conteneur du composant 
 */
async function handleQuotasSave(container) {
  // Récupérer les valeurs du formulaire
  const prospectLimit = parseInt(container.querySelector('#daily-prospect-limit').value) || 1000;
  const messageLimit = parseInt(container.querySelector('#daily-message-limit').value) || 100;
  const connectionLimit = parseInt(container.querySelector('#daily-connection-limit').value) || 50;
  const minDelay = parseInt(container.querySelector('#min-delay').value) || 1000;
  const maxDelay = parseInt(container.querySelector('#max-delay').value) || 3000;
  
  // Valider les valeurs
  if (minDelay > maxDelay) {
    showMessage(container, 'Le délai minimum doit être inférieur au délai maximum', 'error');
    return;
  }
  
  // Afficher un indicateur de chargement
  const saveButton = container.querySelector('#save-quotas-btn');
  const originalButtonText = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enregistrement...';
  saveButton.disabled = true;
  
  try {
    // Préparer les données à envoyer
    const linkedinSettings = {
      quotas: {
        prospects: prospectLimit,
        messages: messageLimit,
        connections: connectionLimit
      },
      delays: {
        min: minDelay,
        max: maxDelay
      }
    };
    
    // Mettre à jour les paramètres
    await updateSettings('linkedin', linkedinSettings);
    
    // Afficher un message de succès
    showMessage(container, 'Quotas LinkedIn enregistrés avec succès', 'success');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des quotas:', error);
    showMessage(container, `Erreur: ${error.message}`, 'error');
  } finally {
    // Restaurer le bouton
    saveButton.innerHTML = originalButtonText;
    saveButton.disabled = false;
  }
}