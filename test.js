const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
require('dotenv').config();

puppeteer.use(StealthPlugin());

async function testLinkedInConnection() {
  try {
    // Lancer le navigateur
    const browser = await puppeteer.launch({
      headless: false, // Mode visible pour le débogage
      defaultViewport: null
    });

    // Créer une nouvelle page
    const page = await browser.newPage();

    // Définir le cookie
    const cookieStr = process.env.LINKEDIN_COOKIE;
    
    console.log('Cookie utilisé :', cookieStr);

    // Transformer le cookie en format Puppeteer
    const cookies = cookieStr.split(';').map(pair => {
      const [name, ...value] = pair.trim().split('=');
      return {
        name: name.trim(),
        value: value.join('=').trim(),
        domain: '.linkedin.com',
        path: '/',
        httpOnly: true,
        secure: true,
      };
    });

    // Afficher les cookies pour vérification
    console.log('Cookies à définir :', cookies);

    // Aller sur LinkedIn
    await page.goto('https://www.linkedin.com/login', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    // Vérifier les cookies existants avant l'ajout
    const existingCookies = await page.cookies();
    console.log('Cookies existants avant ajout :', existingCookies);

    // Supprimer tous les cookies existants
    await page.evaluate(() => {
      document.cookie.split(';').forEach(cookie => {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.linkedin.com`;
      });
    });

    // Définir les nouveaux cookies
    await page.setCookie(...cookies);

    // Vérifier les cookies après ajout
    const newCookies = await page.cookies();
    console.log('Cookies après ajout :', newCookies);

    // Recharger la page
    await page.reload({ 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });

    // Capture d'écran pour vérification
    await page.screenshot({ path: 'linkedin_login_test.png' });

    // Vérifier la connexion
    const loginCheck = await page.evaluate(() => {
      // Collecter le plus d'informations possible
      return {
        url: window.location.href,
        title: document.title,
        bodyClasses: document.body.className,
        bodyText: document.body.innerText,
        cookies: document.cookie,
        isLoggedIn: !!document.querySelector('[data-control-name="nav.profile"]')
      };
    });

    console.log('Résultat de la vérification :', JSON.stringify(loginCheck, null, 2));

    // Intercepter et afficher toutes les requêtes
    page.on('request', (request) => {
      console.log('Request URL:', request.url());
    });

    // Attendre un peu pour voir les requêtes
    await page.waitForTimeout(5000);

    // Fermer le navigateur
    await browser.close();

  } catch (error) {
    console.error('Erreur lors du test de connexion :', error);
  }
}

testLinkedInConnection();