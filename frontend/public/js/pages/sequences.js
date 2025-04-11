import { renderSequencesList } from './sequences/sequencesList.js';
import { renderSequenceForm } from './sequences/sequenceForm.js';
import { renderSequenceEditor } from './sequences/sequenceEditor.js';
import { renderSimpleMessage } from './sequences/simpleMessage.js';
import { addLog, clearLogs, attachLogsListeners } from '../components/logs.js';

/**
 * Charge la page des séquences
 * @param {HTMLElement} container - Conteneur pour le contenu
 */
export async function loadSequencesPage(container) {
  try {
    // Initialiser la structure de base de la page
    container.innerHTML = `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-gray-800">Séquences de Messages</h1>
          <div id="messaging-status" class="hidden">
            <span class="status-indicator status-idle"></span>
            <span class="status-text mr-2">Inactif</span>
          </div>
        </div>
        
        <!-- Tabs -->
        <div class="mb-6">
          <div class="border-b border-gray-200">
            <nav class="flex -mb-px">
              <button 
                id="tab-sequences-list" 
                class="tab-button active" 
                data-target="sequences-list-panel">
                <i class="fas fa-list-ul mr-2"></i> Mes séquences
              </button>
              <button 
                id="tab-create-sequence" 
                class="tab-button" 
                data-target="create-sequence-panel">
                <i class="fas fa-plus mr-2"></i> Nouvelle séquence
              </button>
              <button 
                id="tab-simple-message" 
                class="tab-button" 
                data-target="simple-message-panel">
                <i class="fas fa-paper-plane mr-2"></i> Message simple
              </button>
              <button 
                id="tab-logs" 
                class="tab-button" 
                data-target="logs-panel">
                <i class="fas fa-terminal mr-2"></i> Logs
              </button>
            </nav>
          </div>
        </div>
        
        <!-- Panels -->
        <div class="panels-container">
          <!-- Liste des séquences -->
          <div id="sequences-list-panel" class="panel active">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold">Mes séquences</h2>
              <button id="refresh-sequences" class="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                <i class="fas fa-sync-alt"></i>
              </button>
            </div>
            
            <div id="sequences-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="loading-spinner flex justify-center py-10">
                <i class="fas fa-spinner fa-spin fa-2x text-blue-500"></i>
              </div>
            </div>
          </div>
          
          <!-- Création de séquence -->
          <div id="create-sequence-panel" class="panel hidden">
            <h2 class="text-xl font-semibold mb-4">Créer une nouvelle séquence</h2>
            <div id="sequence-form-container"></div>
          </div>
          
          <!-- Éditeur de séquence -->
          <div id="sequence-editor-panel" class="panel hidden">
            <div id="sequence-editor-container"></div>
          </div>
          
          <!-- Message simple -->
          <div id="simple-message-panel" class="panel hidden">
            <h2 class="text-xl font-semibold mb-4">Envoyer un message simple</h2>
            <div id="simple-message-container"></div>
          </div>
          
          <!-- Logs -->
          <div id="logs-panel" class="panel hidden">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-semibold">Logs et notifications</h2>
              <button id="clear-logs" class="text-sm text-gray-500 hover:text-gray-700">
                <i class="fas fa-trash mr-1"></i> Effacer
              </button>
            </div>
            <div id="logs-container" class="h-96 overflow-y-auto bg-gray-100 p-3 rounded font-mono text-sm">
              <div class="log-entry text-gray-600">
                <span class="text-gray-400">[${new Date().toLocaleTimeString()}]</span> Prêt à envoyer des messages LinkedIn
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Initialiser les composants
    const sequencesContainer = container.querySelector('#sequences-container');
    const sequenceFormContainer = container.querySelector('#sequence-form-container');
    const sequenceEditorContainer = container.querySelector('#sequence-editor-container');
    const simpleMessageContainer = container.querySelector('#simple-message-container');
    
    // Rendre les sous-composants dans leurs containers respectifs
    await renderSequencesList(sequencesContainer);
    renderSequenceForm(sequenceFormContainer);
    renderSimpleMessage(simpleMessageContainer);
    
    // Attacher les écouteurs d'événements pour les onglets
    attachTabListeners(container);
    
    // Attacher les écouteurs d'événements pour les logs
    attachLogsListeners(container);
    
    // Ajouter un log pour indiquer le chargement
    addLog(container, 'Page des séquences chargée avec succès');
    
  } catch (error) {
    container.innerHTML = `
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p class="font-bold">Erreur</p>
        <p>Impossible de charger la page des séquences: ${error.message}</p>
        <button id="retry-sequences" class="mt-3 bg-red-200 hover:bg-red-300 text-red-800 font-bold py-2 px-4 rounded">
          Réessayer
        </button>
      </div>
    `;
    
    document.getElementById('retry-sequences')?.addEventListener('click', () => {
      loadSequencesPage(container);
    });
  }
}

/**
 * Attache les écouteurs d'événements pour les onglets
 * @param {HTMLElement} container - Conteneur principal
 */
function attachTabListeners(container) {
  // Gestion des onglets
  const tabButtons = container.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Désactiver tous les onglets
      tabButtons.forEach(btn => btn.classList.remove('active'));
      
      // Cacher tous les panneaux
      const panels = container.querySelectorAll('.panel');
      panels.forEach(panel => panel.classList.add('hidden'));
      
      // Activer l'onglet cliqué
      button.classList.add('active');
      
      // Afficher le panneau correspondant
      const targetPanel = container.querySelector(`#${button.dataset.target}`);
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
      }
    });
  });
  
  // Bouton pour rafraîchir la liste des séquences
  const refreshSequencesBtn = container.querySelector('#refresh-sequences');
  if (refreshSequencesBtn) {
    refreshSequencesBtn.addEventListener('click', () => {
      const sequencesContainer = container.querySelector('#sequences-container');
      if (sequencesContainer) {
        renderSequencesList(sequencesContainer);
      }
    });
  }
}

