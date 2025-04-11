// connectionManager.js

const Prospect = require('../models/prospect');
const ProspectSequenceStatus = require('../models/prospectSequenceStatus');
const ConnectionQueue = require('../models/connectionQueue');
const DailyStats = require('../models/dailyStats');
const logger = require('../utils/logger');
const { sleep, getRandomDelay } = require('../utils/puppeteerUtils');
const browserUtils = require('../utils/browserUtils');
const AppSettings = require('../models/AppSettings');
const timeService = require('../services/timeService');

/**
 * Service de gestion des connexions LinkedIn
 * Responsable de l'envoi des demandes de connexion
 */
class ConnectionManager {
  constructor() {
    this.isRunning = false;
    this.connectionCheckInterval = null;
    this.connectionRequestInterval = null;
    
    // S'abonner aux événements de changement d'état du cookie
    const authService = require('../services/authService');
    authService.on('cookieBecameInvalid', async () => {
      logger.warn('Cookie LinkedIn invalide - Arrêt du traitement des connexions');
      await this.stopConnectionRequests();
    });
  }

  /**
   * Initialise le gestionnaire de connexions (stub pour compatibilité)
   */
  async init() {
    logger.info('Initialisation du gestionnaire de connexions LinkedIn');
    logger.info('Le gestionnaire de connexions utilise maintenant une approche par session');
    return true;
  }

