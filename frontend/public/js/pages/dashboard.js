import { ProspectsAPI } from '../services/api-service.js';
import { ScraperAPI } from '../services/api-service.js';
import { onSocketEvent } from '../services/socket-service.js';
import { createStatCard, createStatusCard } from '../components/stat-card.js';

// Fonction pour charger le dashboard
export async function loadDashboard(container) {
  // Afficher un écran de chargement
  container.innerHTML = `
    <div class="flex justify-center items-center h-64">
      <div class="loading-spinner"></div>
    </div>
  `;
  
  try {
    // Récupérer les statistiques et le statut en parallèle
    const [statsResponse, statusResponse] = await Promise.all([
      ProspectsAPI.getStats(),
      ScraperAPI.getStatus()
    ]);
    
    const stats = statsResponse.stats;
    const status = statusResponse.status;
    
    // Construire l'interface du dashboard
    container.innerHTML = `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-gray-800">Tableau de bord</h1>
          <button id="refresh-stats" class="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 text-gray-700 flex items-center">
            <i class="fas fa-sync-alt mr-2"></i> Actualiser
          </button>
        </div>
        
        <!-- Statistiques -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          ${createStatCard('Total Prospects', stats.totalProspects, 'bg-blue-500', 'fa-users')}
          ${createStatCard('Scrapés aujourd\'hui', stats.todayProspects, 'bg-green-500', 'fa-calendar-day')}
          ${createStatCard('Quota journalier', `${stats.todayProspects}/${stats.dailyLimit}`, 'bg-purple-500', 'fa-chart-pie')}
          ${createStatusCard(status.status)}
        </div>
        
        <!-- Top Companies et Job Titles -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div class="bg-white rounded-lg shadow-md p-4">
            <h2 class="text-xl font-semibold mb-4">Top Entreprises</h2>
            <div id="top-companies">
              ${generateTopList(stats.topCompanies)}
            </div>
          </div>
          
          <div class="bg-white rounded-lg shadow-md p-4">
            <h2 class="text-xl font-semibold mb-4">Top Postes</h2>
            <div id="top-job-titles">
              ${generateTopList(stats.topJobTitles)}
            </div>
          </div>
        </div>
        
        <!-- Statut actuel -->
        <div class="bg-white rounded-lg shadow-md p-4 mb-6">
          <h2 class="text-xl font-semibold mb-4">Statut du scraper</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="border rounded-lg p-3">
              <h3 class="text-sm text-gray-500" id="session-label">Session</h3>
              <p class="font-mono text-sm truncate" id="session-value">${status.sessionId || 'Aucune session'}</p>
            </div>
            <div class="border rounded-lg p-3">
              <h3 class="text-sm text-gray-500" id="url-label">URL actuelle</h3>
              <p class="font-mono text-sm truncate" id="url-value">${status.listUrl || 'Aucune'}</p>
            </div>
            <div class="border rounded-lg p-3">
              <h3 class="text-sm text-gray-500" id="profiles-label">Profiles scrapés</h3>
              <p class="font-mono text-sm" id="profiles-value">${status.scrapedProfiles || '0'}</p>
            </div>
            <div class="border rounded-lg p-3">
              <h3 class="text-sm text-gray-500" id="position-label">Position actuelle</h3>
              <p class="font-mono text-sm" id="position-value">${status.lastScrapedPosition || '0'}</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Ajouter l'écouteur d'événement pour le bouton d'actualisation
    document.getElementById('refresh-stats').addEventListener('click', () => {
      loadDashboard(container);
    });
    
    // Écouter les mises à jour de statut via WebSocket
    setupStatusListeners(container);
    
  } catch (error) {
    container.innerHTML = `
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p class="font-bold">Erreur</p>
        <p>Impossible de charger les données du tableau de bord: ${error.message}</p>
        <button id="retry-dashboard" class="mt-3 bg-red-200 hover:bg-red-300 text-red-800 font-bold py-2 px-4 rounded">
          Réessayer
        </button>
      </div>
    `;
    
    document.getElementById('retry-dashboard').addEventListener('click', () => {
      loadDashboard(container);
    });
  }
}

/**
 * Génère une liste HTML pour les top items
 * @param {Array} items - Liste des éléments avec _id et count
 * @returns {string} - HTML pour la liste
 */
function generateTopList(items) {
  if (!items || items.length === 0) {
    return '<p class="text-gray-500">Aucune donnée disponible</p>';
  }
  
  // Trouver la valeur maximale pour calculer les pourcentages
  const maxCount = Math.max(...items.map(item => item.count));
  
  return `
    <ul class="space-y-3">
      ${items.map(item => {
        const percentage = Math.round((item.count / maxCount) * 100);
        return `
          <li>
            <div class="flex justify-between mb-1">
              <span class="text-sm font-medium text-gray-700 truncate">${item._id}</span>
              <span class="text-sm text-gray-500">${item.count}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div class="bg-blue-500 h-2 rounded-full" style="width: ${percentage}%"></div>
            </div>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

/**
 * Configure les écouteurs WebSocket pour les mises à jour de statut
 * @param {HTMLElement} container - Conteneur principal
 */
function setupStatusListeners(container) {
  onSocketEvent('status_update', (data) => {
    // Mettre à jour la carte de statut
    const statusCardElement = container.querySelector('.stat-card:nth-child(4)');
    if (statusCardElement) {
      statusCardElement.innerHTML = createStatusCard(data.status);
    }
    
    // Mettre à jour les informations de statut
    updateStatusInfo(container, data);
  });
  
  onSocketEvent('scraping_progress', (progress) => {
    // Mettre à jour la carte de statut
    const statusCardElement = container.querySelector('.stat-card:nth-child(4)');
    if (statusCardElement) {
      statusCardElement.innerHTML = createStatusCard(progress.status);
    }
    
    // Mettre à jour le nombre de profiles scrapés
    const scrapedProfilesElement = document.getElementById('profiles-value');
    if (scrapedProfilesElement) {
      scrapedProfilesElement.textContent = progress.scrapedProfiles || '0';
    }
    
    // Mettre à jour la position actuelle
    const positionElement = document.getElementById('position-value');
    if (positionElement) {
      positionElement.textContent = progress.currentPosition || '0';
    }
  });
}

/**
 * Met à jour les informations de statut dans le conteneur
 * @param {HTMLElement} container - Conteneur principal
 * @param {Object} status - Données de statut
 */
function updateStatusInfo(container, status) {
  // Mettre à jour la session
  const sessionElement = document.getElementById('session-value');
  if (sessionElement) {
    sessionElement.textContent = status.sessionId || 'Aucune session';
  }
  
  // Mettre à jour l'URL
  const urlElement = document.getElementById('url-value');
  if (urlElement) {
    urlElement.textContent = status.listUrl || 'Aucune';
  }
  
  // Mettre à jour les profils scrapés
  const scrapedProfilesElement = document.getElementById('profiles-value');
  if (scrapedProfilesElement) {
    scrapedProfilesElement.textContent = status.scrapedProfiles || '0';
  }
  
  // Mettre à jour la position actuelle
  const positionElement = document.getElementById('position-value');
  if (positionElement) {
    positionElement.textContent = status.lastScrapedPosition || '0';
  }
}