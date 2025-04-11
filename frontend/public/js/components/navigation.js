/**
 * Configure la navigation entre les différentes sections
 * @param {Object} pages - Dictionnaire des fonctions de chargement de pages
 * @param {HTMLElement} contentContainer - Conteneur pour le contenu des pages
 */
export function setupNavigation(pages, contentContainer) {
  console.log("Pages disponibles:", Object.keys(pages)); // Log des pages disponibles
  
  // Récupérer tous les éléments de navigation
  const navItems = document.querySelectorAll('.nav-item');
  console.log("Éléments de navigation trouvés:", navItems.length); // Log du nombre d'éléments
  
  // Log des IDs des éléments de navigation pour vérification
  navItems.forEach(item => console.log("Élément de navigation:", item.id));
  
  // Ajouter les écouteurs d'événements pour chaque élément de navigation
  navItems.forEach(item => {
    item.addEventListener('click', async (event) => {
      event.preventDefault();
      
      // Désactiver tous les éléments de navigation
      navItems.forEach(navItem => navItem.classList.remove('active'));
      
      // Activer l'élément cliqué
      item.classList.add('active');
      
      // Afficher l'indicateur de chargement
      contentContainer.innerHTML = `
        <div class="flex justify-center items-center h-64">
          <div class="loading-spinner"></div>
        </div>
      `;
      
      // Récupérer l'ID de la page à charger
      const pageId = item.id;
      console.log("Tentative de chargement de la page:", pageId); // Log de la page demandée
      console.log("Fonction de chargement trouvée:", !!pages[pageId]); // Vérification si la fonction existe
      
      // Charger la page correspondante si elle existe
      if (pages[pageId]) {
        try {
          await pages[pageId](contentContainer);
        } catch (error) {
          console.error('Erreur lors du chargement de la page:', error);
          contentContainer.innerHTML = `
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p>Erreur lors du chargement de la page: ${error.message}</p>
            </div>
          `;
        }
      } else {
        console.error(`Fonction de chargement pour '${pageId}' introuvable dans:`, pages);
        contentContainer.innerHTML = `
          <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
            <p>Page non trouvée (ID: ${pageId})</p>
          </div>
        `;
      }
    });
  });
}