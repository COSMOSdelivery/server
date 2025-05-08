const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configuration des paramètres du compte par défaut
const DEFAULT_USER_CONFIG = {
  email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
  password: process.env.DEFAULT_ADMIN_PASSWORD || 'adminPassword123',
  nom: process.env.DEFAULT_ADMIN_NOM || 'Admin',
  prenom: process.env.DEFAULT_ADMIN_PRENOM || 'User',
  telephone1: process.env.DEFAULT_ADMIN_TEL1 || '00000000',
  telephone2: process.env.DEFAULT_ADMIN_TEL2 || null,
  cin: process.env.DEFAULT_ADMIN_CIN || '00000000',
  codeTVA: process.env.DEFAULT_ADMIN_TVA || 'TVA-DEFAULT',
  role: process.env.DEFAULT_ADMIN_ROLE || 'ADMIN',
  saltRounds: 10
};

async function DefaultUser() {
  console.log('🔄 Vérification de l\'utilisateur par défaut...');

  try {
    // Vérifier si l'utilisateur par défaut existe déjà
    const existingUser = await prisma.utilisateur.findUnique({
      where: { email: DEFAULT_USER_CONFIG.email }
    });

    if (existingUser) {
      console.log('✅ Utilisateur par défaut déjà présent:', existingUser.email);
      return existingUser;
    }

    // Bloquer la création en production si le mot de passe par défaut est utilisé
    if (process.env.NODE_ENV === 'production' && DEFAULT_USER_CONFIG.password === 'adminPassword123') {
      throw new Error('⚠️ Mot de passe par défaut détecté en production. Veuillez le modifier.');
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(
      DEFAULT_USER_CONFIG.password, 
      DEFAULT_USER_CONFIG.saltRounds
    );

    // Créer l'utilisateur
    const defaultUser = await prisma.utilisateur.create({
        data: {
          email: DEFAULT_USER_CONFIG.email,
          password: hashedPassword,
          nom: DEFAULT_USER_CONFIG.nom,
          prenom: DEFAULT_USER_CONFIG.prenom,
          telephone1: DEFAULT_USER_CONFIG.telephone1,
          telephone2: DEFAULT_USER_CONFIG.telephone2,
          cin: DEFAULT_USER_CONFIG.cin,
          codeTVA: DEFAULT_USER_CONFIG.codeTVA,
          role: DEFAULT_USER_CONFIG.role,
          dateInscription: new Date(),
          derniereMiseAJour: new Date(),
          resetPasswordOtp: null,
          resetPasswordOtpExpiry: null,
          admin: { // Créer un administrateur lié à cet utilisateur
            create: {} 
          }
        }
      });
      

    console.log('✅ Utilisateur par défaut créé avec succès!');
    console.log('📧 Email:', defaultUser.email);
    console.log('👤 Rôle:', defaultUser.role);
    
    return defaultUser;
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur par défaut:', error);

    if (error.code === 'P2002') {
      console.error('  → Erreur de contrainte unique. Vérifiez si le champ email ou cin est unique.');
    } else if (error.code === 'P2003') {
      console.error('  → Erreur de contrainte de clé étrangère. Vérifiez les relations dans votre schéma.');
    } else if (error.code === 'P2019') {
      console.error('  → La table ou la colonne n\'existe pas. Exécutez `prisma migrate deploy`.');
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  DefaultUser()
    .then(() => console.log('🏁 Processus de seeding terminé.'))
    .catch(() => {
      console.error('🛑 Le processus de seeding a échoué.');
      process.exit(1);
    });
}

module.exports = DefaultUser;
