const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const config = require('../config/config');
const logger = require('./logger');
const puppeteerUtils = require('./puppeteerUtils');
const browserPoolService = require('../services/browserPoolService');
// Activer le plugin stealth pour réduire la détection
puppeteer.use(StealthPlugin());

// Importer le service de pool de navigateurs

/**
 * Lance une instance du navigateur avec les configurations optimales pour éviter la détection
 * @param {boolean} temporary - Si true, la session sera fermée après utilisation
 * @param {boolean} forceNewSession - Si true, force la création d'une nouvelle session hors pool
 * @returns {Promise<Browser>} Instance du navigateur
 */
const launchBrowser = async (temporary = false, forceNewSession = false) => {
  logger.info(`Demande d'une session de navigateur depuis le pool (temporaire: ${temporary}, forceNew: ${forceNewSession})`);
  
  try {
    // Si on force une nouvelle session et que c'est temporaire, créer directement sans passer par le pool
    if (forceNewSession && temporary) {
      logger.info('Création dune session temporaire forcée (hors pool)');
      
      const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-notifications',
          '--disable-extensions',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        ],
        ignoreHTTPSErrors: true
      });
      
      // Marquer cette session comme temporaire et hors pool
      browser._isTemporary = true;
      browser._isOutOfPool = true;
      
      // Remplacer la méthode close pour simplement fermer le navigateur
      const originalClose = browser.close;
      browser.close = async function() {
        logger.info('Fermeture d\'une session temporaire forcée (hors pool)');
        return originalClose.call(this);
      };
      
      return browser;
    }
    
    // Si on ne force pas de nouvelle session, utiliser le pool normalement
    const { sessionId, browser, page } = await browserPoolService.getSession(temporary);
    
    // Stocker l'ID de session sur l'objet browser pour pouvoir le retrouver plus tard
    browser._poolSessionId = sessionId;
    browser._poolPage = page;
    browser._isTemporary = temporary;
    
    // Modifier la méthode close() du navigateur pour libérer la session au lieu de fermer
    const originalClose = browser.close;
    browser.close = async function() {
      if (this._poolSessionId) {
        // IMPORTANT: Empêcher les doubles libérations
        const tempId = this._poolSessionId; 
        this._poolSessionId = null;
        
        logger.info(`Libération de la session ${tempId} (temporaire: ${this._isTemporary})`);
        return browserPoolService.releaseSession(tempId);
      } else {
        logger.info('Fermeture directe du navigateur (hors pool)');
        return originalClose.call(this);
      }
    };
    
    return browser;
  } catch (error) {
    logger.error(`Erreur lors de l'obtention d'une session du navigateur: ${error.message}`);
    
    // En cas d'erreur, fallback au comportement original
    logger.warn('ATTENTION: Fallback à un navigateur hors pool, ce qui peut causer des problèmes de ressources');
    
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-notifications',
        '--disable-extensions',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      ],
      ignoreHTTPSErrors: true
    });
    
    return browser;
  }
};

/**
 * Crée une nouvelle page dans le navigateur avec les configurations anti-détection
 * @param {Browser} browser - L'instance du navigateur
 * @returns {Promise<Page>} La page configurée
 */
const createStealthPage = async (browser) => {
  // Si c'est une session du pool, retourner la page déjà configurée
  if (browser._poolPage) {
    logger.info('Utilisation de la page pré-configurée du pool');
    return browser._poolPage;
  }
  
  logger.info('Création d\'une nouvelle page furtive');
  
  const page = await browser.newPage();
  
  // Configurer l'en-tête user-agent
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  );
  
  // Modifier les paramètres du navigateur pour éviter la détection
  await page.evaluateOnNewDocument(() => {
    // Masquer webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
    
    // Modifier la propriété plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        return [
          {
            0: {
              type: 'application/x-google-chrome-pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format',
              enabledPlugin: Plugin,
            },
            description: 'Chrome PDF Plugin',
            filename: 'internal-pdf-viewer',
            length: 1,
            name: 'Chrome PDF Plugin',
          },
          {
            0: {
              type: 'application/pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format',
              enabledPlugin: Plugin,
            },
            description: 'Chrome PDF Viewer',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            length: 1,
            name: 'Chrome PDF Viewer',
          }
        ];
      },
    });
    
    // Modifier la propriété languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['fr-FR', 'fr', 'en-US', 'en'],
    });
    
    // Cacher la détection du mode headless
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });
  
  // Configurer la résolution d'écran
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });
  
  return page;
};

