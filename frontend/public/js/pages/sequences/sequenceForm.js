import { SequenceAPI } from '../../services/sequence-api-service.js';
import { showSequenceEditor } from '../sequences.js';
import { addLog } from '../../components/logs.js';

/**
 * Affiche le formulaire de création de séquence
 * @param {HTMLElement} container - Conteneur pour le formulaire
 * @param {Object} [initialData] - Données initiales pour le formulaire (en cas d'édition)
 */
export function renderSequenceForm(container, initialData = null) {
  const isEditing = !!initialData;
  
  // Construire le formulaire
  container.innerHTML = `
    <form id="sequence-form" class="space-y-4 max-w-2xl">
      <div>
        <label for="sequence-name" class="block text-sm font-medium text-gray-700 mb-1">
          Nom de la séquence *
        </label>
        <input type="text" id="sequence-name" name="sequence-name" 
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Ex: Séquence de bienvenue"
          value="${isEditing ? initialData.name : ''}"
          required>
      </div>
      
      <div>
        <label for="sequence-description" class="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea id="sequence-description" name="sequence-description" rows="3"
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          placeholder="Description de la séquence...">${isEditing ? initialData.description || '' : ''}</textarea>
      </div>
      
      <div>
        <label for="sequence-interval" class="block text-sm font-medium text-gray-700 mb-1">
          Intervalle par défaut (jours)
        </label>
        <input type="number" id="sequence-interval" name="sequence-interval" 
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          min="1" max="30" value="${isEditing ? initialData.intervalDays || 1 : 1}">
        <p class="mt-1 text-sm text-gray-500">
          Intervalle par défaut entre les messages (peut être personnalisé pour chaque message)
        </p>
      </div>
      
      <div class="flex justify-end space-x-2">
        ${isEditing ? `
          <button type="button" id="cancel-sequence-edit" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50">
            <i class="fas fa-times mr-2"></i> Annuler
          </button>
        ` : ''}
        <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
          <i class="fas fa-save mr-2"></i> ${isEditing ? 'Mettre à jour' : 'Créer la séquence'}
        </button>
      </div>
    </form>
  `;
  
  // Attacher les écouteurs d'événements
  const sequenceForm = container.querySelector('#sequence-form');
  
  if (sequenceForm) {
    sequenceForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      // Récupérer les valeurs du formulaire
      const name = container.querySelector('#sequence-name').value;
      const description = container.querySelector('#sequence-description').value;
      const intervalDays = parseInt(container.querySelector('#sequence-interval').value, 10);
      
      // Valider les données
      if (!name) {
        addLog(document, 'Le nom de la séquence est requis', 'error');
        return;
      }
      
      if (isNaN(intervalDays) || intervalDays < 1 || intervalDays > 30) {
        addLog(document, 'L\'intervalle doit être un nombre entre 1 et 30', 'error');
        return;
      }
      
      // Désactiver le formulaire pendant la soumission
      setFormDisabled(container, true);
      
      try {
        let response;
        
        if (isEditing) {
          // Mettre à jour la séquence existante
          response = await SequenceAPI.updateSequence(initialData._id, {
            name,
            description,
            intervalDays
          });
          
          if (response.success) {
            addLog(document, `Séquence "${name}" mise à jour avec succès`, 'success');
            
            // Rediriger vers l'éditeur de séquence
            showSequenceEditor(document, initialData._id);
          } else {
            throw new Error(response.message || 'Erreur lors de la mise à jour de la séquence');
          }
        } else {
          // Créer une nouvelle séquence
          response = await SequenceAPI.createSequence({
            name,
            description,
            intervalDays
          });
          
          if (response.success) {
            addLog(document, `Séquence "${name}" créée avec succès`, 'success');
            
            // Rediriger vers l'éditeur de séquence
            showSequenceEditor(document, response.data._id);
            
            // Réinitialiser le formulaire
            sequenceForm.reset();
          } else {
            throw new Error(response.message || 'Erreur lors de la création de la séquence');
          }
        }
      } catch (error) {
        addLog(document, `Erreur: ${error.message}`, 'error');
      } finally {
        // Réactiver le formulaire
        setFormDisabled(container, false);
      }
    });
  }
  
  // Bouton d'annulation (en mode édition)
  const cancelButton = container.querySelector('#cancel-sequence-edit');
  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      // Rediriger vers l'éditeur de séquence
      showSequenceEditor(document, initialData._id);
    });
  }
}

/**
 * Active ou désactive les éléments du formulaire
 * @param {HTMLElement} container - Conteneur du formulaire
 * @param {boolean} disabled - Doit-on désactiver les éléments
 */
function setFormDisabled(container, disabled) {
  const elements = container.querySelectorAll('input, textarea, button');
  
  elements.forEach(element => {
    element.disabled = disabled;
  });
}