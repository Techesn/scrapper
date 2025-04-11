import { ScraperAPI } from '../services/api-service.js';
import { onSocketEvent } from '../services/socket-service.js';
import { createProgressBar } from '../components/progress-bar.js';


function createSessionDetailsPanel(session) {
  return `
    <div class="border-l-4 ${getSessionBorderClass(session.status)} bg-white p-4 rounded shadow-sm">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 class="text-lg font-semibold mb-2">Informations générales</h3>
          <p class="text-sm mb-1"><span class="font-medium">ID:</span> ${session._id}</p>
          <p class="text-sm mb-1"><span class="font-medium">Type:</span> ${session.type}</p>
          <p class="text-sm mb-1"><span class="font-medium">Date de début:</span> ${new Date(session.startDate).toLocaleString()}</p>
          <p class="text-sm mb-1"><span class="font-medium">Date de fin:</span> ${session.endDate ? new Date(session.endDate).toLocaleString() : 'En cours'}</p>
        </div>
        <div>
          <h3 class="text-lg font-semibold mb-2">Statistiques</h3>
          <p class="text-sm mb-1"><span class="font-medium">Page actuelle:</span> ${session.currentPage || 1}</p>
          <p class="text-sm mb-1"><span class="font-medium">Dernier prospect:</span> ${session.lastProspectName || 'Aucun'}</p>
          <p class="text-sm mb-1"><span class="font-medium">Progression:</span> ${session.scrapedProspectsCount || 0}/${session.totalProspectsCount || '?'} (${calculateProgressPercentage(session)}%)</p>
        </div>
      </div>
      
      <div class="mt-4">
        <h3 class="text-lg font-semibold mb-2">URL source</h3>
        <div class="bg-gray-100 p-2 rounded text-sm break-all">
          <a href="${session.sourceUrl}" target="_blank" class="text-blue-600 hover:underline">${session.sourceUrl}</a>
        </div>
      </div>
    </div>
  `;
}
// Fonction pour charger la page des sessions
export async function loadSessionsPage(container) {
  try {
    // Obtenir le statut actuel du scraper et les sessions existantes
    const [statusResponse, sessionsResponse] = await Promise.all([
      ScraperAPI.getStatus(),
      ScraperAPI.getSessions() // Nouvelle méthode à ajouter à l'API
    ]);
    
    const status = statusResponse.status;
    const sessions = sessionsResponse.data?.sessions || [];
    
    // Construire l'interface des sessions
    container.innerHTML = `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-gray-800">Sessions de Scraping</h1>
          <div class="flex items-center">
            <span class="status-indicator ${getStatusIndicatorClass(status.status)}"></span>
            <span class="mr-2">${getStatusLabel(status.status)}</span>
          </div>
        </div>
        
        <!-- Formulaire de configuration pour nouvelle session -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 class="text-xl font-semibold mb-4">Nouvelle Session</h2>
          <form id="session-form" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="session-name" class="block text-sm font-medium text-gray-700 mb-1">
                  Nom de la session
                </label>
                <input type="text" id="session-name" name="session-name" 
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Leads Tech Paris - Mai 2025"
                  ${status.isRunning ? 'disabled' : ''}
                  required>
              </div>
              <div>
                <label for="list-url" class="block text-sm font-medium text-gray-700 mb-1">
                  URL de liste Sales Navigator
                </label>
                <input type="url" id="list-url" name="list-url" 
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://www.linkedin.com/sales/lists/people/..."
                  value="${status.listUrl || ''}"
                  ${status.isRunning || status.isPaused ? 'disabled' : ''}
                  required>
                <p class="mt-1 text-sm text-gray-500">
                  Collez l'URL complète d'une liste de prospects Sales Navigator.
                </p>
              </div>
            </div>
            
            <div class="flex flex-wrap gap-2">
              <button type="button" id="initialize-btn" 
                class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
                ${status.isRunning || status.isPaused ? 'disabled' : ''}>
                <i class="fas fa-cog mr-2"></i> Initialiser
              </button>
              
              <button type="submit" id="start-btn" 
                class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                ${status.isRunning || status.isPaused ? 'disabled' : ''}>
                <i class="fas fa-play mr-2"></i> Démarrer
              </button>
            </div>
          </form>
        </div>
        
        <!-- Liste des sessions existantes -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 class="text-xl font-semibold mb-4">Sessions existantes</h2>
          
          ${sessions.length === 0 ? `
            <div class="text-center py-8 text-gray-500">
              <i class="fas fa-folder-open text-4xl mb-3"></i>
              <p>Aucune session de scraping existante</p>
            </div>
          ` : `
            <div class="overflow-x-auto">
              <table class="min-w-full bg-white border">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="py-2 px-4 border-b text-left">Nom</th>
                    <th class="py-2 px-4 border-b text-left">Statut</th>
                    <th class="py-2 px-4 border-b text-left">Date</th>
                    <th class="py-2 px-4 border-b text-left">Progression</th>
                    <th class="py-2 px-4 border-b text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${sessions.map(session => `
                    <tr class="hover:bg-gray-50 ${session.status === 'running' ? 'bg-blue-50' : ''}">
                      <td class="py-2 px-4 border-b">
                        <div class="font-medium">${session.name}</div>
                        <div class="text-xs text-gray-500 truncate" title="${session.sourceUrl}">${truncateText(session.sourceUrl || '', 40)}</div>
                      </td>
                      <td class="py-2 px-4 border-b">
                        <span class="px-2 py-1 rounded text-xs ${getStatusBadgeClass(session.status)}">
                          ${getSessionStatusLabel(session.status)}
                        </span>
                      </td>
                      <td class="py-2 px-4 border-b">
                        <div>${new Date(session.startDate).toLocaleDateString()}</div>
                        <div class="text-xs text-gray-500">${new Date(session.startDate).toLocaleTimeString()}</div>
                      </td>
                      <td class="py-2 px-4 border-b">
                        <div class="w-full bg-gray-200 rounded-full h-2.5">
                          <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${calculateProgressPercentage(session)}%"></div>
                        </div>
                        <div class="text-xs text-gray-500 mt-1">
                          ${session.scrapedProspectsCount || 0} / ${session.totalProspectsCount || '?'} prospects
                        </div>
                      </td>
                      <td class="py-2 px-4 border-b">
                        <div class="flex space-x-2">
                          ${getSessionActionButtons(session, status)}
                        </div>
                      </td>
                    </tr>
                    <!-- Zone dépliable pour les détails, initialement masquée -->
                    <tr id="session-details-${session._id}" class="bg-gray-50 hidden">
                      <td colspan="5" class="py-4 px-6 border-b">
                        <div class="session-details-panel">
                          ${createSessionDetailsPanel(session)}
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
        
        <!-- Session active (si présente) -->
        <!-- Pas de panneau de session active -->
        
        <!-- Logs et notifications -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold">Logs et notifications</h2>
            <button id="clear-logs" class="text-sm text-gray-500 hover:text-gray-700">
              <i class="fas fa-trash mr-1"></i> Effacer
            </button>
          </div>
          <div id="logs-container" class="h-48 overflow-y-auto bg-gray-100 p-3 rounded font-mono text-sm">
            <div class="log-entry text-gray-600">
              <span class="text-gray-400">[${new Date().toLocaleTimeString()}]</span> Prêt à démarrer une session de scraping
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Ajouter les écouteurs d'événements
    attachEventListeners(container, status, sessions);
    
    // Configurer les écouteurs WebSocket
    setupWebSocketListeners(container);
    
  } catch (error) {
    container.innerHTML = `
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p class="font-bold">Erreur</p>
        <p>Impossible de charger la page des sessions: ${error.message}</p>
        <button id="retry-sessions" class="mt-3 bg-red-200 hover:bg-red-300 text-red-800 font-bold py-2 px-4 rounded">
          Réessayer
        </button>
      </div>
    `;
    
    document.getElementById('retry-sessions').addEventListener('click', () => {
      loadSessionsPage(container);
    });
  }
}