  /**
   * Envoie une demande de connexion à un prospect
   * @param {string} prospectId - ID du prospect
   * @param {string} sequenceId - ID de la séquence (optionnel)
   * @returns {Promise<Object>} Résultat de l'ajout à la file d'attente
   */
  async sendConnectionRequest(prospectId, sequenceId = null) {
    try {
      // Vérifier si on est dans les plages horaires de travail
      if (!this.isInConnectionRequestTimeWindow()) {
        logger.info('En dehors des plages horaires autorisées pour les connexions');
        return {
          success: false,
          error: 'En dehors des plages horaires autorisées'
        };
      }
  
      // Vérifier si les quotas sont atteints via timeService
      if (!timeService.checkQuotaAvailability('connections')) {
        logger.info('Quota journalier de demandes de connexion atteint');
        return {
          success: false,
          error: 'Quota journalier atteint'
        };
      }

      // Récupérer le prospect
      const prospect = await Prospect.findById(prospectId);
      if (!prospect) {
        throw new Error(`Prospect ${prospectId} introuvable`);
      }

      // Vérifier que l'URL LinkedIn est disponible
      if (!prospect.linkedinProfileUrl) {
        throw new Error(`URL LinkedIn manquante pour le prospect ${prospectId}`);
      }

      // Ajouter à la file d'attente au lieu d'envoyer immédiatement
      await ConnectionQueue.create({
        prospectId,
        sequenceId,
        status: 'pending',
        scheduledAt: new Date(),
        createdAt: new Date()
      });

      logger.info(`Demande de connexion pour ${prospectId} ajoutée à la file d'attente`);
      return {
        success: true,
        message: 'Demande ajoutée à la file d\'attente'
      };
    } catch (error) {
      logger.error(`Erreur lors de l'ajout à la file d'attente: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Arrête la vérification périodique des statuts de connexion
   */
  async stopConnectionChecks() {
    if (!this.isRunning) {
      logger.info('La vérification des connexions n\'est pas en cours');
      return;
    }

    logger.info('Arrêt de la vérification des connexions');

    // Arrêter l'intervalle
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }

    this.isRunning = false;
    logger.info('Vérification des connexions arrêtée avec succès');
  }

  /**
   * Vérifie si nous sommes dans la plage horaire autorisée pour les demandes de connexion
   * @returns {boolean} True si l'heure actuelle est dans la plage autorisée
   */
    isInConnectionRequestTimeWindow() {
      return timeService.isInWorkingHours('connection');
    }

  /**
   * Envoie une vraie demande de connexion LinkedIn avec une instance de page spécifique
   * @private
   * @param {object} page - L'instance de page Puppeteer
   * @param {string} profileUrl - URL du profil LinkedIn
   * @param {string} firstName - Prénom du prospect
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  async _sendRealConnectionRequestWithPage(page, profileUrl, firstName) {
    try {
      logger.info(`Envoi d'une demande de connexion à ${profileUrl}`);

      // Naviguer vers la page du profil
      try {
        await page.goto(profileUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      } catch (navigationError) {
        logger.error(`Erreur lors de la navigation vers le profil: ${navigationError.message}`);
        return {
          success: false,
          error: `Navigation échouée: ${navigationError.message}`,
          statusUpdate: 'error'
        };
      }

      // Gérer le consentement cookies
      await browserUtils.handleCookieConsent(page);

      // Attendre que la page se charge
      try {
        await page.waitForSelector('body', { timeout: 30000 });
      } catch (loadError) {
        logger.error(`Erreur lors du chargement de la page: ${loadError.message}`);
        return {
          success: false,
          error: `Chargement de page échoué: ${loadError.message}`,
          statusUpdate: 'error'
        };
      }

      logger.info('Attente du chargement complet de la page...');
      await sleep(3000);

      // Vérifier si on est toujours authentifié
      const isStillLoggedIn = await page.evaluate(() => {
        const navElements = [
          '.global-nav__me',
          '.profile-rail-card__actor-link',
          'img.global-nav__me-photo',
          'a[data-control-name="identity_profile_photo"]',
          '.feed-identity-module__actor-meta',
          'div.feed-identity-module'
        ];

        for (const selector of navElements) {
          if (document.querySelector(selector)) {
            console.log(`Authentification confirmée via sélecteur: ${selector}`);
            return true;
          }
        }

        const pageText = document.body.textContent || '';
        if (pageText.includes('Se déconnecter') || pageText.includes('Sign Out')) {
          console.log('Authentification confirmée via texte de déconnexion');
          return true;
        }

        console.log('Non authentifié: aucun élément d\'authentification trouvé');
        return false;
      });

      if (!isStillLoggedIn) {
        logger.warn('Session déconnectée, impossible de continuer');
        return {
          success: false,
          error: 'Session déconnectée',
          statusUpdate: 'error'
        };
      }

      // Vérifier si on est bien sur /in/ (non bloquant)
      if (!page.url().includes('/in/')) {
        logger.warn(`Attention, l'URL finale n'est pas un profil: ${page.url()}`);
      }

      // Vérifier le statut (en attente, déjà connecté, indisponible, etc.)
      const connectionStatus = await page.evaluate(() => {
        // 1. Bouton "En attente" => invitation_pending
        const pendingBtn = Array.from(document.querySelectorAll('button')).find(btn => {
          const txt = btn.textContent.trim();
          return (
            (txt.includes('En attente') || txt.includes('Pending')) &&
            btn.offsetWidth > 0 &&
            btn.offsetHeight > 0
          );
        });
        if (pendingBtn) {
          return 'invitation_pending';
        }

        // 2. Badge "1er" => déjà connecté (relation de 1er niveau)
        //    On cherche un élément .dist-value ou .distance-badge qui contient "1er"
        //    ou un label "relation de 1er niveau"
        let isFirstDegree = false;

        // a) Checker .distance-badge
        const distBadge = document.querySelector('.distance-badge, .dist-value');
        if (distBadge) {
          const distText = distBadge.textContent.toLowerCase();
          if (distText.includes('1er')) {
            isFirstDegree = true;
          }
        }

        // b) Checker si "relation de 1er niveau" est dans le body (optionnel)
        if (!isFirstDegree) {
          const bodyText = document.body.textContent.toLowerCase();
          if (bodyText.includes('relation de 1er niveau')) {
            isFirstDegree = true;
          }
        }

        if (isFirstDegree) {
          return 'already_connected';
        }

        // 3. Profil indisponible => profile_unavailable
        const notFoundIndicators = [
          'Cette page n\'est pas disponible',
          'This page isn\'t available',
          'Page not found',
          'account has been closed',
          'compte a été fermé',
          'utilisateur a été supprimé',
          'no longer active'
        ];
        const txtBody = (document.body.textContent || '').toLowerCase();
        for (const indicator of notFoundIndicators) {
          if (txtBody.includes(indicator.toLowerCase())) {
            return 'profile_unavailable';
          }
        }

        // 4. Sinon => not_connected
        return 'not_connected';
      });

      // Traite la valeur
      if (connectionStatus === 'invitation_pending') {
        logger.info(`Invitation déjà en attente pour ${profileUrl}`);
        return {
          success: false,
          error: 'Invitation déjà en attente',
          statusUpdate: 'invitation_sent'
        };
      } else if (connectionStatus === 'already_connected') {
        logger.info(`Déjà connecté à ${profileUrl}`);
        return {
          success: true,
          alreadyConnected: true,
          statusUpdate: 'connected'
        };
      } else if (connectionStatus === 'profile_unavailable') {
        logger.warn(`Profil non disponible pour ${profileUrl}`);
        return {
          success: false,
          error: 'Profil LinkedIn non disponible',
          statusUpdate: 'not_available'
        };
      }

      // On est dans le cas not_connected => on cherche le bouton "Se connecter"
      const container = await page.$('.ph5.pb5'); 
      if (!container) {
        logger.warn('Impossible de trouver le conteneur .ph5.pb5');
        return {
          success: false,
          error: 'Pas de conteneur .ph5.pb5',
          statusUpdate: 'error'
        };
      }

      const candidateButtons = await container.$$('button');
      let connectButton = null;
      for (const btn of candidateButtons) {
        const text = await page.evaluate(el => el.textContent.trim(), btn);
        const hasIcon = await page.evaluate(el => !!el.querySelector('use[href="#connect-small"]'), btn);

        if (text === 'Se connecter' && hasIcon) {
          const box = await btn.boundingBox();
          if (box && box.width > 0 && box.height > 0) {
            connectButton = btn;
            break;
          }
        }
      }

      // 3) Si on n’a pas trouvé de bouton direct => on cherche le bouton “Se connecter” dans le menu “...”
      if (!connectButton) {
        logger.info('Aucun bouton direct "Se connecter" (icône connect-small). On tente le menu "..."');

        // 3a) Tenter de cliquer sur le déclencheur du menu (aria-label="Plus d’actions", ou id$="-profile-overflow-action")
        try {
          const moreActionsTrigger = await container.$('button[aria-label*="Plus d’actions"], button[id$="profile-overflow-action"]');
          if (moreActionsTrigger) {
            // Premier clic sur “...”
            logger.info('Bouton "..." cliqué pour ouvrir le menu');
            // Au lieu de .click() direct, on peut tenter un evaluate
            await page.evaluate(el => el.click(), moreActionsTrigger);

            // Attendre un peu que le menu se déploie
            await sleep(1000);
          }
        } catch (e) {
          logger.warn('Pas de bouton "..." ou erreur de clic: ' + e.message);
        }

        // 3b) Parcourir les items du dropdown pour trouver un item “Se connecter” (icône connect-medium)
        const menuItems = await container.$$('.artdeco-dropdown__item, div[role="button"]');
        for (const item of menuItems) {
          const text = await page.evaluate(el => el.textContent.trim(), item);
          const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label') || '', item);
          const hasIconMedium = await page.evaluate(el => !!el.querySelector('use[href="#connect-medium"]'), item);

          // Conditions :
          // - le texte OU l'aria-label contient "Se connecter" ou "Invitez X à rejoindre votre réseau"
          // - il y a l’icône #connect-medium
          if (
            (text.includes('Se connecter') || ariaLabel.includes('Invitez') || ariaLabel.includes('Se connecter')) &&
            hasIconMedium
          ) {
            const box = await item.boundingBox();
            if (box && box.width > 0 && box.height > 0) {
              logger.info('Item "Se connecter" trouvé dans le menu "..."');
              connectButton = item;
              break;
            }
          }
        }
      }

      // 4) Vérification finale
      if (!connectButton) {
        logger.warn('Bouton "Se connecter" introuvable, ni en direct ni dans le menu "..."');
        return {
          success: false,
          error: 'Pas de bouton Se connecter trouvé',
          statusUpdate: 'error'
        };
      }

      // 5) Cliquer sur ce bouton / item “Se connecter”
      logger.info('Tentative de clic sur "Se connecter"');
      await page.evaluate(el => el.click(), connectButton);

      // Petite pause pour laisser LinkedIn réagir
      await sleep(2000);

      logger.info('Bouton "Se connecter" cliqué avec succès');

      // 1) Attendre la 1ère modale (data-test-modal-id="send-invite-modal") => "Voulez-vous ajouter une note ?"
      try {
        await page.waitForSelector('[data-test-modal-id="send-invite-modal"]', {
          visible: true, 
          timeout: 5000
        });
      } catch (modalWaitError) {
        logger.warn(`La modale "send-invite-modal" n'est pas apparue: ${modalWaitError.message}`);
        // fallback => renvoyer ?
        return {
          success: false,
          error: 'Modale de connexion introuvable',
          statusUpdate: 'error'
        };
      }
      await sleep(2000)
      // 2) Repérer le bouton "Ajouter une note" ou "Envoyer sans note"
      const firstModalButtons = await page.$$('button');
      let addNoteModalBtn = null;
      let sendWithoutNoteBtn = null;
      for (const btn of firstModalButtons) {
        const text = (await page.evaluate(el => el.textContent, btn)) || '';
        const ariaLabel = (await page.evaluate(el => el.getAttribute('aria-label'), btn)) || '';

        // On normalise
        const textTrimmed = text.trim();

        if (
          textTrimmed.includes('Ajouter une note') ||
          ariaLabel.includes('Ajouter une note')
        ) {
          addNoteModalBtn = btn;
        }

        if (
          textTrimmed.includes('Envoyer sans note') ||
          ariaLabel.includes('Envoyer sans note')
        ) {
          sendWithoutNoteBtn = btn;
        }
      }

      // 3) Si on n'a pas trouvé "Ajouter une note", on tente l'envoi direct
      if (!addNoteModalBtn) {
        logger.warn('Bouton "Ajouter une note" non trouvé dans la première modale');
        if (sendWithoutNoteBtn) {
          logger.info('On clique sur "Envoyer sans note"');
          await sendWithoutNoteBtn.click();
          await sleep(getRandomDelay(1000, 2000));
          // Vérifier si c'est ok
          const success = await page.evaluate(() => {
            return (
              !document.querySelector('.artdeco-modal__content') ||
              document.querySelector('.artdeco-toast--success')
            );
          });
          if (success) {
            logger.info(`Demande de connexion envoyée sans note avec succès à ${profileUrl}`);
            return { success: true };
          } else {
            logger.warn(`Échec de l'envoi sans note pour ${profileUrl}`);
            await page.screenshot({ path: './logs/direct-send-failed.png' });
            return {
              success: false,
              error: 'Échec de l\'envoi sans note',
              statusUpdate: 'error'
            };
          }
        } else {
          return {
            success: false,
            error: 'Bouton "Ajouter une note" et "Envoyer sans note" introuvables',
            statusUpdate: 'error'
          };
        }
      }
      await sleep(2000)
      // 4) Cliquer sur le bouton "Ajouter une note"
      try {
        await addNoteModalBtn.click();
        logger.info('Bouton "Ajouter une note" cliqué avec succès (1ère modale)');
        await sleep(getRandomDelay(1000, 2000));
      } catch (clickAddNoteError) {
        logger.error(`Erreur lors du clic sur "Ajouter une note": ${clickAddNoteError.message}`);
        return {
          success: false,
          error: `Erreur clic "Ajouter une note": ${clickAddNoteError.message}`,
          statusUpdate: 'error'
        };
      }
      await sleep(2000)
      // 5) Maintenant la modale affiche le textarea #custom-message
      //    On attend que #custom-message apparaisse
      try {
        await page.waitForSelector('#custom-message', { visible: true, timeout: 5000 });
      } catch (waitTextareaErr) {
        logger.warn(`Le textarea #custom-message n'est pas apparu: ${waitTextareaErr.message}`);
        return {
          success: false,
          error: 'Textarea #custom-message introuvable',
          statusUpdate: 'error'
        };
      }
      await sleep(1000)
      // 6) Saisir le texte
      const message = `Bonjour ${firstName},\nLe secteur de l'IT et de la tech évolue rapidement, et j’aime rester connecté avec des professionnels passionnés. Je vous propose de rejoindre mon réseau pour de futurs échanges et collaborations.
Bien cordialement, Hugo, Top Profil `;

      // On remplit la zone #custom-message
      try {
        const textArea = await page.$('#custom-message');
        if (!textArea) {
          logger.warn('Impossible de récupérer le textarea #custom-message malgré waitForSelector');
          return {
            success: false,
            error: 'textarea #custom-message introuvable',
            statusUpdate: 'error'
          };
        }

        await textArea.click();
        await sleep(500);
        await textArea.focus();
        await sleep(500);

        await page.evaluate(msg => {
          const area = document.getElementById('custom-message');
          if (area) {
            area.value = msg;
            const evt = new Event('input', { bubbles: true });
            area.dispatchEvent(evt);
          }
        }, message);

      } catch (typeError) {
        logger.error(`Erreur lors de l'écriture de la note: ${typeError.message}`);
        return {
          success: false,
          error: `Erreur de saisie note: ${typeError.message}`,
          statusUpdate: 'error'
        };
      }

      // 7) Trouver le bouton "Envoyer" (aria-label="Envoyer une invitation" OU texte "Envoyer")
      let finalSendBtn = null;
      try {
        const modalButtons = await page.$$('button');
        for (const btn of modalButtons) {
          const text = await page.evaluate(el => el.textContent.trim(), btn);
          const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), btn);
          // Selon ton HTML: aria-label="Envoyer une invitation", ou texte "Envoyer"
          if (
            (ariaLabel && ariaLabel.includes('Envoyer une invitation')) ||
            (text && text === 'Envoyer')
          ) {
            finalSendBtn = btn;
            break;
          }
        }
      } catch (sendBtnErr) {
        logger.error(`Erreur lors de la recherche du bouton Envoyer: ${sendBtnErr.message}`);
        return {
          success: false,
          error: `Erreur bouton Envoyer: ${sendBtnErr.message}`,
          statusUpdate: 'error'
        };
      }

      if (!finalSendBtn) {
        logger.warn('Bouton "Envoyer" non trouvé après ajout de la note');
        return {
          success: false,
          error: 'Bouton "Envoyer" introuvable',
          statusUpdate: 'error'
        };
      }
      await sleep(3000)
      // 8) Cliquer sur "Envoyer"
      try {
        await finalSendBtn.click();
        logger.info('Bouton "Envoyer" cliqué avec succès');
        await sleep(getRandomDelay(2000, 3000));
      } catch (sendClickError) {
        logger.error(`Erreur lors du clic sur Envoyer: ${sendClickError.message}`);
        return {
          success: false,
          error: `Erreur clic Envoyer: ${sendClickError.message}`,
          statusUpdate: 'error'
        };
      }
      await sleep(3000)
      
      // Vérifier si la modale disparaît / ou si on a un toast de succès
      const sendSuccess = await page.evaluate(() => {
        const modalGone = !document.querySelector('.artdeco-modal__content');
        const toastOk = document.querySelector('.artdeco-toast--success') ||
                        document.querySelector('.artdeco-inline-notification--success');
        const pendingBtn = Array.from(document.querySelectorAll('button')).some(
          b => b.textContent.includes('En attente') || b.textContent.includes('Pending')
        );
        return modalGone || toastOk || pendingBtn;
      });
      if (!sendSuccess) {
        logger.warn(`Échec possible de l'envoi (la modale est toujours visible)`);
        await page.screenshot({ path: './logs/send-possibly-failed.png' });
        return {
          success: false,
          error: 'Modal toujours visible après "Envoyer"',
          statusUpdate: 'error'
        };
      }

      logger.info(`Demande de connexion envoyée avec succès à ${profileUrl}`);
      return { success: true };

    } catch (error) {
      logger.error(`Erreur générale lors de l'envoi de la demande de connexion: ${error.message}`);
      try {
        await page.screenshot({ path: './logs/connection-request-error.png' });
      } catch (screenError) {
        logger.error(`Impossible de prendre une capture d'écran après l'erreur: ${screenError.message}`);
      }
      return {
        success: false,
        error: `Erreur générale: ${error.message}`,
        statusUpdate: 'error'
      };
    }
  }

