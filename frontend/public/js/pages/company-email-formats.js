export async function loadCompanyEmailFormatsPage(contentContainer) {
  // Charger le contenu HTML avec une structure d'onglets
  contentContainer.innerHTML = `
    <div class="container mx-auto p-6">
      <h1 class="text-2xl font-bold mb-6">Formats d'Email d'Entreprise</h1>
      
      <div class="flex mb-4">
        <button id="tab-to-format" class="px-4 py-2 bg-blue-500 text-white mr-2 rounded-t active-tab">
          Entreprises à Formater
        </button>
        <button id="tab-formatted" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-t">
          Entreprises Formatées
        </button>
      </div>
      
      <div id="content-to-format" class="bg-white shadow rounded p-4">
        <div id="companies-to-format">
          <!-- Liste dynamique des entreprises à formater -->
        </div>
      </div>
      
      <div id="content-formatted" class="bg-white shadow rounded p-4 hidden">
        <div class="mb-4 flex">
          <input 
            type="text" 
            id="search-formatted-companies" 
            placeholder="Rechercher une entreprise" 
            class="w-full p-2 border rounded"
          >
        </div>
        <div id="formatted-companies">
          <!-- Liste dynamique des entreprises formatées -->
        </div>
      </div>
    </div>
  `;

  // Liste des formats d'email disponibles
  const emailFormats = [
    { value: '', label: 'Sélectionner un format' },
    { value: 'p.nom', label: 'Première lettre prénom + nom (p.nom)' },
    { value: 'prenom.nom', label: 'Prénom + nom (prenom.nom)' },
    { value: 'nom', label: 'Nom seul (nom)' },
    { value: 'nom.prenom', label: 'Nom + prénom (nom.prenom)' },
    { value: 'prenom', label: 'Prénom seul (prenom)' },
    { value: 'p.n', label: 'Première lettre prénom + première lettre nom (p.n)' }
  ];

  const companiesContainer = document.getElementById('companies-to-format');
  const formattedCompaniesContainer = document.getElementById('formatted-companies');
  const searchInput = document.getElementById('search-formatted-companies');
  const tabToFormat = document.getElementById('tab-to-format');
  const tabFormatted = document.getElementById('tab-formatted');
  const contentToFormat = document.getElementById('content-to-format');
  const contentFormatted = document.getElementById('content-formatted');

  // Gestion des onglets (code précédent)
  function switchTab(activeTab, inactiveTab, activeContent, inactiveContent) {
    activeTab.classList.add('bg-blue-500', 'text-white');
    activeTab.classList.remove('bg-gray-200', 'text-gray-700');
    inactiveTab.classList.remove('bg-blue-500', 'text-white');
    inactiveTab.classList.add('bg-gray-200', 'text-gray-700');
    
    activeContent.classList.remove('hidden');
    inactiveContent.classList.add('hidden');
  }

  tabToFormat.addEventListener('click', () => {
    switchTab(tabToFormat, tabFormatted, contentToFormat, contentFormatted);
  });

  tabFormatted.addEventListener('click', () => {
    switchTab(tabFormatted, tabToFormat, contentFormatted, contentToFormat);
  });

  // Charger les entreprises nécessitant un format d'email
  async function loadCompaniesToFormat() {
    try {
      const response = await fetch('/api/companies/to-format');
      const data = await response.json();
      
      if (data.success) {
        companiesContainer.innerHTML = data.companies.map(company => `
          <div class="company-item grid grid-cols-4 gap-4 items-center p-2 border-b">
            <span class="font-medium">${company.name}</span>
            <select class="company-email-format border rounded p-1" data-company-name="${company.name}">
              ${emailFormats.map(format => 
                `<option value="${format.value}" ${format.value === '' ? 'selected' : ''}>
                  ${format.label}
                </option>`
              ).join('')}
            </select>
            <input 
              type="text" 
              class="company-email-domain border rounded p-1" 
              value="${company.name.toLowerCase().replace(/\s+/g, '-')}.com" 
              data-company-name="${company.name}"
            >
            <button 
              class="save-company-format bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
              data-company-name="${company.name}"
            >
              Enregistrer
            </button>
          </div>
        `).join('');

        // Ajouter des écouteurs pour le bouton d'enregistrement
        document.querySelectorAll('.save-company-format').forEach(button => {
          button.addEventListener('click', () => saveCompanyEmailFormat(button.dataset.companyName));
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des entreprises', error);
    }
  }

  // Charger les entreprises avec format déjà défini
  async function loadFormattedCompanies() {
    try {
      const response = await fetch('/api/companies/with-email-format');
      const data = await response.json();
      
      if (data.success) {
        formattedCompaniesContainer.innerHTML = data.companies.map(company => `
          <div class="company-item grid grid-cols-3 gap-4 items-center p-2 border-b" data-company-name="${company.name}">
            <span class="font-medium">${company.name}</span>
            <div>
              <span>${company.emailFormat} @ ${company.emailDomain}</span>
            </div>
            <div class="text-right">
              <button 
                class="modify-company-format text-blue-500 hover:text-blue-700 mr-2"
                data-company-name="${company.name}"
                data-email-format="${company.emailFormat}"
                data-email-domain="${company.emailDomain}"
              >
                <i class="fas fa-edit"></i>
              </button>
            </div>
          </div>
        `).join('');

        // Ajouter des écouteurs pour le bouton de modification
        document.querySelectorAll('.modify-company-format').forEach(button => {
          button.addEventListener('click', () => {
            const companyItem = button.closest('.company-item');
            const companyName = button.dataset.companyName;
            const emailFormat = button.dataset.emailFormat;
            const emailDomain = button.dataset.emailDomain;
            
            // Convertir la ligne en formulaire de modification
            companyItem.innerHTML = `
              <span class="font-medium">${companyName}</span>
              <div>
                <select class="company-email-format border rounded p-1 mr-2" data-company-name="${companyName}">
                  ${emailFormats.map(format => 
                    `<option value="${format.value}" ${format.value === emailFormat ? 'selected' : ''}>
                      ${format.label}
                    </option>`
                  ).join('')}
                </select>
                <input 
                  type="text" 
                  class="company-email-domain border rounded p-1" 
                  value="${emailDomain}" 
                  data-company-name="${companyName}"
                >
              </div>
              <div class="text-right">
                <button 
                  class="save-company-format bg-green-500 text-white px-2 py-1 rounded mr-2 hover:bg-green-600"
                  data-company-name="${companyName}"
                >
                  Enregistrer
                </button>
                <button 
                  class="cancel-company-format text-red-500 hover:text-red-700"
                  data-company-name="${companyName}"
                >
                  Annuler
                </button>
              </div>
            `;

            // Réattacher les écouteurs d'événements
            document.querySelector(`.save-company-format[data-company-name="${companyName}"]`)
              .addEventListener('click', () => saveCompanyEmailFormat(companyName));
            
            document.querySelector(`.cancel-company-format[data-company-name="${companyName}"]`)
              .addEventListener('click', loadFormattedCompanies);
          });
        });

        // Ajouter la recherche
        searchInput.addEventListener('input', () => {
          const searchTerm = searchInput.value.toLowerCase();
          const companyItems = document.querySelectorAll('.company-item');
          
          companyItems.forEach(item => {
            const companyName = item.dataset.companyName.toLowerCase();
            item.style.display = companyName.includes(searchTerm) ? '' : 'none';
          });
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement des entreprises formatées', error);
    }
  }

  // Enregistrer le format d'email
  async function saveCompanyEmailFormat(companyName) {
    const emailFormat = document.querySelector(`.company-email-format[data-company-name="${companyName}"]`).value;
    const emailDomain = document.querySelector(`.company-email-domain[data-company-name="${companyName}"]`).value;

    if (!emailFormat) {
      alert('Veuillez sélectionner un format d\'email');
      return;
    }

    try {
      const response = await fetch('/api/companies/email-format', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          emailFormat,
          emailDomain
        })
      });

      const data = await response.json();

      if (data.success) {
        // Recharger les listes
        await loadCompaniesToFormat();
        await loadFormattedCompanies();
      } else {
        alert(data.message || 'Erreur lors de l\'enregistrement');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du format', error);
      alert('Erreur lors de la mise à jour du format');
    }
  }

  // Charger les données initiales
  await loadCompaniesToFormat();
  await loadFormattedCompanies();
}