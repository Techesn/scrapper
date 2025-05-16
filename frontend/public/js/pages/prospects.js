import { ProspectsAPI } from '../services/api-service.js';
import { ScraperAPI } from '../services/api-service.js';

// Variables pour la pagination et la gestion des sessions
let currentPage = 1;
let totalPages = 1;
let pageSize = 20;
let currentSort = 'scrapedAt';
let currentOrder = 'desc';
let currentSearch = '';
let currentSessionId = null;
let sessions = [];

/**
 * Charge la page des prospects
 * @param {HTMLElement} container - Conteneur principal
 */
export async function loadProspectsPage(container) {
  // Afficher un écran de chargement
  container.innerHTML = `
    <div class="flex justify-center items-center h-64">
      <div class="loading-spinner"></div>
    </div>
  `;
  
  try {
    // Charger les sessions
    await loadSessions(container);
  } catch (error) {
    container.innerHTML = `
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p class="font-bold">Erreur</p>
        <p>Impossible de charger les sessions: ${error.message}</p>
        <button id="retry-sessions" class="mt-3 bg-red-200 hover:bg-red-300 text-red-800 font-bold py-2 px-4 rounded">
          Réessayer
        </button>
      </div>
    `;
    
    document.getElementById('retry-sessions').addEventListener('click', () => {
      loadProspectsPage(container);
    });
  }
}

/**
 * Charge les sessions
 * @param {HTMLElement} container - Conteneur principal
 */
async function loadSessions(container) {
  try {
    // Récupérer les sessions de scraping
    const sessionsResponse = await ScraperAPI.getSessions({
      page: 1,
      limit: 50,
      type: 'scraping'
    });

    // Stocker les sessions 
    sessions = sessionsResponse.data.sessions || [];

    // Construire l'interface avec les sessions
    container.innerHTML = `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-gray-800">Sessions de Scraping</h1>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="sessions-container">
          ${renderSessionsList(sessions)}
        </div>

        <div id="prospects-section" class="mt-6" style="display:none;">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-gray-800" id="current-session-title">Prospects</h2>
            <div class="flex space-x-2">
              <button id="export-csv" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center">
                <i class="fas fa-file-csv mr-2"></i> Exporter CSV
              </button>
              <button id="delete-session-btn" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center">
                <i class="fas fa-trash-alt mr-2"></i> Supprimer
              </button>
              <div class="relative">
                <input type="text" id="search-input" 
                  class="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Rechercher..."
                  value="${currentSearch}">
                <button id="search-btn" class="absolute right-2 top-2 text-gray-500 hover:text-gray-700">
                  <i class="fas fa-search"></i>
                </button>
              </div>
              <select id="page-size" class="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                <option value="10" ${pageSize === 10 ? 'selected' : ''}>10</option>
                <option value="20" ${pageSize === 20 ? 'selected' : ''}>20</option>
                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
              </select>
            </div>
          </div>
          
          <div class="overflow-x-auto bg-white rounded-lg shadow-md">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prénom</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entreprise</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Poste</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date d'extraction</th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody id="prospects-table-body" class="bg-white divide-y divide-gray-200">
                <!-- Prospects seront chargés ici -->
              </tbody>
            </table>
          </div>
          
          <div class="mt-6 flex items-center justify-between" id="pagination-container">
            <!-- Pagination sera chargée ici -->
          </div>
        </div>
      </div>
    `;

    // Attacher les écouteurs pour les sessions
    attachSessionListeners(container);
    
  } catch (error) {
    console.error('Erreur lors du chargement des sessions:', error);
    throw error;
  }
}

/**
 * Génère le HTML pour la liste des sessions
 * @param {Array} sessions - Liste des sessions
 * @returns {string} - HTML des sessions
 */
function renderSessionsList(sessions) {
  if (!sessions || sessions.length === 0) {
    return `
      <div class="col-span-full text-center text-gray-500">
        Aucune session de scraping trouvée
      </div>
    `;
  }

  return sessions.map(session => `
    <div class="session-card bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition cursor-pointer" 
         data-session-id="${session._id}">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold">${session.name}</h3>
        <span class="text-sm ${getStatusColor(session.status)}">${session.status}</span>
      </div>
      <div class="mt-2 text-sm text-gray-600">
        <p>Début: ${formatDate(session.startDate)}</p>
        <p>Prospects: ${session.scrapedProspectsCount || 0}/${session.totalProspectsCount || 0}</p>
      </div>
    </div>
  `).join('');
}

/**
 * Attache les écouteurs pour la liste des sessions
 * @param {HTMLElement} container - Conteneur principal
 */
