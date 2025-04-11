/**
 * Ajoute une entrée dans les logs
 * @param {HTMLElement|Document} container - Conteneur principal ou document
 * @param {string} message - Message à ajouter
 * @param {string} type - Type de log (info, error, success, warning)
 */
export function addLog(container, message, type = 'info') {
    // Si container est le document, chercher le conteneur de logs
    const logsContainer = container instanceof HTMLElement 
      ? container.querySelector('#logs-container')
      : document.querySelector('#logs-container');
    
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
   * Efface les logs
   * @param {HTMLElement|Document} container - Conteneur principal ou document
   */
  export function clearLogs(container) {
    // Si container est le document, chercher le conteneur de logs
    const logsContainer = container instanceof HTMLElement 
      ? container.querySelector('#logs-container')
      : document.querySelector('#logs-container');
    
    if (!logsContainer) return;
    
    // Vider le conteneur
    logsContainer.innerHTML = '';
    
    // Ajouter un message initial
    addLog(container, 'Logs effacés');
  }
  
  /**
   * Attache les écouteurs d'événements pour les logs
   * @param {HTMLElement} container - Conteneur principal
   */
  export function attachLogsListeners(container) {
    // Bouton pour effacer les logs
    const clearLogsBtn = container.querySelector('#clear-logs');
    if (clearLogsBtn) {
      clearLogsBtn.addEventListener('click', () => {
        clearLogs(container);
      });
    }
  }