const authenticateWithCookies = async (page, listUrl = null) => {
  logger.info('Authentification via cookie li_at');
  
  try {
    // Récupérer le cookie depuis la base de données
    const Cookie = require('../models/Cookie');
    const cookieRecord = await Cookie.findOne({ name: 'linkedin_li_at' });
    
    if (!cookieRecord || !cookieRecord.value) {
      logger.error('CRITIQUE : Aucun cookie LinkedIn trouvé dans la base de données');
      throw new Error('Cookie LinkedIn manquant');
    }
    
    const cookieValue = cookieRecord.value;
    
    // D'abord, naviguer sur LinkedIn avec gestion robuste des timeouts
    try {
      await page.goto('https://www.linkedin.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 90000,
      });
      logger.info('Page LinkedIn chargée avant authentification');
    } catch (navError) {
      logger.warn(`Navigation vers LinkedIn a rencontré un problème: ${navError.message}`);
      // Continuer malgré l'erreur si la page est partiellement chargée
    }
    
    // Configurer directement le cookie li_at
    await page.setCookie({
      name: 'li_at',
      value: cookieValue,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true
    });
    
    // Recharger la page avec gestion d'erreur robuste
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
      logger.info('Page LinkedIn rechargée après ajout du cookie');
    } catch (reloadError) {
      logger.warn(`Rechargement de la page a rencontré un problème: ${reloadError.message}`);
      // Continuer malgré l'erreur
    }
    
    // Gérer le popup de cookies
    await handleCookieConsent(page);
    
    // Vérifier si nous sommes connectés avec gestion des erreurs
    const isLoggedIn = await page.evaluate(() => {
      // Vérifier si le formulaire de connexion est présent (indique qu'on n'est pas connecté)
      const loginForm = document.querySelector('form.login__form, form#login-form');
      if (loginForm) return false;
      
      // Vérifier divers éléments qui indiquent qu'on est connecté
      const profileIcon = document.querySelector('.global-nav__me-photo, .presence-entity__image');
      const feedModule = document.querySelector('.feed-identity-module');
      const navBar = document.querySelector('nav.global-nav');
      const activitySection = document.querySelector('.feed-identity-module__actor-meta');
      
      // Si au moins un de ces éléments est présent, on est probablement connecté
      return !!(profileIcon || feedModule || navBar || activitySection);
    }).catch(error => {
      logger.warn(`Erreur lors de la vérification de connexion: ${error.message}`);
      return false; // En cas d'erreur, considérer comme non connecté
    });
    
    if (isLoggedIn) {
      logger.info('Authentification LinkedIn réussie');
      
      
      // Si une URL de liste est fournie, naviguer directement vers celle-ci
      if (listUrl) {
        logger.info(`Navigation directe vers la liste Sales Navigator: ${listUrl}`);
        
        try {
          await page.goto(listUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 120000
          });
          
          // Attendre un peu pour le chargement complet
          await puppeteerUtils.waitForTimeout(null, 10000);
          
          logger.info('Page de liste Sales Navigator chargée');
          return true;
        } catch (navError) {
          logger.error(`Erreur lors de la navigation vers la liste: ${navError.message}`);
          
          // En cas de timeout, tenter de continuer quand même
          if (navError.name === 'TimeoutError') {
            logger.warn('Timeout atteint, mais on continue');
            return true;
          }
          
          throw navError;
        }
      }
      
      return true;
    } else {
      logger.error('CRITIQUE : Échec de l\'authentification LinkedIn');
      return false;
    }
  } catch (error) {
    logger.error(`CRITIQUE : Erreur lors de l'authentification: ${error.message}`, { 
      stack: error.stack 
    });
    throw error;
  }
};

/**
 * Gère le consentement aux cookies LinkedIn
 * @param {Page} page - L'instance de la page Puppeteer
 * @returns {Promise<boolean>} True si le consentement a été géré
 */
