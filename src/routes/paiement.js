const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ✅ Créer un nouveau paiement
router.post('/', async (req, res) => {
  const { id_client, id_commande, montant, mode, statut } = req.body;

  // 🛡️ Validation de base
  if (!id_client || !montant || !mode || !statut) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }

  try {
    // ✅ Créer le paiement
    const paiement = await prisma.paiement.create({
      data: {
        id_client: Number(id_client),
        id_commande: id_commande ? Number(id_commande) : null,
        montant: Number(montant),
        mode,
        statut,
      },
    });

    // 🌀 Mise à jour automatique de la commande si PAYE
    if (statut === 'PAYE' && id_commande) {
      await prisma.commande.update({
        where: { code_a_barre: Number(id_commande) },
        data: { etat: 'LIVRES_PAYE' }, // ou autre champ spécifique selon ton modèle
      });
    }

    res.status(201).json(paiement);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la création du paiement' });
  }
});

// ✅ Lister les paiements d'une commande
router.get('/commande/:id_commande', async (req, res) => {
  const { id_commande } = req.params;

  try {
    const paiements = await prisma.paiement.findMany({
      where: { id_commande: Number(id_commande) },
      orderBy: { datePaiement: 'desc' },
    });

    res.json(paiements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération des paiements' });
  }
});

// ✅ Lister les paiements d’un client
router.get('/client/:id_client', async (req, res) => {
  const { id_client } = req.params;

  try {
    const paiements = await prisma.paiement.findMany({
      where: { id_client: Number(id_client) },
      orderBy: { datePaiement: 'desc' },
    });

    res.json(paiements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération des paiements client' });
  }
});

module.exports = router;