  /**
   * Traite les demandes de connexion en file d'attente
   * @returns {Promise<number>} Nombre de demandes envoyées
   */
  async processPendingConnectionRequests() {
    let browser = null;
    let page = null;

    try {
      const Cookie = require('../models/Cookie');
      const cookieRecord = await Cookie.findOne({ name: 'linkedin_li_at' });
      
      if (!cookieRecord || !cookieRecord.isValid) {
        logger.error('Cookie LinkedIn invalide ou expiré, traitement des connexions annulé');
        return 0;
      }
      if (!this.isInConnectionRequestTimeWindow()) {
        logger.info('En dehors de la plage horaire autorisée (10h-20h)');
        return 0;
      }

      if (await DailyStats.isConnectionRequestQuotaReached()) {
        logger.info('Quota journalier de demandes de connexion atteint');
        return 0;
      }

      const pendingRequests = await ConnectionQueue.find({
        status: 'pending',
        scheduledAt: { $lte: new Date() }
      })
        .limit(10)
        .populate({
          path: 'prospectId',
          select: 'firstName lastName email linkedinProfileUrl connectionStatus'
        });

      if (pendingRequests.length === 0) {
        logger.info('Aucune demande en attente dans la file');
        return 0;
      }

      logger.info(`Traitement de ${pendingRequests.length} demandes en file d'attente`);

      browser = await browserUtils.launchBrowser(false, false);
      page = await browserUtils.createStealthPage(browser);
  
      const isAuthenticated = await browserUtils.authenticateWithCookies(page);
      if (!isAuthenticated) {
        logger.error('Échec de l\'authentification LinkedIn, traitement annulé');
        if (browser) await browserUtils.closeBrowser(browser);
        return 0;
      }

      let sentCount = 0;

      for (const request of pendingRequests) {
        if (await DailyStats.isConnectionRequestQuotaReached()) {
          logger.info('Quota journalier atteint pendant le traitement');
          break;
        }

        request.status = 'processing';
        request.processingStartedAt = new Date();
        await request.save();

        const prospect = request.prospectId;
        const result = await this._sendRealConnectionRequestWithPage(
          page,
          prospect.linkedinProfileUrl,
          prospect.firstName
        );

        if (result.success) {
          let statusToUpdate = 'invitation_sent';
          if (result.alreadyConnected) {
            statusToUpdate = 'connected';
          }

          await Prospect.findByIdAndUpdate(prospect._id, {
            connectionStatus: statusToUpdate,
            invitationSentAt: new Date(),
            lastConnectionCheckAt: new Date(),
            connectionError: null
          });

          await ProspectSequenceStatus.updateConnectionStatus(prospect._id, statusToUpdate);

          await DailyStats.incrementConnectionRequestsSent();

          request.status = 'sent';
          request.completedAt = new Date();
          await request.save();

          sentCount++;
          const settings = await this._loadSettings();
          const minDelay = settings.quotas.connections.delay || 30000;
          const maxDelay = minDelay * 2;
          await sleep(getRandomDelay(minDelay, maxDelay));

        } else {
          await Prospect.findByIdAndUpdate(prospect._id, {
            connectionStatus: result.statusUpdate || 'error',
            lastConnectionCheckAt: new Date(),
            connectionError: result.error
          });

          request.status = 'failed';
          request.error = result.error;
          request.completedAt = new Date();
          await request.save();

          logger.warn(`Échec de l'envoi pour ${prospect.linkedinProfileUrl}: ${result.error}`);
        }
      }

      logger.info(`${sentCount} demandes de connexion envoyées avec succès`);
      return sentCount;
  
    } catch (error) {
      logger.error(`Erreur lors du traitement des demandes de connexion: ${error.message}`);
      return 0;
    } finally {
      if (browser) {
        logger.info('Fermeture de l\'instance de navigateur');
        await browserUtils.closeBrowser(browser); // Ceci appelle bien la bonne fonction
      }
    }
  }

