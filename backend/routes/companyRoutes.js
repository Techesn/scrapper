const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');

// Routes pour les entreprises
router.get('/to-format', companyController.getCompaniesToFormat);
router.get('/with-email-format', companyController.getCompaniesWithEmailFormat);
router.post('/email-format', companyController.setCompanyEmailFormat);

module.exports = router;