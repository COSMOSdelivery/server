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

router.get('/admin/global-statistics', async (req, res) => {
  try {
    // Statistiques globales pour tous les livreurs
    const totalOrders = await prisma.commande.count();

    const deliveredOrders = await prisma.commande.count({
      where: { etat: 'LIVRES' },
    });

    const pendingOrders = await prisma.commande.count({
      where: { etat: 'EN_ATTENTE' },
    });

    const inProgressOrders = await prisma.commande.count({
      where: { etat: 'EN_COURS' },
    });

    const delayedOrders = await prisma.commande.count({
      where: {
        etat: 'EN_COURS',
        dateAjout: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Commandes de plus de 24 heures
      },
    });

    const returnedOrders = await prisma.commande.count({
      where: { etat: 'RETOUR_DEFINITIF' },
    });

    const ordersToVerify = await prisma.commande.count({
      where: { etat: 'A_VERIFIER' },
    });

    const exchangeOrders = await prisma.commande.count({
      where: { etat: 'ECHANGE' },
    });

    const deliveriesThisWeek = await prisma.commande.count({
      where: {
        etat: 'LIVRES',
        derniereMiseAJour: {
          gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000), // Commandes livrées cette semaine
        },
      },
    });

    // Calculer les revenus totaux
    const deliveredOrdersData = await prisma.commande.findMany({
      where: { etat: 'LIVRES' },
      select: { prix: true },
    });

    const totalRevenue = deliveredOrdersData.reduce((acc, order) => acc + order.prix, 0);
    const totalLivreurRevenue = totalRevenue * 0.1; // 10% pour tous les livreurs

    // Statistiques par livreur
    const livreurStats = await prisma.commande.groupBy({
      by: ['id_livreur'],
      _count: {
        id: true,
      },
      _sum: {
        prix: true,
      },
      where: {
        id_livreur: { not: null }, // Exclure les commandes sans livreur assigné
      },
    });

    // Enrichir les données des livreurs
    const detailedLivreurStats = await Promise.all(
      livreurStats.map(async (stat) => {
        const [
          deliveredCount,
          pendingCount,
          inProgressCount,
          delayedCount,
          returnedCount,
          toVerifyCount,
          exchangeCount,
          weeklyDeliveries,
        ] = await Promise.all([
          prisma.commande.count({
            where: { id_livreur: stat.id_livreur, etat: 'LIVRES' },
          }),
          prisma.commande.count({
            where: { id_livreur: stat.id_livreur, etat: 'EN_ATTENTE' },
          }),
          prisma.commande.count({
            where: { id_livreur: stat.id_livreur, etat: 'EN_COURS' },
          }),
          prisma.commande.count({
            where: {
              id_livreur: stat.id_livreur,
              etat: 'EN_COURS',
              dateAjout: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
          }),
          prisma.commande.count({
            where: { id_livreur: stat.id_livreur, etat: 'RETOUR_DEFINITIF' },
          }),
          prisma.commande.count({
            where: { id_livreur: stat.id_livreur, etat: 'A_VERIFIER' },
          }),
          prisma.commande.count({
            where: { id_livreur: stat.id_livreur, etat: 'ECHANGE' },
          }),
          prisma.commande.count({
            where: {
              id_livreur: stat.id_livreur,
              etat: 'LIVRES',
              derniereMiseAJour: {
                gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          }),
        ]);

        // Calculer les revenus du livreur
        const livreurDeliveredOrders = await prisma.commande.findMany({
          where: { id_livreur: stat.id_livreur, etat: 'LIVRES' },
          select: { prix: true },
        });

        const livreurTotalRevenue = livreurDeliveredOrders.reduce(
          (acc, order) => acc + order.prix,
          0
        );
        const livreurRevenue = livreurTotalRevenue * 0.1;

        // Optionnel : récupérer les infos du livreur
        const livreurInfo = await prisma.livreur.findUnique({
          where: { id: stat.id_livreur },
          select: { nom: true, prenom: true, telephone: true },
        });

        return {
          id_livreur: stat.id_livreur,
          livreurInfo,
          totalOrders: stat._count.id,
          deliveredOrders: deliveredCount,
          pendingOrders: pendingCount,
          inProgressOrders: inProgressCount,
          delayedOrders: delayedCount,
          returnedOrders: returnedCount,
          ordersToVerify: toVerifyCount,
          exchangeOrders: exchangeCount,
          deliveriesThisWeek: weeklyDeliveries,
          livreurRevenue,
          deliveryRate: stat._count.id > 0 ? (deliveredCount / stat._count.id) * 100 : 0,
        };
      })
    );

    // Nombre total de livreurs actifs
    const activeLivreurs = livreurStats.length;

    // Top performers (livreurs avec le plus de livraisons)
    const topPerformers = detailedLivreurStats
      .sort((a, b) => b.deliveredOrders - a.deliveredOrders)
      .slice(0, 5);

    res.json({
      // Statistiques globales
      global: {
        totalOrders,
        deliveredOrders,
        pendingOrders,
        inProgressOrders,
        delayedOrders,
        returnedOrders,
        ordersToVerify,
        exchangeOrders,
        deliveriesThisWeek,
        totalRevenue,
        totalLivreurRevenue,
        activeLivreurs,
        globalDeliveryRate: totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0,
      },
      // Statistiques détaillées par livreur
      livreurStats: detailedLivreurStats,
      // Top performers
      topPerformers,
    });
  } catch (error) {
    console.error('Error fetching global statistics:', error);
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

router.get("/monthly-orders", async (req, res) => {
  try {
    // Query to group orders by month and count them
    const monthlyOrders = await prisma.$queryRaw`
      SELECT 
        TO_CHAR("dateAjout", 'YYYY-MM') AS month, 
        COUNT(*) AS total_orders
      FROM "Commande"
      GROUP BY TO_CHAR("dateAjout", 'YYYY-MM')
      ORDER BY TO_CHAR("dateAjout", 'YYYY-MM') ASC;
    `;

    // Format the response
    const formattedData = monthlyOrders.map((row) => ({
      month: row.month, // Format: YYYY-MM
      total_orders: Number(row.total_orders), // Convert BigInt to Number
    }));

    res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error fetching monthly orders:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route pour obtenir le nombre d'utilisateurs par rôle
router.get('/usersNumbers', verifyAdminOrServiceClient, async (req, res) => {
    try {
        const roles = Object.values(Role);
        const countsByRole = {};

        for (const role of roles) {
            const count = await prisma.utilisateur.count({
                where: { role: role },
            });
            countsByRole[role] = count;
        }

        // Calculate total users
        const totalUsers = Object.values(countsByRole).reduce((acc, count) => acc + count, 0);

        return res.status(200).json({ countsByRole, totalUsers });
    } catch (error) {
        console.error("Erreur : ", error);
        return res.status(500).json({ msg: "Erreur interne du serveur" });
    }
});

module.exports = router;