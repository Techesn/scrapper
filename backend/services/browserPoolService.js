// services/browserPoolService.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Activer le plugin stealth
puppeteer.use(StealthPlugin());

class BrowserPoolService {
  constructor(maxSessions = 2) {
    this.maxSessions = maxSessions;
    this.sessions = []; // Sessions disponibles
    this.inUseSessions = new Map(); // Sessions en cours d'utilisation
    this.waitQueue = []; // File d'attente
    this.isInitialized = false;
    this.temporarySessions = new Set(); // Suivi des sessions temporaires
  }

  async init() {
    if (this.isInitialized) return;
    
    logger.info(`Initialisation du pool de navigateurs avec ${this.maxSessions} sessions maximum`);
    
    try {
      // Pré-initialiser toutes les sessions autorisées
      const initPromises = [];
      for (let i = 0; i < this.maxSessions; i++) {
        initPromises.push(this._createNewSession());
      }
      
      // Attendre que toutes les sessions soient créées
      const sessions = await Promise.all(initPromises);
      this.sessions = sessions;
      
      this.isInitialized = true;
      logger.info(`Pool de navigateurs initialisé avec ${this.sessions.length} sessions disponibles`);
    } catch (error) {
      logger.error(`Erreur lors de l'initialisation du pool de navigateurs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtient une session de navigateur du pool
   * @param {boolean} temporary - Si true, la session sera fermée après utilisation au lieu d'être remise dans le pool
   * @returns {Promise<{sessionId: string, browser: Browser, page: Page, temporary: boolean}>}
   */
  async getSession(temporary = false) {
    if (!this.isInitialized) {
      await this.init();
    }
    
    // S'il y a une session disponible, la réutiliser
    if (this.sessions.length > 0) {
      const session = this.sessions.pop();
      const sessionId = uuidv4();
      
      // Ajouter aux sessions en cours d'utilisation
      this.inUseSessions.set(sessionId, { ...session, temporary });
      
      // Si c'est temporaire, l'ajouter au Set des sessions temporaires
      if (temporary) {
        this.temporarySessions.add(sessionId);
      }
      
      logger.info(`Session de navigateur ${sessionId} attribuée depuis le pool (temporaire: ${temporary})`);
      return { sessionId, ...session, temporary };
    }
    
    // Si toutes les sessions sont utilisées mais c'est une demande temporaire
    if (temporary) {
      logger.info(`Création d'une session temporaire supplémentaire (au-delà du max de ${this.maxSessions})`);
      const session = await this._createNewSession();
      const sessionId = uuidv4();
      
      // Ajouter aux sessions en cours d'utilisation et marquer comme temporaire
      this.inUseSessions.set(sessionId, { ...session, temporary: true });
      this.temporarySessions.add(sessionId);
      
      logger.info(`Nouvelle session temporaire ${sessionId} créée et attribuée`);
      return { sessionId, ...session, temporary: true };
    }
    
    // Si on a atteint le maximum et ce n'est pas temporaire, mettre en file d'attente
    logger.info('Toutes les sessions sont utilisées, mise en file d\'attente');
    
    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Libère une session de navigateur pour qu'elle puisse être réutilisée
   * @param {string} sessionId - ID de la session à libérer
   */
  async releaseSession(sessionId) {
    if (!this.inUseSessions.has(sessionId)) {
      logger.warn(`Tentative de libération d'une session inconnue: ${sessionId}`);
      return;
    }
    
    const sessionInfo = this.inUseSessions.get(sessionId);
    const { browser, page, temporary } = sessionInfo;
    
    // Supprimer d'abord des structures de données
    this.inUseSessions.delete(sessionId);
    if (this.temporarySessions.has(sessionId)) {
      this.temporarySessions.delete(sessionId);
    }
    
    try {
      if (temporary) {
        // Si c'est une session temporaire, la fermer complètement
        logger.info(`Fermeture de la session temporaire ${sessionId}`);
        try {
          await browser.close();
          logger.info(`Session temporaire ${sessionId} fermée avec succès`);
        } catch (closeError) {
          logger.error(`Erreur lors de la fermeture de la session temporaire ${sessionId}: ${closeError.message}`);
        }
        return;
      }
      
      // Vérifier si la page est toujours valide
      let isValid = false;
      try {
        // Tenter d'accéder à une propriété de la page pour voir si elle est encore valide
        await page.evaluate(() => document.title);
        isValid = true;
      } catch (error) {
        logger.warn(`Session ${sessionId} invalide: ${error.message}`);
        isValid = false;
      }
      
      if (isValid) {
        try {
          // Nettoyer la session avant de la réutiliser
          await this._cleanSession({ browser, page });
          
          // Si la file d'attente n'est pas vide, attribuer cette session au prochain en attente
          if (this.waitQueue.length > 0) {
            const resolve = this.waitQueue.shift();
            const newSessionId = uuidv4();
            
            this.inUseSessions.set(newSessionId, { browser, page, temporary: false });
            logger.info(`Session ${sessionId} réattribuée à la demande en attente avec ID ${newSessionId}`);
            
            resolve({ sessionId: newSessionId, browser, page, temporary: false });
          } else {
            // Sinon, remettre la session dans le pool
            this.sessions.push({ browser, page });
            logger.info(`Session ${sessionId} remise dans le pool pour réutilisation`);
          }
        } catch (cleanError) {
          logger.error(`Erreur lors du nettoyage de la session ${sessionId}: ${cleanError.message}`);
          await this._replaceInvalidSession(sessionId);
        }
      } else {
        // La session n'est pas valide, la recréer
        await this._replaceInvalidSession(sessionId);
      }
    } catch (error) {
      logger.error(`Erreur lors de la libération de la session ${sessionId}: ${error.message}`);
      
      // En cas d'erreur grave, tenter de fermer le navigateur
      try {
        await browser.close();
      } catch (closeError) {
        logger.error(`Erreur lors de la fermeture du navigateur pour la session ${sessionId}: ${closeError.message}`);
      }
      
      // Créer une nouvelle session pour remplacer celle-ci
      try {
        const newSession = await this._createNewSession();
        
        if (this.waitQueue.length > 0) {
          const resolve = this.waitQueue.shift();
          const newSessionId = uuidv4();
          
          this.inUseSessions.set(newSessionId, { ...newSession, temporary: false });
          resolve({ sessionId: newSessionId, ...newSession, temporary: false });
        } else {
          this.sessions.push(newSession);
        }
      } catch (createError) {
        logger.error(`Erreur lors de la création d'une session de remplacement: ${createError.message}`);
      }
    }
  }

  /**
   * Remplace une session invalide
   * @private
   * @param {string} oldSessionId - ID de la session à remplacer
   */
  async _replaceInvalidSession(oldSessionId) {
    try {
      logger.warn(`Remplacement de la session invalide ${oldSessionId}`);
      
      // Tenter de fermer l'ancien navigateur
      try {
        const oldSession = this.inUseSessions.get(oldSessionId);
        if (oldSession && oldSession.browser) {
          await oldSession.browser.close();
        }
      } catch (closeError) {
        logger.error(`Erreur lors de la fermeture de l'ancien navigateur: ${closeError.message}`);
      }
      
      // Créer une nouvelle session
      const newSession = await this._createNewSession();
      
      // Si des requêtes sont en attente, attribuer la nouvelle session
      if (this.waitQueue.length > 0) {
        const resolve = this.waitQueue.shift();
        const newSessionId = uuidv4();
        
        this.inUseSessions.set(newSessionId, { ...newSession, temporary: false });
        resolve({ sessionId: newSessionId, ...newSession, temporary: false });
        logger.info(`Nouvelle session ${newSessionId} attribuée à une requête en attente`);
      } else {
        // Sinon, ajouter au pool
        this.sessions.push(newSession);
        logger.info(`Nouvelle session ajoutée au pool en remplacement de ${oldSessionId}`);
      }
    } catch (error) {
      logger.error(`Erreur lors du remplacement de la session ${oldSessionId}: ${error.message}`);
    }
  }

  /**
   * Ferme tous les navigateurs et vide le pool
   */
  async closeAll() {
    logger.info('Fermeture de toutes les sessions de navigateur');
    
    const closePromises = [];
    
    // Fermer les sessions disponibles
    for (const session of this.sessions) {
      closePromises.push(
        session.browser.close().catch(error => {
          logger.warn(`Erreur lors de la fermeture d'une session: ${error.message}`);
        })
      );
    }
    
    // Fermer les sessions en cours d'utilisation
    for (const [sessionId, session] of this.inUseSessions.entries()) {
      closePromises.push(
        session.browser.close().catch(error => {
          logger.warn(`Erreur lors de la fermeture de la session ${sessionId}: ${error.message}`);
        })
      );
    }
    
    // Attendre que toutes les fermetures soient terminées
    await Promise.allSettled(closePromises);
    
    // Réinitialiser les structures de données
    this.sessions = [];
    this.inUseSessions.clear();
    this.temporarySessions.clear();
    
    // Rejeter toutes les demandes en attente
    for (const resolve of this.waitQueue) {
      resolve({ error: 'Les sessions ont été fermées' });
    }
    this.waitQueue = [];
    
    this.isInitialized = false;
    logger.info('Toutes les sessions fermées');
  }

  /**
   * Crée une nouvelle session de navigateur
   * @private
   * @returns {Promise<{browser: Browser, page: Page}>}
   */
  async _createNewSession() {
    logger.info('Création d\'une nouvelle session de navigateur');
    
    const browser = await puppeteer.launch({
      headless: false, // Mode visible - meilleur pour éviter la détection
      defaultViewport: null, // Utiliser la taille de fenêtre naturelle
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
    
    const page = await browser.newPage();
    
    // Configurer l'en-tête user-agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    );
    
    // Configurer pour éviter la détection
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
    
    logger.info('Nouvelle session de navigateur créée avec succès');
    return { browser, page };
  }

  /**
   * Nettoie une session (efface cookies, cache, etc.)
   * @private
   * @param {Object} session - Session à nettoyer
   */
  async _cleanSession(session) {
    try {
      const { page } = session;
      
      // Utiliser une approche plus douce pour le nettoyage
      // 1. Aller sur une page blanche
      await page.goto('about:blank', { waitUntil: 'load', timeout: 10000 })
        .catch(err => logger.warn(`Erreur lors de la navigation vers about:blank: ${err.message}`));
      
      // 2. Effacer les cookies et le cache via CDP de manière plus robuste
      try {
        const client = await page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
      } catch (cdpError) {
        logger.warn(`Erreur lors du nettoyage via CDP: ${cdpError.message}`);
        // Continuer malgré l'erreur
      }
      
      logger.debug('Session nettoyée avec succès');
      return true;
    } catch (error) {
      logger.error(`Erreur lors du nettoyage de la session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtient le nombre de sessions disponibles
   * @returns {number} Nombre de sessions disponibles
   */
  getAvailableSessionCount() {
    return this.sessions.length;
  }

  /**
   * Obtient le nombre de sessions en cours d'utilisation
   * @returns {number} Nombre de sessions en cours d'utilisation
   */
  getInUseSessionCount() {
    return this.inUseSessions.size;
  }

  /**
   * Obtient le nombre de sessions temporaires
   * @returns {number} Nombre de sessions temporaires
   */
  getTemporarySessionCount() {
    return this.temporarySessions.size;
  }

  /**
   * Vérifie si une session est temporaire
   * @param {string} sessionId - ID de la session
   * @returns {boolean} True si la session est temporaire
   */
  isTemporarySession(sessionId) {
    return this.temporarySessions.has(sessionId);
  }
}

module.exports = new BrowserPoolService(2); // Initialiser avec 2 sessions maximum