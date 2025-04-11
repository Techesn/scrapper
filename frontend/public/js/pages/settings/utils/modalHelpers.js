/**
 * Crée et affiche une modal
 * @param {Object} options - Options de la modal
 * @param {string} options.title - Titre de la modal
 * @param {string|HTMLElement} options.content - Contenu de la modal (HTML ou élément)
 * @param {Array<Object>} [options.buttons] - Boutons de la modal [{text, type, onClick}]
 * @param {string} [options.size] - Taille de la modal ('sm', 'md', 'lg', 'xl')
 * @param {Function} [options.onClose] - Callback à l'exécution après la fermeture
 * @returns {Object} Objet avec méthodes pour manipuler la modal
 */
export function showModal(options) {
    // Valeurs par défaut
    const config = {
      title: options.title || 'Information',
      content: options.content || '',
      buttons: options.buttons || [],
      size: options.size || 'md',
      onClose: options.onClose || null
    };
    
    // Déterminer la classe de taille
    let sizeClass;
    switch (config.size) {
      case 'sm': sizeClass = 'max-w-md'; break;
      case 'lg': sizeClass = 'max-w-3xl'; break;
      case 'xl': sizeClass = 'max-w-5xl'; break;
      default: sizeClass = 'max-w-xl'; // md
    }
    
    // Créer l'élément de la modal
    const modalElement = document.createElement('div');
    modalElement.className = 'fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center';
    modalElement.setAttribute('aria-modal', 'true');
    modalElement.setAttribute('role', 'dialog');
    
    // Contenu HTML de la modal
    modalElement.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl ${sizeClass} w-full mx-4 transform transition-all" role="document">
        <div class="border-b px-6 py-4 flex items-center justify-between">
          <h3 class="text-lg font-medium text-gray-900">${config.title}</h3>
          <button type="button" class="modal-close text-gray-400 hover:text-gray-500 focus:outline-none">
            <span class="sr-only">Fermer</span>
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="px-6 py-4 modal-content"></div>
        
        ${config.buttons.length > 0 ? `
          <div class="bg-gray-50 px-6 py-4 flex flex-wrap justify-end space-x-2">
            ${config.buttons.map((button, index) => `
              <button type="button" 
                      class="modal-button px-4 py-2 ${getButtonClasses(button.type)} rounded-md focus:outline-none"
                      data-index="${index}">
                ${button.text}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
    
    // Ajouter le contenu
    const contentContainer = modalElement.querySelector('.modal-content');
    if (typeof config.content === 'string') {
      contentContainer.innerHTML = config.content;
    } else if (config.content instanceof HTMLElement) {
      contentContainer.appendChild(config.content);
    }
    
    // Ajouter au DOM
    document.body.appendChild(modalElement);
    
    // Empêcher le défilement du body
    document.body.style.overflow = 'hidden';
    
    // Gérer la fermeture
    function closeModal() {
      modalElement.classList.add('modal-closing');
      setTimeout(() => {
        if (modalElement.parentNode) {
          modalElement.remove();
          document.body.style.overflow = '';
          
          // Exécuter le callback onClose si défini
          if (typeof config.onClose === 'function') {
            config.onClose();
          }
        }
      }, 200);
    }
    
    // Ajouter les gestionnaires d'événements
    modalElement.querySelector('.modal-close').addEventListener('click', closeModal);
    
    // Fermer en cliquant en dehors
    modalElement.addEventListener('click', (e) => {
      if (e.target === modalElement) {
        closeModal();
      }
    });
    
    // Ajouter des événements aux boutons
    const buttonElements = modalElement.querySelectorAll('.modal-button');
    buttonElements.forEach(button => {
      const index = parseInt(button.dataset.index);
      button.addEventListener('click', () => {
        // Exécuter le callback du bouton s'il existe
        if (config.buttons[index] && typeof config.buttons[index].onClick === 'function') {
          config.buttons[index].onClick();
        }
        
        // Fermer la modal si closeOnClick n'est pas explicitement à false
        if (config.buttons[index].closeOnClick !== false) {
          closeModal();
        }
      });
    });
    
    // Ajouter les styles si nécessaire
    if (!document.querySelector('#modal-styles')) {
      const style = document.createElement('style');
      style.id = 'modal-styles';
      style.textContent = `
        .modal-closing {
          opacity: 0;
          transform: scale(0.95);
          transition: opacity 0.2s, transform 0.2s;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Retourner un objet permettant de manipuler la modal
    return {
      close: closeModal,
      getElement: () => modalElement,
      setTitle: (title) => {
        const titleElement = modalElement.querySelector('h3');
        if (titleElement) {
          titleElement.textContent = title;
        }
      },
      setContent: (content) => {
        if (typeof content === 'string') {
          contentContainer.innerHTML = content;
        } else if (content instanceof HTMLElement) {
          contentContainer.innerHTML = '';
          contentContainer.appendChild(content);
        }
      }
    };
  }
  
  /**
   * Affiche une modal de confirmation
   * @param {string} message - Message de confirmation
   * @param {Object} options - Options supplémentaires
   * @returns {Promise<boolean>} Résultat de la confirmation (true si confirmé)
   */
  export function confirmModal(message, options = {}) {
    return new Promise(resolve => {
      showModal({
        title: options.title || 'Confirmation',
        content: `<p class="text-gray-700">${message}</p>`,
        buttons: [
          {
            text: options.cancelText || 'Annuler',
            type: 'secondary',
            onClick: () => resolve(false)
          },
          {
            text: options.confirmText || 'Confirmer',
            type: options.confirmType || 'primary',
            onClick: () => resolve(true)
          }
        ],
        size: options.size || 'sm',
        onClose: () => resolve(false)
      });
    });
  }
  
  /**
   * Affiche une modal d'alerte
   * @param {string} message - Message d'alerte
   * @param {Object} options - Options supplémentaires
   * @returns {Promise<void>} Promesse résolue après fermeture
   */
  export function alertModal(message, options = {}) {
    return new Promise(resolve => {
      showModal({
        title: options.title || 'Information',
        content: `<p class="text-gray-700">${message}</p>`,
        buttons: [
          {
            text: options.buttonText || 'OK',
            type: options.buttonType || 'primary',
            onClick: () => resolve()
          }
        ],
        size: options.size || 'sm',
        onClose: () => resolve()
      });
    });
  }
  
  /**
   * Détermine les classes CSS pour un type de bouton
   * @private
   * @param {string} type - Type de bouton ('primary', 'secondary', 'danger', 'success', etc.)
   * @returns {string} Classes CSS pour le bouton
   */
  function getButtonClasses(type) {
    switch (type) {
      case 'primary':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'secondary':
        return 'bg-gray-200 hover:bg-gray-300 text-gray-800';
      case 'danger':
        return 'bg-red-500 hover:bg-red-600 text-white';
      case 'success':
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'warning':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      default:
        return 'bg-gray-200 hover:bg-gray-300 text-gray-800';
    }
  }