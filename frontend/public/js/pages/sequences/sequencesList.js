import { SequenceAPI } from '../../services/sequence-api-service.js';
import { showSequenceEditor } from '../sequences.js';
import { addLog } from '../../components/logs.js';

/**
 * Affiche la liste des séquences
 * @param {HTMLElement} container - Conteneur pour la liste des séquences
 */
export async function renderSequencesList(container) {
  try {
    // Afficher un spinner de chargement
    container.innerHTML = `
      <div class="loading-spinner flex justify-center py-10 col-span-2">
        <i class="fas fa-spinner fa-spin fa-2x text-blue-500"></i>
      </div>
    `;
    
    // Récupérer les séquences
    const response = await SequenceAPI.getAllSequences();
    
    // Vérifier si la requête a réussi
    if (!response.success) {
      throw new Error(response.message || 'Erreur lors de la récupération des séquences');
    }
    
    // Si aucune séquence n'est trouvée
    if (!response.data || response.data.length === 0) {
      container.innerHTML = `
        <div class="empty-state text-center py-8 text-gray-500 col-span-2">
          <i class="fas fa-list-alt text-4xl mb-3"></i>
          <p>Aucune séquence trouvée</p>
          <button id="create-first-sequence" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
            <i class="fas fa-plus mr-2"></i> Créer votre première séquence
          </button>
        </div>
      `;
      
      // Ajouter un écouteur pour le bouton de création
      const createFirstBtn = container.querySelector('#create-first-sequence');
      if (createFirstBtn) {
        createFirstBtn.addEventListener('click', () => {
          // Activer l'onglet de création de séquence
          document.querySelector('#tab-create-sequence')?.click();
        });
      }
      
      return;
    }
    
    // Récupérer le template de carte de séquence
    const templateElement = document.getElementById('sequence-card-template');
    
    // Si le template n'existe pas, créons-le
    if (!templateElement) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = `
        <template id="sequence-card-template">
          <div class="sequence-card bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="text-lg font-semibold sequence-name">Nom de la séquence</h3>
                <p class="text-sm text-gray-500 sequence-description">Description de la séquence</p>
              </div>
              <span class="sequence-status px-2 py-1 text-xs rounded-full">Brouillon</span>
            </div>
            
            <div class="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div class="text-center bg-gray-50 rounded p-2">
                <span class="sequence-message-count text-xl font-semibold">0</span>
                <div class="text-xs text-gray-500">Messages</div>
              </div>
              <div class="text-center bg-gray-50 rounded p-2">
                <span class="sequence-prospects-count text-xl font-semibold">0</span>
                <div class="text-xs text-gray-500">Prospects</div>
              </div>
              <div class="text-center bg-gray-50 rounded p-2">
                <span class="sequence-sent-count text-xl font-semibold">0</span>
                <div class="text-xs text-gray-500">Envoyés</div>
              </div>
            </div>
            
            <div class="mt-4 flex justify-between items-center">
              <div class="text-gray-500 text-xs">
                <i class="far fa-calendar-alt"></i> <span class="sequence-date">01/01/2023</span>
              </div>
              <div class="sequence-actions flex space-x-2">
                <button class="btn-edit px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200" title="Modifier">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn-play px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Activer">
                  <i class="fas fa-play"></i>
                </button>
                <button class="btn-pause hidden px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200" title="Mettre en pause">
                  <i class="fas fa-pause"></i>
                </button>
                <button class="btn-delete px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Supprimer">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </template>
      `;
      document.body.appendChild(tempDiv.firstElementChild);
    }
    
    // Vider le conteneur
    container.innerHTML = '';
    
    // Récupérer le template
    const template = document.getElementById('sequence-card-template');
    
    // Pour chaque séquence, créer une carte
    response.data.forEach(sequence => {
      // Cloner le template
      const card = document.importNode(template.content, true).firstElementChild;
      
      // Configurer les attributs de données
      card.dataset.id = sequence._id;
      
      // Remplir les données
      card.querySelector('.sequence-name').textContent = sequence.name;
      card.querySelector('.sequence-description').textContent = sequence.description || 'Aucune description';
      
      // Configurer le statut
      const statusElement = card.querySelector('.sequence-status');
      statusElement.textContent = getStatusText(sequence.status);
      statusElement.className = `sequence-status px-2 py-1 text-xs rounded-full ${getStatusClass(sequence.status)}`;
      
      // Remplir les compteurs
      card.querySelector('.sequence-message-count').textContent = sequence.messageTotalCount || 0;
      
      card.querySelector('.sequence-prospects-count').textContent = sequence.stats.totalProspects || 0;
      card.querySelector('.sequence-sent-count').textContent = sequence.stats.sentCount || 0;
      
      // Configurer la date
      card.querySelector('.sequence-date').textContent = formatDate(sequence.createdAt);
      
      // Configurer les boutons d'actions selon le statut
      const btnPlay = card.querySelector('.btn-play');
      const btnPause = card.querySelector('.btn-pause');
      
      if (sequence.status === 'active') {
        btnPlay.classList.add('hidden');
        btnPause.classList.remove('hidden');
      } else {
        btnPlay.classList.remove('hidden');
        btnPause.classList.add('hidden');
      }
      
      // Ajouter les écouteurs d'événements
      attachCardEventListeners(card, sequence);
      
      // Ajouter la carte au conteneur
      container.appendChild(card);
    });
    
    addLog(document, `${response.data.length} séquences chargées`);
  } catch (error) {
    container.innerHTML = `
      <div class="error-state bg-red-100 text-red-700 p-4 rounded col-span-2">
        <p class="font-bold">Erreur</p>
        <p>${error.message}</p>
        <button id="retry-load-sequences" class="mt-2 bg-red-200 hover:bg-red-300 text-red-800 px-4 py-2 rounded">
          <i class="fas fa-sync-alt mr-2"></i> Réessayer
        </button>
      </div>
    `;
    
    const retryBtn = container.querySelector('#retry-load-sequences');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        renderSequencesList(container);
      });
    }
    
    addLog(document, `Erreur: ${error.message}`, 'error');
  }
}