async function handleCookieConsent(page) {
  logger.info('Vérification et gestion du consentement aux cookies LinkedIn');
  
  try {
    // Attendre un court moment pour que la page charge complètement
    await puppeteerUtils.waitForTimeout(null, 3000);
    
    // Vérifier si la fenêtre de consentement aux cookies est présente
    const isCookieConsentVisible = await page.evaluate(() => {
      // Rechercher les éléments de la fenêtre de consentement
      const cookieAlert = document.querySelector('.artdeco-global-alert__body');
      const cookieTitle = document.querySelector('.artdeco-global-alert__content h1');
      
      if (cookieAlert && cookieTitle) {
        const titleText = cookieTitle.textContent.trim();
        return titleText.includes('confidentialité') || 
               titleText.includes('privacy') || 
               titleText.includes('cookie');
      }
      return false;
    }).catch(error => {
      console.error('Erreur lors de la vérification du consentement aux cookies:', error.message);
      return false;
    });
    
    if (isCookieConsentVisible) {
      logger.info('Fenêtre de consentement aux cookies détectée');
      
      // Accepter les cookies en cliquant sur le bouton "Accepter"
      const acceptBtnClicked = await page.evaluate(() => {
        // Rechercher les boutons d'action
        const acceptButtons = Array.from(document.querySelectorAll('.artdeco-global-alert__action'));
        
        // Trouver le bouton Accepter
        const acceptBtn = acceptButtons.find(btn => 
          btn.textContent.trim().toLowerCase() === 'accepter' || 
          btn.textContent.trim().toLowerCase() === 'accept'
        );
        
        if (acceptBtn) {
          acceptBtn.click();
          return true;
        }
        
        return false;
      });
      
      if (acceptBtnClicked) {
        logger.info('Cookies acceptés avec succès');
        
        // Attendre que la fenêtre disparaisse
        await puppeteerUtils.waitForTimeout(null, 2000);
        return true;
      } else {
        logger.warn('Bouton d\'acceptation des cookies non trouvé');
        
        // Essayer une méthode alternative plus générique
        await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            if (btn.textContent.trim().toLowerCase().includes('accept') || 
                btn.textContent.trim().toLowerCase().includes('accepter')) {
              btn.click();
              return true;
            }
          }
          return false;
        });
        
        // Attendre un moment pour voir si l'action a eu un effet
        await puppeteerUtils.waitForTimeout(null, 2000);
      }
    } else {
      logger.info('Aucune fenêtre de consentement aux cookies détectée');
    }
    
    return false;
  } catch (error) {
    logger.warn(`Erreur lors de la gestion du consentement aux cookies: ${error.message}`);
    return false;
  }
}

/**
 * Vérifie si un CAPTCHA est présent sur la page
 * @param {Page} page - L'instance de la page Puppeteer
 * @returns {Promise<boolean>} True si un CAPTCHA est détecté
 */
const isCaptchaPresent = async (page) => {
  logger.debug('Vérification de la présence d\'un CAPTCHA');
  
  return await page.evaluate(() => {
    const bodyText = document.body.innerText.toLowerCase();
    return bodyText.includes('captcha') || 
           bodyText.includes('vérification') ||
           bodyText.includes('verification') ||
           bodyText.includes('security check') ||
           bodyText.includes('contrôle de sécurité') ||
           document.querySelector('iframe[src*="captcha"]') !== null;
  });
};

/**
 * Vérifie si LinkedIn a détecté une activité suspecte
 * @param {Page} page - L'instance de la page Puppeteer
 * @returns {Promise<boolean>} True si une activité suspecte est détectée
 */
const isSuspiciousActivityDetected = async (page) => {
  logger.debug('Vérification de la détection d\'activité suspecte');
  
  return await page.evaluate(() => {
    const bodyText = document.body.innerText.toLowerCase();
    return bodyText.includes('unusual activity') ||
           bodyText.includes('activité inhabituelle') ||
           bodyText.includes('unusual sign in activity') ||
           bodyText.includes('activité de connexion inhabituelle');
  });
};

/**
 * Gère les situations d'erreur spécifiques de LinkedIn
 * @param {Page} page - L'instance de la page Puppeteer
 * @returns {Promise<Object>} Statut et message d'erreur
 */
