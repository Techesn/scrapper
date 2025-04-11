const logger = require('../utils/logger');
const browserUtils = require('../utils/browserUtils');
const humanBehavior = require('../utils/humanBehavior');
const puppeteerUtils = require('../utils/puppeteerUtils');
const AppSettings = require('../models/AppSettings');
const timeService = require('../services/timeService');

/**
 * Service pour envoyer des messages via LinkedIn
 */
class MessageService {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.settings = null;
    this.currentSessionId = null;
    this.isSessionLocked = false; // Nouvel attribut pour suivre l'état de verrouillage
  }

  /**
   * Initialise le service de messagerie
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.info('Initialisation du service de messagerie LinkedIn');
    
    try {
      // Vérifier si le service est déjà en cours d'initialisation
      if (this.isSessionLocked) {
        logger.warn('Initialisation déjà en cours, attente...');
        // Attendre que l'autre initialisation se termine
        await new Promise(resolve => setTimeout(resolve, 5000));
        return;
      }
      
      this.isSessionLocked = true; // Verrouiller la session
      
      // Charger les paramètres
      await this._loadSettings();
      
      // Fermer l'instance précédente si elle existe
      if (this.browser) {
        logger.info('Libération de la session précédente');
        try {
          await browserUtils.closeBrowser(this.browser);
        } catch (closeError) {
          logger.warn(`Erreur lors de la libération de la session précédente: ${closeError.message}`);
          // Continuer malgré l'erreur
        }
        this.browser = null;
        this.page = null;
      }
      
      // Lancer le navigateur - utiliser une session persistante
      this.browser = await browserUtils.launchBrowser(false, false); 
      this.page = await browserUtils.createStealthPage(this.browser);
      
      // Authentification à LinkedIn
      logger.info('Vérification de l\'authentification LinkedIn');
      const isAuthenticated = await browserUtils.authenticateWithCookies(this.page);
      
      if (!isAuthenticated) {
        throw new Error('Échec de l\'authentification à LinkedIn');
      }
      
      logger.info('Service de messagerie initialisé avec succès');
      return true;
    } catch (error) {
      logger.error(`Erreur lors de l'initialisation du service de messagerie: ${error.message}`, { stack: error.stack });
      
      // Libérer la session en cas d'erreur
      if (this.browser) {
        try {
          await browserUtils.closeBrowser(this.browser);
        } catch (closeError) {
          logger.error(`Erreur lors de la libération après échec d'initialisation: ${closeError.message}`);
        }
        this.browser = null;
        this.page = null;
      }
      
      throw error;
    } finally {
      this.isSessionLocked = false; // Déverrouiller la session
    }
  }

  /**
   * Vérifie si la session est dans un état valide
   * @returns {Promise<boolean>} True si la session est valide
   */
  async isSessionValid() {
    if (!this.browser || !this.page) {
      return false;
    }
    
    try {
      // Essayer d'exécuter un javascript simple
      await this.page.evaluate(() => true);
      return true;
    } catch (error) {
      logger.warn(`Session invalide détectée: ${error.message}`);
      return false;
    }
  }

  /**
   * Ferme la modal de conversation LinkedIn
   * @private
   * @returns {Promise<boolean>} True si la modal a été fermée avec succès
   */
  async _closeConversationModal() {
    try {
      logger.info('Tentative de fermeture de la modal de conversation');
      
      // Vérifier si la session est valide
      if (!await this.isSessionValid()) {
        logger.warn('Session invalide lors de la fermeture de la modal, impossible de continuer');
        return false;
      }
      
      // Capture d'écran avant de fermer la modal
      try {
        await this.page.screenshot({ path: './logs/before-close-modal.png' });
      } catch (screenshotError) {
        logger.warn(`Impossible de prendre une capture d'écran avant fermeture: ${screenshotError.message}`);
        // Continuer malgré l'erreur
      }
      
      // Attendre un peu pour s'assurer que tout est chargé
      await puppeteerUtils.waitForTimeout(null, 2000);
      
      // Cibler spécifiquement le bouton de fermeture avec l'icône "close-small"
      const modalClosed = await this.page.evaluate(() => {
        console.log('Recherche du bouton de fermeture (croix) de la modal...');
        
        // Trouver le bouton qui contient une icône SVG avec "close-small"
        const closeButtons = Array.from(document.querySelectorAll('button'));
        
        for (const button of closeButtons) {
          // Vérifier si le bouton contient une icône SVG avec use[href="#close-small"]
          const svgUseElement = button.querySelector('svg use[href="#close-small"]');
          
          if (svgUseElement) {
            console.log('Bouton de fermeture avec icône croix trouvé:', button.outerHTML);
            
            // Vérifier si le bouton est visible
            if (button.offsetWidth > 0 && button.offsetHeight > 0) {
              console.log('Le bouton est visible, clic sur la croix');
              button.click();
              return true;
            }
          }
        }
        
        // Essayer avec la classe spécifique comme backup
        const specificButtons = document.querySelectorAll('.msg-overlay-bubble-header__control');
        for (const btn of specificButtons) {
          if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
            console.log('Bouton de fermeture trouvé par classe spécifique:', btn.outerHTML);
            btn.click();
            return true;
          }
        }
        
        return false;
      }).catch(error => {
        logger.error(`Erreur lors de l'évaluation du script de fermeture: ${error.message}`);
        return false;
      });
      
      if (modalClosed) {
        logger.info('Modal de conversation fermée avec succès');
        
        // Attendre que la modal se ferme complètement
        await puppeteerUtils.waitForTimeout(null, 2000);
        
        // Capture d'écran finale pour confirmer
        try {
          await this.page.screenshot({ path: './logs/after-close-modal.png' });
        } catch (screenshotError) {
          logger.warn(`Impossible de prendre une capture d'écran après fermeture: ${screenshotError.message}`);
        }
        return true;
      } else {
        logger.warn('Impossible de trouver le bouton de fermeture (croix) de la modal');
        return false;
      }
    } catch (error) {
      logger.error(`Erreur lors de la fermeture de la modal: ${error.message}`);
      return false;
    }
  }

  /**
   * Envoie un message à un profil LinkedIn
   * @param {string} profileUrl - URL du profil LinkedIn
   * @param {string} message - Message à envoyer
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  async sendMessage(profileUrl, message) {
    // Vérifier si le service est déjà en cours d'utilisation
    if (this.isRunning) {
      logger.warn('Service déjà en cours d\'exécution, attente...');
      // Dans un cas réel, vous pourriez implémenter une file d'attente ici
      return {
        success: false,
        error: 'Service déjà en cours d\'exécution'
      };
    }
    
    // Vérifier si on est dans les plages horaires autorisées
    if (!timeService.isInWorkingHours('message')) {
      logger.info('En dehors des plages horaires autorisées pour les messages');
      return {
        success: false,
        error: 'En dehors des plages horaires autorisées pour les messages'
      };
    }
    
    // Vérifier les quotas
    if (!timeService.checkQuotaAvailability('messages')) {
      logger.info('Quota journalier de messages atteint');
      return {
        success: false,
        error: 'Quota journalier de messages atteint'
      };
    }

    logger.info(`Envoi d'un message à ${profileUrl}`);
    
    // Vérifier si la session est valide, sinon l'initialiser
    if (!this.browser || !this.page || !await this.isSessionValid()) {
      logger.info('Session invalide, réinitialisation...');
      try {
        await this.initialize();
      } catch (initError) {
        logger.error(`Échec de l'initialisation: ${initError.message}`);
        return {
          success: false,
          error: `Impossible d'initialiser la session: ${initError.message}`
        };
      }
    }
    
    this.isRunning = true;
    
    try {
      // 1. Naviguer directement vers le profil avec gestion du timeout
      logger.info(`Navigation vers le profil: ${profileUrl}`);
      
      try {
        await this.page.goto(profileUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      } catch (navError) {
        // Si c'est un timeout, on continue quand même
        if (navError.name === 'TimeoutError') {
          logger.warn('Timeout de navigation atteint, mais on continue quand même');
        } else {
          // Pour les autres erreurs, on les propage
          throw navError;
        }
      }
      
      // Attente supplémentaire pour s'assurer que la page est bien chargée
      logger.info('Attente du chargement complet de la page...');
      await puppeteerUtils.waitForTimeout(null, 10000);
      
      // Vérifier et gérer les cookies après chargement de la page
      logger.info('Vérification des cookies après chargement de la page');
      await browserUtils.handleCookieConsent(this.page);
      
      // Prendre une capture d'écran pour confirmer le chargement
      try {
        await this.page.screenshot({ path: './logs/profile-page-loaded.png' });
      } catch (screenshotError) {
        logger.warn(`Impossible de prendre une capture d'écran: ${screenshotError.message}`);
      }
      
      // 2. Faire défiler la page progressivement
      logger.info('Défilement de la page pour localiser le bouton...');
      
      // Défilement progressif et naturel
      for (let i = 0; i < 5; i++) {
        // Vérifier si la session est toujours valide
        if (!await this.isSessionValid()) {
          throw new Error('Session devenue invalide pendant le défilement');
        }
        
        // Calculer la distance de défilement
        const scrollAmount = 300 * (i + 1);
        
        // Défiler
        await this.page.evaluate((scrollY) => {
          window.scrollTo({
            top: scrollY,
            behavior: 'smooth'
          });
        }, scrollAmount).catch(error => {
          logger.warn(`Erreur lors du défilement: ${error.message}`);
        });
        
        // Attendre entre chaque défilement
        await puppeteerUtils.waitForTimeout(null, 1000);
      }
      
      // 3. Rechercher et cliquer sur le bouton de message
      logger.info('Recherche du bouton de message');
      const messageButtonFound = await this._findAndClickMessageButton();
      
      if (!messageButtonFound) {
        logger.error('Bouton de message introuvable');
        return {
          success: false,
          error: 'Bouton de message introuvable sur la page du profil'
        };
      }
      
      // 4. Attendre que la modal de message apparaisse
      logger.info('Attente de l\'ouverture de la fenêtre de message');
      await puppeteerUtils.waitForTimeout(null, 5000);
      
      // 5. Écrire et envoyer le message
      logger.info('Écriture et envoi du message');
      const messageSent = await this._writeAndSendMessage(message);
      
      if (!messageSent) {
        logger.error('Échec de l\'envoi du message');
        return {
          success: false,
          error: 'Impossible d\'envoyer le message'
        };
      }
      
      logger.info('Message envoyé avec succès');
      
      // Incrémenter les statistiques
      const DailyStats = require('../models/dailyStats');
      await DailyStats.incrementMessagesSent();
      
      return {
        success: true,
        message: 'Message envoyé avec succès'
      };
      
    } catch (error) {
      logger.error(`Erreur lors de l'envoi du message: ${error.message}`, { stack: error.stack });
      
      // Capture d'écran en cas d'erreur
      try {
        await this.page.screenshot({ path: './logs/message-send-error-exception.png' });
      } catch (screenshotError) {
        logger.warn(`Impossible de prendre une capture d'écran d'erreur: ${screenshotError.message}`);
      }
      
      // Vérifier l'état de la session après l'erreur
      if (!await this.isSessionValid()) {
        logger.warn('Session détectée comme invalide après erreur, réinitialisation...');
        try {
          // Libérer les ressources actuelles
          if (this.browser) {
            await browserUtils.closeBrowser(this.browser);
            this.browser = null;
            this.page = null;
          }
          
          // Réinitialiser plus tard
          setTimeout(() => {
            this.initialize().catch(initError => {
              logger.error(`Échec de la réinitialisation après erreur: ${initError.message}`);
            });
          }, 5000);
        } catch (resetError) {
          logger.error(`Erreur lors de la réinitialisation après échec: ${resetError.message}`);
        }
      }
      
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isRunning = false;
      
      // Toujours naviguer vers une page neutre pour éviter les problèmes
      if (this.page && await this.isSessionValid()) {
        try {
          await this.page.goto('about:blank', { waitUntil: 'load', timeout: 5000 })
            .catch(() => logger.debug('Navigation vers page neutre ignorée'));
        } catch (blankError) {
          logger.debug(`Erreur lors de la navigation vers page neutre: ${blankError.message}`);
        }
      }
    }
  }

  /**
   * Recherche et clique sur le bouton de message
   * @private
   * @returns {Promise<boolean>} True si le bouton a été trouvé et cliqué
   */
  async _findAndClickMessageButton() {
    try {
      // Vérifier si la session est valide
      if (!await this.isSessionValid()) {
        throw new Error('Session invalide lors de la recherche du bouton de message');
      }
      
      // Attendre que la page soit complètement chargée
      await this.page.waitForSelector('body', { timeout: 10000 }).catch(() => {
        logger.warn('Timeout lors de l\'attente du body');
      });
      
      // Simuler un scroll pour voir tous les boutons potentiels
      await humanBehavior.simulateNaturalScroll(this.page, 300).catch(error => {
        logger.warn(`Erreur lors du défilement: ${error.message}`);
      });
      
      // Prendre une capture d'écran pour débogage
      try {
        await this.page.screenshot({ path: './logs/before-message-button-search.png' });
      } catch (screenshotError) {
        logger.warn(`Impossible de prendre une capture d'écran: ${screenshotError.message}`);
      }
      
      logger.info('Recherche du bouton de message avec diverses stratégies');
      
      // Stratégie 1: Utiliser les attributs aria-label
      const messageButtonByAriaLabel = await this.page.evaluate(() => {
        const ariaLabels = [
          'Envoyer un message à',
          'Message',
          'Send a message',
          'Message ',
          'Send message'
        ];
        
        for (const label of ariaLabels) {
          const buttons = Array.from(document.querySelectorAll(`button[aria-label*="${label}"]`));
          for (const btn of buttons) {
            if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
              // Bouton visible trouvé
              console.log('Bouton de message trouvé par aria-label:', btn.outerHTML);
              btn.click();
              return true;
            }
          }
        }
        return false;
      }).catch(error => {
        logger.warn(`Erreur lors de l'évaluation par aria-label: ${error.message}`);
        return false;
      });
      
      if (messageButtonByAriaLabel) {
        logger.info('Bouton de message trouvé et cliqué via aria-label');
        await puppeteerUtils.waitForTimeout(null, 2000);
        return true;
      }
      
      // Stratégie 2: Utiliser le texte du bouton
      const messageButtonByText = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        
        for (const btn of buttons) {
          const text = btn.textContent.trim().toLowerCase();
          if ((text.includes('message') || text === 'message') && 
              btn.offsetWidth > 0 && btn.offsetHeight > 0) {
            console.log('Bouton de message trouvé par texte:', btn.outerHTML);
            btn.click();
            return true;
          }
        }
        return false;
      }).catch(error => {
        logger.warn(`Erreur lors de l'évaluation par texte: ${error.message}`);
        return false;
      });
      
      if (messageButtonByText) {
        logger.info('Bouton de message trouvé et cliqué via texte du bouton');
        await puppeteerUtils.waitForTimeout(null, 2000);
        return true;
      }
      
      // Stratégie 3: Rechercher l'icône "message" dans les SVG
      const messageButtonBySVG = await this.page.evaluate(() => {
        // Chercher les icônes qui pourraient indiquer un message
        const svgElements = document.querySelectorAll('svg');
        for (const svg of svgElements) {
          // Vérifier si l'élément SVG ou son parent a trait aux messages
          const svgParent = svg.closest('button');
          if (svgParent) {
            const useTags = svg.querySelectorAll('use');
            for (const useTag of useTags) {
              const href = useTag.getAttribute('href');
              if (href && 
                  (href.includes('message') || 
                   href.includes('send-privately') || 
                   href.includes('mail') || 
                   href.includes('envelope'))) {
                console.log('Bouton de message trouvé par SVG:', svgParent.outerHTML);
                svgParent.click();
                return true;
              }
            }
            
            // Vérifier aussi le texte du bouton parent
            if (svgParent.textContent.trim().toLowerCase().includes('message')) {
              console.log('Bouton de message trouvé par SVG+texte:', svgParent.outerHTML);
              svgParent.click();
              return true;
            }
          }
        }
        return false;
      }).catch(error => {
        logger.warn(`Erreur lors de l'évaluation par SVG: ${error.message}`);
        return false;
      });
      
      if (messageButtonBySVG) {
        logger.info('Bouton de message trouvé et cliqué via SVG');
        await puppeteerUtils.waitForTimeout(null, 2000);
        return true;
      }
      
      // Stratégie 4: Méthode plus agressive
      logger.info('Utilisation d\'une stratégie plus agressive pour trouver le bouton');
      const aggressiveMethod = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          if (el.textContent.toLowerCase().includes('message') && 
              el.tagName !== 'BODY' && el.tagName !== 'HTML' && 
              el.offsetWidth > 0 && el.offsetHeight > 0) {
            
            // Exclure les éléments trop grands (probablement des conteneurs)
            if (el.offsetWidth < 300 && el.offsetHeight < 100) {
              console.log('Élément "message" trouvé:', el.outerHTML);
              
              // Soit cliquer sur l'élément lui-même
              el.click();
              
              // Soit chercher un bouton proche
              const nearbyButton = el.closest('button') || 
                                 el.querySelector('button') || 
                                 el.parentElement?.querySelector('button');
              
              if (nearbyButton) {
                console.log('Bouton proche trouvé:', nearbyButton.outerHTML);
                nearbyButton.click();
              }
              
              return true;
            }
          }
        }
        return false;
      }).catch(error => {
        logger.warn(`Erreur lors de l'évaluation aggressive: ${error.message}`);
        return false;
      });
      
      if (aggressiveMethod) {
        logger.info('Élément contenant "message" trouvé et cliqué avec la méthode agressive');
        await puppeteerUtils.waitForTimeout(null, 2000);
        return true;
      }
      
      // Prendre une capture d'écran finale pour le débogage
      try {
        await this.page.screenshot({ path: './logs/message-button-not-found.png' });
      } catch (screenshotError) {
        logger.warn(`Impossible de prendre une capture d'écran finale: ${screenshotError.message}`);
      }
      
      logger.error('Bouton de message introuvable après toutes les tentatives');
      
      return false;
    } catch (error) {
      logger.error(`Erreur lors de la recherche du bouton de message: ${error.message}`);
      try {
        await this.page.screenshot({ path: './logs/message-button-error.png' });
      } catch (screenshotError) {
        logger.warn(`Impossible de prendre une capture d'écran d'erreur: ${screenshotError.message}`);
      }
      return false;
    }
  }

  /**
   * Écrit et envoie un message dans la fenêtre de messagerie, puis ferme la modal
   * @private
   * @param {string} message - Message à envoyer
   * @returns {Promise<boolean>} True si le message a été envoyé
   */
  async _writeAndSendMessage(message) {
    try {
      if (!await this.isSessionValid()) {
        throw new Error('Session invalide lors de l\'écriture du message');
      }
  
      await puppeteerUtils.waitForTimeout(null, 3000);
  
      // Injection directe via execCommand("insertText")
      const inputInjected = await this.page.evaluate((text) => {
        const selectors = [
          'div.msg-form__contenteditable',
          'div[contenteditable="true"]',
          'div[role="textbox"]',
          '.msg-form__message-texteditor [contenteditable="true"]'
        ];
  
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.offsetParent !== null) {
            element.focus();
            document.execCommand('selectAll', false, null);  // Vide le contenu précédent
            document.execCommand('insertText', false, text); // Injecte le texte
            return true;
          }
        }
        return false;
      }, message);
  
      if (!inputInjected) {
        logger.error('Impossible dinjecter le message directement.');
        await this.page.screenshot({ path: './logs/message-injection-error.png' });
        return false;
      }
  
      logger.info('Message injecté directement avec succès.');
  
      await puppeteerUtils.waitForTimeout(null, 1000);
  
      // Clique sur le bouton Envoyer
      const sendButtonClicked = await this.page.evaluate(() => {
        const buttonSelectors = [
          '.msg-form__send-button',
          'button.msg-form__send-button',
          'button[type="submit"]',
          '.msg-form__right-actions button[type="submit"]'
        ];
  
        for (const selector of buttonSelectors) {
          const btn = document.querySelector(selector);
          if (btn && btn.offsetParent !== null) {
            btn.click();
            return true;
          }
        }
  
        // En backup, rechercher par texte
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const btn of buttons) {
          const text = btn.innerText.trim().toLowerCase();
          if (text === 'envoyer' || text === 'send') {
            btn.click();
            return true;
          }
        }
        return false;
      });
  
      if (!sendButtonClicked) {
        logger.warn('Bouton denvoi introuvable, utilisation de Ctrl+Entrée');
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('Enter');
        await this.page.keyboard.up('Control');
      } else {
        logger.info('Bouton denvoi cliqué avec succès');
      }
  
      await puppeteerUtils.waitForTimeout(null, 3000);
  
      // Ferme proprement la modal
      await this._closeConversationModal();
  
      return true;
  
    } catch (error) {
      logger.error(`Erreur lors de l'envoi du message: ${error.message}`);
      await this.page.screenshot({ path: './logs/message-send-error.png' });
      return false;
    }
  }
  
  /**
   * Ferme le navigateur et libère les ressources
   */
  async close() {
    logger.info('Fermeture du service de messagerie');
    
    if (this.browser) {
      try {
        // Utiliser la méthode améliorée qui respecte le pool
        await browserUtils.closeBrowser(this.browser);
        this.browser = null;
        this.page = null;
        logger.info('Navigateur fermé avec succès');
      } catch (error) {
        logger.error(`Erreur lors de la fermeture du navigateur: ${error.message}`);
      }
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
      return this.settings;
    } catch (error) {
      logger.error(`Erreur lors du chargement des paramètres: ${error.message}`);
      // Valeurs par défaut
      this.settings = {
        quotas: { messages: { delay: 5000 } }
      };
      return this.settings;
    }
  }
}

module.exports = new MessageService();