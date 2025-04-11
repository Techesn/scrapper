const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  emailFormat: {
    type: String,
    enum: [
      'p.nom', 
      'prenom.nom', 
      'nom', 
      'nom.prenom', 
      'prenom', 
      'p.n'
    ],
    required: false
  },
  emailDomain: {
    type: String,
    trim: true,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  indexes: [
    { name: 1 }
  ]
});

// Méthode statique pour trouver ou créer une entreprise
companySchema.statics.findOrCreate = async function(name) {
  let company = await this.findOne({ name });
  
  if (!company) {
    const cleanedName = name.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');
    
    company = new this({
      name,
      emailDomain: `${cleanedName}.com`
    });
    await company.save();
  }
  
  return company;
};

// Méthode pour générer un email
companySchema.methods.generateEmail = function(firstName, lastName) {
  if (!this.emailFormat || !this.emailDomain) return null;

  const cleanFirstName = this.cleanName(firstName);
  const cleanLastName = this.cleanName(lastName);
  const firstInitial = cleanFirstName.charAt(0);
  const lastInitial = cleanLastName.charAt(0);

  let generatedEmail;
  switch (this.emailFormat) {
    case 'p.nom':
      generatedEmail = `${firstInitial}.${cleanLastName}`;
      break;
    case 'prenom.nom':
      generatedEmail = `${cleanFirstName}.${cleanLastName}`;
      break;
    case 'nom':
      generatedEmail = cleanLastName;
      break;
    case 'nom.prenom':
      generatedEmail = `${cleanLastName}.${cleanFirstName}`;
      break;
    case 'prenom':
      generatedEmail = cleanFirstName;
      break;
    case 'p.n':
      generatedEmail = `${firstInitial}.${lastInitial}`;
      break;
    default:
      return null;
  }

  return `${generatedEmail}@${this.emailDomain}`.toLowerCase();
};

// Méthode utilitaire pour nettoyer les noms
companySchema.methods.cleanName = function(name) {
  return name
    .normalize('NFD')  // Décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '')  // Supprime les accents
    .replace(/\s+/g, '-')  // Remplace les espaces par des tirets
    .toLowerCase();
};

const Company = mongoose.model('Company', companySchema);

module.exports = Company;