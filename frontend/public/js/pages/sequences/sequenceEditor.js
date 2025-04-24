import { SequenceAPI } from '../../services/sequence-api-service.js';
import { renderSequenceForm } from './sequenceForm.js';
import { addLog } from '../../components/logs.js';

/**
 * Affiche l'éditeur de séquence
 * @param {HTMLElement} container - Conteneur pour l'éditeur
 * @param {string} sequenceId - ID de la séquence à éditer
 */
export async function renderSequenceEditor(container, sequenceId) {
  try {
    // Afficher un spinner de chargement
    container.innerHTML = `
      <div class="loading-spinner flex justify-center py-10">
        <i class="fas fa-spinner fa-spin fa-2x text-blue-500"></i>
      </div>
    `;
    
    // Récupérer les détails de la séquence
    const response = await SequenceAPI.getSequenceById(sequenceId);
    
    if (!response.success) {
      throw new Error(response.message || 'Erreur lors de la récupération des détails de la séquence');
    }
    
    const { sequence, messages, stats } = response.data;
    
    // Construire l'interface d'édition
    container.innerHTML = `
      <div class="space-y-6">
        <!-- En-tête de l'éditeur -->
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-xl font-semibold">${sequence.name}</h2>
            <p class="text-sm text-gray-500">${sequence.description || 'Aucune description'}</p>
          </div>
          <div class="flex space-x-2">
            <button id="btn-edit-sequence" class="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200" title="Modifier les informations">
              <i class="fas fa-edit"></i>
            </button>
            ${sequence.status === 'active' 
              ? `<button id="btn-pause-sequence" class="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200" title="Mettre en pause">
                  <i class="fas fa-pause"></i>
                </button>`
              : `<button id="btn-activate-sequence" class="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Activer">
                  <i class="fas fa-play"></i>
                </button>`
            }
            <button id="btn-back-to-list" class="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Retour à la liste">
              <i class="fas fa-arrow-left"></i>
            </button>
          </div>
        </div>
        
        <!-- Statistiques -->
        <div class="bg-white rounded-lg shadow-md p-4">
          <h3 class="text-lg font-semibold mb-3">Statistiques</h3>
          <div class="grid grid-cols-5 gap-4">
            <div class="text-center">
              <div class="text-2xl font-bold">${messages.length}</div>
              <div class="text-sm text-gray-500">Messages</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold">${stats.totalProspects || 0}</div>
              <div class="text-sm text-gray-500">Prospects</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold">${stats.statusCounts?.active || 0}</div>
              <div class="text-sm text-gray-500">Actifs</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold">${stats.statusCounts?.completed || 0}</div>
              <div class="text-sm text-gray-500">Terminés</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold ${getSequenceStatusColor(sequence.status)}">${getSequenceStatusText(sequence.status)}</div>
              <div class="text-sm text-gray-500">Statut</div>
            </div>
          </div>
        </div>
        
        <!-- Messages de la séquence -->
        <div class="bg-white rounded-lg shadow-md p-4">
          <div class="flex justify-between items-center mb-3">
            <h3 class="text-lg font-semibold">Messages de la séquence</h3>
            <button id="btn-add-message" class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
              <i class="fas fa-plus mr-1"></i> Ajouter un message
            </button>
          </div>
          
          <div id="sequence-messages-container">
            ${messages.length === 0 
              ? `<div class="text-center py-8 text-gray-500">
                  <i class="fas fa-envelope text-4xl mb-3"></i>
                  <p>Aucun message dans cette séquence</p>
                  <p class="text-sm">Ajoutez des messages pour commencer</p>
                </div>`
              : `<div class="space-y-4">
                  ${messages.map((message, index) => `
                    <div class="message-card bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500" data-id="${message._id}" data-position="${message.position}">
                      <div class="flex justify-between items-start">
                        <div class="flex-1">
                          <div class="flex items-center mb-2">
                            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-2">Message ${message.position}</span>
                            <span class="text-gray-500 text-sm">Délai: ${
                            message.delayHours < 1 
                              ? `${Math.round(message.delayHours * 60)} min` 
                              : `${message.delayHours}h`
                          }</span>
                          </div>
                          <div class="message-content text-gray-700 whitespace-pre-wrap">${message.content}</div>
                        </div>
                        <div class="flex space-x-1">
                          <button class="btn-edit-message px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200" title="Modifier">
                            <i class="fas fa-edit"></i>
                          </button>
                          <button class="btn-delete-message px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Supprimer">
                            <i class="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>`
            }
          </div>
        </div>
        
<!-- Prospects dans la séquence -->
<div class="bg-white rounded-lg shadow-md p-4">
  <div class="flex justify-between items-center mb-3">
    <h3 class="text-lg font-semibold">Prospects dans la séquence</h3>
    <button id="btn-add-prospects" class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
      <i class="fas fa-plus mr-1"></i> Ajouter des prospects
    </button>
  </div>
  
  <div id="prospects-container">
    ${(response.data.activeProspects.length === 0 && response.data.pendingProspects.length === 0)
      ? `<div class="text-center py-8 text-gray-500">
          <i class="fas fa-users text-4xl mb-3"></i>
          <p>Aucun prospect dans cette séquence</p>
          <p class="text-sm">Ajoutez des prospects pour commencer</p>
        </div>`
      : `<div class="space-y-4">
          ${[...response.data.activeProspects, ...response.data.pendingProspects].map(prospect => `
            <div class="prospect-card bg-gray-50 rounded-lg p-4 border-l-4 ${prospect.sequenceStatus.status === 'active' ? 'border-blue-500' : 'border-yellow-500'}" data-id="${prospect._id}">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="flex items-center mb-2">
                    <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-2">
                      ${prospect.firstName} ${prospect.lastName}
                    </span>
                    <span class="text-gray-500 text-sm">
                      ${prospect.company || 'N/A'} - ${prospect.jobTitle || 'N/A'}
                    </span>
                  </div>
                  <div class="flex space-x-2">
                    <span class="text-sm text-gray-600">
                      Étape : ${prospect.sequenceStatus.currentStep}
                    </span>
                    <span class="text-sm ${prospect.sequenceStatus.status === 'active' ? 'text-blue-600' : 'text-yellow-600'}">
                      Statut : ${getProspectStatusText(prospect.sequenceStatus.status)}
                    </span>
                    <span class="text-sm ${prospect.sequenceStatus.connectionStatus === 'connected' ? 'text-green-600' : 'text-orange-600'}">
                      Connexion : ${getConnectionStatusText(prospect.sequenceStatus.connectionStatus)}
                    </span>
                  </div>
                </div>
                <div class="flex space-x-1">
                  <button class="btn-remove-prospect px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200" title="Retirer">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>`
    }
  </div>
</div>
      
      <!-- Modals -->
      <div id="message-modal" class="modal hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="modal-content bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold modal-title">Ajouter un message</h3>
            <button class="modal-close text-gray-500 hover:text-gray-700">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <form id="message-form" class="space-y-4">
            <input type="hidden" id="message-id" value="">
            <div>
              <label for="message-position" class="block text-sm font-medium text-gray-700 mb-1">
                Position dans la séquence *
              </label>
              <select id="message-position" name="message-position" 
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required>
                <option value="">Sélectionnez la position...</option>
                ${[1, 2, 3, 4, 5].map(pos => `
                  <option value="${pos}" ${messages.some(m => m.position === pos) ? 'disabled' : ''}>
                    Message ${pos} ${messages.some(m => m.position === pos) ? '(déjà utilisé)' : ''}
                  </option>
                `).join('')}
              </select>
              <p class="mt-1 text-sm text-gray-500">
                La position détermine l'ordre des messages dans la séquence.
              </p>
            </div>
            
            <div>
              <label for="message-delay" class="block text-sm font-medium text-gray-700 mb-1">
                Délai avant envoi (heures) *
              </label>
              <input type="number" id="message-delay" name="message-delay" 
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                min="0.01" step="0.01" value="24" required>
              <p class="mt-1 text-sm text-gray-500">
                Temps d'attente avant d'envoyer ce message après le précédent.<br>
                <span class="text-blue-600">Pour les tests: utilisez 0.08 pour un délai de ~5 minutes.</span>
              </p>
            </div>
            
            <div>
              <label for="message-content" class="block text-sm font-medium text-gray-700 mb-1">
                Contenu du message *
              </label>
              <textarea id="message-content" name="message-content" rows="6"
                class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Saisissez votre message ici..."
                required></textarea>
              <p class="mt-1 text-sm text-gray-500">
                Le message sera envoyé tel quel au prospect.
              </p>
            </div>
            
            <div class="flex justify-end space-x-2">
              <button type="button" class="modal-close px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
                Annuler
              </button>
              <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                <i class="fas fa-save mr-2"></i> <span class="submit-text">Ajouter</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    // Attacher les écouteurs d'événements
    attachSequenceEditorListeners(container, sequenceId, sequence);
    
    addLog(document, `Éditeur de séquence "${sequence.name}" chargé`, 'info');
  } catch (error) {
    container.innerHTML = `
      <div class="error-state bg-red-100 text-red-700 p-4 rounded">
        <p class="font-bold">Erreur</p>
        <p>${error.message}</p>
        <button id="retry-load-editor" class="mt-2 bg-red-200 hover:bg-red-300 text-red-800 px-4 py-2 rounded">
          <i class="fas fa-sync-alt mr-2"></i> Réessayer
        </button>
        <button id="back-to-sequences" class="mt-2 ml-2 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded">
          <i class="fas fa-arrow-left mr-2"></i> Retour aux séquences
        </button>
      </div>
    `;
    
    const retryBtn = container.querySelector('#retry-load-editor');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        renderSequenceEditor(container, sequenceId);
      });
    }
    
    const backBtn = container.querySelector('#back-to-sequences');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        document.querySelector('#tab-sequences-list')?.click();
      });
    }
    
    addLog(document, `Erreur lors du chargement de l'éditeur: ${error.message}`, 'error');
  }
}

/**
 * Attache les écouteurs d'événements de l'éditeur de séquence
 * @param {HTMLElement} container - Conteneur de l'éditeur
 * @param {string} sequenceId - ID de la séquence
 * @param {Object} sequence - Données de la séquence
 */
function attachSequenceEditorListeners(container, sequenceId, sequence) {
  // Bouton d'édition de la séquence
  const btnEditSequence = container.querySelector('#btn-edit-sequence');
  if (btnEditSequence) {
    btnEditSequence.addEventListener('click', () => {
      // Remplacer le contenu par le formulaire d'édition
      const editorContainer = document.querySelector('#sequence-editor-container');
      if (editorContainer) {
        renderSequenceForm(editorContainer, sequence);
      }
    });
  }
  
  // Bouton d'activation de la séquence
  const btnActivateSequence = container.querySelector('#btn-activate-sequence');
  if (btnActivateSequence) {
    btnActivateSequence.addEventListener('click', async () => {
      try {
        // Vérifier que la séquence a au moins un message
        const messagesContainer = container.querySelector('#sequence-messages-container');
        if (messagesContainer && messagesContainer.querySelector('.message-card') === null) {
          alert('La séquence doit contenir au moins un message avant d\'être activée.');
          return;
        }
        
        // Activer la séquence
        const response = await SequenceAPI.activateSequence(sequenceId);
        
        if (response.success) {
          addLog(document, `Séquence "${sequence.name}" activée avec succès`, 'success');
          
          // Recharger l'éditeur pour mettre à jour l'interface
          renderSequenceEditor(container, sequenceId);
        } else {
          throw new Error(response.message || 'Erreur lors de l\'activation de la séquence');
        }
      } catch (error) {
        addLog(document, `Erreur: ${error.message}`, 'error');
      }
    });
  }
  
  // Bouton de mise en pause de la séquence
  const btnPauseSequence = container.querySelector('#btn-pause-sequence');
  if (btnPauseSequence) {
    btnPauseSequence.addEventListener('click', async () => {
      try {
        // Mettre en pause la séquence
        const response = await SequenceAPI.pauseSequence(sequenceId);
        
        if (response.success) {
          addLog(document, `Séquence "${sequence.name}" mise en pause`, 'success');
          
          // Recharger l'éditeur pour mettre à jour l'interface
          renderSequenceEditor(container, sequenceId);
        } else {
          throw new Error(response.message || 'Erreur lors de la mise en pause de la séquence');
        }
      } catch (error) {
        addLog(document, `Erreur: ${error.message}`, 'error');
      }
    });
  }
  
  // Bouton de retour à la liste
  const btnBackToList = container.querySelector('#btn-back-to-list');
  if (btnBackToList) {
    btnBackToList.addEventListener('click', () => {
      document.querySelector('#tab-sequences-list')?.click();
    });
  }
  
  // Gestion du modal d'ajout/édition de message
  const messageModal = container.querySelector('#message-modal');
  const openMessageModal = (messageData = null) => {
    if (!messageModal) return;
    
    const isEditing = !!messageData;
    const modalTitle = messageModal.querySelector('.modal-title');
    const messageForm = messageModal.querySelector('#message-form');
    const messageId = messageModal.querySelector('#message-id');
    const messagePosition = messageModal.querySelector('#message-position');
    const messageDelay = messageModal.querySelector('#message-delay');
    const messageContent = messageModal.querySelector('#message-content');
    const submitButton = messageModal.querySelector('.submit-text');
    
    // Configurer le formulaire
    modalTitle.textContent = isEditing ? 'Modifier le message' : 'Ajouter un message';
    submitButton.textContent = isEditing ? 'Mettre à jour' : 'Ajouter';
    messageId.value = isEditing ? messageData._id : '';
    
    if (isEditing) {
      messagePosition.value = messageData.position;
      messagePosition.disabled = true; // Ne pas permettre de changer la position en mode édition
      messageDelay.value = messageData.delayHours;
      messageContent.value = messageData.content;
    } else {
      messagePosition.disabled = false;
      messagePosition.value = '';
      messageDelay.value = 24;
      messageContent.value = '';
    }
    
    // Afficher le modal
    messageModal.classList.remove('hidden');
  };
  
  const closeMessageModal = () => {
    if (!messageModal) return;
    messageModal.classList.add('hidden');
  };
  
  // Bouton d'ajout de message
  const btnAddMessage = container.querySelector('#btn-add-message');
  if (btnAddMessage) {
    btnAddMessage.addEventListener('click', () => {
      openMessageModal();
    });
  }
  
  // Boutons de fermeture du modal
  const closeButtons = container.querySelectorAll('.modal-close');
  closeButtons.forEach(button => {
    button.addEventListener('click', closeMessageModal);
  });
  
  // Soumission du formulaire de message
  const messageForm = container.querySelector('#message-form');
  if (messageForm) {
    messageForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const messageId = container.querySelector('#message-id').value;
      const position = parseInt(container.querySelector('#message-position').value, 10);
      const delayHours = parseFloat(container.querySelector('#message-delay').value);
      const content = container.querySelector('#message-content').value;
      
      // Valider les données
      if (isNaN(position) || position < 1 || position > 5) {
        alert('Position invalide. Veuillez sélectionner une position entre 1 et 5.');
        return;
      }
      
      if (isNaN(delayHours) || delayHours < 0.01) {
        alert('Le délai doit être un nombre positif supérieur à 0.01.');
        return;
      }
      
      if (!content) {
        alert('Le contenu du message est requis.');
        return;
      }
      
      // Désactiver le formulaire pendant la soumission
      const formElements = messageForm.querySelectorAll('input, textarea, select, button');
      formElements.forEach(el => el.disabled = true);
      
      try {
        let response;
        
        if (messageId) {
          // Mettre à jour un message existant
          response = await SequenceAPI.updateSequenceMessage(sequenceId, messageId, {
            content,
            delayHours
          });
          
          if (response.success) {
            addLog(document, `Message #${position} mis à jour`, 'success');
          } else {
            throw new Error(response.message || 'Erreur lors de la mise à jour du message');
          }
        } else {
          // Ajouter un nouveau message
          response = await SequenceAPI.addMessageToSequence(sequenceId, {
            position,
            delayHours,
            content
          });
          
          if (response.success) {
            addLog(document, `Message #${position} ajouté à la séquence`, 'success');
          } else {
            throw new Error(response.message || 'Erreur lors de l\'ajout du message');
          }
        }
        
        // Fermer le modal
        closeMessageModal();
        
        // Recharger l'éditeur pour mettre à jour l'interface
        renderSequenceEditor(container, sequenceId);
      } catch (error) {
        addLog(document, `Erreur: ${error.message}`, 'error');
        
        // Réactiver le formulaire
        formElements.forEach(el => el.disabled = false);
      }
    });
  }
  
  // Boutons d'édition de message
  const editButtons = container.querySelectorAll('.btn-edit-message');
  editButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const messageCard = button.closest('.message-card');
      const messageId = messageCard.dataset.id;
      const position = parseInt(messageCard.dataset.position, 10);
      
      try {
        // Récupérer les détails du message
        const messagesResponse = await SequenceAPI.getSequenceMessages(sequenceId);
        
        if (!messagesResponse.success) {
          throw new Error(messagesResponse.message || 'Erreur lors de la récupération des messages');
        }
        
        const message = messagesResponse.data.find(m => m._id === messageId);
        
        if (!message) {
          throw new Error('Message introuvable');
        }
        
        // Ouvrir le modal en mode édition
        openMessageModal(message);
      } catch (error) {
        addLog(document, `Erreur: ${error.message}`, 'error');
      }
    });
  });
  
  // Boutons de suppression de message
  const deleteButtons = container.querySelectorAll('.btn-delete-message');
  deleteButtons.forEach(button => {
    button.addEventListener('click', async () => {
      if (!confirm('Êtes-vous sûr de vouloir supprimer ce message de la séquence ?')) {
        return;
      }
      
      const messageCard = button.closest('.message-card');
      const messageId = messageCard.dataset.id;
      const position = messageCard.dataset.position;
      
      try {
        // Supprimer le message
        const response = await SequenceAPI.deleteSequenceMessage(sequenceId, messageId);
        
        if (response.success) {
          addLog(document, `Message #${position} supprimé de la séquence`, 'success');
          
          // Recharger l'éditeur pour mettre à jour l'interface
          renderSequenceEditor(container, sequenceId);
        } else {
          throw new Error(response.message || 'Erreur lors de la suppression du message');
        }
      } catch (error) {
        addLog(document, `Erreur: ${error.message}`, 'error');
      }
    });
  });
  