/**
 * Tronque un texte s'il est trop long
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string} - Texte tronqué
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Calcule le pourcentage de progression d'une session
 * @param {Object} session - Session
 * @returns {number} - Pourcentage (0-100)
 */
function calculateProgressPercentage(session) {
  if (!session.totalProspectsCount || session.totalProspectsCount === 0) return 0;
  const percentage = (session.scrapedProspectsCount / session.totalProspectsCount) * 100;
  return Math.min(Math.max(0, percentage), 100); // Limiter entre 0 et 100
}

/**
 * Génère les boutons d'actions pour une session
 * @param {Object} session - Données de la session
 * @param {Object} status - Statut actuel du système
 * @returns {string} - HTML des boutons
 */
function getSessionActionButtons(session, status) {
  // Vérifier s'il y a une session en cours d'exécution (running), pas en pause
  const isRunningSession = status.isRunning;
  
  // Définir quand les boutons doivent être désactivés
  const disableButtons = isRunningSession && session.status !== 'running';
  
  let buttons = '';
  
  // Bouton Détails (toujours disponible) - remplacer par un bouton qui affiche/masque les détails
  buttons += `
    <button data-session-id="${session._id}" class="session-toggle-details-btn px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
      <i class="fas fa-info-circle"></i>
    </button>
  `;
  
  // Boutons en fonction du statut de la session
  switch (session.status) {
    case 'running':
      buttons += `
        <button data-session-id="${session._id}" class="session-pause-btn px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600">
          <i class="fas fa-pause"></i>
        </button>
        <button data-session-id="${session._id}" class="session-stop-btn px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">
          <i class="fas fa-stop"></i>
        </button>
      `;
      break;
    case 'paused':
      buttons += `
        <button data-session-id="${session._id}" class="session-resume-btn px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 ${disableButtons ? 'opacity-50 cursor-not-allowed' : ''}">
          <i class="fas fa-play"></i>
        </button>
        <button data-session-id="${session._id}" class="session-stop-btn px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">
          <i class="fas fa-stop"></i>
        </button>
      `;
      break;
    default:
      // Pour les sessions terminées ou en erreur
      buttons += `
        <button data-session-id="${session._id}" class="session-restart-btn px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 ${isRunningSession ? 'opacity-50 cursor-not-allowed' : ''}">
          <i class="fas fa-redo"></i>
        </button>
      `;
  }
  
  return buttons;
}

