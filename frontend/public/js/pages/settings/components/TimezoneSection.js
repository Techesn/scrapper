import { updateSettings } from '../api.js';
import { showMessage } from '../utils/toastMessages.js';

/**
 * Liste des fuseaux horaires principaux
 * @type {Array<Object>}
 */
const TIMEZONES = [
  { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1/+2)' },
  { value: 'Europe/London', label: 'Europe/London (UTC+0/+1)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (UTC+1/+2)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid (UTC+1/+2)' },
  { value: 'Europe/Rome', label: 'Europe/Rome (UTC+1/+2)' },
  { value: 'America/New_York', label: 'America/New_York (UTC-5/-4)' },
  { value: 'America/Chicago', label: 'America/Chicago (UTC-6/-5)' },
  { value: 'America/Denver', label: 'America/Denver (UTC-7/-6)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8/-7)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (UTC+10/+11)' }
];

/**
 * Composant pour la section de gestion du fuseau horaire
 * @param {HTMLElement} container - Conteneur pour le composant
 * @param {Object} settings - Paramètres actuels
 */
export function TimezoneSection(container, settings) {
  // Extraire le fuseau horaire
  const timezone = settings.timezone || 'Europe/Paris';
  
  // Rendu HTML
  container.innerHTML = `
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold mb-4">Fuseau horaire</h2>
      
      <form id="timezone-form" class="space-y-4">
        <div>
          <label for="timezone" class="block text-sm font-medium text-gray-700 mb-1">
            Fuseau horaire
          </label>
          <select id="timezone" name="timezone"
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
            ${TIMEZONES.map(tz => `
              <option value="${tz.value}" ${timezone === tz.value ? 'selected' : ''}>
                ${tz.label}
              </option>
            `).join('')}
          </select>
          <p class="mt-1 text-sm text-gray-500">
            Fuseau horaire utilisé pour les calculs de temps
          </p>
        </div>
        
        <div class="pt-2">
          <button type="submit" id="save-timezone-btn" 
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
            <i class="fas fa-save mr-2"></i> Enregistrer le fuseau horaire
          </button>
        </div>
      </form>
      
      <div class="mt-4 text-sm text-gray-500">
        <p>
          <i class="fas fa-info-circle mr-1"></i>
          Le fuseau horaire est utilisé pour déterminer les heures de travail et les calculs de temps dans l'application.
        </p>
        <p class="mt-2">
          <strong>Note:</strong> Après avoir modifié le fuseau horaire, il est recommandé de vérifier les plages horaires configurées.
        </p>
      </div>
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
  // Formulaire du fuseau horaire
  const timezoneForm = container.querySelector('#timezone-form');
  if (timezoneForm) {
    timezoneForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleTimezoneSave(container);
    });
  }
}

/**
 * Gère la sauvegarde du fuseau horaire
 * @param {HTMLElement} container - Conteneur du composant 
 */
async function handleTimezoneSave(container) {
  // Récupérer la valeur du formulaire
  const timezone = container.querySelector('#timezone').value;
  
  // Afficher un indicateur de chargement
  const saveButton = container.querySelector('#save-timezone-btn');
  const originalButtonText = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enregistrement...';
  saveButton.disabled = true;
  
  try {
    // Mettre à jour le paramètre
    await updateSettings('timezone', timezone);
    
    // Afficher un message de succès
    showMessage(container, 'Fuseau horaire enregistré avec succès', 'success');
    
    // Suggérer de vérifier les plages horaires
    setTimeout(() => {
      showMessage(container, 'N\'oubliez pas de vérifier vos plages horaires configurées', 'info');
    }, 3000);
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du fuseau horaire:', error);
    showMessage(container, `Erreur: ${error.message}`, 'error');
  } finally {
    // Restaurer le bouton
    saveButton.innerHTML = originalButtonText;
    saveButton.disabled = false;
  }
}