function attachSessionListeners(container) {
  const sessionsContainer = container.querySelector('#sessions-container');
  const prospectsSection = container.querySelector('#prospects-section');
  const prospectsTableBody = container.querySelector('#prospects-table-body');
  const paginationContainer = container.querySelector('#pagination-container');
  const currentSessionTitle = container.querySelector('#current-session-title');

  sessionsContainer.querySelectorAll('.session-card').forEach(card => {
    card.addEventListener('click', async () => {
      // Réinitialiser l'état
      currentPage = 1;
      currentSearch = '';
      currentSessionId = card.dataset.sessionId;

      // Mettre à jour le titre de la section
      const session = sessions.find(s => s._id === currentSessionId);
      currentSessionTitle.textContent = `Prospects - ${session.name}`;

      // Afficher la section des prospects
      prospectsSection.style.display = 'block';

      // Charger les prospects de cette session
      await loadProspects(prospectsTableBody, paginationContainer);
    });
  });

  // Réattacher les écouteurs généraux
  attachProspectsEventListeners(container);
}

/**
 * Charge les prospects 
 * @param {HTMLElement} prospectsTableBody - Corps du tableau des prospects
 * @param {HTMLElement} paginationContainer - Conteneur de pagination
 */
async function loadProspects(prospectsTableBody, paginationContainer) {
  try {
    // Récupérer les prospects
    const response = await ProspectsAPI.getProspects(
      currentPage,
      pageSize,
      currentSort,
      currentOrder,
      currentSearch,
      currentSessionId
    );
    
    const { prospects, pagination } = response.data;
    
    // Mettre à jour les variables de pagination
    totalPages = pagination.pages;
    
    // Remplir le tableau des prospects
    prospectsTableBody.innerHTML = renderProspectsTableRows(prospects);
    
    // Mettre à jour la pagination
    paginationContainer.innerHTML = `
      <div class="text-sm text-gray-700">
        Affichage de <span class="font-medium">${(pagination.page - 1) * pagination.limit + 1}</span> à 
        <span class="font-medium">${Math.min(pagination.page * pagination.limit, pagination.total)}</span> sur 
        <span class="font-medium">${pagination.total}</span> prospects
      </div>
      <div class="flex space-x-1">
        ${renderPagination(pagination)}
      </div>
    `;
    
    // Ajouter les écouteurs pour les boutons de détails
    prospectsTableBody.querySelectorAll('.show-details-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const id = button.dataset.id;
        showProspectDetails(id);
      });
    });
    
    // Ajouter des écouteurs de pagination
    attachPaginationListeners(paginationContainer);
    
  } catch (error) {
    console.error('Erreur lors du chargement des prospects:', error);
    throw error;
  }
}

/**
 * Attache les écouteurs d'événements pour les prospects
 * @param {HTMLElement} container - Conteneur principal
 */
function attachProspectsEventListeners(container) {
  const exportButton = container.querySelector('#export-csv');
  const searchButton = container.querySelector('#search-btn');
  const searchInput = container.querySelector('#search-input');
  const pageSizeSelect = container.querySelector('#page-size');
  const prospectsTableBody = container.querySelector('#prospects-table-body');
  const paginationContainer = container.querySelector('#pagination-container');

  // Export CSV
  if (exportButton) {
    exportButton.addEventListener('click', async () => {
      try {
        await ProspectsAPI.exportCSV(currentSearch, currentSessionId);
      } catch (error) {
        console.error('Erreur lors de l\'exportation CSV:', error);
        alert('Erreur lors de l\'exportation des prospects.');
      }
    });
  }

  // Recherche
  if (searchButton && searchInput) {
    const performSearch = () => {
      const searchValue = searchInput.value.trim();
      if (searchValue !== currentSearch) {
        currentSearch = searchValue;
        currentPage = 1;
        loadProspects(prospectsTableBody, paginationContainer);
      }
    };
    
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        performSearch();
      }
    });
  }

  // Changement de taille de page
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => {
      const newPageSize = parseInt(pageSizeSelect.value, 10);
      if (newPageSize !== pageSize) {
        pageSize = newPageSize;
        currentPage = 1;
        loadProspects(prospectsTableBody, paginationContainer);
      }
    });
  }

  // Bouton Supprimer Session
  const deleteButton = container.querySelector('#delete-session-btn');
  if (deleteButton) {
    deleteButton.addEventListener('click', async () => {
      if (!currentSessionId) {
        alert('Aucune session sélectionnée.');
        return;
      }
      
      // Demander confirmation
      const confirmation = confirm(
        `Êtes-vous sûr de vouloir supprimer cette session et tous les prospects associés ?\n\nSession ID: ${currentSessionId}\n\nCette action est irréversible.`
      );
      
      if (!confirmation) {
        return; // L'utilisateur a annulé
      }
      
      try {
        // Appel API pour supprimer la session
        const response = await fetch(`/api/sessions/${currentSessionId}`, {
          method: 'DELETE',
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          alert(data.message || 'Session supprimée avec succès.');
          
          // Cacher la section des prospects
          const prospectsSection = container.querySelector('#prospects-section');
          if (prospectsSection) {
            prospectsSection.style.display = 'none';
          }
          
          // Optionnel : Recharger la liste des sessions pour la mettre à jour
          // await loadSessions(container); 
          
        } else {
          throw new Error(data.message || 'Erreur lors de la suppression de la session');
        }
      } catch (error) {
        console.error('Erreur lors de la suppression de la session:', error);
        alert(`Erreur lors de la suppression de la session: ${error.message}`);
      }
    });
  }
}