/**
 * Obtient la classe CSS pour le badge de statut de session
 * @param {string} status - Statut de la session
 * @returns {string} - Classe CSS
 */
function getStatusBadgeClass(status) {
  switch (status) {
    case 'running': return 'bg-blue-100 text-blue-800';
    case 'paused': return 'bg-yellow-100 text-yellow-800';
    case 'error': return 'bg-red-100 text-red-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'stopped': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Obtient la classe CSS pour la bordure de la session active
 * @param {string} status - Statut de la session
 * @returns {string} - Classe CSS
 */
function getSessionBorderClass(status) {
  switch (status) {
    case 'running': return 'border-blue-500';
    case 'paused': return 'border-yellow-500';
    case 'error': return 'border-red-500';
    case 'completed': return 'border-green-500';
    case 'stopped': return 'border-gray-500';
    default: return 'border-gray-300';
  }
}

/**
 * Obtient le libellé du statut de session
 * @param {string} status - Statut de la session
 * @returns {string} - Libellé
 */
function getSessionStatusLabel(status) {
  switch (status) {
    case 'running': return 'En cours';
    case 'paused': return 'En pause';
    case 'error': return 'Erreur';
    case 'completed': return 'Terminée';
    case 'stopped': return 'Arrêtée';
    case 'initializing': return 'Initialisation';
    default: return 'Inconnue';
  }
}

/**
 * Crée le panneau d'information pour la session active
 * @param {Object} status - Statut du système
 * @returns {string} - HTML du panneau
 */
function createActiveSessionPanel(status) {
  const session = status.session;
  if (!session) return '';
  
  return `
    <div class="bg-white rounded-lg shadow-md p-6 mb-6 border-l-4 ${getSessionBorderClass(session.status)}">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Session active: ${session.name}</h2>
        <span class="px-2 py-1 rounded ${getStatusBadgeClass(session.status)}">
          ${getSessionStatusLabel(session.status)}
        </span>
      </div>
      
      <div class="mb-4">
        <p class="text-sm text-gray-600 mb-2">
          <i class="fas fa-link mr-1"></i> 
          <a href="${session.sourceUrl}" target="_blank" class="text-blue-600 hover:underline">
            ${truncateText(session.sourceUrl, 60)}
          </a>
        </p>
        <p class="text-sm text-gray-600">
          <i class="far fa-calendar-alt mr-1"></i> Démarré le ${new Date(session.startDate).toLocaleString()}
        </p>
      </div>
      
      <div id="active-progress-container" class="mb-4">
        ${createProgressBar(
          session.scrapedProspectsCount || 0, 
          session.totalProspectsCount || 100, 
          session.status
        )}
        <div class="flex justify-between text-sm text-gray-600 mt-1">
          <span>${session.scrapedProspectsCount || 0} prospects extraits</span>
          <span>${session.totalProspectsCount || '?'} au total</span>
        </div>
      </div>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div class="border rounded-lg p-3">
          <h3 class="text-sm text-gray-500">Page actuelle</h3>
          <p id="current-page" class="text-lg font-semibold">${session.currentPage || 1}</p>
        </div>
        <div class="border rounded-lg p-3">
          <h3 class="text-sm text-gray-500">Dernier prospect</h3>
          <p id="last-prospect" class="text-lg font-semibold truncate" title="${session.lastProspectName || 'Aucun'}">${session.lastProspectName || 'Aucun'}</p>
        </div>
        <div class="border rounded-lg p-3">
          <h3 class="text-sm text-gray-500">Taux d'extraction</h3>
          <p id="scraping-rate" class="text-lg font-semibold">
            ${calculateProgressPercentage(session)}%
          </p>
        </div>
        <div class="border rounded-lg p-3">
          <h3 class="text-sm text-gray-500">Quota journalier</h3>
          <p id="daily-quota" class="text-lg font-semibold">${status.dailyQuota?.used || 0}/${status.dailyQuota?.limit || 0}</p>
        </div>
      </div>
      
      <div class="flex flex-wrap gap-2">
        ${session.status === 'running' ? `
          <button id="active-pause-btn" class="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2">
            <i class="fas fa-pause mr-2"></i> Pause
          </button>
        ` : ''}
        
        ${session.status === 'paused' ? `
          <button id="active-resume-btn" class="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2">
            <i class="fas fa-play mr-2"></i> Reprendre
          </button>
        ` : ''}
        
        ${(session.status === 'running' || session.status === 'paused') ? `
          <button id="active-stop-btn" class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2">
            <i class="fas fa-stop mr-2"></i> Arrêter
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Obtient la classe CSS pour l'indicateur de statut
 * @param {string} status - Statut du scraper
 * @returns {string} - Classe CSS
 */
function getStatusIndicatorClass(status) {
  switch (status) {
    case 'running': return 'status-running';
    case 'paused': return 'status-paused';
    case 'error': return 'status-error';
    case 'completed': return 'status-completed';
    default: return 'status-idle';
  }
}

/**
 * Obtient le libellé du statut
 * @param {string} status - Statut du scraper
 * @returns {string} - Libellé
 */
function getStatusLabel(status) {
  switch (status) {
    case 'running': return 'En cours';
    case 'paused': return 'En pause';
    case 'error': return 'Erreur';
    case 'completed': return 'Terminé';
    case 'initializing': return 'Initialisation';
    default: return 'Inactif';
  }
}

/**
 * Attache les écouteurs d'événements aux boutons
 * @param {HTMLElement} container - Conteneur principal
 * @param {Object} status - Statut actuel du système
 * @param {Array} sessions - Liste des sessions
 */
function attachEventListeners(container, status, sessions) {
  // 1. Formulaire de création de session
  const sessionForm = container.querySelector('#session-form');
  if (sessionForm) {
    sessionForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const listUrl = container.querySelector('#list-url').value;
      const sessionName = container.querySelector('#session-name').value;
      
      if (!listUrl || !sessionName) return;
      
      try {
        // Désactiver le formulaire pendant la requête
        setFormDisabled(container, true);
        addLog(container, `Création de la session "${sessionName}"...`);
        
        // Envoyer la requête de création de session
        const response = await ScraperAPI.createSession({
          name: sessionName,
          type: 'scraping',
          sourceUrl: listUrl
        });
        
        addLog(container, `Session créée: ${response.data.name}`);
        
        // Démarrer la session
        const startResponse = await ScraperAPI.startSession(response.data._id);
        addLog(container, `Session démarrée: ${startResponse.message}`, 'success');
        
        // Rafraîchir la page après un court délai
        setTimeout(() => {
          loadSessionsPage(container);
        }, 1000);
        
      } catch (error) {
        addLog(container, `Erreur: ${error.message}`, 'error');
        setFormDisabled(container, false);
      }
    });
  }
  
  // 2. Bouton d'initialisation
  const initializeBtn = container.querySelector('#initialize-btn');
  if (initializeBtn) {
    initializeBtn.addEventListener('click', async () => {
      try {
        setFormDisabled(container, true);
        addLog(container, 'Initialisation du scraper...');
        
        const response = await ScraperAPI.initialize();
        
        addLog(container, `Initialisation: ${response.message}`);
        setFormDisabled(container, false);
      } catch (error) {
        addLog(container, `Erreur: ${error.message}`, 'error');
        setFormDisabled(container, false);
      }
    });
  }
  
  // 3. Boutons de la session active
  const activePauseBtn = container.querySelector('#active-pause-btn');
  if (activePauseBtn) {
    activePauseBtn.addEventListener('click', async () => {
      try {
        addLog(container, 'Mise en pause de la session active...');
        const response = await ScraperAPI.pauseSession(status.sessionObjectId);
        addLog(container, `Pause: ${response.message}`);
      } catch (error) {
        addLog(container, `Erreur: ${error.message}`, 'error');
      }
    });
  }
  
  const activeResumeBtn = container.querySelector('#active-resume-btn');
  if (activeResumeBtn) {
    activeResumeBtn.addEventListener('click', async () => {
      try {
        addLog(container, 'Reprise de la session active...');
        const response = await ScraperAPI.resumeSession(status.sessionObjectId);
        addLog(container, `Reprise: ${response.message}`);
      } catch (error) {
        addLog(container, `Erreur: ${error.message}`, 'error');
      }
    });
  }
  
  const activeStopBtn = container.querySelector('#active-stop-btn');
  if (activeStopBtn) {
    activeStopBtn.addEventListener('click', async () => {
      try {
        addLog(container, 'Arrêt de la session active...');
        const response = await ScraperAPI.stopSession(status.sessionObjectId);
        addLog(container, `Arrêt: ${response.message}`);
        
        // Rafraîchir la page après un court délai
        setTimeout(() => {
          loadSessionsPage(container);
        }, 1000);
        
      } catch (error) {
        addLog(container, `Erreur: ${error.message}`, 'error');
      }
    });
  }
  
  // 4. Boutons pour chaque session dans la liste
  const sessionPauseBtns = container.querySelectorAll('.session-pause-btn');
  sessionPauseBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const sessionId = btn.dataset.sessionId;
      if (!sessionId) return;
      
      try {
        const isDisabled = btn.classList.contains('opacity-50');
        if (isDisabled) {
          addLog(container, 'Impossible de mettre en pause cette session', 'warning');
          return;
        }
        
        // Désactiver temporairement le bouton
        btn.disabled = true;
        
        addLog(container, `Mise en pause de la session ${sessionId}...`);
        const response = await ScraperAPI.pauseSession(sessionId);
        addLog(container, `Pause: ${response.message}`);
        
        // Rafraîchir l'interface après la pause
        setTimeout(() => {
          loadSessionsPage(container);
        }, 1000);
      } catch (error) {
        addLog(container, `Erreur: ${error.message}`, 'error');
        // Réactiver le bouton en cas d'erreur
        btn.disabled = false;
      }
    });
  });
  
  const sessionResumeBtns = container.querySelectorAll('.session-resume-btn');
  sessionResumeBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const sessionId = btn.dataset.sessionId;
      if (!sessionId) return;
      
      try {
        const isDisabled = btn.classList.contains('opacity-50');
        if (isDisabled) {
          addLog(container, 'Impossible de reprendre cette session car une autre est déjà active', 'warning');
          return;
        }
        
        // Désactiver temporairement le bouton
        btn.disabled = true;
        
        addLog(container, `Reprise de la session ${sessionId}...`);
        const response = await ScraperAPI.resumeSession(sessionId);
        addLog(container, `Reprise: ${response.message}`);
        
        // Rafraîchir l'interface après la reprise
        setTimeout(() => {
          loadSessionsPage(container);
        }, 1000);
      } catch (error) {
        addLog(container, `Erreur: ${error.message}`, 'error');
        // Réactiver le bouton en cas d'erreur
        btn.disabled = false;
      }
    });
  });
  
  const sessionStopBtns = container.querySelectorAll('.session-stop-btn');
  sessionStopBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const sessionId = btn.dataset.sessionId;
      if (!sessionId) return;
      
      try {
        // Désactiver temporairement le bouton
        btn.disabled = true;
        
        addLog(container, `Arrêt de la session ${sessionId}...`);
        const response = await ScraperAPI.stopSession(sessionId);
        addLog(container, `Arrêt: ${response.message}`);
        
        // Rafraîchir l'interface après l'arrêt
        setTimeout(() => {
          loadSessionsPage(container);
        }, 1000);
      } catch (error) {
        addLog(container, `Erreur: ${error.message}`, 'error');
        // Réactiver le bouton en cas d'erreur
        btn.disabled = false;
      }
    });
  });


