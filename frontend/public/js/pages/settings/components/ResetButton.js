import { resetSettings } from '../api.js';
import { showMessage } from '../utils/toastMessages.js';
import { confirmModal } from '../utils/modalHelpers.js';

/**
 * Composant pour le bouton de réinitialisation des paramètres
 * @param {HTMLElement} container - Conteneur pour le composant
 * @param {Function} onReset - Callback à exécuter après réinitialisation
 */
export function ResetButton(container, onReset) {
  // Rendu HTML
  container.innerHTML = `
    <button type="button" id="reset-settings-btn" 
      class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 flex items-center">
      <i class="fas fa-redo-alt mr-2"></i> Réinitialiser
    </button>
  `;
  
  // Attacher l'écouteur d'événement
  const resetButton = container.querySelector('#reset-settings-btn');
  if (resetButton) {
    resetButton.addEventListener('click', async () => {
      await handleReset(container, onReset);
    });
  }
}

/**
 * Gère la réinitialisation des paramètres
 * @param {HTMLElement} container - Conteneur du composant
 * @param {Function} onReset - Callback à exécuter après réinitialisation 
 */
async function handleReset(container, onReset) {
  // Demander confirmation
  const confirmed = await confirmModal(
    'Êtes-vous sûr de vouloir réinitialiser tous les paramètres aux valeurs par défaut ? Cette action est irréversible.',
    {
      title: 'Réinitialiser les paramètres',
      confirmText: 'Réinitialiser',
      cancelText: 'Annuler',
      confirmType: 'danger'
    }
  );
  
  if (!confirmed) {
    return;
  }
  
  // Afficher un indicateur de chargement
  const resetButton = container.querySelector('#reset-settings-btn');
  const originalButtonText = resetButton.innerHTML;
  resetButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Réinitialisation...';
  resetButton.disabled = true;
  
  try {
    // Réinitialiser les paramètres
    await resetSettings();
    
    // Afficher un message de succès
    showMessage(document.body, 'Tous les paramètres ont été réinitialisés aux valeurs par défaut', 'success');
    
    // Exécuter le callback
    if (typeof onReset === 'function') {
      onReset();
    }
  } catch (error) {
    console.error('Erreur lors de la réinitialisation des paramètres:', error);
    showMessage(document.body, `Erreur: ${error.message}`, 'error');
  } finally {
    // Restaurer le bouton
    resetButton.innerHTML = originalButtonText;
    resetButton.disabled = false;
  }
}