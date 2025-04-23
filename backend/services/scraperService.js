const config = require('../config/config');
const logger = require('../utils/logger');
const browserUtils = require('../utils/browserUtils');
const humanBehavior = require('../utils/humanBehavior');
const Prospect = require('../models/prospect');
const { v4: uuidv4 } = require('uuid');
const puppeteerUtils = require('../utils/puppeteerUtils');
const Session = require('../models/session');
const AppSettings = require('../models/AppSettings');


/**
 * Recherche un profil LinkedIn via l'API Brave Search
 * @param {Object} prospectData - Données du prospect
 * @returns {Promise<string>} URL du profil LinkedIn si trouvée
 */
async function searchLinkedInProfileViaBrave(prospectData) {
  const { firstName, lastName, company, jobTitle } = prospectData;
  const fullName = `${firstName} ${lastName}`;
  
  logger.info(`🔍 Recherche Brave pour le profil LinkedIn de ${fullName}`);
  
  try {
    // Construction de la requête
    const query = encodeURIComponent(`"${fullName}" ${company || ''} "${jobTitle || ''}" site:linkedin.com/in`);
    const apiUrl = `https://api.search.brave.com/res/v1/web/search?q=${query}&search_lang=fr`;
    
    // Headers pour l'authentification et le format
    const headers = {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': process.env.BRAVE_API_KEY || 'votre_clé_api_brave'
    };
    
    // Effectuer la requête avec node-fetch
    const fetch = require('node-fetch');
    const response = await fetch(apiUrl, { headers });
    
    if (!response.ok) {
      throw new Error(`API Brave retourne une erreur: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extraire les résultats
    const results = data.web && data.web.results ? data.web.results : [];
    
    if (results.length === 0) {
      logger.warn(`⚠️ Aucun résultat trouvé pour ${fullName}`);
      return '';
    }
    
    // Filtrer pour ne garder que les liens vers des profils LinkedIn
    const linkedInProfiles = results.filter(result => {
      const url = result.url || '';
      return url.includes('linkedin.com/in/') && !url.includes('/dir/');
    });
    
    if (linkedInProfiles.length > 0) {
      const profileUrl = linkedInProfiles[0].url;
      logger.info(`✅ Profil LinkedIn trouvé via Brave: ${profileUrl}`);
      return profileUrl;
    } else {
      logger.warn(`⚠️ Aucun profil LinkedIn trouvé dans les résultats pour ${fullName}`);
      return '';
    }
    
  } catch (error) {
    logger.error(`❌ Erreur lors de la recherche Brave: ${error.message}`, { stack: error.stack });
    return '';
  }
}
class ScraperService {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.isPaused = false;
    this.sessionId = null;
    this.listUrl = null;
    this.scrapedProfiles = 0;
    this.scrapingStatus = 'idle';
    this.dailyLimit = config.linkedin.scraping.dailyProspectLimit;
    this.lastScrapedPosition = 0;
    this.currentProgressCallback = null;
    this.selectors = config.selectors.salesNavigator;
    this.sessionObjectId = null;
    this.totalProspectsCount = 0;
    this.lastProspectName = '';
    this.currentPage = 1;
    
    // S'abonner aux événements de changement d'état du cookie
    const authService = require('../services/authService');
    authService.on('cookieBecameInvalid', async () => {
      logger.warn('Cookie LinkedIn devenu invalide - Pause du scraping');
      await this.pauseScraping();
    });
  }

  async initialize() {
    logger.info('Initialisation du service de scraping');
    
    try {
      // Charger les paramètres
      await this._loadSettings();
      
      // Vérifier d'abord la validité du cookie
      const Cookie = require('../models/Cookie');
      const cookieRecord = await Cookie.findOne({ name: 'linkedin_li_at' });
      
      if (!cookieRecord || !cookieRecord.isValid) {
        logger.error('Cookie LinkedIn invalide ou expiré');
        throw new Error('Cookie LinkedIn invalide ou expiré');
      }
      
      // Sauvegarder temporairement la valeur du compteur
      const currentScrapedProfiles = this.scrapedProfiles || 0;
      
      // Vérifier si une session est déjà en cours
      if (this.browser) {
        logger.info('Fermeture de la session précédente');
        await this.close();
      }
      
      // Générer un nouvel ID de session
      this.sessionId = uuidv4();
      
      // NE PAS réinitialiser scrapedProfiles ici, mais plutôt restaurer sa valeur
      this.scrapedProfiles = currentScrapedProfiles;
      
      this.lastScrapedPosition = 0;
      this.scrapingStatus = 'initializing';
      
      logger.info(`Compteur préservé après initialisation: ${this.scrapedProfiles}`);
      
      // Lancer le navigateur
      // Utiliser une session NON temporaire car le scraping est une opération longue
      // qui pourrait dépasser les capacités du pool
      this.browser = await browserUtils.launchBrowser(true, true);
      this.page = await browserUtils.createStealthPage(this.browser);
      
      // Authentification à LinkedIn
      const isAuthenticated = await browserUtils.authenticateWithCookies(this.page);
      if (!isAuthenticated) {
        throw new Error('Échec de l\'authentification à LinkedIn');
      }
      
      // Vérifier le quota journalier
      const todayCount = await Prospect.countScrapedToday();
      logger.info(`Profils déjà scrapés aujourd'hui: ${todayCount}/${this.dailyLimit}`);
      
      if (todayCount >= this.dailyLimit) {
        throw new Error(`Limite quotidienne de ${this.dailyLimit} profils atteinte`);
      }
      
      this.scrapingStatus = 'ready';
      logger.info('Service de scraping initialisé avec succès');
    } catch (error) {
      this.scrapingStatus = 'error';
      logger.error(`Erreur lors de l'initialisation: ${error.message}`, { stack: error.stack });
      await this.close();
      throw error;
    }
  }

  /**
   * Démarre le processus de scraping
   * @param {string} listUrl - URL de la liste Sales Navigator à scraper
   * @param {Function} progressCallback - Callback pour les mises à jour de progression
   * @returns {Promise<Object>} Résultat du scraping
   */
  async startScraping(listUrl, sessionName = "Session de scraping", sessionId = null) {
    if (!listUrl || !listUrl.includes('linkedin.com/sales/')) {
      throw new Error('URL de liste Sales Navigator invalide');
    }
    
    this.listUrl = listUrl;
    this.isRunning = true;
    this.isPaused = false;
    this.scrapingStatus = 'running';
    
    // Si sessionId est fourni, c'est une reprise de session
    if (sessionId) {
      this.sessionObjectId = sessionId;
      
      // Charger les informations existantes pour la reprise
      const session = await Session.findById(sessionId);
      if (session) {
        this.scrapedProfiles = parseInt(session.scrapedProspectsCount || 0);
        this.currentPage = parseInt(session.currentPage || 1);
        this.lastProspectName = session.lastProspectName || '';
        logger.info(`Reprise de session: Compteur chargé = ${this.scrapedProfiles}, Page = ${this.currentPage}`);
      }
    } else {
      // C'est une nouvelle session, réinitialiser le compteur à 0
      this.scrapedProfiles = 0;
      this.lastProspectName = '';
      this.currentPage = 1;
      logger.info(`Nouvelle session: Compteur réinitialisé à 0`);
    }
    
    logger.info(`Démarrage du scraping pour la liste: ${listUrl}`);
    
    try {
      // Initialiser si nécessaire
      if (!this.browser || !this.page) {
        await this.initialize();
      }
      
      // Accéder à l'URL de la liste
      await this.page.goto(this.listUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      logger.info(`Navigation vers: ${listUrl}`);
      logger.info('⏰ Attente de 5 secondes pour le chargement complet de la page...');

      await puppeteerUtils.waitForTimeout(this.page, 5000);
      // Gérer les erreurs potentielles de LinkedIn
      const linkedinStatus = await browserUtils.handleLinkedInErrors(this.page);
      if (linkedinStatus.status !== 'ok') {
        throw new Error(linkedinStatus.message);
      }
      
      this.totalProspectsCount = await this._getTotalProspectsCount();
      logger.info(`Nombre total de prospects détectés: ${this.totalProspectsCount}`);
      
      // Si pas de sessionId, créer une nouvelle session
      if (!this.sessionObjectId) {
        const session = new Session({
          name: sessionName,
          type: 'scraping',
          status: 'running',
          sourceUrl: listUrl,
          totalProspectsCount: this.totalProspectsCount, // S'assurer que cette valeur est bien définie
          scrapedProspectsCount: 0,
          currentPage: 1,
          lastProspectName: '',
          isCompleted: false
        });
        
        const savedSession = await session.save();
        this.sessionObjectId = savedSession._id;
        
        logger.info(`Session créée avec l'ID: ${this.sessionObjectId}`);
      } else {
        // Si la session existe déjà, mettre à jour le nombre total de prospects
        await Session.findByIdAndUpdate(
          this.sessionObjectId,
          { totalProspectsCount: this.totalProspectsCount }
        );
        logger.info(`Nombre total de prospects mis à jour dans la session: ${this.totalProspectsCount}`);
      }
      
      // Scraper la liste
      const result = await this._scrapeList();

    // Vérifier si le scraping a été mis en pause
    if (!result.paused) {
      // Mettre à jour la session seulement si le scraping n'est pas en pause
      await Session.findByIdAndUpdate(
        this.sessionObjectId,
        { 
          status: 'completed',
          endDate: new Date(),
          isCompleted: this.scrapedProfiles >= this.totalProspectsCount,
          scrapedProspectsCount: this.scrapedProfiles
        }
      );
      
      this.scrapingStatus = 'completed';
      logger.info(`Scraping terminé: ${result.scrapedProfiles}/${this.totalProspectsCount} profils extraits`);
      
      // Fermer immédiatement le navigateur comme dans connectionChecker
      logger.info('🏁 Liste entièrement scrappée. Fermeture du navigateur...');
      
      // Utiliser this.close() qui appelle browserUtils.closeBrowser() correctement
      await this.close();
      
      logger.info('✅ Navigateur fermé avec succès après la fin du scraping');
    } else {
      // Si en pause, ne pas changer le statut
      logger.info(`Scraping en pause: ${result.scrapedProfiles}/${this.totalProspectsCount} profils extraits jusqu'à présent`);
    }

      return result;
      } catch (error) {
        this.scrapingStatus = 'error';
        logger.error(`Erreur lors du scraping: ${error.message}`, { stack: error.stack });
        
        // Mettre à jour la session en cas d'erreur
        if (this.sessionObjectId) {
          await Session.findByIdAndUpdate(
            this.sessionObjectId,
            { 
              status: 'error',
              endDate: new Date()
            }
          );
        }
        
        throw error;
      } finally {
        // Ne pas mettre isRunning à false ici si on est en pause
        if (!this.isPaused) {
          this.isRunning = false;
        }
      }
    }

    async pauseScraping() {
      if (this.isRunning && !this.isPaused) {
        logger.info('Mise en pause du processus de scraping');
        this.isPaused = true;
        this.isRunning = false;
        this.scrapingStatus = 'paused';
        
        // Log du nombre de prospects scrapés avant pause
        logger.info(`Nombre de prospects scrapés avant pause: ${this.scrapedProfiles}`);
        
        // Mettre à jour la session dans la base de données
        if (this.sessionObjectId) {
          await Session.findByIdAndUpdate(
            this.sessionObjectId,
            {
              status: 'paused',
              currentPage: this.currentPage,
              lastProspectName: this.lastProspectName,
              scrapedProspectsCount: this.scrapedProfiles
            }
          );
          
          // Vérification après mise à jour
          const updatedSession = await Session.findById(this.sessionObjectId);
          logger.info(`Session mise à jour avant pause: scrapedProspectsCount=${updatedSession.scrapedProspectsCount}`);
        }
        
        // Attendre 10 secondes pour s'assurer que les opérations en cours sont terminées
        logger.info('Attente de 10 secondes avant de fermer le navigateur...');
        await puppeteerUtils.waitForTimeout(null, 15000);
        
        // Fermer l'instance du navigateur Chrome
        if (this.browser) {
          try {
            logger.info('Fermeture de l\'instance du navigateur via browserUtils');
            await browserUtils.closeBrowser(this.browser);
            this.browser = null;
            this.page = null;
            logger.info('Instance du navigateur fermée avec succès');
          }
          catch (error) {
            logger.error(`Erreur lors de la fermeture du navigateur: ${error.message}`);
          }
        }
        
        logger.info('Scraping mis en pause avec succès');
      }
    }
  /**
   * Reprend le processus de scraping
   */
  async resumeScraping() {
    if (this.isPaused) {
      logger.info('Reprise du processus de scraping');
      this.isPaused = false;
      this.isRunning = true; 
      this.scrapingStatus = 'running';
      
      try {
        // Mettre à jour la session
        if (this.sessionObjectId) {
          await Session.findByIdAndUpdate(
            this.sessionObjectId,
            { status: 'running' }
          );
        }
        
        // Vérifier si la page est toujours valide
        if (!this.page || !this.browser) {
          logger.info('Initialisation d\'une nouvelle instance de navigateur');
          // Utiliser une session NON temporaire pour le scraping
          this.browser = await browserUtils.launchBrowser(true, true);
          this.page = await browserUtils.createStealthPage(this.browser);
          
          // Construire l'URL directe de la page où on s'est arrêté
          const baseUrl = this.listUrl.split('?')[0]; 
          const pageParam = this.currentPage > 1 ? `?page=${this.currentPage}` : '';
          
          // Vérifier si l'URL de base contient déjà des paramètres
          const urlParams = new URL(this.listUrl).searchParams;
          let additionalParams = '';
          
          // Conserver les autres paramètres s'ils existent (tri, filtre, etc.)
          for (const [key, value] of urlParams.entries()) {
            if (key !== 'page') {
              additionalParams += additionalParams || pageParam ? '&' : '?';
              additionalParams += `${key}=${value}`;
            }
          }
          
          // Construire l'URL finale
          const directPageUrl = `${baseUrl}${pageParam}${additionalParams}`;
          
          // Authentifier
          const isAuthenticated = await browserUtils.authenticateWithCookies(this.page);
          if (!isAuthenticated) {
            throw new Error('Échec de l\'authentification LinkedIn lors de la reprise');
          }
          
          logger.info(`Navigation directe vers la page ${this.currentPage}: ${directPageUrl}`);
          await this.page.goto(directPageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          
          // Ajouter un délai d'au moins 5 secondes
          logger.info('⏰ Attente de 5 secondes pour le chargement complet de la page...');
          await puppeteerUtils.waitForTimeout(this.page, 5000);
          // Ajouter un délai aléatoire pour un comportement plus humain
          await humanBehavior.randomDelay();
          
          // Attendre que la page soit chargée
          await this.page.waitForSelector(this.selectors.prospectRow, { 
            timeout: 30000,
            visible: true 
          });
          
          // Reprendre le scraping à partir de la dernière position
          await this._scrapeList(true); // Paramètre pour indiquer une reprise
        } else {
          // Si le navigateur existe toujours, utiliser la même approche
          // Construire l'URL directe de la page
          const baseUrl = this.listUrl.split('?')[0]; 
          const directPageUrl = `${baseUrl}?page=${this.currentPage}`;
          
          logger.info(`Navigation directe vers la page ${this.currentPage}: ${directPageUrl}`);
          await this.page.goto(directPageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          
          // Ajouter un délai suffisant
          await puppeteerUtils.waitForTimeout(this.page, 5000);
          
          // Reprendre le scraping à partir de la dernière position
          await this._scrapeList(true);
        }
      } catch (error) {
        this.scrapingStatus = 'error';
        logger.error(`Erreur lors de la reprise: ${error.message}`, { stack: error.stack });
        
        // Mettre à jour la session en cas d'erreur
        if (this.sessionObjectId) {
          await Session.findByIdAndUpdate(
            this.sessionObjectId,
            { status: 'error' }
          );
        }
        
        throw error;
      }
    }
  }

  /**
   * Arrête le processus de scraping et ferme le navigateur
   */
  async close() {
    logger.info('Fermeture du service de scraping');
    
    this.isRunning = false;
    this.isPaused = false;
    
    // Mettre à jour la session si elle existe
    if (this.sessionObjectId) {
      await Session.findByIdAndUpdate(
        this.sessionObjectId,
        { 
          status: 'completed',
          endDate: new Date(),
          scrapedProspectsCount: this.scrapedProfiles
        }
      );
    }
    
    if (this.browser) {
      try {
        // Utiliser browserUtils.closeBrowser au lieu de this.browser.close()
        await browserUtils.closeBrowser(this.browser);
        logger.info('Navigateur fermé avec succès via browserUtils');
      } catch (error) {
        logger.error(`Erreur lors de la fermeture du navigateur: ${error.message}`);
      }
    }
    
    this.browser = null;
    this.page = null;
    this.scrapingStatus = 'idle';
  }
  

  /**
   * Obtient le statut actuel du scraping
   * @returns {Object} Informations sur le statut
   */
  async getStatus() {
    try {
      // Obtenir le nombre de profils scrapés aujourd'hui
      const todayCount = await Prospect.countScrapedToday();
      
      // Récupérer la session active si elle existe
      let sessionData = {};
      if (this.sessionObjectId) {
        const session = await Session.findById(this.sessionObjectId);
        if (session) {
          sessionData = {
            id: session._id,
            name: session.name,
            type: session.type,
            startDate: session.startDate,
            totalProspectsCount: session.totalProspectsCount,
            scrapedProspectsCount: session.scrapedProspectsCount,
            currentPage: session.currentPage,
            lastProspectName: session.lastProspectName,
            status: session.status
          };
        }
      }
      
      return {
        status: this.scrapingStatus,
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        scrapedProfiles: this.scrapedProfiles,
        sessionId: this.sessionId,
        sessionObjectId: this.sessionObjectId,
        session: sessionData,
        listUrl: this.listUrl,
        lastScrapedPosition: this.lastScrapedPosition,
        currentPage: this.currentPage,
        totalProspectsCount: this.totalProspectsCount,
        lastProspectName: this.lastProspectName,
        dailyQuota: {
          limit: this.dailyLimit,
          used: todayCount
        }
      };
    } catch (error) {
      logger.error(`Erreur lors de la récupération du statut: ${error.message}`);
      // Retourner un objet par défaut en cas d'erreur
      return {
        status: this.scrapingStatus,
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        scrapedProfiles: this.scrapedProfiles,
        sessionId: this.sessionId,
        listUrl: this.listUrl,
        lastScrapedPosition: this.lastScrapedPosition,
        dailyQuota: {
          limit: this.dailyLimit,
          used: 0
        }
      };
    }
  }

/**
 * Scrape la liste de prospects avec gestion de la pagination
 * @private
 * @returns {Promise<Object>} Résultat du scraping
 */
async _scrapeList(isResume = false) {
  logger.info('🚀 Début du processus de scraping de la liste Sales Navigator');
  
  // Initialisation des compteurs en tenant compte des valeurs existantes
  let scrapedCount = this.scrapedProfiles || 0;
  
  // Log du nombre actuel de prospects scrapés
  logger.info(`Reprise avec ${scrapedCount} prospects déjà scrapés`);
  
  let currentPage = this.currentPage || 1;
  let hasMorePages = true;
  
  // Quota journalier
  const todayCount = await Prospect.countScrapedToday();
  const remainingQuota = this.dailyLimit - todayCount;
  
  logger.info(`📊 Quota actuel : ${todayCount}/${this.dailyLimit} profils`);
  
  while (hasMorePages && this.isRunning && !this.isPaused && scrapedCount < remainingQuota) {
    logger.info(`📄 Traitement de la page ${currentPage}`);
    
    // Mettre à jour la page actuelle dans l'objet et dans la base de données
    this.currentPage = currentPage;
    if (this.sessionObjectId) {
      await Session.findByIdAndUpdate(
        this.sessionObjectId,
        { currentPage }
      );
    }
    
    // Attendre le chargement complet de la page
    try {
      await this.page.waitForSelector(this.selectors.prospectRow, { 
        timeout: 30000,
        visible: true 
      });
    } catch (error) {
      logger.error(`❌ Erreur lors de l'attente des prospects: ${error.message}`);
      logger.info('⚠️ Aucun prospect trouvé dans la liste - fin du scraping');
      break;
    }
    
    // Récupérer tous les éléments de prospects (lignes du tableau)
    const prospectRows = await this.page.$$(this.selectors.prospectRow);
    logger.info(`🔍 ${prospectRows.length} prospects détectés sur la page ${currentPage}`);
    
    // Vérification de base
    if (prospectRows.length === 0) {
      logger.warn('⚠️ Aucun prospect trouvé dans la liste - fin du scraping');
      break;
    }
    
    // Variable pour suivre si nous avons trouvé le dernier prospect lors d'une reprise
    let shouldStartScraping = !isResume; // Si ce n'est pas une reprise, commencer immédiatement
    let startIndex = 0;
    
    // Si c'est une reprise et qu'il y a un nom de dernier prospect, chercher sa position
    if (isResume && this.lastProspectName && this.lastProspectName.trim() !== '') {
      logger.info(`🔍 Recherche de la position du dernier prospect: ${this.lastProspectName}`);
      
      // Parcourir les prospects pour trouver le dernier traité
      for (let i = 0; i < prospectRows.length; i++) {
        const row = prospectRows[i];
        const name = await this._getProspectNameFromRow(row);
        
        if (name === this.lastProspectName) {
          logger.info(`✅ Dernier prospect trouvé à la position ${i}. Reprise à partir du prospect suivant.`);
          startIndex = i + 1; // Commencer au prospect suivant
          shouldStartScraping = true;
          break;
        }
      }
      
      // Si on ne trouve pas le prospect exact, commencer au début de la page
      if (!shouldStartScraping) {
        logger.warn(`⚠️ Dernier prospect "${this.lastProspectName}" non trouvé sur cette page. Reprise au début de la page.`);
        shouldStartScraping = true;
      }
    }
    
    // Parcours des prospects de la page courante
    for (let i = startIndex; i < prospectRows.length; i++) {
      // Vérifications de pause et de quota
      if (!this.isRunning || this.isPaused) {
        logger.info(`⏸️ Scraping mis en pause à la position ${i} de la page ${currentPage}`);
        
        // Mettre à jour la session en cas de pause
        if (this.sessionObjectId) {
          await Session.findByIdAndUpdate(
            this.sessionObjectId,
            {
              currentPage,
              scrapedProspectsCount: scrapedCount,
              status: 'paused'
            }
          );
        }
        
        return { 
          scrapedProfiles: scrapedCount,
          reachedLimit: false,
          totalProfiles: this.totalProspectsCount,
          paused: true  // Ajouter un flag qui indique que le processus a été mis en pause
        };
      }
      
      if (scrapedCount >= remainingQuota) {
        logger.warn('🛑 Quota journalier atteint');
        
        // Mettre à jour la session en cas d'atteinte de quota
        if (this.sessionObjectId) {
          await Session.findByIdAndUpdate(
            this.sessionObjectId,
            {
              scrapedProspectsCount: scrapedCount,
              status: 'paused',
              currentPage,
              lastProspectName: this.lastProspectName
            }
          );
        }
        
        return { 
          scrapedProfiles: scrapedCount,
          reachedLimit: true,
          totalProfiles: this.totalProspectsCount
        };
      }
      
      try {
        const prospectRow = prospectRows[i];
        
        // Scroll et mise en vue du prospect
        await this._scrollToProspect(prospectRow);
        
        // 1. Extraire les données de base du tableau
        const basicData = await this._extractBasicDataFromRow(prospectRow, i+1);
        
        // 2. Ouvrir la modale et extraire les données détaillées
        const isModalOpened = await this._clickProfileName(prospectRow, i+1);
        let detailedData = {};
        
        if (isModalOpened) {
          // Attendre que la modale soit chargée (délai fixe de 5 secondes)
          await puppeteerUtils.waitForTimeout(this.page, 5000);
          
          // Passer les données de base pour la recherche LinkedIn si nécessaire
          detailedData = await this._extractDetailedDataFromModal(basicData);
          await this._closeProspectModal();
          
          // Après avoir extrait les données détaillées, mettre à jour le nom du dernier prospect
          if (basicData.firstName && basicData.lastName) {
            this.lastProspectName = `${basicData.firstName} ${basicData.lastName}`;
            
            // Mettre à jour dans la session
            if (this.sessionObjectId) {
              await Session.findByIdAndUpdate(
                this.sessionObjectId,
                { lastProspectName: this.lastProspectName }
              );
            }
            
            logger.info(`✅ Dernier prospect mis à jour: ${this.lastProspectName}`);
          }
        } else {
          logger.warn(`⚠️ Impossible d'ouvrir la modale pour le prospect ${i+1}`);
        }
        
        // 3. Combiner les données de base et détaillées
        const completeData = {
          ...basicData,
          ...detailedData,
          scrapedAt: new Date(),
          sessionId: this.sessionObjectId,
          metadata: {
            source: 'Sales Navigator',
            listUrl: this.listUrl,
            scrapingSessionId: this.sessionId,
            page: currentPage
          }
        };
        
        // 4. Enregistrer le prospect
        const savedProspect = await this._saveProspect(completeData);
        

        if (savedProspect) {
          scrapedCount++;
          this.scrapedProfiles = scrapedCount; // Assurez-vous que cette ligne existe
          
          // Mettre à jour le compteur dans la session
          if (this.sessionObjectId) {
            await Session.findByIdAndUpdate(
              this.sessionObjectId,
              { 
                scrapedProspectsCount: scrapedCount,
                lastProspectName: this.lastProspectName
              }
            );
            
            // Ajoutez un log pour vérifier la mise à jour
            logger.info(`✅ Mise à jour du compteur de prospects dans la session: ${scrapedCount}`);
          }
        }
        
        // Délai entre les profils
        await puppeteerUtils.waitForTimeout(this.page, 1500);
        
      } catch (error) {
        logger.error(`❌ Erreur lors du traitement du prospect ${i+1} de la page ${currentPage}:`, {
          message: error.message,
          stack: error.stack
        });
      }
    } // Fin de la boucle for pour les prospects d'une page
    
    // Vérifier si on peut passer à la page suivante
    if (prospectRows.length === 25) { // Si on a 25 résultats, on est probablement sur une page complète
      const nextPageAvailable = await this._goToNextPage();
      if (nextPageAvailable) {
        currentPage++;
        logger.info(`✅ Navigation vers la page ${currentPage}`);
      } else {
        hasMorePages = false;
        logger.info('🏁 Fin des résultats - dernière page atteinte');
      }
    } else {
      hasMorePages = false; // Moins de 25 résultats, c'est probablement la dernière page
      logger.info('🏁 Dernière page détectée (moins de 25 résultats)');
    }
    
    // Petit délai entre les pages
    if (hasMorePages) {
      await puppeteerUtils.waitForTimeout(this.page, 3000);
    }
  } // Fin de la boucle while pour les pages
  
  logger.info(`✅ Scraping terminé : ${scrapedCount} profils extraits sur ${currentPage} pages`);

  return { 
    scrapedProfiles: scrapedCount, 
    reachedLimit: scrapedCount >= remainingQuota,
    totalProfiles: this.totalProspectsCount
  };
}




  /**
   * Extrait les données de base d'un prospect depuis la ligne du tableau
   * @private
   * @param {ElementHandle} prospectRow - Ligne du tableau contenant le prospect
   * @param {number} index - Numéro du prospect (pour les logs)
   * @returns {Promise<Object>} Données de base du prospect
   */
  async _extractBasicDataFromRow(prospectRow, index) {
    logger.info(`🔍 Extraction des données de base du prospect ${index}`);
    
    try {
      // Extraction des données de base
      const data = await this.page.evaluate((row) => {
        // Fonction utilitaire pour extraire du texte en toute sécurité
        const extractText = (selector, context) => {
          const element = context.querySelector(selector);
          return element ? element.textContent.trim() : '';
        };
        
        // Extraction du nom complet
        const nameElement = row.querySelector('a[data-anonymize="person-name"]');
        const fullName = nameElement ? nameElement.textContent.trim() : '';
        
        // Séparation prénom/nom
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Extraction du titre de poste
        const jobTitle = extractText('div[data-anonymize="job-title"]', row);
        
        // Extraction de l'entreprise 
        const company = extractText('span[data-anonymize="company-name"]', row);
        
        return {
          firstName,
          lastName,
          company,
          jobTitle
        };
      }, prospectRow);
      
      // Log des données extraites
      logger.info(`📄 Données de base extraites du prospect ${index}: ${JSON.stringify(data)}`);
      
      // S'assurer que les données minimales sont présentes
      if (!data.firstName) data.firstName = 'Unknown';
      if (!data.lastName) data.lastName = `User-${index}`;
      
      return data;
      
    } catch (error) {
      logger.error(`❌ Erreur lors de l'extraction des données de base du prospect ${index}: ${error.message}`);
      return {
        firstName: 'Unknown',
        lastName: `User-${index}`,
        company: '',
        jobTitle: ''
      };
    }
  }

  /**
   * Clique simplement sur le nom du profil pour ouvrir la modale
   * @private
   * @param {ElementHandle} prospectRow - Ligne du tableau contenant le prospect
   * @param {number} index - Numéro du prospect (pour les logs)
   * @returns {Promise<boolean>} Succès du clic
   */
  async _clickProfileName(prospectRow, index) {
    logger.info(`🔍 Ouverture de la modale du prospect ${index}`);
    
    try {
      // Trouver et cliquer sur le nom du prospect
      const nameSelector = this.selectors.profileName;
      const nameLink = await prospectRow.$(nameSelector);
      
      if (!nameLink) {
        logger.warn(`⚠️ Lien du nom introuvable pour le prospect ${index}`);
        return false;
      }
      
      // Obtenir la position du lien
      const box = await nameLink.boundingBox();
      if (!box) {
        logger.warn(`⚠️ Position du lien indéterminée pour le prospect ${index}`);
        return false;
      }
      
      // Cliquer sur le lien
      await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      logger.info(`✅ Clic sur le nom du prospect ${index}`);
      
      // On considère que le clic a réussi
      return true;
    } catch (error) {
      logger.error(`❌ Erreur lors du clic sur le nom du prospect ${index}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Extrait les données détaillées d'un prospect depuis la modale ouverte
   * @private
   * @returns {Promise<Object>} Données détaillées du prospect
   */
  async _extractDetailedDataFromModal(basicData) {
    logger.info('🔍 Extraction des données détaillées depuis la modale');
    
    try {
      // Extraction parallèle des données pour optimiser la performance
      const [linkedinProfileUrl, jobDescription] = await Promise.all([
        this._getLinkedInProfileUrl(basicData),
        this._getJobDescription()
      ]);
      
      return {
        linkedinProfileUrl,
        jobDescription
      };
    } catch (error) {
      logger.error(`❌ Erreur lors de l'extraction des données détaillées: ${error.message}`);
      return {
        linkedinProfileUrl: '',
        jobDescription: ''
      };
    }
  }
  
/**
 * Récupère l'URL LinkedIn du profil
 * @private
 * @param {Object} basicData - Données de base du prospect
 * @returns {Promise<string>} URL du profil LinkedIn
 */
async _getLinkedInProfileUrl(basicData) {
  logger.info('🔍 Récupération de l\'URL LinkedIn du profil');

  try {
    // 1. Essayer de trouver l'URL dans la modale
    const linkedinUrl = await this.page.evaluate(() => {
      // Chercher spécifiquement dans la section "Activité récente sur LinkedIn"
      const activitySection = Array.from(document.querySelectorAll('div[data-sn-view-name="lead-recent-activity"]'));
      
      if (activitySection.length > 0) {
        const linkedinLink = activitySection[0].querySelector('a[href*="linkedin.com/in/"]');
        if (linkedinLink) {
          return linkedinLink.href;
        }
      }
      
      // Si pas trouvé dans la section d'activité, chercher dans tout le modal
      const allLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));
      return allLinks.length > 0 ? allLinks[0].href : '';
    });

    if (linkedinUrl) {
      logger.info(`✅ URL LinkedIn trouvée dans la modale: ${linkedinUrl}`);
      return linkedinUrl;
    }
    
    // 2. Si l'URL n'est pas trouvée dans la modale et que les données de base sont disponibles, 
    // utiliser l'API Brave Search
    if (basicData && basicData.firstName && basicData.lastName) {
      logger.info(`🔍 URL LinkedIn non trouvée dans la modale, recherche Brave pour ${basicData.firstName} ${basicData.lastName}`);
      
      const profileUrl = await searchLinkedInProfileViaBrave(basicData);
      
      if (profileUrl) {
        return profileUrl;
      }
    }
    
    logger.warn('⚠️ URL LinkedIn introuvable');
    return '';
  } catch (error) {
    logger.error(`❌ Erreur lors de la récupération de l'URL LinkedIn: ${error.message}`, { stack: error.stack });
    return '';
  }
}
  /**
   * Récupère la description du poste complète
   * @private
   * @returns {Promise<string>} Description du poste
   */
  async _getJobDescription() {
    logger.info('🔍 Récupération de la description du poste');
  
    try {
      // Extraire la description du poste complète directement depuis l'attribut title
      const jobDescription = await this.page.evaluate(() => {
        // Chercher les éléments contenant la description du poste
        const descriptionElements = document.querySelectorAll('[data-anonymize="person-blurb"]');
        
        if (descriptionElements && descriptionElements.length > 0) {
          return descriptionElements[0].getAttribute('title') || descriptionElements[0].textContent.trim();
        }
        
        // Alternative 1: chercher les éléments par classe
        const altElements = document.querySelectorAll('._position-description_q5pnp1');
        if (altElements && altElements.length > 0) {
          return altElements[0].getAttribute('title') || altElements[0].textContent.trim();
        }
        
        // Alternative 2: chercher par contenu d'attribut
        const allElements = document.querySelectorAll('[title]');
        for (const el of allElements) {
          const titleAttr = el.getAttribute('title');
          if (titleAttr && titleAttr.length > 100) {
            return titleAttr;
          }
        }
        
        return '';
      });
  
      if (jobDescription) {
        logger.info(`✅ Description du poste trouvée (longueur: ${jobDescription.length} caractères)`);
        return jobDescription;
      } else {
        logger.warn('⚠️ Description du poste introuvable');
        return '';
      }
    } catch (error) {
      logger.error(`❌ Erreur lors de la récupération de la description du poste: ${error.message}`);
      return '';
    }
  }
  
  /**
   * Ferme la modale du prospect
   * @private
   * @returns {Promise<boolean>} Succès de la fermeture
   */
  async _closeProspectModal() {
    logger.info('🔍 Fermeture de la modale');
    
    try {
      const closed = await this.page.evaluate(() => {
        // Chercher le bouton de fermeture par attribut aria-label
        const closeButtons = document.querySelectorAll('button[aria-label="Fermer"], button[aria-label="Close"]');
        if (closeButtons.length > 0) {
          closeButtons[0].click();
          return true;
        }
        return false;
      });
      
      if (closed) {
        logger.info('✅ Modale fermée');
        await puppeteerUtils.waitForTimeout(this.page, 1000); // Attendre la fermeture de la modale
        return true;
      }
      
      // En cas d'échec, essayer la touche Échap
      await this.page.keyboard.press('Escape');
      logger.info('✅ Modale fermée avec la touche Échap');
      await puppeteerUtils.waitForTimeout(this.page, 1000); // Attendre la fermeture de la modale
      return true;
    } catch (error) {
      logger.error(`❌ Erreur lors de la fermeture de la modale: ${error.message}`);
      
      // En dernier recours, essayer la touche Échap
      try {
        await this.page.keyboard.press('Escape');
        logger.info('✅ Modale fermée avec la touche Échap (méthode de secours)');
        await puppeteerUtils.waitForTimeout(this.page, 1000); // Attendre la fermeture de la modale
        return true;
      } catch (secondError) {
        logger.error(`❌ Échec de toutes les tentatives de fermeture de la modale: ${secondError.message}`);
        return false;
      }
    }
  }


  /**
   * Scroll jusqu'à un prospect
   * @private
   * @param {ElementHandle} prospectElement - Élément du prospect
   */
  async _scrollToProspect(prospectElement) {
    try {
      await this.page.evaluate(el => {
        el.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center', 
          inline: 'nearest' 
        });
      }, prospectElement);
      
      await puppeteerUtils.waitForTimeout(this.page, 1000);
    } catch (error) {
      logger.warn('⚠️ Erreur lors du scroll:', error.message);
    }
  }
  
  /**
   * Sauvegarde un prospect dans la base de données
   * @private
   * @param {Object} prospectData - Données du prospect
   * @returns {Promise<boolean>} Prospect sauvegardé
   */
  async _saveProspect(prospectData) {
    try {
      // S'assurer que tous les champs requis sont présents
      const cleanedData = {
        firstName: prospectData.firstName || 'Unknown',
        lastName: prospectData.lastName || 'User',
        company: prospectData.company || '',
        jobTitle: prospectData.jobTitle || '',
        jobDescription: prospectData.jobDescription || '',
        linkedinProfileUrl: prospectData.linkedinProfileUrl || '',
        scrapedAt: new Date(),
        // Ajouter la référence à la session
        sessionId: this.sessionObjectId,
        metadata: {
          source: 'Sales Navigator',
          listUrl: this.listUrl,
          scrapingSessionId: this.sessionId
        }
      };
      
      // Enregistrer dans MongoDB
      const prospect = new Prospect(cleanedData);
      await prospect.save();
      
      logger.info(`💾 Prospect enregistré: ${cleanedData.firstName} ${cleanedData.lastName}`);
      return true;
    } catch (error) {
      logger.error(`❌ Erreur lors de la sauvegarde du prospect: ${error.message}`, {
        stack: error.stack,
        data: JSON.stringify(prospectData)
      });
      return false;
    }
  }

    /**
   * Vérifie si le bouton "Suivant" est présent et cliquable
   * @private
   * @returns {Promise<boolean>} True si le bouton a été cliqué avec succès
   */
  async _goToNextPage() {
    logger.info('🔍 Vérification de la présence du bouton "Suivant"');
    
    try {
      // Vérifier si le bouton "Suivant" existe et est cliquable
      const nextButtonExists = await this.page.evaluate(() => {
        // Sélecteurs pour le bouton suivant
        const selectors = [
          'button.artdeco-pagination__button--next', 
          'button[aria-label="Suivant"]',
          'button.artdeco-pagination__button.artdeco-pagination__button--next',
          '.artdeco-pagination__button--next'
        ];
        
        // Essayer chaque sélecteur
        for (const selector of selectors) {
          const button = document.querySelector(selector);
          
          if (button) {
            // Vérifier si le bouton est désactivé
            const isDisabled = button.hasAttribute('disabled') || 
                              button.classList.contains('artdeco-button--disabled') ||
                              button.getAttribute('aria-disabled') === 'true';
            
            if (!isDisabled) {
              // Le bouton existe et n'est pas désactivé
              return true;
            } else {
              // Le bouton existe mais est désactivé
              return false;
            }
          }
        }
        
        // Aucun bouton trouvé
        return false;
      });
      
      if (!nextButtonExists) {
        logger.info('⚠️ Bouton "Suivant" introuvable ou désactivé - fin du scraping');
        return false;
      }
      
      // Cliquer sur le bouton "Suivant"
      await this.page.evaluate(() => {
        const selectors = [
          'button.artdeco-pagination__button--next', 
          'button[aria-label="Suivant"]',
          'button.artdeco-pagination__button.artdeco-pagination__button--next',
          '.artdeco-pagination__button--next'
        ];
        
        for (const selector of selectors) {
          const button = document.querySelector(selector);
          if (button && !button.hasAttribute('disabled')) {
            button.click();
            return true;
          }
        }
        return false;
      });
      
      logger.info('✅ Clic sur le bouton "Suivant"');
      
      // Attendre le chargement de la nouvelle page
      await this.page.waitForFunction(() => {
        // Vérifier si le loader a disparu
        const loaderVisible = document.querySelector('.artdeco-loader') !== null;
        return !loaderVisible;
      }, { timeout: 30000 });
      
      // Attendre un peu plus pour que le contenu se charge complètement
      await puppeteerUtils.waitForTimeout(this.page, 3000);
      
      logger.info('✅ Nouvelle page chargée avec succès');
      return true;
      
    } catch (error) {
      logger.error(`❌ Erreur lors du passage à la page suivante: ${error.message}`, { stack: error.stack });
      return false;
    }
  }
    /**
   * Récupère le nombre total de prospects dans la liste
   * @private
   * @returns {Promise<number>} Nombre total de prospects
   */
    async _getTotalProspectsCount() {
      try {
        // Attendre que la page soit complètement chargée
        await puppeteerUtils.waitForTimeout(this.page, 5000);
        
        // Attendre que le bouton soit chargé avec un délai plus long
        await this.page.waitForSelector('#search-spotlight-tab-ALL, button[data-control-name="view_spotlight_for_type_ALL"], .artdeco-spotlight-tab__primary-text', { 
          timeout: 15000,
          visible: true 
        });
        
        const totalCount = await this.page.evaluate(() => {
          // Essayer plusieurs approches pour trouver le nombre
          
          // 1. Approche directe - bouton spécifique
          const button = document.querySelector('#search-spotlight-tab-ALL') || 
                         document.querySelector('button[data-control-name="view_spotlight_for_type_ALL"]');
          
          if (button) {
            const primaryTextSpan = button.querySelector('.artdeco-spotlight-tab__primary-text');
            if (primaryTextSpan) {
              const text = primaryTextSpan.textContent.trim();
              console.log("Texte trouvé dans le bouton:", text);
              const match = text.match(/(\d+)/);
              if (match) {
                return parseInt(match[0], 10);
              }
            }
          }
          
          // 2. Recherche de tous les éléments primary-text
          const allPrimaryTextSpans = document.querySelectorAll('.artdeco-spotlight-tab__primary-text');
          console.log("Nombre d'éléments primary-text trouvés:", allPrimaryTextSpans.length);
          
          for (const span of allPrimaryTextSpans) {
            const text = span.textContent.trim();
            console.log("Texte trouvé dans un span:", text);
            const match = text.match(/(\d+)/);
            if (match) {
              return parseInt(match[0], 10);
            }
          }
          
          // 3. Recherche dans tout le document
          const allText = document.body.innerText;
          const resultRegex = /(\d+)\s*résultats?/i;
          const resultMatch = allText.match(resultRegex);
          
          if (resultMatch) {
            return parseInt(resultMatch[1], 10);
          }
          
          // Renvoyer la structure HTML pour diagnostic
          return {
            htmlStructure: document.querySelector('.search-results-container')?.outerHTML || 'Non trouvé',
            totalNotFound: true
          };
        });
        
        // Vérifier si nous avons obtenu un objet de diagnostic plutôt qu'un nombre
        if (typeof totalCount === 'object' && totalCount.totalNotFound) {
          logger.warn('Structure HTML pour diagnostic:', totalCount.htmlStructure);
          logger.warn('Impossible de détecter automatiquement le nombre total de prospects');
          return 100; // Valeur par défaut
        }
        
        if (totalCount > 0) {
          logger.info(`Nombre total de prospects détecté: ${totalCount}`);
          return totalCount;
        } else {
          // Faire une capture d'écran pour diagnostic
          await this.page.screenshot({ path: './logs/search-page.png' });
          logger.warn('Impossible de détecter le nombre total de prospects. Une capture d\'écran a été sauvegardée.');
          return 100; // Valeur par défaut
        }
      } catch (error) {
        logger.error(`Erreur lors de la récupération du nombre total de prospects: ${error.message}`, { stack: error.stack });
        return 100; // Valeur par défaut en cas d'erreur
      }
    }
    
    /**
     * Charge une session existante pour reprendre le scraping
     * @param {string} sessionId - ID de la session
     * @returns {Promise<void>}
     */
    async loadSession(sessionId) {
      try {
        const session = await Session.findById(sessionId);
        
        if (!session) {
          throw new Error(`Session avec l'ID ${sessionId} introuvable`);
        }
        
        // Log des valeurs de la session avant chargement
        logger.info(`Chargement de la session: ${session._id}`);
        logger.info(`scrapedProspectsCount dans la base: ${session.scrapedProspectsCount}`);
        
        // Charger les données de la session
        this.sessionObjectId = session._id;
        this.listUrl = session.sourceUrl;
        this.scrapedProfiles = parseInt(session.scrapedProspectsCount || 0);
        this.totalProspectsCount = parseInt(session.totalProspectsCount || 0);
        this.currentPage = parseInt(session.currentPage || 1);
        this.lastProspectName = session.lastProspectName || '';
        this.isPaused = true;
        this.scrapingStatus = 'paused';
        
        // Log après chargement
        logger.info(`Valeur de this.scrapedProfiles après chargement: ${this.scrapedProfiles}`);
        logger.info(`Session ${sessionId} chargée avec succès`);
        logger.info(`Détails: Page=${this.currentPage}, Dernier prospect=${this.lastProspectName}, Prospects scrapés=${this.scrapedProfiles}/${this.totalProspectsCount}`);
        
        return session;
      } catch (error) {
        logger.error(`Erreur lors du chargement de la session: ${error.message}`);
        throw error;
      }
    }
    /**
   * Récupère le nom du prospect depuis une ligne de tableau
   * @private
   * @param {ElementHandle} prospectRow - Ligne du tableau
   * @returns {Promise<string>} Nom complet du prospect
   */
  async _getProspectNameFromRow(prospectRow) {
    try {
      const name = await this.page.evaluate((row) => {
        const nameElement = row.querySelector('a[data-anonymize="person-name"]');
        return nameElement ? nameElement.textContent.trim() : '';
      }, prospectRow);
      
      return name;
    } catch (error) {
      logger.warn(`⚠️ Erreur lors de la récupération du nom du prospect: ${error.message}`);
      return '';
    }
  }
    /**
   * Charge les paramètres globaux de l'application
   * @private
   * @returns {Promise<Object>} Paramètres de l'application
   */
  async _loadSettings() {
    try {
      this.settings = await AppSettings.getGlobalSettings();
      logger.debug('Paramètres de l\'application chargés avec succès');
      
      // Mettre à jour la limite quotidienne avec la valeur des paramètres
      if (this.settings.linkedin && this.settings.linkedin.quotas) {
        this.dailyLimit = this.settings.linkedin.quotas.prospects || this.dailyLimit;
        logger.info(`Limite quotidienne de scraping: ${this.dailyLimit} profils`);
      }
      
      return this.settings;
    } catch (error) {
      logger.error(`Erreur lors du chargement des paramètres: ${error.message}`);
      return null;
    }
  }
  
}

module.exports = new ScraperService();