// Bouton d'ajout de prospects amélioré
const btnAddProspects = container.querySelector('#btn-add-prospects');
if (btnAddProspects) {
  btnAddProspects.addEventListener('click', () => {
    // Créer un modal pour l'ajout de prospects
    const modalHtml = `
      <div id="prospects-modal" class="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="modal-content bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Ajouter des prospects à la séquence</h3>
            <button class="prospects-modal-close text-gray-500 hover:text-gray-700">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="mb-4">
            <div class="flex border-b">
              <button id="tab-manual-ids" class="py-2 px-4 text-blue-500 border-b-2 border-blue-500">
                IDs manuels
              </button>
              <button id="tab-from-session" class="py-2 px-4 text-gray-500 hover:text-gray-700">
                Depuis une session
              </button>
              <button id="tab-search" class="py-2 px-4 text-gray-500 hover:text-gray-700">
                Rechercher
              </button>
            </div>
          </div>
          
          <div id="tab-content-manual-ids" class="tab-content">
            <form id="prospects-form-manual" class="space-y-4">
              <div>
                <label for="prospect-ids" class="block text-sm font-medium text-gray-700 mb-1">
                  IDs des prospects (un par ligne) *
                </label>
                <textarea id="prospect-ids" name="prospect-ids" rows="8"
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Collez ici les IDs des prospects, un par ligne..."
                  required></textarea>
                <p class="mt-1 text-sm text-gray-500">
                  Vous pouvez coller des IDs MongoDB ou des URLs de profils LinkedIn complètes.
                </p>
              </div>
              
              <div class="flex justify-end space-x-2">
                <button type="button" class="prospects-modal-close px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
                  Annuler
                </button>
                <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                  <i class="fas fa-plus mr-2"></i> Ajouter
                </button>
              </div>
            </form>
          </div>
          
          <div id="tab-content-from-session" class="tab-content hidden">
            <form id="prospects-form-session" class="space-y-4">
              <div>
                <label for="session-select" class="block text-sm font-medium text-gray-700 mb-1">
                  Sélectionner une session *
                </label>
                <select id="session-select" name="session-select" 
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required>
                  <option value="">Choisissez une session...</option>
                  <!-- Les sessions seront chargées dynamiquement -->
                </select>
              </div>
              
              <div class="prospects-list-container border border-gray-200 rounded-md p-3 max-h-64 overflow-y-auto hidden">
                <div class="mb-2 flex justify-between items-center">
                  <span class="text-sm text-gray-700">
                    <span id="selected-count">0</span> prospect(s) sélectionné(s) sur <span id="total-count">0</span>
                  </span>
                  <div>
                    <button type="button" id="btn-select-all" class="text-sm text-blue-500 hover:text-blue-700">
                      Tout sélectionner
                    </button>
                    <button type="button" id="btn-deselect-all" class="text-sm text-blue-500 hover:text-blue-700 ml-2">
                      Tout désélectionner
                    </button>
                  </div>
                </div>
                <div id="session-prospects-list" class="space-y-1">
                  <!-- Liste des prospects de la session sélectionnée -->
                </div>
              </div>
              
              <div class="flex justify-end space-x-2">
                <button type="button" class="prospects-modal-close px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
                  Annuler
                </button>
                <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                  <i class="fas fa-plus mr-2"></i> Ajouter les prospects sélectionnés
                </button>
              </div>
            </form>
          </div>
          
          <div id="tab-content-search" class="tab-content hidden">
            <form id="prospects-form-search" class="space-y-4">
              <div>
                <label for="search-criteria" class="block text-sm font-medium text-gray-700 mb-1">
                  Critères de recherche
                </label>
                <input type="text" id="search-criteria" name="search-criteria" 
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nom, entreprise, titre, etc.">
              </div>
              
              <div class="flex space-x-2">
                <button type="button" id="btn-search-prospects" class="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">
                  <i class="fas fa-search mr-2"></i> Rechercher
                </button>
                
                <div class="search-filters flex-1 flex space-x-2">
                  <select id="company-filter" class="px-2 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="">Toutes les entreprises</option>
                  </select>
                  <select id="job-filter" class="px-2 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="">Tous les postes</option>
                  </select>
                </div>
              </div>
              
              <div class="search-results-container border border-gray-200 rounded-md p-3 max-h-64 overflow-y-auto hidden">
                <div class="mb-2 flex justify-between items-center">
                  <span class="text-sm text-gray-700">
                    <span id="selected-count-search">0</span> prospect(s) sélectionné(s) sur <span id="total-count-search">0</span>
                  </span>
                  <div>
                    <button type="button" id="btn-select-all-search" class="text-sm text-blue-500 hover:text-blue-700">
                      Tout sélectionner
                    </button>
                    <button type="button" id="btn-deselect-all-search" class="text-sm text-blue-500 hover:text-blue-700 ml-2">
                      Tout désélectionner
                    </button>
                  </div>
                </div>
                <div id="search-prospects-list" class="space-y-1">
                  <!-- Liste des prospects trouvés -->
                </div>
              </div>
              
              <div class="flex justify-end space-x-2">
                <button type="button" class="prospects-modal-close px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
                  Annuler
                </button>
                <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                  <i class="fas fa-plus mr-2"></i> Ajouter les prospects sélectionnés
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    
    // Ajouter le modal au DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const prospectsModal = document.getElementById('prospects-modal');
    
    // Gestion des onglets
    const tabManualIds = document.getElementById('tab-manual-ids');
    const tabFromSession = document.getElementById('tab-from-session');
    const tabSearch = document.getElementById('tab-search');
    
    const tabContentManualIds = document.getElementById('tab-content-manual-ids');
    const tabContentFromSession = document.getElementById('tab-content-from-session');
    const tabContentSearch = document.getElementById('tab-content-search');
    
    const switchTab = (tabButton, tabContent) => {
      // Désactiver tous les onglets
      [tabManualIds, tabFromSession, tabSearch].forEach(tab => {
        tab.classList.remove('text-blue-500', 'border-b-2', 'border-blue-500');
        tab.classList.add('text-gray-500');
      });
      
      // Cacher tous les contenus
      [tabContentManualIds, tabContentFromSession, tabContentSearch].forEach(content => {
        content.classList.add('hidden');
      });
      
      // Activer l'onglet sélectionné
      tabButton.classList.remove('text-gray-500');
      tabButton.classList.add('text-blue-500', 'border-b-2', 'border-blue-500');
      
      // Afficher le contenu correspondant
      tabContent.classList.remove('hidden');
    };
    
    tabManualIds.addEventListener('click', () => switchTab(tabManualIds, tabContentManualIds));
    tabFromSession.addEventListener('click', () => {
      switchTab(tabFromSession, tabContentFromSession);
      loadSessions();
    });
    tabSearch.addEventListener('click', () => switchTab(tabSearch, tabContentSearch));
    
    // Gestion de la fermeture du modal
    const closeProspectsModal = () => {
      prospectsModal.remove();
    };
    
    document.querySelectorAll('.prospects-modal-close').forEach(button => {
      button.addEventListener('click', closeProspectsModal);
    });
    
    // Chargement des sessions
    const loadSessions = async () => {
      try {
        const sessionsResponse = await fetch('/api/sessions');
        const sessionsData = await sessionsResponse.json();
        
        if (sessionsData.success) {
          const sessionSelect = document.getElementById('session-select');
          
          // Vider la liste
          sessionSelect.innerHTML = '<option value="">Choisissez une session...</option>';
          
          // Vérifier que data est un tableau, sinon utiliser la structure appropriée
          const sessions = Array.isArray(sessionsData.data) ? sessionsData.data : 
                         (sessionsData.data.sessions || sessionsData.data.result || []);
          
          // Ajouter les sessions
          sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session._id;
            option.textContent = `${session.name} (${session.scrapedProspectsCount || 0} prospects)`;
            sessionSelect.appendChild(option);
          });
          
          // Si aucune session trouvée
          if (sessions.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Aucune session disponible";
            option.disabled = true;
            sessionSelect.appendChild(option);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des sessions:', error);
        // Afficher un message d'erreur à l'utilisateur
        const sessionSelect = document.getElementById('session-select');
        sessionSelect.innerHTML = '<option value="">Erreur de chargement</option>';
      }
    };
    
    // Chargement des prospects d'une session
    const loadSessionProspects = async (sessionId) => {
      try {
        const prospectsContainer = document.querySelector('.prospects-list-container');
        const prospectsList = document.getElementById('session-prospects-list');
        
        // Afficher un chargement
        prospectsList.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Chargement des prospects...</div>';
        prospectsContainer.classList.remove('hidden');
        
        // Ajouter ?limit=-1 pour récupérer tous les prospects
        const prospectsResponse = await fetch(`/api/sessions/${sessionId}/prospects?limit=-1`);
        const prospectsData = await prospectsResponse.json();
        
        if (prospectsData.success) {
          // Mettre à jour les compteurs
          document.getElementById('total-count').textContent = prospectsData.data.length;
          document.getElementById('selected-count').textContent = '0';
          
          // Vider la liste
          prospectsList.innerHTML = '';
          
          // Ajouter les prospects
          if (prospectsData.data.length === 0) {
            prospectsList.innerHTML = '<div class="text-center py-4 text-gray-500">Aucun prospect dans cette session</div>';
          } else {
            prospectsData.data.forEach(prospect => {
              const prospectElement = document.createElement('div');
              prospectElement.className = 'flex items-center py-1';
              prospectElement.innerHTML = `
                <input type="checkbox" id="prospect-${prospect._id}" name="selected-prospects" value="${prospect._id}" 
                  class="prospect-checkbox mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500">
                <label for="prospect-${prospect._id}" class="text-sm cursor-pointer flex-1">
                  ${prospect.firstName} ${prospect.lastName} - ${prospect.company || 'N/A'} - ${prospect.jobTitle || 'N/A'}
                </label>
              `;
              prospectsList.appendChild(prospectElement);
            });
            
            // Ajouter les écouteurs pour les cases à cocher
            document.querySelectorAll('.prospect-checkbox').forEach(checkbox => {
              checkbox.addEventListener('change', updateSelectedCount);
            });
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des prospects:', error);
      }
    };
    
    // Mise à jour du compteur de sélection
    const updateSelectedCount = () => {
      const selectedCheckboxes = document.querySelectorAll('.prospect-checkbox:checked');
      document.getElementById('selected-count').textContent = selectedCheckboxes.length;
    };
    
    // Écouteurs pour les boutons "Tout sélectionner" et "Tout désélectionner"
    document.getElementById('btn-select-all').addEventListener('click', () => {
      document.querySelectorAll('.prospect-checkbox').forEach(checkbox => {
        checkbox.checked = true;
      });
      updateSelectedCount();
    });
    
    document.getElementById('btn-deselect-all').addEventListener('click', () => {
      document.querySelectorAll('.prospect-checkbox').forEach(checkbox => {
        checkbox.checked = false;
      });
      updateSelectedCount();
    });
    
    // Écouteur pour le changement de session
    document.getElementById('session-select').addEventListener('change', (event) => {
      const sessionId = event.target.value;
      if (sessionId) {
        loadSessionProspects(sessionId);
      } else {
        document.querySelector('.prospects-list-container').classList.add('hidden');
      }
    });
    
    // Fonction de recherche de prospects
    const searchProspects = async () => {
      const searchCriteria = document.getElementById('search-criteria').value;
      const companyFilter = document.getElementById('company-filter').value;
      const jobFilter = document.getElementById('job-filter').value;
      
      const searchResultsContainer = document.querySelector('.search-results-container');
      const searchProspectsList = document.getElementById('search-prospects-list');
      
      // Afficher un chargement
      searchProspectsList.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Recherche en cours...</div>';
      searchResultsContainer.classList.remove('hidden');
      
      try {
        const searchResponse = await fetch('/api/prospects/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            criteria: searchCriteria,
            company: companyFilter,
            jobTitle: jobFilter
          })
        });
        
        const searchData = await searchResponse.json();
        
        if (searchData.success) {
          // Mettre à jour les compteurs
          document.getElementById('total-count-search').textContent = searchData.data.length;
          document.getElementById('selected-count-search').textContent = '0';
          
          // Vider la liste
          searchProspectsList.innerHTML = '';
          
          // Ajouter les prospects
          if (searchData.data.length === 0) {
            searchProspectsList.innerHTML = '<div class="text-center py-4 text-gray-500">Aucun prospect trouvé</div>';
          } else {
            searchData.data.forEach(prospect => {
              const prospectElement = document.createElement('div');
              prospectElement.className = 'flex items-center py-1';
              prospectElement.innerHTML = `
                <input type="checkbox" id="search-prospect-${prospect._id}" name="search-selected-prospects" value="${prospect._id}" 
                  class="search-prospect-checkbox mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500">
                <label for="search-prospect-${prospect._id}" class="text-sm cursor-pointer flex-1">
                  ${prospect.firstName} ${prospect.lastName} - ${prospect.company || 'N/A'} - ${prospect.jobTitle || 'N/A'}
                </label>
              `;
              searchProspectsList.appendChild(prospectElement);
            });
            
            // Ajouter les écouteurs pour les cases à cocher
            document.querySelectorAll('.search-prospect-checkbox').forEach(checkbox => {
              checkbox.addEventListener('change', updateSearchSelectedCount);
            });
          }
        }
      } catch (error) {
        console.error('Erreur lors de la recherche de prospects:', error);
        searchProspectsList.innerHTML = '<div class="text-center py-4 text-red-500">Erreur lors de la recherche</div>';
      }
    };
    
    // Mise à jour du compteur de sélection pour la recherche
    const updateSearchSelectedCount = () => {
      const selectedCheckboxes = document.querySelectorAll('.search-prospect-checkbox:checked');
      document.getElementById('selected-count-search').textContent = selectedCheckboxes.length;
    };
    
    // Écouteur pour le bouton de recherche
    document.getElementById('btn-search-prospects').addEventListener('click', searchProspects);
    
    // Écouteurs pour les boutons "Tout sélectionner" et "Tout désélectionner" de la recherche
    document.getElementById('btn-select-all-search').addEventListener('click', () => {
      document.querySelectorAll('.search-prospect-checkbox').forEach(checkbox => {
        checkbox.checked = true;
      });
      updateSearchSelectedCount();
    });
    
    document.getElementById('btn-deselect-all-search').addEventListener('click', () => {
      document.querySelectorAll('.search-prospect-checkbox').forEach(checkbox => {
        checkbox.checked = false;
      });
      updateSearchSelectedCount();
    });
    
    // Soumission du formulaire manuel
    const manualForm = document.getElementById('prospects-form-manual');
    manualForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const prospectIdsText = document.getElementById('prospect-ids').value.trim();
      if (!prospectIdsText) {
        alert('Veuillez saisir au moins un ID de prospect.');
        return;
      }
      
      // Extraire et nettoyer les IDs
      const prospectIds = prospectIdsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => {
          // Si c'est une URL LinkedIn, extraire l'ID MongoDB à la fin
          const urlMatch = line.match(/\/([a-f0-9]{24})$/);
          if (urlMatch) {
            return urlMatch[1];
          }
          
          // Si c'est déjà un ID MongoDB, le retourner directement
          const idMatch = line.match(/^[a-f0-9]{24}$/);
          if (idMatch) {
            return line;
          }
          
          // Sinon, c'est peut-être un ID personnalisé ou un autre format
          return line;
        });
      
      if (prospectIds.length === 0) {
        alert('Aucun ID de prospect valide trouvé.');
        return;
      }
      
      // Désactiver le formulaire pendant la soumission
      const formElements = manualForm.querySelectorAll('input, textarea, button');
      formElements.forEach(el => el.disabled = true);
      
      try {
        await addProspectsToSequence(prospectIds);
      } catch (error) {
        formElements.forEach(el => el.disabled = false);
      }
    });
    
    // Soumission du formulaire de session
    const sessionForm = document.getElementById('prospects-form-session');
    sessionForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const selectedProspects = Array.from(document.querySelectorAll('.prospect-checkbox:checked')).map(checkbox => checkbox.value);
      
      if (selectedProspects.length === 0) {
        alert('Veuillez sélectionner au moins un prospect.');
        return;
      }
      
      // Désactiver le formulaire pendant la soumission
      const formElements = sessionForm.querySelectorAll('input, select, button');
      formElements.forEach(el => el.disabled = true);
      
      try {
        await addProspectsToSequence(selectedProspects);
      } catch (error) {
        formElements.forEach(el => el.disabled = false);
      }
    });
    
    // Soumission du formulaire de recherche
    const searchForm = document.getElementById('prospects-form-search');
    searchForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const selectedProspects = Array.from(document.querySelectorAll('.search-prospect-checkbox:checked')).map(checkbox => checkbox.value);
      
      if (selectedProspects.length === 0) {
        alert('Veuillez sélectionner au moins un prospect.');
        return;
      }
      
      // Désactiver le formulaire pendant la soumission
      const formElements = searchForm.querySelectorAll('input, select, button');
      formElements.forEach(el => el.disabled = true);
      
      try {
        await addProspectsToSequence(selectedProspects);
      } catch (error) {
        formElements.forEach(el => el.disabled = false);
      }
    });
    
    // Fonction commune d'ajout de prospects
    const addProspectsToSequence = async (prospectIds) => {
      try {
        // Envoyer la requête et capturer la réponse
        const response = await SequenceAPI.addProspectsToSequence(sequenceId, prospectIds);
        
        if (response.success) {
          addLog(document, `${response.data.successCount} prospect(s) ajouté(s) à la séquence`, 'success');
          closeProspectsModal();
          
          // Recharger l'éditeur
          renderSequenceEditor(container, sequenceId);
        } else {
          throw new Error(response.message || 'Erreur lors de l\'ajout des prospects');
        }
      } catch (error) {
        addLog(document, `Erreur: ${error.message}`, 'error');
        throw error;
      }
    };
  });
}
}

/**
 * Retourne le texte correspondant au statut d'une séquence
 * @param {string} status - Statut de la séquence
 * @returns {string} Texte du statut
 */
function getSequenceStatusText(status) {
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
 * Retourne la classe de couleur correspondant au statut d'une séquence
 * @param {string} status - Statut de la séquence
 * @returns {string} Classe de couleur
 */
function getSequenceStatusColor(status) {
  switch (status) {
    case 'active':
      return 'text-green-600';
    case 'paused':
      return 'text-yellow-600';
    case 'completed':
      return 'text-blue-600';
    case 'draft':
    default:
      return 'text-gray-600';
  }
}

/**
 * Retourne le texte correspondant au statut du prospect
 * @param {string} status - Statut du prospect
 * @returns {string} Texte du statut
 */
function getProspectStatusText(status) {
  switch (status) {
    case 'pending':
      return 'En attente';
    case 'active':
      return 'Actif';
    case 'paused':
      return 'En pause';
    case 'completed':
      return 'Terminé';
    case 'failed':
      return 'Échoué';
    default:
      return status;
  }
}

/**
 * Retourne le texte correspondant au statut de connexion
 * @param {string} status - Statut de connexion
 * @returns {string} Texte du statut
 */
function getConnectionStatusText(status) {
  switch (status) {
    case 'not_connected':
      return 'Non connecté';
    case 'invitation_sent':
      return 'Invitation envoyée';
    case 'connected':
      return 'Connecté';
    default:
      return status;
  }
}