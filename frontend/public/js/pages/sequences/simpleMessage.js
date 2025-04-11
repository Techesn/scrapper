import { MessageAPI } from '../../services/message-api-service.js';
import { addLog } from '../../components/logs.js';
import { updateMessagingStatus } from '../sequences.js';

/**
 * Affiche le formulaire de message simple
 * @param {HTMLElement} container - Conteneur pour le formulaire
 */
export function renderSimpleMessage(container) {
  // Construire le formulaire de message simple
  container.innerHTML = `
    <form id="message-form" class="space-y-4">
      <div>
        <label for="profile-url" class="block text-sm font-medium text-gray-700 mb-1">
          URL du profil LinkedIn
        </label>
        <input type="url" id="profile-url" name="profile-url" 
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="https://www.linkedin.com/in/nom-utilisateur"
          required>
        <p class="mt-1 text-sm text-gray-500">
          Collez l'URL complète d'un profil LinkedIn.
        </p>
      </div>
      
      <div>
        <label for="message-content" class="block text-sm font-medium text-gray-700 mb-1">
          Message
        </label>
        <textarea id="message-content" name="message-content" rows="4"
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Saisissez votre message ici..."
          required></textarea>
      </div>
      
      <div class="flex flex-wrap gap-2">
        <button type="button" id="initialize-messaging-btn" 
          class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50">
          <i class="fas fa-cog mr-2"></i> Initialiser
        </button>
        
        <button type="submit" id="send-message-btn" 
          class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
          <i class="fas fa-paper-plane mr-2"></i> Envoyer
        </button>
      </div>
    </form>
    
    <!-- Historique des messages -->
    <div class="mt-8">
      <div class="bg-white rounded-lg shadow-md p-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">Historique des messages</h3>
          <button id="clear-history" class="text-sm text-gray-500 hover:text-gray-700">
            <i class="fas fa-trash mr-1"></i> Effacer
          </button>
        </div>
        <div id="message-history" class="empty-state">
          <div class="text-center py-8 text-gray-500">
            <i class="fas fa-inbox text-4xl mb-3"></i>
            <p>Aucun message envoyé pour le moment</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Attacher les écouteurs d'événements
  attachSimpleMessageListeners(container);
  
  // Charger l'historique des messages depuis localStorage
  loadMessageHistory(container);
}

/**
 * Attache les écouteurs d'événements du composant de message simple
 * @param {HTMLElement} container - Conteneur du composant
 */
function attachSimpleMessageListeners(container) {
  // Formulaire d'envoi de message
  const messageForm = container.querySelector('#message-form');
  if (messageForm) {
    messageForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const profileUrl = container.querySelector('#profile-url').value;
      const messageContent = container.querySelector('#message-content').value;
      
      if (!profileUrl || !messageContent) return;
      
      try {
        // Désactiver le formulaire pendant l'envoi
        setFormDisabled(container, true);
        updateMessagingStatus(document, 'sending');
        addLog(document, `Envoi d'un message à ${profileUrl}...`);
        
        // Envoyer le message
        const response = await MessageAPI.sendMessage({
          profileUrl,
          message: messageContent
        });
        
        if (response.success) {
          updateMessagingStatus(document, 'ready');
          addLog(document, `Message envoyé avec succès !`, 'success');
          
          // Ajouter à l'historique
          addToMessageHistory(container, {
            profileUrl,
            message: messageContent,
            date: new Date(),
            status: 'success'
          });
          
          // Vider le formulaire
          container.querySelector('#profile-url').value = '';
          container.querySelector('#message-content').value = '';
        } else {
          updateMessagingStatus(document, 'error');
          addLog(document, `Erreur: ${response.message || response.error}`, 'error');
        }
        
      } catch (error) {
        updateMessagingStatus(document, 'error');
        addLog(document, `Erreur: ${error.message}`, 'error');
      } finally {
        setFormDisabled(container, false);
      }
    });
  }
  
  // Bouton d'initialisation
  const initializeBtn = container.querySelector('#initialize-messaging-btn');
  if (initializeBtn) {
    initializeBtn.addEventListener('click', async () => {
      try {
        setFormDisabled(container, true);
        updateMessagingStatus(document, 'idle');
        addLog(document, 'Initialisation du service de messagerie...');
        
        const response = await MessageAPI.initialize();
        
        if (response.success) {
          updateMessagingStatus(document, 'ready');
          addLog(document, `Initialisation: ${response.message || 'Terminée avec succès'}`, 'success');
        } else {
          updateMessagingStatus(document, 'error');
          addLog(document, `Erreur d'initialisation: ${response.message || response.error}`, 'error');
        }
      } catch (error) {
        updateMessagingStatus(document, 'error');
        addLog(document, `Erreur: ${error.message}`, 'error');
      } finally {
        setFormDisabled(container, false);
      }
    });
  }
  
  // Bouton pour effacer l'historique
  const clearHistoryBtn = container.querySelector('#clear-history');
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      const historyContainer = container.querySelector('#message-history');
      if (historyContainer) {
        historyContainer.innerHTML = `
          <div class="text-center py-8 text-gray-500">
            <i class="fas fa-inbox text-4xl mb-3"></i>
            <p>Aucun message envoyé pour le moment</p>
          </div>
        `;
        historyContainer.className = 'empty-state';
        
        // Effacer l'historique dans localStorage
        localStorage.removeItem('messageHistory');
        
        addLog(document, 'Historique des messages effacé');
      }
    });
  }
}