/**
 * Attache les écouteurs d'événements à une carte de séquence
 * @param {HTMLElement} card - Carte de séquence
 * @param {Object} sequence - Données de la séquence
 */
function attachCardEventListeners(card, sequence) {
  // Bouton d'édition
  const btnEdit = card.querySelector('.btn-edit');
  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      // Rediriger vers l'éditeur de séquence
      showSequenceEditor(document, sequence._id);
    });
  }
  
  // Bouton d'activation
  const btnPlay = card.querySelector('.btn-play');
  if (btnPlay) {
    btnPlay.addEventListener('click', async () => {
      try {
        // Activer la séquence
        const response = await SequenceAPI.activateSequence(sequence._id);
        
        if (response.success) {
          addLog(document, `Séquence "${sequence.name}" activée avec succès`, 'success');
          
          // Mettre à jour l'interface
          btnPlay.classList.add('hidden');
          card.querySelector('.btn-pause').classList.remove('hidden');
          
          // Mettre à jour le statut
          const statusElement = card.querySelector('.sequence-status');
          statusElement.textContent = 'Active';
          statusElement.className = `sequence-status px-2 py-1 text-xs rounded-full bg-green-100 text-green-800`;
        } else {
          addLog(document, `Erreur lors de l'activation: ${response.message}`, 'error');
        }
      } catch (error) {
        addLog(document, `Erreur: ${error.message}`, 'error');
      }
    });
  }
  
  // Bouton de pause
  const btnPause = card.querySelector('.btn-pause');
  if (btnPause) {
    btnPause.addEventListener('click', async () => {
      try {
        // Mettre en pause la séquence
        const response = await SequenceAPI.pauseSequence(sequence._id);
        
        if (response.success) {
          addLog(document, `Séquence "${sequence.name}" mise en pause`, 'success');
          
          // Mettre à jour l'interface
          btnPause.classList.add('hidden');
          card.querySelector('.btn-play').classList.remove('hidden');
          
          // Mettre à jour le statut
          const statusElement = card.querySelector('.sequence-status');
          statusElement.textContent = 'En pause';
          statusElement.className = `sequence-status px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800`;
        } else {
          addLog(document, `Erreur lors de la mise en pause: ${response.message}`, 'error');
        }
      } catch (error) {
        addLog(document, `Erreur: ${error.message}`, 'error');
      }
    });
  }
  
  // Bouton de suppression
  const btnDelete = card.querySelector('.btn-delete');
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      // Demander confirmation
      if (!confirm(`Êtes-vous sûr de vouloir supprimer la séquence "${sequence.name}" ?`)) {
        return;
      }
      
      try {
        // Supprimer la séquence
        const response = await SequenceAPI.deleteSequence(sequence._id);
        
        if (response.success) {
          addLog(document, `Séquence "${sequence.name}" supprimée`, 'success');
          
          // Supprimer la carte de l'interface
          card.remove();
          
          // Si c'était la dernière séquence, afficher l'état vide
          const container = document.querySelector('#sequences-container');
          if (container && container.children.length === 0) {
            renderSequencesList(container);
          }
        } else {
          addLog(document, `Erreur lors de la suppression: ${response.message}`, 'error');
        }
      } catch (error) {
        addLog(document, `Erreur: ${error.message}`, 'error');
      }
    });
  }
}

/**
 * Retourne le texte correspondant au statut d'une séquence
 * @param {string} status - Statut de la séquence
 * @returns {string} Texte du statut
 */
function getStatusText(status) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'paused':
      return 'En pause';
    case 'completed':
      return 'Terminée';
    case 'draft':
    default:
      return 'Brouillon';
  }
}

/**
 * Retourne la classe CSS correspondant au statut d'une séquence
 * @param {string} status - Statut de la séquence
 * @returns {string} Classe CSS
 */
function getStatusClass(status) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    case 'draft':
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Formate une date pour l'affichage
 * @param {string} dateString - Date au format ISO
 * @returns {string} Date formatée
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  
  // Vérifier si la date est valide
  if (isNaN(date.getTime())) {
    return 'Date inconnue';
  }
  
  // Formater la date
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}