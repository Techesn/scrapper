const config = require('../config/config');
const logger = require('./logger');

/**
 * Génère un délai aléatoire entre les actions
 * @returns {Promise} - Promesse résolue après un délai aléatoire
 */
const randomDelay = async () => {
  const min = config.linkedin.scraping.minDelayBetweenActions;
  const max = config.linkedin.scraping.maxDelayBetweenActions;
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  
  logger.debug(`Attente de ${delay}ms avant la prochaine action`);
  return new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Simule un mouvement de souris humain
 * @param {Object} page - Instance de page Puppeteer
 * @param {Object} start - Position de départ {x, y}
 * @param {Object} end - Position d'arrivée {x, y}
 * @param {Number} steps - Nombre d'étapes pour le mouvement
 */
const simulateMouseMovement = async (page, start, end, steps = 10) => {
  logger.debug('Simulation d\'un mouvement de souris naturel');
  
  for (let i = 0; i <= steps; i++) {
    const x = start.x + (end.x - start.x) * (i / steps);
    const y = start.y + (end.y - start.y) * (i / steps);
    
    // Ajout d'une légère variation pour rendre le mouvement plus naturel
    const randomX = x + (Math.random() * 5 - 2.5);
    const randomY = y + (Math.random() * 5 - 2.5);
    
    await page.mouse.move(randomX, randomY);
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 15));
  }
};

/**
 * Simule un scroll naturel
 * @param {Object} page - Instance de page Puppeteer
 * @param {Number} distance - Distance de scroll (positif = vers le bas)
 */
const simulateNaturalScroll = async (page, distance) => {
  logger.debug(`Simulation d'un scroll naturel de ${distance}px`);
  
  // Divise le scroll en plusieurs petits scrolls pour le rendre plus naturel
  const steps = Math.abs(Math.floor(distance / 100)) + 1;
  const stepSize = distance / steps;
  
  for (let i = 0; i < steps; i++) {
    await page.evaluate(stepSize => {
      window.scrollBy(0, stepSize);
    }, stepSize);
    
    // Ajout d'un petit délai entre chaque étape de scroll
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
  }
  
  // Petit délai après le scroll complet
  await randomDelay();
};

/**
 * Simule un clic humain avec mouvement de souris
 * @param {Object} page - Instance de page Puppeteer
 * @param {String} selector - Sélecteur CSS de l'élément à cliquer
 */
const simulateHumanClick = async (page, selector) => {
  logger.debug(`Simulation d'un clic humain sur ${selector}`);
  
  // Attendre que l'élément soit visible
  await page.waitForSelector(selector, { visible: true });
  
  // Obtenir la position et dimensions de l'élément
  const elementBounds = await page.evaluate(selector => {
    const element = document.querySelector(selector);
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  }, selector);
  
  // Position aléatoire dans l'élément
  const clickX = elementBounds.x + Math.random() * elementBounds.width;
  const clickY = elementBounds.y + Math.random() * elementBounds.height;
  
  // Position actuelle de la souris
  const currentPosition = await page.evaluate(() => {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  });
  
  // Simuler le mouvement de la souris
  await simulateMouseMovement(page, currentPosition, { x: clickX, y: clickY });
  
  // Cliquer sur l'élément
  await page.mouse.click(clickX, clickY);
  
  // Attendre un délai aléatoire après le clic
  await randomDelay();
};

/**
 * Effectue un scroll progressif pour charger tout le contenu dynamique
 * @param {Object} page - Instance de page Puppeteer
 * @param {Number} maxScrolls - Nombre maximum de scrolls à effectuer
 * @param {Function} checkNewContent - Fonction pour vérifier si du nouveau contenu est chargé
 */
/**
 * Effectue un scroll progressif pour charger tout le contenu dynamique
 * @param {Object} page - Instance de page Puppeteer
 * @param {Number} maxScrolls - Nombre maximum de scrolls à effectuer
 * @param {Function} checkNewContent - Fonction pour vérifier si du nouveau contenu est chargé
 */
const progressiveScroll = async (page, maxScrolls = 100, checkNewContent) => {
  logger.debug('Démarrage du scroll progressif pour charger le contenu');
  
  let previousHeight = 0;
  let sameHeightCount = 0;
  let scrollCount = 0;
  
  while (scrollCount < maxScrolls) {
    try {
      // Obtenir la hauteur actuelle de la page
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      
      // Vérifier si la hauteur a changé
      if (currentHeight === previousHeight) {
        sameHeightCount++;
        
        // Si la hauteur reste la même après plusieurs tentatives, on arrête le scroll
        if (sameHeightCount >= 3) {
          logger.debug('Fin du scroll : hauteur de page stable');
          break;
        }
      } else {
        sameHeightCount = 0;
        previousHeight = currentHeight;
      }
      
      // Scroll d'une distance plus courte (300px) pour éviter les rechargements
      await page.evaluate(() => {
        window.scrollBy(0, 300);
      });
      
      // Attendre un peu plus longtemps entre chaque scroll
      await puppeteerUtils.waitForTimeout(page, 1000);
      
      // Compter le nombre d'éléments chargés si une fonction de vérification est fournie
      if (typeof checkNewContent === 'function') {
        try {
          const hasNewContent = await checkNewContent();
          if (!hasNewContent) {
            logger.debug('Fin du scroll : pas de nouveau contenu détecté');
            break;
          }
        } catch (error) {
          logger.warn(`Erreur lors de la vérification du nouveau contenu: ${error.message}`);
          // Attendre un peu et continuer
          await puppeteerUtils.waitForTimeout(page, 2000);
        }
      }
      
      scrollCount++;
      await puppeteerUtils.waitForTimeout(page, 1000);
      
    } catch (error) {
      logger.warn(`Erreur pendant le scroll: ${error.message}`);
      // Attendre un peu et continuer
      await puppeteerUtils.waitForTimeout(page, 2000);
    }
  }
  
  logger.info(`Scroll progressif terminé après ${scrollCount} scrolls`);
};

module.exports = {
  randomDelay,
  simulateMouseMovement,
  simulateNaturalScroll,
  simulateHumanClick,
  progressiveScroll
};