  /**
   * Démarre le traitement périodique des demandes de connexion
   * @param {number} interval - Intervalle en millisecondes (défaut: 60 secondes)
   */
/**
 * Démarre le traitement périodique des demandes de connexion
 * @param {number} interval - Intervalle en millisecondes (optionnel)
 */
async startConnectionRequests(interval = null) {
  if (this.connectionRequestInterval) {
    logger.info('Le traitement des demandes de connexion est déjà en cours');
    return;
  }

  // Charger les paramètres pour obtenir l'intervalle configuré
  const settings = await this._loadSettings();
  const checkInterval = interval || settings.intervals.connectionRequest || 60000;

  logger.info(`Démarrage du traitement des demandes de connexion avec un intervalle de ${checkInterval}ms`);

  // Vérifier si on est dans les plages horaires de travail
  if (this.isInConnectionRequestTimeWindow()) {
    await this.processPendingConnectionRequests();
  } else {
    logger.info('En dehors des plages horaires de travail - Traitement reporté à la prochaine période de travail');
  }

  this.connectionRequestInterval = setInterval(async () => {
    try {
      // Vérifier si on est dans les plages horaires de travail
      if (this.isInConnectionRequestTimeWindow()) {
        await this.processPendingConnectionRequests();
      } else {
        logger.debug('En dehors des plages horaires de travail - Traitement reporté');
      }
    } catch (error) {
      logger.error(`Erreur dans l'intervalle de traitement des demandes: ${error.message}`);
    }
  }, checkInterval);

  logger.info('Traitement des demandes de connexion démarré avec succès');
}

  /**
   * Arrête le traitement périodique des demandes de connexion
   */
  async stopConnectionRequests() {
    if (!this.connectionRequestInterval) {
      logger.info('Le traitement des demandes de connexion n\'est pas en cours');
      return;
    }

    logger.info('Arrêt du traitement des demandes de connexion');
    clearInterval(this.connectionRequestInterval);
    this.connectionRequestInterval = null;
    logger.info('Traitement des demandes de connexion arrêté avec succès');
  }

    /**
   * Charge les paramètres globaux de l'application
   * @private
   * @returns {Promise<Object>} Paramètres de l'application
   */
  async _loadSettings() {
    try {
      const settings = await AppSettings.getGlobalSettings();
      logger.debug('Paramètres de l\'application chargés avec succès');
      return settings;
    } catch (error) {
      logger.error(`Erreur lors du chargement des paramètres: ${error.message}`);
      // Valeurs par défaut
      return {
        intervals: { connectionRequest: 60000 },
        quotas: { connections: { max: 50, delay: 30000 } }
      };
    }
  }
}

module.exports = new ConnectionManager();
