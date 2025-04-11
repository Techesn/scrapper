// js/pages/settings.js
// Ce fichier principal chargera la page des paramètres

/**
 * Charge la page des paramètres
 * @param {HTMLElement} container - Conteneur principal
 */
export async function loadSettingsPage(container) {
  // Afficher un indicateur de chargement
  container.innerHTML = `
    <div class="flex items-center justify-center h-96">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p class="text-gray-600">Chargement des paramètres...</p>
      </div>
    </div>
  `;
  
  try {
    // Charger chaque module dynamiquement seulement quand nécessaire
    // Cela évite les problèmes d'importation à l'avance
    const api = await import('./settings/api.js');
    const CookieSection = (await import('./settings/components/CookieSection.js')).CookieSection;
    const QuotasSection = (await import('./settings/components/QuotasSection.js')).QuotasSection;
    const IntervalsSection = (await import('./settings/components/IntervalsSection.js')).IntervalsSection;
    const WorkingHoursSection = (await import('./settings/components/WorkingHoursSection.js')).WorkingHoursSection;
    const TimezoneSection = (await import('./settings/components/TimezoneSection.js')).TimezoneSection;
    const ResetButton = (await import('./settings/components/ResetButton.js')).ResetButton;
    const showMessage = (await import('./settings/utils/toastMessages.js')).showMessage;
    
    // Récupérer les paramètres actuels du serveur
    const settings = await api.fetchSettings();
    
    // Construire l'interface
    container.innerHTML = `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-gray-800">Paramètres</h1>
          <div id="reset-button-container"></div>
        </div>
        
        <div id="cookie-section" class="mb-6"></div>
        <div id="quotas-section" class="mb-6"></div>
        <div id="intervals-section" class="mb-6"></div>
        <div id="working-hours-section" class="mb-6"></div>
        <div id="timezone-section"></div>
      </div>
    `;
    
    // Fonction de réinitialisation
    const onSettingsReset = async () => {
      try {
        await api.resetSettings();
        showMessage(document.body, 'Tous les paramètres ont été réinitialisés aux valeurs par défaut', 'success');
        
        // Recharger la page des paramètres
        setTimeout(() => {
          loadSettingsPage(container);
        }, 1500);
      } catch (error) {
        console.error('Erreur lors de la réinitialisation des paramètres:', error);
        showMessage(document.body, `Erreur: ${error.message}`, 'error');
      }
    };
    
    // Rendre chaque section
    const resetButtonContainer = container.querySelector('#reset-button-container');
    ResetButton(resetButtonContainer, onSettingsReset);
    
    const cookieSection = container.querySelector('#cookie-section');
    CookieSection(cookieSection, settings);
    
    const quotasSection = container.querySelector('#quotas-section');
    QuotasSection(quotasSection, settings);
    
    const intervalsSection = container.querySelector('#intervals-section');
    IntervalsSection(intervalsSection, settings);
    
    const workingHoursSection = container.querySelector('#working-hours-section');
    WorkingHoursSection(workingHoursSection, settings);
    
    const timezoneSection = container.querySelector('#timezone-section');
    TimezoneSection(timezoneSection, settings);
    
  } catch (error) {
    console.error('Erreur lors du chargement de la page des paramètres:', error);
    
    // Afficher un message d'erreur dans le conteneur
    container.innerHTML = `
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
        <strong class="font-bold">Erreur!</strong>
        <span class="block sm:inline"> Impossible de charger les paramètres: ${error.message}</span>
        <p class="mt-2">Vérifiez la console pour plus de détails.</p>
      </div>
      <button id="retry-button" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
        <i class="fas fa-redo mr-2"></i> Réessayer
      </button>
    `;
    
    // Ajouter un écouteur d'événement pour le bouton de réessai
    const retryButton = container.querySelector('#retry-button');
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        loadSettingsPage(container);
      });
    }
  }
}