/**
 * Crée un composant de carte de statistique
 * @param {string} title - Titre de la statistique
 * @param {string|number} value - Valeur de la statistique
 * @param {string} bgColor - Couleur de fond (classe Tailwind)
 * @param {string} icon - Classe d'icône FontAwesome
 * @returns {string} - HTML de la carte de statistique
 */
export function createStatCard(title, value, bgColor = 'bg-blue-500', icon = 'fa-chart-line') {
    return `
      <div class="stat-card transform transition-all duration-200 ease-in-out hover:-translate-y-1">
        <div class="${bgColor} rounded-lg shadow-md p-4 text-white">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold">${title}</h3>
              <p class="text-3xl font-bold mt-2">${value}</p>
            </div>
            <div class="text-4xl opacity-70">
              <i class="fas ${icon}"></i>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Crée une carte de statut pour le scraper
   * @param {string} status - Statut actuel du scraper
   * @returns {string} - HTML de la carte de statut
   */
  export function createStatusCard(status) {
    // Définir la couleur et le texte en fonction du statut
    let statusColor = 'status-idle';
    let statusText = 'Inactif';
    let bgColor = 'bg-gray-100 text-gray-800';
    let icon = 'fa-power-off';
    
    switch (status) {
      case 'running':
        statusColor = 'status-running';
        statusText = 'En cours';
        bgColor = 'bg-green-100 text-green-800';
        icon = 'fa-play';
        break;
      case 'paused':
        statusColor = 'status-paused';
        statusText = 'En pause';
        bgColor = 'bg-yellow-100 text-yellow-800';
        icon = 'fa-pause';
        break;
      case 'error':
        statusColor = 'status-error';
        statusText = 'Erreur';
        bgColor = 'bg-red-100 text-red-800';
        icon = 'fa-exclamation-triangle';
        break;
      case 'completed':
        statusColor = 'status-completed';
        statusText = 'Terminé';
        bgColor = 'bg-blue-100 text-blue-800';
        icon = 'fa-check';
        break;
      case 'initializing':
        statusColor = 'status-idle';
        statusText = 'Initialisation';
        bgColor = 'bg-purple-100 text-purple-800';
        icon = 'fa-cog fa-spin';
        break;
    }
    
    return `
      <div class="stat-card transform transition-all duration-200 ease-in-out hover:-translate-y-1">
        <div class="${bgColor} rounded-lg shadow-md p-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold">Statut</h3>
              <p class="text-2xl font-bold mt-2 flex items-center">
                <span class="status-indicator ${statusColor}"></span>
                ${statusText}
              </p>
            </div>
            <div class="text-4xl opacity-70">
              <i class="fas ${icon}"></i>
            </div>
          </div>
        </div>
      </div>
    `;
  }