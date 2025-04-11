require('dotenv').config();

const config = {
  app: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/linkedin_scraper'
  },
  linkedin: {
    scraping: {
      dailyProspectLimit: parseInt(process.env.DAILY_PROSPECT_LIMIT) || 1000,
      minDelayBetweenActions: parseInt(process.env.MIN_DELAY_BETWEEN_ACTIONS) || 1000,
      maxDelayBetweenActions: parseInt(process.env.MAX_DELAY_BETWEEN_ACTIONS) || 3000,
      scrollStepSize: parseInt(process.env.SCROLL_STEP_SIZE) || 500
    }
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  selectors: {
    salesNavigator: {
      // Sélecteurs de liste
      prospectRow: 'tr.artdeco-models-table-row',
      
      // Sélecteurs pour les données à extraire dans la liste
      profileName: 'a[data-anonymize="person-name"]',
      profileJobTitle: 'div[data-anonymize="job-title"]',
      profileCompany: 'span[data-anonymize="company-name"]',
      
      // Sélecteurs pour la modale
      moreOptionsButton: 'button[aria-label="Plus"]',
      moreOptionsDropdown: 'div.artdeco-dropdown__content--is-open',
      viewProfileOption: 'div.artdeco-dropdown__content--is-open a[href*="linkedin.com/in/"]',
      modalHeader: 'div.artdeco-modal-overlay + div[role="dialog"]',
      jobDescription: '.profile-position__position-excerpt, .profile-experience__description, .lt-line-clamp__raw-line',
      closeModalButton: 'button[aria-label="Fermer"], button[aria-label="Close"]',
      seeMoreButton: 'button.lt-line-clamp__more, span.lt-line-clamp__more'
    }
  }
};

module.exports = config;