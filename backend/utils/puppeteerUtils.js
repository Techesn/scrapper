/**
 * Attend pendant un certain temps spécifié
 * @param {Page} page - Page Puppeteer
 * @param {number} timeout - Temps d'attente en millisecondes
 * @returns {Promise<void>}
 */
const waitForTimeout = async (page, timeout) => {
  return new Promise(resolve => setTimeout(resolve, timeout));
};

/**
 * Pause l'exécution pendant le nombre de millisecondes spécifié
 * @param {number} ms - Nombre de millisecondes
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Génère un délai aléatoire entre deux valeurs
 * @param {number} min - Valeur minimum en millisecondes
 * @param {number} max - Valeur maximum en millisecondes
 * @returns {number} Délai aléatoire entre min et max
 */
const getRandomDelay = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

module.exports = {
  waitForTimeout,
  sleep,
  getRandomDelay
};