const handleLinkedInErrors = async (page) => {
  logger.debug('Vérification des erreurs LinkedIn potentielles');
  
  // Vérifier la présence de CAPTCHA
  if (await isCaptchaPresent(page)) {
    logger.warn('CAPTCHA détecté - intervention humaine requise');
    return { 
      status: 'captcha',
      message: 'CAPTCHA détecté. Intervention humaine requise.'
    };
  }
  
  // Vérifier l'activité suspecte
  if (await isSuspiciousActivityDetected(page)) {
    logger.warn('Activité suspecte détectée par LinkedIn');
    return { 
      status: 'suspicious',
      message: 'LinkedIn a détecté une activité suspecte. Intervention requise.'
    };
  }
  
  // Vérifier si la page est bloquée/limite de quota atteinte
  const isBlocked = await page.evaluate(() => {
    const bodyText = document.body.innerText.toLowerCase();
    return bodyText.includes('youve reached the commercial use limit') ||
           bodyText.includes('vous avez atteint la limite d\'utilisation commerciale') ||
           bodyText.includes('out of search requests') ||
           bodyText.includes('plus de requêtes de recherche');
  });
  
  if (isBlocked) {
    logger.warn('LinkedIn a bloqué les requêtes - limite atteinte');
    return { 
      status: 'blocked',
      message: 'Limite de requêtes LinkedIn atteinte. Essayez à nouveau plus tard.'
    };
  }
  
  return { status: 'ok', message: 'Aucune erreur détectée' };
};

/**
 * Ferme proprement une instance de navigateur
 * @param {Browser} browser - L'instance du navigateur à fermer
 * @param {boolean} force - Si true, force la fermeture même si c'est une session du pool
 * @returns {Promise<void>}
 */
const closeBrowser = async (browser, force = false) => {
  if (!browser) return;
  
  try {
    // Si c'est une session hors pool
    if (browser._isOutOfPool) {
      logger.info('Fermeture directe dune session hors pool');
      const originalClose = browser.constructor.prototype.close;
      await originalClose.call(browser);
      return;
    }
    
    // Si c'est une session du pool et qu'on ne force pas la fermeture
    if (browser._poolSessionId && !force) {
      // IMPORTANT: Empêcher les doubles libérations
      const tempId = browser._poolSessionId;
      browser._poolSessionId = null;
      
      logger.info(`Libération de la session du pool ${tempId}`);
      await browserPoolService.releaseSession(tempId);
    } else {
      // Sinon, fermeture directe
      logger.info('Fermeture directe du navigateur');
      
      // Si c'est une session du pool mais avec force=true, on nettoie d'abord
      if (browser._poolSessionId && force) {
        logger.warn(`Fermeture forcée d'une session du pool ${browser._poolSessionId}`);
        try {
          // Informer le pool que cette session va être fermée directement
          await browserPoolService.releaseSession(browser._poolSessionId);
        } catch (releaseError) {
          logger.warn(`Erreur lors de la libération forcée: ${releaseError.message}`);
        }
      }
      
      // Utiliser la méthode originale pour fermer
      const originalClose = browser.constructor.prototype.close;
      await originalClose.call(browser);
    }
  } catch (error) {
    logger.error(`Erreur lors de la fermeture du navigateur: ${error.message}`);
    
    // En cas d'erreur, tenter une fermeture forcée
    try {
      if (browser.process() != null) {
        browser.process().kill('SIGKILL');
        logger.warn('Navigateur fermé avec SIGKILL après échec de fermeture normale');
      }
    } catch (killError) {
      logger.error(`Échec de fermeture forcée: ${killError.message}`);
    }
  }
};

/**
 * Récupère l'état du pool de navigateurs
 * @returns {Object} État actuel du pool
 */
const getPoolStatus = () => {
  return {
    available: browserPoolService.getAvailableSessionCount(),
    inUse: browserPoolService.getInUseSessionCount(),
    temporary: browserPoolService.getTemporarySessionCount(),
    total: browserPoolService.getAvailableSessionCount() + browserPoolService.getInUseSessionCount(),
    maxSessions: browserPoolService.maxSessions
  };
};

module.exports = {
  launchBrowser,
  createStealthPage,
  authenticateWithCookies,
  isCaptchaPresent,
  isSuspiciousActivityDetected,
  handleLinkedInErrors,
  handleCookieConsent,
  closeBrowser,
  getPoolStatus
};