const sessionToggleDetailsBtns = container.querySelectorAll('.session-toggle-details-btn');
sessionToggleDetailsBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const sessionId = btn.dataset.sessionId;
    if (!sessionId) return;
    
    // Trouver la ligne de détails correspondante
    const detailsRow = container.querySelector(`#session-details-${sessionId}`);
    if (detailsRow) {
      // Basculer la visibilité
      detailsRow.classList.toggle('hidden');
      
      // Changer l'icône du bouton
      const icon = btn.querySelector('i');
      if (icon) {
        if (detailsRow.classList.contains('hidden')) {
          icon.className = 'fas fa-info-circle';
        } else {
          icon.className = 'fas fa-chevron-up';
        }
      }
    }
  });
});

  const sessionRestartBtns = container.querySelectorAll('.session-restart-btn');
  sessionRestartBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const sessionId = btn.dataset.sessionId;
      if (!sessionId) return;
      
      try {
        const isDisabled = btn.classList.contains('opacity-50');
        if (isDisabled) {
          addLog(container, 'Impossible de redémarrer cette session car une autre est déjà active', 'warning');
          return;
        }
        
        const session = sessions.find(s => s._id === sessionId);
        if (!session) return;
        
        addLog(container, `Création d'une nouvelle session basée sur "${session.name}"...`);
        
        // Créer une nouvelle session avec les mêmes paramètres
        const newSessionResponse = await ScraperAPI.createSession({
          name: `${session.name} (reprise)`,
          type: 'scraping',
          sourceUrl: session.sourceUrl
        });
        
        addLog(container, `Session créée: ${newSessionResponse.data.name}`);
        
        // Démarrer la nouvelle session
        const startResponse = await ScraperAPI.startSession(newSessionResponse.data._id);
        addLog(container, `Session démarrée: ${startResponse.message}`, 'success');
        
        // Rafraîchir la page après un court délai
        setTimeout(() => {
          loadSessionsPage(container);
        }, 1000);
        
      } catch (error) {
        addLog(container, `Erreur: ${error.message}`, 'error');
      }
    });
  });
  
  // 5. Bouton de nettoyage des logs
  const clearLogsBtn = container.querySelector('#clear-logs');
  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
      const logsContainer = container.querySelector('#logs-container');
      if (logsContainer) {
        logsContainer.innerHTML = '';
        addLog(container, 'Logs effacés');
      }
    });
  }
}

