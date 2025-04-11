/**
 * Affiche un message toast temporaire
 * @param {HTMLElement|Document} container - Conteneur où afficher le message (ou document)
 * @param {string} message - Message à afficher
 * @param {string} type - Type de message ('success', 'error', 'info', 'warning')
 * @param {number} duration - Durée d'affichage en millisecondes
 */
export function showMessage(container, message, type = 'info', duration = 3000) {
    // Déterminer où ajouter le toast (document.body par défaut)
    const target = container === document ? document.body : 
                  (container || document.body);
    
    // Supprimer les messages existants avec la même classe
    const existingMessages = target.querySelectorAll('.message-toast');
    existingMessages.forEach(el => {
      // Ajouter une classe de disparition
      el.classList.add('message-toast-fadeout');
      // Supprimer après l'animation
      setTimeout(() => el.remove(), 300);
    });
    
    // Déterminer les couleurs et l'icône en fonction du type
    let bgColor, textColor, iconName;
    switch (type) {
      case 'success':
        bgColor = 'bg-green-100';
        textColor = 'text-green-800';
        iconName = 'check-circle';
        break;
      case 'error':
        bgColor = 'bg-red-100';
        textColor = 'text-red-800';
        iconName = 'exclamation-circle';
        break;
      case 'warning':
        bgColor = 'bg-yellow-100';
        textColor = 'text-yellow-800';
        iconName = 'exclamation-triangle';
        break;
      default: // info
        bgColor = 'bg-blue-100';
        textColor = 'text-blue-800';
        iconName = 'info-circle';
    }
    
    // Créer l'élément de toast
    const toast = document.createElement('div');
    toast.className = `message-toast fixed top-4 right-4 flex items-center p-4 mb-4 ${bgColor} ${textColor} rounded-lg shadow-lg z-50 transform transition-all duration-300 ease-out`;
    toast.style.maxWidth = '90%';
    toast.innerHTML = `
      <span class="mr-2 flex-shrink-0">
        <i class="fas fa-${iconName}"></i>
      </span>
      <span class="flex-grow">${message}</span>
      <button type="button" class="ml-2 text-gray-400 hover:text-gray-900 focus:outline-none">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    // Ajouter au DOM
    target.appendChild(toast);
    
    // Animer l'entrée
    requestAnimationFrame(() => {
      toast.classList.add('message-toast-fadein');
    });
    
    // Configurer le bouton de fermeture
    const closeButton = toast.querySelector('button');
    closeButton.addEventListener('click', () => {
      toast.classList.add('message-toast-fadeout');
      setTimeout(() => toast.remove(), 300);
    });
    
    // Supprimer après la durée spécifiée
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('message-toast-fadeout');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
    
    // Ajouter les styles si nécessaire
    if (!document.querySelector('#toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        .message-toast {
          opacity: 0;
          transform: translateY(-20px);
        }
        .message-toast-fadein {
          opacity: 1;
          transform: translateY(0);
        }
        .message-toast-fadeout {
          opacity: 0;
          transform: translateY(-20px);
        }
      `;
      document.head.appendChild(style);
    }
    
    return toast;
  }