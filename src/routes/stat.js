const express = require('express');
const router = express.Router();
const { PrismaClient, EtatCommande,Role} = require('@prisma/client');
const { verifyClient, verifyLogin, verifyAdmin,verifyAdminOrServiceClient, verifyLivreur} = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken"); // Importer le middleware

const prisma = new PrismaClient();

// Route pour obtenir le nombre de commandes pour tous les états d'un client spécifique
router.get('/client/command', async (req, res) => {
    try {
      // Récupérer tous les états possibles de l'enum EtatCommande
      const etats = Object.values(EtatCommande); // Convertir l'enum en tableau
  
      // Obtenir le nombre de commandes pour chaque état et le sum de prix
      const results = {};
      let totalOrders = 0; // Variable pour stocker le total des commandes
      let totalRevenue = 0; // Variable pour stocker le revenu total
  
      for (const etat of etats) {
        const count = await prisma.commande.count({
          where: {
            etat: etat,
          },
        });
        const sumPrix = await prisma.commande.aggregate({
          where: {
            etat: etat,
          },
          _sum: {
            prix: true, // Calculer la somme des prix pour cet état
          },
        });
  
        results[etat] = {
          count: count, // Nombre de commandes
          totalPrix: sumPrix._sum.prix || 0, // Cumul des prix (0 si aucune commande)
        };
  
        // Ajouter au total des commandes et au revenu total
        totalOrders += count;
        totalRevenue += sumPrix._sum.prix || 0;
      }
  
      // Retourner les résultats avec totalOrders et totalRevenue
      return res.status(200).json({ results, totalOrders, totalRevenue });
    } catch (error) {
      console.error('Erreur : ', error);
      return res.status(500).json({ msg: 'Erreur interne du serveur' });
    }
});
// routes/stat.js
router.get('/statistics/:id_livreur', async (req, res) => {
  const livreurId = parseInt(req.params.id_livreur);

  try {
    const totalOrders = await prisma.commande.count({
      where: { id_livreur: livreurId },
    });

    const deliveredOrders = await prisma.commande.count({
      where: { id_livreur: livreurId, etat: 'LIVRES' },
    });

    const pendingOrders = await prisma.commande.count({
      where: { id_livreur: livreurId, etat: 'EN_ATTENTE' },
    });

    const inProgressOrders = await prisma.commande.count({
      where: { id_livreur: livreurId, etat: 'EN_COURS' },
    });

    const delayedOrders = await prisma.commande.count({
      where: {
        id_livreur: livreurId,
        etat: 'EN_COURS',
        dateAjout: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Commandes de plus de 24 heures
      },
    });

    const returnedOrders = await prisma.commande.count({
      where: { id_livreur: livreurId, etat: 'RETOUR_DEFINITIF' },
    });

    const ordersToVerify = await prisma.commande.count({
      where: { id_livreur: livreurId, etat: 'A_VERIFIER' },
    });

    const exchangeOrders = await prisma.commande.count({
      where: { id_livreur: livreurId, etat: 'ECHANGE' },
    });

    const deliveriesThisWeek = await prisma.commande.count({
      where: {
        id_livreur: livreurId,
        etat: 'LIVRES',
        derniereMiseAJour: {
          gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000), // Commandes livrées cette semaine
        },
      },
    });

    // Calculer les revenus du livreur
    const deliveredOrdersData = await prisma.commande.findMany({
      where: { id_livreur: livreurId, etat: 'LIVRES' },
      select: { prix: true },
    });

    const totalRevenue = deliveredOrdersData.reduce((acc, order) => acc + order.prix, 0);
    const livreurRevenue = totalRevenue * 0.1; // Supposons que le livreur gagne 10% du prix de la commande

    res.json({
      totalOrders,
      deliveredOrders,
      pendingOrders,
      inProgressOrders,
      delayedOrders,
      returnedOrders,
      ordersToVerify,
      exchangeOrders,
      deliveriesThisWeek,
      livreurRevenue, // Ajouter les revenus du livreur
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get("/daily-orders", async (req, res) => {
  try {
    // Query to group orders by day and count them
    const dailyOrders = await prisma.$queryRaw`
      SELECT 
        DATE("dateAjout") AS date, 
        COUNT(*) AS total_orders
      FROM "Commande"
      GROUP BY DATE("dateAjout")
      ORDER BY DATE("dateAjout") ASC;
    `;

    // Format the response
    const formattedData = dailyOrders.map((row) => ({
      date: row.date.toISOString().split("T")[0], // Format date as YYYY-MM-DD
      total_orders: Number(row.total_orders), // Convert BigInt to Number
    }));

    res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error fetching daily orders:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route pour obtenir le nombre d'utilisateurs par rôle
router.get('/usersNumbers',verifyAdminOrServiceClient, async (req, res) => {
    try {
        // Récupérer tous les rôles possibles de l'enum Role
        const roles = Object.values(Role); // Convertir l'enum en tableau

        // Obtenir le nombre d'utilisateurs pour chaque rôle
        const countsByRole = {};

        for (const role of roles) {
            const count = await prisma.utilisateur.count({
                where: {
                    role: role,
                },
            });
            countsByRole[role] = count;
        }

        // Retourner les résultats
        return res.status(200).json({ countsByRole });
    } catch (error) {
        console.error("Erreur : ", error);
        return res.status(500).json({ msg: "Erreur interne du serveur" });
    }
});

module.exports = router;