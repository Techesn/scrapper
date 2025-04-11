/**
 * Crée une barre de progression avec des informations détaillées
 * @param {number} current - Valeur actuelle
 * @param {number} total - Valeur totale
 * @param {string} [status='running'] - Statut actuel
 * @returns {string} - HTML de la barre de progression
 */
export function createProgressBar(current, total, status = 'running') {
    // Calculer le pourcentage de progression
    const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    
    // Déterminer la couleur en fonction du statut
    let colorClass = 'bg-blue-500';
    
    switch (status) {
      case 'paused':
        colorClass = 'bg-yellow-500';
        break;
      case 'error':
        colorClass = 'bg-red-500';
        break;
      case 'completed':
        colorClass = 'bg-green-500';
        break;
    }
    
    // Animation en fonction du statut
    const animationClass = status === 'running' ? 'animate-pulse' : '';
    
    return `
      <div class="mb-6">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium text-gray-700">Progression</span>
          <span class="text-sm font-medium text-gray-700">${percentage}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2.5">
          <div class="${colorClass} h-2.5 rounded-full ${animationClass}" style="width: ${percentage}%"></div>
        </div>
        <div class="flex justify-between items-center mt-2 text-sm text-gray-500">
          <span>Profils scrapés: ${current}</span>
          <span>Total chargé: ${total}</span>
        </div>
      </div>
    `;
  }