/**
 * Attache les écouteurs pour les boutons de pagination
 * @param {HTMLElement} paginationContainer - Conteneur de pagination
 */
function attachPaginationListeners(paginationContainer) {
  const pageButtons = paginationContainer.querySelectorAll('.page-btn');
  pageButtons.forEach(button => {
    if (!button.disabled) {
      button.addEventListener('click', () => {
        const page = parseInt(button.dataset.page, 10);
        if (page !== currentPage) {
          currentPage = page;
          const prospectsTableBody = document.querySelector('#prospects-table-body');
          loadProspects(prospectsTableBody, paginationContainer);
        }
      });
    }
  });
}

/**
 * Retourne la classe de couleur en fonction du statut
 * @param {string} status - Statut de la session
 * @returns {string} - Classe de couleur
 */
function getStatusColor(status) {
  switch(status) {
    case 'running': return 'text-green-600';
    case 'paused': return 'text-yellow-600';
    case 'completed': return 'text-blue-600';
    case 'stopped': return 'text-red-600';
    case 'error': return 'text-red-600';
    default: return 'text-gray-600';
  }
}

/**
 * Génère le HTML pour les lignes du tableau de prospects
 * @param {Array} prospects - Liste des prospects
 * @returns {string} - HTML des lignes
 */
function renderProspectsTableRows(prospects) {
  if (!prospects || prospects.length === 0) {
    return `
      <tr>
        <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">
          Aucun prospect trouvé
        </td>
      </tr>
    `;
  }
  
  return prospects.map(prospect => `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        ${prospect.firstName || ''}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${prospect.lastName || ''}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${prospect.company || ''}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${prospect.jobTitle || ''}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        ${formatDate(prospect.scrapedAt)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <a href="${prospect.linkedinProfileUrl}" target="_blank" class="text-blue-600 hover:text-blue-900 mr-3" title="Voir le profil">
          <i class="fas fa-external-link-alt"></i>
        </a>
        <button class="show-details-btn text-green-600 hover:text-green-900" 
          data-id="${prospect._id}" title="Voir détails">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * Formate une date pour l'affichage
 * @param {string} dateString - Date au format ISO
 * @returns {string} - Date formatée
 */
function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Génère le HTML pour la pagination
 * @param {Object} pagination - Informations de pagination
 * @returns {string} - HTML des boutons de pagination
 */
function renderPagination(pagination) {
  const { page, pages } = pagination;
  
  if (pages <= 1) {
    return '';
  }
  
  let paginationHtml = '';
  
  // Bouton précédent
  paginationHtml += `
    <button class="page-btn ${page <= 1 ? 'opacity-50 cursor-not-allowed' : ''}"
      data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
      <i class="fas fa-chevron-left"></i>
    </button>
  `;
  
  // Pages
  const displayPages = getDisplayedPages(page, pages);
  
  displayPages.forEach(p => {
    if (p === '...') {
      paginationHtml += `<span class="px-3 py-1">...</span>`;
    } else {
      paginationHtml += `
        <button class="page-btn ${p === page ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'} 
          px-3 py-1 rounded-md" data-page="${p}">
          ${p}
        </button>
      `;
    }
  });
  
  // Bouton suivant
  paginationHtml += `
    <button class="page-btn ${page >= pages ? 'opacity-50 cursor-not-allowed' : ''}"
      data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>
      <i class="fas fa-chevron-right"></i>
    </button>
  `;
  
  return paginationHtml;
}

/**
 * Détermine les pages à afficher dans la pagination
 * @param {number} currentPage - Page actuelle
 * @param {number} totalPages - Nombre total de pages
 * @returns {Array} - Pages à afficher
 */
function getDisplayedPages(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  
  if (currentPage <= 3) {
    return [1, 2, 3, 4, '...', totalPages - 1, totalPages];
  }
  
  if (currentPage >= totalPages - 2) {
    return [1, 2, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  
  return [
    1,
    '...',
    currentPage - 1,
    currentPage,
    currentPage + 1,
    '...',
    totalPages
  ];
}

/**
 * Affiche les détails d'un prospect dans une modale
 * @param {string} prospectId - ID du prospect
 */
async function showProspectDetails(prospectId) {
  try {
    // Créer ou réutiliser la modale
    let modal = document.getElementById('prospect-details-modal');
    
    // Si la modale n'existe pas encore, la créer
    if (!modal) {
      const modalHTML = `
        <div id="prospect-details-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50" style="display: none;">
          <div class="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="p-4 border-b flex justify-between items-center">
              <h2 class="text-xl font-semibold" id="prospect-details-title">Détails du prospect</h2>
              <button id="close-prospect-details" class="text-gray-500 hover:text-gray-700">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="p-6" id="prospect-details-content">
              <div class="flex justify-center items-center h-32">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Ajouter directement au body
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      // Récupérer la modale après l'avoir ajoutée
      modal = document.getElementById('prospect-details-modal');
      
      // Ajouter l'écouteur d'événement pour le bouton de fermeture
      const closeButton = document.getElementById('close-prospect-details');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          modal.style.display = 'none';
        });
      }
    }
    
    // Afficher la modale
    modal.style.display = 'flex';
    
    // Récupérer les éléments de contenu de la modale
    const titleElement = document.getElementById('prospect-details-title');
    const contentElement = document.getElementById('prospect-details-content');
    
    // Afficher le chargement
    if (contentElement) {
      contentElement.innerHTML = `
        <div class="flex justify-center items-center h-32">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      `;
    }
    
    // Récupérer les données du prospect
    const prospectsResponse = await ProspectsAPI.getProspects(1, 999999);
    const prospects = prospectsResponse.data.prospects;
    const prospect = prospects.find(p => p._id === prospectId);
    
    if (!prospect) {
      if (contentElement) {
        contentElement.innerHTML = `
          <div class="bg-red-100 text-red-700 p-4 rounded">
            Prospect non trouvé.
          </div>
        `;
      }
      return;
    }
    
    // Mettre à jour le titre
    if (titleElement) {
      titleElement.textContent = `${prospect.firstName} ${prospect.lastName}`;
    }
    
    // Afficher les détails du prospect
    if (contentElement) {
      contentElement.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="text-lg font-semibold mb-4">Informations personnelles</h3>
            <p class="mb-2"><span class="font-medium">Prénom:</span> ${prospect.firstName || '-'}</p>
            <p class="mb-2"><span class="font-medium">Nom:</span> ${prospect.lastName || '-'}</p>
            <p class="mb-2">
              <span class="font-medium">LinkedIn:</span> 
              ${prospect.linkedinProfileUrl ? 
                `<a href="${prospect.linkedinProfileUrl}" target="_blank" class="text-blue-600 hover:underline">
                  ${prospect.linkedinProfileUrl}
                </a>` : '-'}
            </p>
            ${prospect.email ? 
              `<p class="mb-2"><span class="font-medium">Email:</span> ${prospect.email}</p>` : ''}
          </div>
          
          <div>
            <h3 class="text-lg font-semibold mb-4">Informations professionnelles</h3>
            <p class="mb-2"><span class="font-medium">Entreprise:</span> ${prospect.company || '-'}</p>
            <p class="mb-2"><span class="font-medium">Poste:</span> ${prospect.jobTitle || '-'}</p>
            <p class="mb-2"><span class="font-medium">Date d'extraction:</span> ${formatDate(prospect.scrapedAt)}</p>
          </div>
        </div>
        
        ${prospect.jobDescription ? `
          <div class="mt-6">
            <h3 class="text-lg font-semibold mb-2">Description du poste</h3>
            <div class="bg-gray-50 p-4 rounded">
              ${prospect.jobDescription.replace(/\n/g, '<br>')}
            </div>
          </div>
        ` : ''}
        
        <div class="mt-6 flex justify-end">
          ${prospect.linkedinProfileUrl ? 
            `<a href="${prospect.linkedinProfileUrl}" target="_blank" 
              class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              <i class="fab fa-linkedin mr-2"></i>Voir sur LinkedIn
            </a>` : ''}
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'affichage des détails du prospect:', error);
    
    // Afficher un message d'erreur
    const contentElement = document.getElementById('prospect-details-content');
    if (contentElement) {
      contentElement.innerHTML = `
        <div class="bg-red-100 text-red-700 p-4 rounded">
          Une erreur est survenue lors de la récupération des détails: ${error.message}
        </div>
      `;
    }
  }
}