/**
 * Active ou désactive les éléments du formulaire
 * @param {HTMLElement} container - Conteneur du formulaire
 * @param {boolean} disabled - Doit-on désactiver les éléments
 */
function setFormDisabled(container, disabled) {
  const profileUrlInput = container.querySelector('#profile-url');
  const messageContentInput = container.querySelector('#message-content');
  const initializeBtn = container.querySelector('#initialize-messaging-btn');
  const sendMessageBtn = container.querySelector('#send-message-btn');
  
  if (profileUrlInput) profileUrlInput.disabled = disabled;
  if (messageContentInput) messageContentInput.disabled = disabled;
  if (initializeBtn) initializeBtn.disabled = disabled;
  if (sendMessageBtn) sendMessageBtn.disabled = disabled;
}

/**
 * Ajoute un message à l'historique
 * @param {HTMLElement} container - Conteneur principal
 * @param {Object} messageData - Données du message
 */
function addToMessageHistory(container, messageData) {
  const historyContainer = container.querySelector('#message-history');
  if (!historyContainer) return;
  
  // Supprimer l'état vide si c'est le premier message
  if (historyContainer.classList.contains('empty-state')) {
    historyContainer.innerHTML = '';
    historyContainer.className = '';
  }
  
  // Créer l'élément d'historique
  const messageElement = document.createElement('div');
  messageElement.className = 'border-b border-gray-200 py-3';
  messageElement.innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        <p class="font-medium text-blue-600">
          <a href="${messageData.profileUrl}" target="_blank" class="hover:underline">
            ${messageData.profileUrl.split('/in/')[1] || messageData.profileUrl}
          </a>
        </p>
        <p class="text-sm text-gray-500">${new Date(messageData.date).toLocaleString()}</p>
      </div>
      <span class="px-2 py-1 text-xs rounded ${messageData.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
        ${messageData.status === 'success' ? 'Envoyé' : 'Échec'}
      </span>
    </div>
    <p class="mt-2 text-gray-700">${messageData.message}</p>
  `;
  
  // Ajouter au conteneur (au début pour que les plus récents soient en haut)
  historyContainer.insertBefore(messageElement, historyContainer.firstChild);
  
  // Sauvegarder dans localStorage
  saveMessageHistory(messageData);
}

/**
 * Charge l'historique des messages depuis localStorage
 * @param {HTMLElement} container - Conteneur principal
 */
function loadMessageHistory(container) {
  try {
    const history = JSON.parse(localStorage.getItem('messageHistory')) || [];
    
    if (history.length > 0) {
      const historyContainer = container.querySelector('#message-history');
      if (historyContainer) {
        // Vider le conteneur
        historyContainer.innerHTML = '';
        historyContainer.className = '';
        
        // Pour chaque message dans l'historique (dans l'ordre inverse pour que les plus récents soient en haut)
        for (let i = history.length - 1; i >= 0; i--) {
          addToMessageHistory(container, {
            ...history[i],
            date: new Date(history[i].date)
          });
        }
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement de l\'historique:', error);
    addLog(document, 'Erreur lors du chargement de l\'historique des messages', 'error');
  }
}

/**
 * Sauvegarde un message dans l'historique localStorage
 * @param {Object} messageData - Données du message
 */
function saveMessageHistory(messageData) {
  try {
    // Récupérer l'historique actuel
    const history = JSON.parse(localStorage.getItem('messageHistory')) || [];
    
    // Ajouter le nouveau message
    history.push({
      ...messageData,
      date: messageData.date.toISOString() // Convertir la date en chaîne pour JSON
    });
    
    // Limiter la taille de l'historique (garder les 100 derniers messages)
    if (history.length > 100) {
      history.shift(); // Retirer le plus ancien
    }
    
    // Sauvegarder
    localStorage.setItem('messageHistory', JSON.stringify(history));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de l\'historique:', error);
    addLog(document, 'Erreur lors de la sauvegarde dans l\'historique des messages', 'error');
  }
}