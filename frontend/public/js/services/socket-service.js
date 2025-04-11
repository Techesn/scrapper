// Variables pour stocker la référence à la socket et les callbacks
let socket = null;
const eventCallbacks = {};

/**
 * Initialise la connexion socket avec le serveur
 * @returns {Object} - L'instance de la socket
 */
export function initSocketConnection() {
  if (socket) return socket;
  
  // Créer la connexion
  socket = io(window.location.origin);
  
  // Configurer les écouteurs d'événements par défaut
  socket.on('connect', () => {
    console.log('Socket connecté au serveur');
    triggerCallbacks('connect');
  });
  
  socket.on('disconnect', () => {
    console.log('Socket déconnecté du serveur');
    triggerCallbacks('disconnect');
  });
  
  socket.on('connect_error', (error) => {
    console.error('Erreur de connexion socket:', error);
    triggerCallbacks('error', error);
  });
  
  // Écouteurs pour les événements spécifiques à l'application
  socket.on('status_update', (data) => {
    console.log('Mise à jour du statut reçue:', data);
    triggerCallbacks('status_update', data);
  });
  
  socket.on('scraping_progress', (data) => {
    console.log('Progression du scraping reçue:', data);
    triggerCallbacks('scraping_progress', data);
  });
  
  return socket;
}

/**
 * Enregistre un callback pour un événement spécifique
 * @param {string} eventName - Nom de l'événement
 * @param {Function} callback - Fonction à appeler lors de l'événement
 */
export function onSocketEvent(eventName, callback) {
  if (!eventCallbacks[eventName]) {
    eventCallbacks[eventName] = [];
  }
  
  eventCallbacks[eventName].push(callback);
}

/**
 * Déclenche tous les callbacks enregistrés pour un événement
 * @param {string} eventName - Nom de l'événement
 * @param {*} data - Données de l'événement
 */
function triggerCallbacks(eventName, data) {
  if (eventCallbacks[eventName]) {
    eventCallbacks[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Erreur dans le callback pour ${eventName}:`, error);
      }
    });
  }
}

/**
 * Obtient l'instance de la socket
 * @returns {Object|null} - L'instance de la socket ou null si non initialisée
 */
export function getSocket() {
  return socket;
}