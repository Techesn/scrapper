// Imports des modules
import { setupNavigation } from './components/navigation.js';
import { loadDashboard } from './pages/dashboard.js';
import { loadSessionsPage } from './pages/sessions.js'; 
import { loadProspectsPage } from './pages/prospects.js';
import { loadSettingsPage } from './pages/settings.js';
import { initSocketConnection } from './services/socket-service.js';
import { loadCompanyEmailFormatsPage } from './pages/company-email-formats.js';
import { loadSequencesPage } from './pages/sequences.js'; // Nouvelle importation

// Élément DOM principal pour le contenu
const contentContainer = document.getElementById('content-container');

// Dictionnaire des pages
const pages = {
  'nav-dashboard': loadDashboard,
  'nav-sessions': loadSessionsPage,
  'nav-prospects': loadProspectsPage,
  'nav-settings': loadSettingsPage,
  'nav-email-formats': loadCompanyEmailFormatsPage,
  'nav-sequences': loadSequencesPage // Nouvelle page pour les séquences
};

// Solution temporaire - Support de l'ancien ID nav-scraper
pages['nav-scraper'] = loadSessionsPage;

// Point d'entrée de l'application
document.addEventListener('DOMContentLoaded', async () => {
  // Initialiser la connexion socket
  initSocketConnection();
  
  // Configurer la navigation
  setupNavigation(pages, contentContainer);
  
  // Charger la page dashboard par défaut
  await loadDashboard(contentContainer);
  
  // Vérifier et mettre à jour l'interface de navigation si nécessaire
  const scraperNavItem = document.getElementById('nav-scraper');
  if (scraperNavItem) {
    console.log('Mise à jour temporaire de l\'élément de navigation');
    scraperNavItem.id = 'nav-sessions';
    scraperNavItem.innerHTML = '<i class="fas fa-layer-group mr-3"></i> Sessions';
  }
});