/**
 * Configure les écouteurs WebSocket pour les mises à jour
 * @param {HTMLElement} container - Conteneur principal
 */
function setupWebSocketListeners(container) {
  // Écouter les mises à jour de statut
  onSocketEvent('status_update', (status) => {
    updateStatus(container, status);
  });
  
  // Écouter les mises à jour de progression
  onSocketEvent('scraping_progress', (progress) => {
    updateProgress(container, progress);
  });
  
  // Écouter les mises à jour de session
  onSocketEvent('session_update', (sessionData) => {
    updateSessionData(container, sessionData);
  });
}

/**
 * Active ou désactive les éléments du formulaire
 * @param {HTMLElement} container - Conteneur principal
 * @param {boolean} disabled - Doit-on désactiver les éléments
 */
function setFormDisabled(container, disabled) {
  // Champs du formulaire
  const nameInput = container.querySelector('#session-name');
  const urlInput = container.querySelector('#list-url');
  const initializeBtn = container.querySelector('#initialize-btn');
  const startBtn = container.querySelector('#start-btn');
  
  if (nameInput) nameInput.disabled = disabled;
  if (urlInput) urlInput.disabled = disabled;
  if (initializeBtn) initializeBtn.disabled = disabled;
  if (startBtn) startBtn.disabled = disabled;
}

