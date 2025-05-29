const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const prisma = new PrismaClient();

// Constants aligned with schema enums
const PAYMENT_STATUSES = {
  NON_PAYE: 'NON_PAYE',
  PAYE: 'PAYE',
  EN_ATTENTE: 'EN_ATTENTE',
  REFUSE: 'REFUSE',
};

const ORDER_STATUSES = {
  PAYE: 'PAYE',
  LIVRES_PAYE: 'LIVRES_PAYE',
};

// Validation schema for creating a payment
const paymentSchema = Joi.object({
  id_client: Joi.number().integer().positive().required(),
  id_commande: Joi.string().optional(),
  montant: Joi.number().positive().required(),
  mode: Joi.string().valid('ESPECE', 'CHEQUE', 'ESPECE_ou_CHEQUE').required(),
  statut: Joi.string().valid('NON_PAYE', 'PAYE', 'EN_ATTENTE', 'REFUSE').required(),
});

// Validation schema for confirming a payment
const confirmPaymentSchema = Joi.object({
  id_paiement: Joi.number().integer().positive().required(),
});

// Create a new payment
router.post('/', async (req, res) => {
  const { error } = paymentSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }

  const { id_client, id_commande, montant, mode, statut } = req.body;

  try {
    // Validate client
    const client = await prisma.client.findUnique({ where: { idClient: Number(id_client) } });
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client non trouvé' });
    }

    // Validate order if provided
    if (id_commande) {
      const commande = await prisma.commande.findUnique({ where: { code_a_barre: id_commande } });
      if (!commande) {
        return res.status(404).json({ success: false, error: 'Commande non trouvée' });
      }
    }

    const paiement = await prisma.$transaction(async (tx) => {
      const newPaiement = await tx.paiement.create({
        data: {
          id_client: Number(id_client),
          id_commande,
          montant: Number(montant),
          mode,
          statut,
        },
      });

      if (statut === PAYMENT_STATUSES.PAYE && id_commande) {
        await tx.commande.update({
          where: { code_a_barre: id_commande },
          data: { etat: ORDER_STATUSES.PAYE, statutPaiement: PAYMENT_STATUSES.PAYE },
        });
      }

      return newPaiement;
    });

    res.status(201).json({ success: true, data: paiement, message: 'Paiement créé avec succès' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création du paiement' });
  }
});

// List payments for a client
router.get('/client/:id_client', async (req, res) => {
  const { id_client } = req.params;

  if (isNaN(id_client)) {
    return res.status(400).json({ success: false, error: 'ID client invalide' });
  }

  try {
    const paiements = await prisma.paiement.findMany({
      where: { id_client: Number(id_client) },
      orderBy: { datePaiement: 'desc' },
      include: { commande: true, client: { select: { nomShop: true } } },
    });

    res.json({ success: true, data: paiements, message: 'Paiements récupérés avec succès' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des paiements client' });
  }
});

// List orders with etat: 'PAYE' for a client
router.get('/client/:id_client/orders', async (req, res) => {
  const { id_client } = req.params;

  if (isNaN(id_client)) {
    return res.status(400).json({ success: false, error: 'ID client invalide' });
  }

  try {
    const orders = await prisma.commande.findMany({
      where: {
        id_client: Number(id_client),
        etat: ORDER_STATUSES.PAYE,
      },
      include: {
        paiements: true, // Include related payments
        client: { select: { nomShop: true } },
      },
      orderBy: { dateAjout: 'desc' },
    });

    res.json({
      success: true,
      data: orders,
      message: 'Commandes récupérées avec succès',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des commandes' });
  }
});

// Confirm a payment
router.post('/confirm', async (req, res) => {
  const { error } = confirmPaymentSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }

  const { id_paiement } = req.body;

  try {
    const paiement = await prisma.$transaction(async (tx) => {
      const existingPaiement = await tx.paiement.findUnique({
        where: { id: Number(id_paiement) },
      });

      if (!existingPaiement) {
        throw new Error('Paiement non trouvé');
      }

      if (existingPaiement.statut !== PAYMENT_STATUSES.EN_ATTENTE) {
        throw new Error('Le paiement ne peut pas être confirmé (doit être EN_ATTENTE)');
      }

      const updatedPaiement = await tx.paiement.update({
        where: { id: Number(id_paiement) },
        data: { statut: PAYMENT_STATUSES.PAYE },
      });

      if (existingPaiement.id_commande) {
        await tx.commande.update({
          where: { code_a_barre: existingPaiement.id_commande },
          data: { etat: ORDER_STATUSES.LIVRES_PAYE, statutPaiement: PAYMENT_STATUSES.PAYE },
        });
      }

      return updatedPaiement;
    });

    res.json({
      success: true,
      data: paiement,
      message: 'Paiement confirmé avec succès',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;