/**
 * Affiche l'éditeur de séquence pour une séquence spécifique
 * @param {HTMLElement} container - Conteneur principal
 * @param {string} sequenceId - ID de la séquence à éditer
 */
export function showSequenceEditor(container, sequenceId) {
  // Activer l'onglet éditeur
  const tabButtons = container.querySelectorAll('.tab-button');
  tabButtons.forEach(btn => btn.classList.remove('active'));
  
  // Cacher tous les panneaux
  const panels = container.querySelectorAll('.panel');
  panels.forEach(panel => panel.classList.add('hidden'));
  
  // Afficher le panneau d'édition
  const editorPanel = container.querySelector('#sequence-editor-panel');
  if (editorPanel) {
    editorPanel.classList.remove('hidden');
    
    // Rendre l'éditeur avec la séquence spécifiée
    const editorContainer = container.querySelector('#sequence-editor-container');
    renderSequenceEditor(editorContainer, sequenceId);
  }
}

/**
 * Met à jour le statut du service de messagerie dans l'interface
 * @param {HTMLElement} container - Conteneur principal
 * @param {string} status - Statut (idle, ready, sending, error)
 */
export function updateMessagingStatus(container, status) {
  const statusContainer = container.querySelector('#messaging-status');
  const statusIndicator = statusContainer?.querySelector('.status-indicator');
  const statusText = statusContainer?.querySelector('.status-text');
  
  if (!statusContainer || !statusIndicator || !statusText) return;
  
  statusContainer.classList.remove('hidden');
  
  // Mettre à jour l'indicateur
  statusIndicator.className = 'status-indicator';
  
  switch (status) {
    case 'idle':
      statusIndicator.classList.add('status-idle');
      statusText.textContent = 'Inactif';
      break;
    case 'ready':
      statusIndicator.classList.add('status-completed');
      statusText.textContent = 'Prêt';
      break;
    case 'sending':
      statusIndicator.classList.add('status-running');
      statusText.textContent = 'Envoi en cours';
      break;
    case 'error':
      statusIndicator.classList.add('status-error');
      statusText.textContent = 'Erreur';
      break;
    default:
      statusIndicator.classList.add('status-idle');
      statusText.textContent = 'Inactif';
  }
}