/**
 * Ajoute une entrée dans les logs
 * @param {HTMLElement} container - Conteneur principal
 * @param {string} message - Message à ajouter
 * @param {string} type - Type de log (info, error, success, warning)
 */
function addLog(container, message, type = 'info') {
  const logsContainer = container.querySelector('#logs-container');
  if (!logsContainer) return;
  
  // Déterminer la classe de couleur
  let colorClass = 'text-gray-600';
  switch (type) {
    case 'error':
      colorClass = 'text-red-600';
      break;
    case 'success':
      colorClass = 'text-green-600';
      break;
    case 'warning':
      colorClass = 'text-yellow-600';
      break;
  }
  
  // Créer l'entrée de log
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${colorClass}`;
  logEntry.innerHTML = `
    <span class="text-gray-400">[${new Date().toLocaleTimeString()}]</span> ${message}
  `;
  
  // Ajouter au conteneur et scroll vers le bas
  logsContainer.appendChild(logEntry);
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

/**
 * Met à jour l'interface avec le nouveau statut
 * @param {HTMLElement} container - Conteneur principal
 * @param {Object} status - Nouveau statut
 */
function updateStatus(container, status) {
  console.log("Mise à jour du statut:", status); // Log pour déboguer
  
  // Mettre à jour l'indicateur de statut global
  const statusIndicator = container.querySelector('.status-indicator');
  if (statusIndicator) {
    statusIndicator.className = `status-indicator ${getStatusIndicatorClass(status.status)}`;
  }
  
  const statusLabel = statusIndicator?.nextElementSibling;
  if (statusLabel) {
    statusLabel.textContent = getStatusLabel(status.status);
  }
  
  // Si une session active est présente, mettre à jour son panneau
  if (status.sessionObjectId) {
    // Récupérer les données de session actualisées
    const sessionData = status.session || {};
    
    console.log("Session data:", sessionData); // Log pour déboguer
    
    // Créer un nouveau panneau HTML avec les données actualisées
    const updatedPanelHTML = createActiveSessionPanel(status);
    
    // Vérifier si le panneau existe déjà
    const activePanel = container.querySelector('[id^="active-progress-container"]');
    if (!activePanel && sessionData) {
      // S'il n'existe pas, ajouter le panneau après le tableau des sessions
      const sessionsTable = container.querySelector('.bg-white.rounded-lg.shadow-md.p-6.mb-6:nth-child(3)');
      if (sessionsTable) {
        const activePanelDiv = document.createElement('div');
        activePanelDiv.innerHTML = updatedPanelHTML;
        sessionsTable.insertAdjacentElement('afterend', activePanelDiv.firstElementChild);
      }
    } else if (activePanel && sessionData) {
      // S'il existe, remplacer tout le contenu par le nouveau HTML
      const activeSessionContainer = activePanel.closest('.bg-white.rounded-lg.shadow-md.p-6.mb-6');
      if (activeSessionContainer) {
        activeSessionContainer.outerHTML = updatedPanelHTML;
      }
    }
    
    // Important: réattacher les écouteurs d'événements après avoir mis à jour le HTML
    attachActiveSessionButtonListeners(container, status);
  } else {
    // Si aucune session active, retirer le panneau s'il existe
    const activePanel = container.querySelector('[id^="active-progress-container"]')?.closest('.bg-white.rounded-lg.shadow-md.p-6.mb-6');
    if (activePanel) {
      activePanel.remove();
    }
  }
  
  // Mettre à jour l'état du formulaire de création de session
  const formDisabled = status.isRunning || status.isPaused;
  setFormDisabled(container, formDisabled);
  
  // Ajouter un log
  addLog(container, `Statut global mis à jour: ${getStatusLabel(status.status)}`);
  
  // Rafraîchir complètement la page pour certains changements d'état importants
  if (status.status === 'completed' || status.status === 'error' || status.status === 'idle') {
    console.log("Rafraîchissement de la page programmé");
    setTimeout(() => {
      loadSessionsPage(container);
    }, 2000);
  }
}

/**
 * Ajoute les écouteurs d'événements aux boutons de la session active
 * @param {HTMLElement} container - Conteneur principal
 * @param {Object} status - Statut actuel du système
 */
function attachActiveSessionButtonListeners(container, status) {
  const activePauseBtn = container.querySelector('#active-pause-btn');
  if (activePauseBtn) {
    activePauseBtn.addEventListener('click', async () => {
      try {
        addLog(container, 'Mise en pause de la session active...');
        const response = await ScraperAPI.pauseSession(status.sessionObjectId);
        addLog(container, `Pause: ${response.message}`);
      } catch (error) {
        addLog(container, `Erreur: ${error.message}`, 'error');
      }
    });
  }
  
  const activeResumeBtn = container.querySelector('#active-resume-btn');
  if (activeResumeBtn) {
    activeResumeBtn.addEventListener('click', async () => {
      try {
        addLog(container, 'Reprise de la session active...');
        const response = await ScraperAPI.resumeSession(status.sessionObjectId);
        addLog(container, `Reprise: ${response.message}`);
      } catch (error) {
        addLog(container, `Erreur: ${error.message}`, 'error');
      }
    });
  }
  
  const activeStopBtn = container.querySelector('#active-stop-btn');
  if (activeStopBtn) {
    activeStopBtn.addEventListener('click', async () => {
      try {
        addLog(container, 'Arrêt de la session active...');
        const response = await ScraperAPI.stopSession(status.sessionObjectId);
        addLog(container, `Arrêt: ${response.message}`);
        
        // Rafraîchir la page après un court délai
        setTimeout(() => {
          loadSessionsPage(container);
        }, 1000);
      } catch (error) {
        addLog(container, `Erreur: ${error.message}`, 'error');
      }
    });
  }
}

/**
 * Met à jour l'interface avec la nouvelle progression
 * @param {HTMLElement} container - Conteneur principal
 * @param {Object} progress - Données de progression
 */
function updateProgress(container, progress) {
  // Mettre à jour la barre de progression de la session active
  const progressContainer = container.querySelector('#active-progress-container');
  if (progressContainer) {
    progressContainer.innerHTML = `
      ${createProgressBar(
        progress.scrapedProfiles || 0,
        progress.totalProspectsCount || 100,
        progress.status
      )}
      <div class="flex justify-between text-sm text-gray-600 mt-1">
        <span>${progress.scrapedProfiles || 0} prospects extraits</span>
        <span>${progress.totalProspectsCount || '?'} au total</span>
      </div>
    `;
  }
  
  // Mettre à jour les statistiques de la session active
  const currentPage = container.querySelector('#current-page');
  if (currentPage) {
    currentPage.textContent = progress.currentPage || 1;
  }
  
  const lastProspect = container.querySelector('#last-prospect');
  if (lastProspect) {
    lastProspect.textContent = progress.lastProspectName || 'Aucun';
    lastProspect.title = progress.lastProspectName || 'Aucun';
  }
  
  const scrapingRate = container.querySelector('#scraping-rate');
  if (scrapingRate && progress.totalProspectsCount) {
    const percentage = Math.round((progress.scrapedProfiles / progress.totalProspectsCount) * 100);
    scrapingRate.textContent = `${percentage}%`;
  }
  
  // Ajouter un log
  addLog(container, `Progression: ${progress.scrapedProfiles} prospects extraits (page ${progress.currentPage || 1})`);
}

/**
 * Met à jour les données d'une session spécifique
 * @param {HTMLElement} container - Conteneur principal
 * @param {Object} sessionData - Données de la session
 */
function updateSessionData(container, sessionData) {
  // Cette fonction serait appelée si vous avez un événement WebSocket spécifique pour les mises à jour de session
  // Pour l'instant, nous rafraîchissons simplement toute la page après certains événements
  
  // Ajouter un log
  addLog(container, `Mise à jour de la session ${sessionData._id}: ${sessionData.status}`, 'info');
  
  // Rafraîchir la page si nécessaire
  if (sessionData.status === 'completed' || sessionData.status === 'error' || sessionData.status === 'stopped') {
    setTimeout(() => {
      loadSessionsPage(container);
    }, 2000);
  }
}

