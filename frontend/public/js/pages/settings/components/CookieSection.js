import { updateLinkedInCookie, validateLinkedInCookie } from '../api.js';
import { showMessage } from '../utils/toastMessages.js';
import { showModal } from '../utils/modalHelpers.js';

/**
 * Composant pour la section de gestion du cookie LinkedIn
 * @param {HTMLElement} container - Conteneur pour le composant
 * @param {Object} settings - Paramètres actuels
 */
export function CookieSection(container, settings) {
  // Extraire les informations du cookie
  const cookieExists = settings.cookie && settings.cookie.exists;
  const cookieStatus = settings.cookie && settings.cookie.status;
  
  let cookieStatusHtml = '';
  if (cookieStatus) {
    const statusColor = cookieStatus.isValid ? 'green' : 'red';
    const statusIcon = cookieStatus.isValid ? 'check-circle' : 'exclamation-circle';
    const statusText = cookieStatus.isValid ? 'Valide' : 'Invalide';
    const lastChecked = new Date(cookieStatus.lastChecked).toLocaleString();
    
    cookieStatusHtml = `
      <div class="mt-2 flex items-center cookie-status-indicator">
        <span class="text-${statusColor}-600 mr-2">
          <i class="fas fa-${statusIcon}"></i>
        </span>
        <span>Statut: <span class="font-medium text-${statusColor}-600">${statusText}</span></span>
        <span class="mx-2">•</span>
        <span class="text-sm text-gray-500">Dernière vérification: ${lastChecked}</span>
      </div>
    `;
  }
  
  // Rendu HTML
  container.innerHTML = `
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold mb-4">Cookie LinkedIn</h2>
      
      <div class="space-y-4">
        <div>
          <label for="linkedin-cookie" class="block text-sm font-medium text-gray-700 mb-1">
            Cookie de session LinkedIn (li_at)
          </label>
          <div class="flex flex-col space-y-2">
            <textarea id="linkedin-cookie" name="linkedin-cookie" rows="3"
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Copiez votre cookie de session LinkedIn ici">${cookieExists ? '••••••••••••••••••••••••••••••••' : ''}</textarea>
            
            ${cookieStatusHtml}
            
            <div class="flex space-x-2 mt-2">
              <button type="button" id="validate-cookie-btn" 
                class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 flex items-center">
                <i class="fas fa-check-circle mr-1.5"></i> Vérifier
              </button>
              <button type="button" id="save-cookie-btn" 
                class="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center">
                <i class="fas fa-save mr-1.5"></i> Enregistrer
              </button>
            </div>
            
            <p class="text-sm text-gray-500">
              Ce cookie est utilisé pour l'authentification à LinkedIn sans identifiants.
              <a href="#" id="cookie-help-btn" class="text-blue-600 hover:text-blue-800">Comment l'obtenir?</a>
            </p>
          </div>
        </div>
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
  // Bouton d'aide pour le cookie
  const helpButton = container.querySelector('#cookie-help-btn');
  if (helpButton) {
    helpButton.addEventListener('click', (e) => {
      e.preventDefault();
      showCookieHelp();
    });
  }
  
  // Bouton de validation du cookie
  const validateButton = container.querySelector('#validate-cookie-btn');
  if (validateButton) {
    validateButton.addEventListener('click', async () => {
      await handleCookieValidation(container);
    });
  }
  
  // Bouton de sauvegarde du cookie
  const saveButton = container.querySelector('#save-cookie-btn');
  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      await handleCookieSave(container);
    });
  }
}

/**
 * Gère la validation du cookie LinkedIn
 * @param {HTMLElement} container - Conteneur du composant 
 */
async function handleCookieValidation(container) {
  const cookieTextarea = container.querySelector('#linkedin-cookie');
  const cookie = cookieTextarea.value.trim();
  
  if (!cookie) {
    showMessage(container, 'Veuillez entrer un cookie LinkedIn', 'error');
    return;
  }
  
  // Afficher un indicateur de chargement
  const validateButton = container.querySelector('#validate-cookie-btn');
  const originalButtonText = validateButton.innerHTML;
  validateButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i> Vérification...';
  validateButton.disabled = true;
  
  try {
    // Valider le cookie
    const validationResult = await validateLinkedInCookie(cookie);
    
    // Afficher le résultat
    displayCookieValidationResult(container, validationResult);
    
    // Afficher un message
    const messageType = validationResult.valid ? 'success' : 'error';
    const message = validationResult.valid ? 
      'Cookie LinkedIn valide !' : 
      'Cookie LinkedIn invalide. Veuillez vérifier et réessayer.';
    
    showMessage(container, message, messageType);
  } catch (error) {
    console.error('Erreur lors de la validation du cookie:', error);
    showMessage(container, `Erreur: ${error.message}`, 'error');
  } finally {
    // Restaurer le bouton
    validateButton.innerHTML = originalButtonText;
    validateButton.disabled = false;
  }
}

/**
 * Gère la sauvegarde du cookie LinkedIn
 * @param {HTMLElement} container - Conteneur du composant 
 */
async function handleCookieSave(container) {
  const cookieTextarea = container.querySelector('#linkedin-cookie');
  const cookie = cookieTextarea.value.trim();
  
  if (!cookie) {
    showMessage(container, 'Veuillez entrer un cookie LinkedIn', 'error');
    return;
  }
  
  // Afficher un indicateur de chargement
  const saveButton = container.querySelector('#save-cookie-btn');
  const originalButtonText = saveButton.innerHTML;
  saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i> Enregistrement...';
  saveButton.disabled = true;
  
  try {
    // Mettre à jour le cookie
    const result = await updateLinkedInCookie(cookie);
    
    // Afficher le résultat
    const cookieStatus = result.cookie && result.cookie.status;
    if (cookieStatus) {
      displayCookieValidationResult(container, cookieStatus);
    }
    
    // Masquer le cookie pour la sécurité
    cookieTextarea.value = '••••••••••••••••••••••••••••••••';
    
    // Afficher un message de succès
    showMessage(container, 'Cookie LinkedIn enregistré avec succès', 'success');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du cookie:', error);
    showMessage(container, `Erreur: ${error.message}`, 'error');
  } finally {
    // Restaurer le bouton
    saveButton.innerHTML = originalButtonText;
    saveButton.disabled = false;
  }
}

/**
 * Affiche le résultat de la validation du cookie
 * @param {HTMLElement} container - Conteneur du composant
 * @param {Object} validationResult - Résultat de la validation
 */
function displayCookieValidationResult(container, validationResult) {
  // Supprimer l'indicateur de statut existant
  const existingStatus = container.querySelector('.cookie-status-indicator');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  const cookieTextarea = container.querySelector('#linkedin-cookie');
  
  // Créer le nouvel élément de statut
  const statusElement = document.createElement('div');
  statusElement.className = 'mt-2 flex items-center cookie-status-indicator';
  
  // Déterminer la couleur et l'icône en fonction du résultat
  const statusColor = validationResult.valid ? 'green' : 'red';
  const statusIcon = validationResult.valid ? 'check-circle' : 'exclamation-circle';
  const statusText = validationResult.valid ? 'Valide' : 'Invalide';
  const lastChecked = new Date(validationResult.lastChecked).toLocaleString();
  
  statusElement.innerHTML = `
    <span class="text-${statusColor}-600 mr-2">
      <i class="fas fa-${statusIcon}"></i>
    </span>
    <span>Statut: <span class="font-medium text-${statusColor}-600">${statusText}</span></span>
    <span class="mx-2">•</span>
    <span class="text-sm text-gray-500">Dernière vérification: ${lastChecked}</span>
  `;
  
  // Ajouter l'élément après le textarea
  cookieTextarea.parentNode.insertBefore(statusElement, cookieTextarea.nextSibling);
}

/**
 * Affiche une aide pour obtenir le cookie LinkedIn
 */
function showCookieHelp() {
  showModal({
    title: 'Comment obtenir votre cookie LinkedIn',
    content: `
      <div class="prose max-w-none">
        <p>Pour obtenir le cookie <code>li_at</code> de LinkedIn, suivez ces étapes :</p>
        
        <ol class="list-decimal pl-6 space-y-2">
          <li>Connectez-vous à <a href="https://www.linkedin.com" target="_blank" class="text-blue-600 hover:text-blue-800">LinkedIn</a></li>
          <li>Ouvrez les outils de développement (F12 ou clic droit > Inspecter)</li>
          <li>Allez dans l'onglet "Application" (Chrome) ou "Stockage" (Firefox)</li>
          <li>Dans le panneau gauche, cliquez sur "Cookies" puis "https://www.linkedin.com"</li>
          <li>Recherchez le cookie nommé <code>li_at</code></li>
          <li>Copiez la valeur de ce cookie et collez-la dans le champ correspondant</li>
        </ol>
        
        <p class="mt-4 text-sm text-gray-500">
          <strong>Note de sécurité :</strong> Ce cookie permet l'accès à votre compte LinkedIn. 
          Il est stocké de manière sécurisée dans notre base de données, mais veillez à ne pas le partager.
        </p>
      </div>
    `,
    size: 'md',
    buttons: [
      {
        text: 'Compris',
        type: 'primary'
      }
    ]
  });
}