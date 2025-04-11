const { authenticateWithCookies, createStealthPage, launchBrowser } = require('../utils/browserUtils');
const Prospect = require('../models/prospect');
const ProspectSequenceStatus = require('../models/prospectSequenceStatus');
const sequenceScheduler = require('./sequenceScheduler');
const logger = require('../utils/logger');
const { sleep } = require('../utils/puppeteerUtils');
const authService = require('../services/authService');
const timeService = require('../services/timeService');
const AppSettings = require('../models/AppSettings');
const browserUtils = require('../utils/browserUtils');
/**
 * Service de vérification des connexions LinkedIn récentes
 * Responsable de vérifier les nouveaux contacts sur LinkedIn et mettre à jour
 * leur statut dans la base de données
 */
class ConnectionChecker {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.checkInterval = null;
    this.settings = null; // Ajout pour stocker les paramètres
    
    // S'abonner aux événements de changement d'état du cookie
    authService.on('cookieBecameInvalid', async () => {
      logger.warn('Cookie LinkedIn devenu invalide - Arrêt de la vérification des connexions');
      await this.stopChecking();
    });
  }

  async initialize() {
    try {
      logger.info('Initialisation du vérificateur de connexions LinkedIn');
      
      // Vérifier d'abord si le cookie est valide
      const isValid = await authService.checkCookieValidity();
      if (!isValid) {
        logger.error('Cookie LinkedIn invalide ou expiré');
        throw new Error('Cookie LinkedIn invalide ou expiré');
      }
      
      if (this.browser) {
        logger.info('Le navigateur est déjà initialisé');
        return;
      }
      
      // Lancer le navigateur en mode furtif
      // Utiliser une session temporaire ET forcer une création hors pool
      // pour ne pas prendre de session du pool permanent
      this.browser = await browserUtils.launchBrowser(true, true); // temporary=true, forceNewSession=true
      this.page = await browserUtils.createStealthPage(this.browser);
      
      // Authentification LinkedIn
      const isAuthenticated = await browserUtils.authenticateWithCookies(this.page);
      
      if (!isAuthenticated) {
        logger.error('Échec de l\'authentification LinkedIn');
        await this.close();
        throw new Error('Authentification LinkedIn échouée');
      }
      
      logger.info('Vérificateur de connexions initialisé avec succès');
    } catch (error) {
      logger.error(`Erreur lors de l'initialisation du vérificateur: ${error.message}`);
      await this.close();
      throw error;
    }
  }

  /**
   * Nettoie un nom en retirant caractères spéciaux et emojis
   * @private
   * @param {string} name - Nom à nettoyer
   * @returns {string} Nom nettoyé
   */
  _cleanName(name) {
    // Supprimer les emojis et caractères spéciaux mais conserver les lettres, chiffres, espaces, tirets et apostrophes
    return name.replace(/[^\p{L}\p{N}\s\-']/gu, '').trim();
  }

  /**
   * Normalise un nom pour faciliter la comparaison
   * @private
   * @param {string} name - Nom à normaliser
   * @returns {string} Nom normalisé
   */
  _normalizeName(name) {
    return name.toLowerCase()
      .replace(/[-']/g, ' ')  // Remplacer tirets et apostrophes par des espaces
      .replace(/\s+/g, ' ')   // Normaliser les espaces multiples
      .trim();
  }

  /**
   * Vérifie les connexions LinkedIn récentes
   */
  async checkRecentConnections() {
    try {
      // Initialiser pour chaque vérification
      await this.initialize();
      
      logger.info('Vérification des connexions LinkedIn récentes');
      
      // Naviguer vers la page des connexions
      await this.page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', {
        waitUntil: 'domcontentloaded', // Moins restrictif
        timeout: 30000
      });
      
      // Attendre que la page charge de manière plus souple
      await sleep(5000);
      
      // Extraire les connexions avec une méthode améliorée
      const connections = await this.page.evaluate(() => {
        const results = [];
        const uniqueProfiles = new Set(); // Pour éviter les doublons par URL de profil
        
        // Cibler les éléments conteneurs des connexions récentes
        const connectionContainers = document.querySelectorAll('div[componentkey^="auto-component"]');
        
        // Parcourir tous les conteneurs de connexions
        for (const container of connectionContainers) {
          // Vérifier si c'est une connexion récente en cherchant le texte "Connexion le"
          const dateText = container.textContent || '';
          if (!dateText.includes('Connexion le')) continue;
          
          // Chercher spécifiquement le lien qui contient le nom (utiliser le sélecteur correct)
          const nameLink = container.querySelector('a._139m7k1io._3g29zz0');
          
          if (!nameLink) {
            // Si le sélecteur spécifique ne fonctionne pas, essayer une approche alternative
            const allLinks = container.querySelectorAll('a[href*="/in/"]');
            for (const link of allLinks) {
              if (link.textContent && link.textContent.trim() && !link.textContent.includes('@')) {
                const profileUrl = link.getAttribute('href');
                // Éviter les doublons en vérifiant l'URL du profil
                if (uniqueProfiles.has(profileUrl)) continue;
                uniqueProfiles.add(profileUrl);
                
                const fullName = link.textContent.trim();
                
                results.push({
                  fullName,
                  profileUrl,
                  dateText: dateText.includes('Connexion le') ? 'Connexion récente' : dateText
                });
                break;
              }
            }
            continue;
          }
          
          // Extraire le nom complet et l'URL du profil
          const fullName = nameLink.textContent.trim();
          const profileUrl = nameLink.getAttribute('href');
          
          // Éviter les doublons en vérifiant l'URL du profil
          if (uniqueProfiles.has(profileUrl)) continue;
          uniqueProfiles.add(profileUrl);
          
          results.push({
            fullName,
            profileUrl,
            dateText: dateText.includes('Connexion le') ? 'Connexion récente' : dateText
          });
        }
        
        return results;
      });
      
      // Prétraitement des données extraites
      const processedConnections = connections.map(connection => {
        // Nettoyer le nom
        const cleanName = this._cleanName(connection.fullName);
        
        // Diviser en prénom et nom de façon plus intelligente
        const nameParts = cleanName.split(' ');
        let firstName, lastName;
        
        if (nameParts.length === 1) {
          // S'il n'y a qu'un seul mot, considérer comme prénom
          firstName = nameParts[0];
          lastName = '';
        } else {
          // Considérer le premier mot comme prénom et le reste comme nom
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        }
        
        return {
          firstName,
          lastName,
          fullName: cleanName,
          profileUrl: connection.profileUrl,
          dateText: connection.dateText
        };
      });
      
      // Afficher pour le debugging
      logger.info(`${processedConnections.length} connexions récentes trouvées:`);
      processedConnections.forEach(connection => {
        logger.info(`- ${connection.firstName} ${connection.lastName} (${connection.dateText}) - ${connection.profileUrl}`);
      });
      
      // Pour chaque connexion récente, vérifier si elle correspond à un prospect
      let matchCount = 0;
      for (const connection of processedConnections) {
        // Stratégie de correspondance améliorée
        
        // 1. D'abord essayer de trouver par URL du profil (la méthode la plus fiable)
        let prospect = null;
        if (connection.profileUrl) {
          prospect = await Prospect.findOne({
            linkedinProfileUrl: connection.profileUrl
          });
          
          if (prospect) {
            logger.info(`Connexion trouvée par URL pour ${connection.fullName} (${connection.profileUrl})`);
          }
        }
        
        // 2. Si pas trouvé par URL, essayer par nom
        if (!prospect) {
          // Normaliser les noms pour la recherche
          const normalizedFirstName = this._normalizeName(connection.firstName);
          const normalizedLastName = this._normalizeName(connection.lastName);
          
          logger.debug(`Recherche par nom : "${normalizedFirstName} ${normalizedLastName}"`);
          
          // Recherche plus flexible
          const prospects = await Prospect.find({
            $and: [
              {
                $or: [
                  { firstName: { $regex: new RegExp('^' + normalizedFirstName, 'i') } },
                  { firstName: { $regex: new RegExp(normalizedFirstName, 'i') } }
                ]
              },
              {
                $or: [
                  { lastName: { $regex: new RegExp('^' + normalizedLastName, 'i') } },
                  { lastName: { $regex: new RegExp(normalizedLastName, 'i') } }
                ]
              }
            ]
          });
          
          if (prospects.length > 0) {
            // S'il y a plusieurs correspondances, prendre la première
            prospect = prospects[0];
            logger.info(`Connexion trouvée par nom pour ${connection.fullName}`);
            
            // Si URL du profil disponible et pas déjà enregistrée, la mettre à jour
            if (connection.profileUrl && (!prospect.linkedinProfileUrl || prospect.linkedinProfileUrl !== connection.profileUrl)) {
              await Prospect.findByIdAndUpdate(prospect._id, {
                linkedinProfileUrl: connection.profileUrl
              });
              logger.info(`URL de profil mise à jour pour ${prospect.firstName} ${prospect.lastName}`);
            }
          }
        }
        
        // Si une correspondance est trouvée, mettre à jour le statut
        if (prospect) {
          matchCount++;
          
          // Mettre à jour le statut de connexion
          await Prospect.findByIdAndUpdate(prospect._id, {
            connectionStatus: 'connected',
            lastConnectionCheckAt: new Date()
          });
          
          // Mettre à jour les statuts dans les séquences
          await this._updateProspectInSequences(prospect._id);
        }
      }
      
      logger.info(`Vérification des connexions terminée. ${matchCount} correspondances trouvées.`);
      
      // Fermer le navigateur après chaque vérification
      await this.close();
      
      return true;
    } catch (error) {
      logger.error(`Erreur lors de la vérification des connexions: ${error.message}`);
      
      // Réinitialiser le navigateur en cas d'erreur
      await this.close();
      return false;
    }
  }

  /**
   * Met à jour directement les statuts des prospects dans les séquences actives
   * sans vérifier s'ils sont en attente ou non
   * @private
   * @param {string} prospectId - ID du prospect
   */
  async _updateProspectStatusesDirectly(prospectId) {
    try {
      // Mettre à jour le statut de connexion du prospect
      await Prospect.findByIdAndUpdate(prospectId, {
        connectionStatus: 'connected',
        lastConnectionCheckAt: new Date()
      });
      
      logger.info(`Prospect ${prospectId} marqué comme connecté`);
      
      // Mettre à jour le statut dans toutes les séquences
      await this._updateProspectInSequences(prospectId);
      
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour du statut: ${error.message}`);
    }
  }
  

  /**
   * Démarre la vérification périodique des connexions
   * @param {number} interval - Intervalle en millisecondes (défaut: 1 heure)
   */
/**
 * Démarre la vérification périodique des connexions
 * @param {number} interval - Intervalle en millisecondes (optionnel)
 */
async startChecking(interval = null) {
  if (this.isRunning) {
    logger.info('La vérification des connexions est déjà en cours');
    return;
  }
  
  // Charger les paramètres s'ils ne sont pas déjà chargés
  if (!this.settings) {
    await this._loadSettings();
  }
  
  // Utiliser l'intervalle des paramètres si aucun n'est fourni
  const checkInterval = interval || this.settings.intervals.connectionCheck;
  
  this.isRunning = true;
  
  logger.info(`Démarrage de la vérification des connexions avec un intervalle de ${checkInterval}ms`);
  
  // Vérifier si on est dans les plages horaires de travail
  if (!timeService.isInWorkingHours('connection')) {
    logger.info('En dehors des plages horaires de travail pour les connexions - La première vérification sera effectuée lors de la prochaine période de travail');
  } else {
    // Effectuer une première vérification
    await this.checkRecentConnections();
  }
  
  // Configurer l'intervalle pour les vérifications suivantes
  this.checkInterval = setInterval(async () => {
    try {
      // Vérifier si on est dans les plages horaires de travail
      if (timeService.isInWorkingHours('connection')) {
        await this.checkRecentConnections();
      } else {
        logger.debug('En dehors des plages horaires de travail pour les connexions - Vérification reportée');
      }
    } catch (error) {
      logger.error(`Erreur dans l'intervalle de vérification: ${error.message}`);
    }
  }, checkInterval);
  
  logger.info('Vérification des connexions démarrée avec succès');
}

  /**
   * Arrête la vérification périodique des connexions
   */
  async stopChecking() {
    if (!this.isRunning) {
      logger.info('La vérification des connexions n\'est pas en cours');
      return;
    }
    
    logger.info('Arrêt de la vérification des connexions');
    
    // Arrêter l'intervalle
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.isRunning = false;
    
    // Fermer le navigateur
    await this.close();
    
    logger.info('Vérification des connexions arrêtée avec succès');
  }
  async _updateProspectInSequences(prospectId) {
    try {
      // Mettre à jour le statut de connexion dans toutes les séquences où ce prospect est présent
      const result = await ProspectSequenceStatus.updateMany(
        { prospectId: prospectId },
        { connectionStatus: 'connected' }
      );
      
      if (result.nModified > 0) {
        logger.info(`Statut de connexion mis à jour dans ${result.nModified} séquences pour le prospect ${prospectId}`);
      }
      
      // Passer en status "active" les prospects "pending" qui sont maintenant connectés
      // (ce qui déclenche l'envoi du premier message)
      await ProspectSequenceStatus.updateMany(
        { 
          prospectId: prospectId,
          status: 'pending',
          connectionStatus: 'connected'
        },
        { status: 'active' }
      );
      
      // Planifier les prochains messages pour ces prospects qui viennent d'être activés
      const activatedStatuses = await ProspectSequenceStatus.find({
        prospectId: prospectId,
        status: 'active',
        currentStep: 1,
        $or: [
          { nextMessageScheduledAt: { $exists: false } },
          { nextMessageScheduledAt: null }
        ]
      });
      
      for (const status of activatedStatuses) {
        await sequenceScheduler.scheduleNextMessageForProspect(status._id);
      }
      
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour du prospect dans les séquences: ${error.message}`);
    }
  }
  /**
   * Ferme le navigateur
   */
  async close() {
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
   * @returns {Promise<void>}
   */
  async _loadSettings() {
    try {
      this.settings = await AppSettings.getGlobalSettings();
      logger.debug('Paramètres de l\'application chargés avec succès');
    } catch (error) {
      logger.error(`Erreur lors du chargement des paramètres: ${error.message}`);
      // Utiliser des valeurs par défaut en cas d'erreur
      this.settings = {
        intervals: { connectionCheck: 3600000 }, // 1 heure par défaut
        quotas: { connections: { max: 50, delay: 3000 } }
      };
    }
  }
}

module.exports = new ConnectionChecker();