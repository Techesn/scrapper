import { updateSettings } from '../api.js';
import { showMessage } from '../utils/toastMessages.js';

/**
 * Composant pour la section de gestion des plages horaires
 * @param {HTMLElement} container - Conteneur pour le composant
 * @param {Object} settings - Paramètres actuels
 */
export function WorkingHoursSection(container, settings) {
  // Extraire les plages horaires
  const workingHours = settings.workingHours || {
    message: { start: 9, end: 19 },
    connection: { start: 10, end: 20 }
  };
  
  // Rendu HTML
  container.innerHTML = `
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold mb-4">Plages horaires (${settings.timezone || 'Europe/Paris'})</h2>
      
      <form id="working-hours-form" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="text-md font-medium mb-3">Messages</h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="message-hours-start" class="block text-sm font-medium text-gray-700 mb-1">
                  Heure de début
                </label>
                <input type="number" id="message-hours-start" name="message-hours-start" min="0" max="23"
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value="${workingHours.message.start}">
              </div>
              
              <div>
                <label for="message-hours-end" class="block text-sm font-medium text-gray-700 mb-1">
                  Heure de fin
                </label>
                <input type="number" id="message-hours-end" name="message-hours-end" min="1" max="24"
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value="${workingHours.message.end}">
              </div>
            </div>
            <p class="mt-1 text-sm text-gray-500">
              Plage horaire pour l'envoi de messages
            </p>
          </div>
          
          <div>
            <h3 class="text-md font-medium mb-3">Demandes de connexion</h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="connection-hours-start" class="block text-sm font-medium text-gray-700 mb-1">
                  Heure de début
                </label>
                <input type="number" id="connection-hours-start" name="connection-hours-start" min="0" max="23"
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value="${workingHours.connection.start}">
              </div>
              
              <div>
                <label for="connection-hours-end" class="block text-sm font-medium text-gray-700 mb-1">
                  Heure de fin
                </label>
                <input type="number" id="connection-hours-end" name="connection-hours-end" min="1" max="24"
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value="${workingHours.connection.end}">
              </div>
            </div>
            <p class="mt-1 text-sm text-gray-500">
              Plage horaire pour l'envoi de demandes de connexion
            </p>
          </div>
        </div>
        
        <div class="pt-2">
          <button type="submit" id="save-working-hours-btn" 
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
            <i class="fas fa-save mr-2"></i> Enregistrer les plages horaires
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
  // Formulaire des plages horaires
  const workingHoursForm = container.querySelector('#working-hours-form');
  if (workingHoursForm) {
    workingHoursForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleWorkingHoursSave(container);
    });
  }
}

/**
 * Gère la sauvegarde des plages horaires
 * @param {HTMLElement} container - Conteneur du composant 
 */
async function handleWorkingHoursSave(container) {
  // Récupérer les valeurs du formulaire
  const messageStart = parseInt(container.querySelector('#message-hours-start').value) || 9;
  const messageEnd = parseInt(container.querySelector('#message-hours-end').value) || 19;
  const connectionStart = parseInt(container.querySelector('#connection-hours-start').value) || 10;
  const connectionEnd = parseInt(container.querySelector('#connection-hours-end').value) || 20;
  
  // Valider les valeurs
  if (messageStart >= messageEnd) {
    showMessage(container, 'L\'heure de début des messages doit être inférieure à l\'heure de fin', 'error');
    return;
  }
  
  if (connectionStart >= connectionEnd) {
    showMessage(container, 'L\'heure de début des connexions doit être inférieure à l\'heure de fin', 'error');
    return;
  }
  
  // Construire l'objet de plages horaires
  const workingHours = {
    message: {
      start: messageStart,
      end: messageEnd
    },
    connection: {
      start: connectionStart,
      end: connectionEnd
    }
  };
  
  // Afficher un indicateur de chargement
  const saveButton = container.querySelector('#save-working-hours-btn');
  const originalButtonText = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enregistrement...';
  saveButton.disabled = true;
  
  try {
    // Mettre à jour les paramètres
    await updateSettings('workingHours', workingHours);
    
    // Afficher un message de succès
    showMessage(container, 'Plages horaires enregistrées avec succès', 'success');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des plages horaires:', error);
    showMessage(container, `Erreur: ${error.message}`, 'error');
  } finally {
    // Restaurer le bouton
    saveButton.innerHTML = originalButtonText;
    saveButton.disabled = false;
  }
}