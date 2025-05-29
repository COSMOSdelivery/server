const express = require("express");
const router = express.Router();
const { PrismaClient, EtatCommande, Role } = require("@prisma/client");
const {
  verifyClient,
  verifyLogin,
  verifyAdmin,
  verifyAdminOrServiceClient,
  verifyLivreur,
} = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");

const prisma = new PrismaClient();

// Route pour obtenir le nombre de commandes pour tous les états d'un client spécifique
router.get("/client/command", async (req, res) => {
  try {
    const etats = Object.values(EtatCommande);
    const results = {};
    let totalOrders = 0;
    let totalRevenue = 0;

    for (const etat of etats) {
      const count = await prisma.commande.count({
        where: { etat: etat },
      });
      const sumPrix = await prisma.commande.aggregate({
        where: { etat: etat },
        _sum: { prix: true },
      });

      results[etat] = {
        count: count,
        totalPrix: sumPrix._sum.prix || 0,
      };

      totalOrders += count;
      totalRevenue += sumPrix._sum.prix || 0;
    }

    return res.status(200).json({ results, totalOrders, totalRevenue });
  } catch (error) {
    console.error("Erreur : ", error);
    return res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});

// Route pour les statistiques d'un livreur spécifique
router.get("/statistics/:id_livreur", async (req, res) => {
  const livreurId = parseInt(req.params.id_livreur);

  try {
    const totalOrders = await prisma.commande.count({
      where: { id_livreur: livreurId },
    });

    const deliveredOrders = await prisma.commande.count({
      where: { id_livreur: livreurId, etat: "LIVRES" },
    });

    const pendingOrders = await prisma.commande.count({
      where: { id_livreur: livreurId, etat: "EN_ATTENTE" },
    });

    const inProgressOrders = await prisma.commande.count({
      where: { id_livreur: livreurId, etat: "EN_COURS" },
    });

    const delayedOrders = await prisma.commande.count({
      where: {
        id_livreur: livreurId,
        etat: "EN_COURS",
        dateAjout: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    const returnedOrders = await prisma.commande.count({
      where: { id_livreur: livreurId, etat: "RETOUR_DEFINITIF" },
    });

    const ordersToVerify = await prisma.commande.count({
      where: { id_livreur: livreurId, etat: "A_VERIFIER" },
    });

    const exchangeOrders = await prisma.commande.count({
      where: { id_livreur: livreurId, etat: "ECHANGE" },
    });

    const deliveriesThisWeek = await prisma.commande.count({
      where: {
        id_livreur: livreurId,
        etat: "LIVRES",
        derniereMiseAJour: {
          gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const deliveredOrdersData = await prisma.commande.findMany({
      where: { id_livreur: livreurId, etat: "LIVRES" },
      select: { prix: true },
    });

    const totalRevenue = deliveredOrdersData.reduce(
      (acc, order) => acc + order.prix,
      0
    );
    const livreurRevenue = totalRevenue * 0.1;

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
      livreurRevenue,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route pour les statistiques globales (admin)
router.get("/admin/global-statistics", verifyAdmin, async (req, res) => {
  try {
    const totalOrders = await prisma.commande.count();

    const deliveredOrders = await prisma.commande.count({
      where: { etat: "LIVRES" },
    });

    const pendingOrders = await prisma.commande.count({
      where: { etat: "EN_ATTENTE" },
    });

    const inProgressOrders = await prisma.commande.count({
      where: { etat: "EN_COURS" },
    });

    const delayedOrders = await prisma.commande.count({
      where: {
        etat: "EN_COURS",
        dateAjout: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    const returnedOrders = await prisma.commande.count({
      where: { etat: "RETOUR_DEFINITIF" },
    });

    const ordersToVerify = await prisma.commande.count({
      where: { etat: "A_VERIFIER" },
    });

    const exchangeOrders = await prisma.commande.count({
      where: { etat: "ECHANGE" },
    });

    const deliveriesThisWeek = await prisma.commande.count({
      where: {
        etat: "LIVRES",
        derniereMiseAJour: {
          gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const deliveredOrdersData = await prisma.commande.findMany({
      where: { etat: "LIVRES" },
      select: { prix: true },
    });

    const totalRevenue = deliveredOrdersData.reduce(
      (acc, order) => acc + (order.prix || 0),
      0
    );
    const totalLivreurRevenue = totalRevenue * 0.1;

    const livreurStats = await prisma.commande.groupBy({
      by: ["id_livreur"],
      _count: { _all: true },
      _sum: { prix: true },
      where: { id_livreur: { not: null } },
    });

    const detailedLivreurStats = await Promise.all(
      livreurStats.map(async (stat) => {
        try {
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
              where: { id_livreur: stat.id_livreur, etat: "LIVRES" },
            }),
            prisma.commande.count({
              where: { id_livreur: stat.id_livreur, etat: "EN_ATTENTE" },
            }),
            prisma.commande.count({
              where: { id_livreur: stat.id_livreur, etat: "EN_COURS" },
            }),
            prisma.commande.count({
              where: {
                id_livreur: stat.id_livreur,
                etat: "EN_COURS",
                dateAjout: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              },
            }),
            prisma.commande.count({
              where: { id_livreur: stat.id_livreur, etat: "RETOUR_DEFINITIF" },
            }),
            prisma.commande.count({
              where: { id_livreur: stat.id_livreur, etat: "A_VERIFIER" },
            }),
            prisma.commande.count({
              where: { id_livreur: stat.id_livreur, etat: "ECHANGE" },
            }),
            prisma.commande.count({
              where: {
                id_livreur: stat.id_livreur,
                etat: "LIVRES",
                derniereMiseAJour: {
                  gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000),
                },
              },
            }),
          ]);

          const livreurDeliveredOrders = await prisma.commande.findMany({
            where: { id_livreur: stat.id_livreur, etat: "LIVRES" },
            select: { prix: true },
          });

          const livreurTotalRevenue = livreurDeliveredOrders.reduce(
            (acc, order) => acc + (order.prix || 0),
            0
          );
          const livreurRevenue = livreurTotalRevenue * 0.1;

         const livreurInfo = await prisma.livreur.findUnique({
  where: { idLivreur: stat.id_livreur },
  select: {
    idLivreur: true,
    utilisateur: {
      select: {
        nom: true,
        prenom: true,
        telephone1: true,
      },
    },
  },
});

          return {
            id_livreur: stat.id_livreur,
            livreurInfo: livreurInfo?.utilisateur || {
              nom: "Unknown",
              prenom: "",
              telephone1: "",
            },
            totalOrders: stat._count._all,
            deliveredOrders: deliveredCount,
            pendingOrders: pendingCount,
            inProgressOrders: inProgressCount,
            delayedOrders: delayedCount,
            returnedOrders: returnedCount,
            ordersToVerify: toVerifyCount,
            exchangeOrders: exchangeCount,
            deliveriesThisWeek: weeklyDeliveries,
            livreurRevenue,
            deliveryRate:
              stat._count._all > 0
                ? (deliveredCount / stat._count._all) * 100
                : 0,
          };
        } catch (livreurError) {
          console.error(
            `Error processing livreur ${stat.id_livreur}:`,
            livreurError
          );
          return null;
        }
      })
    );

    const filteredLivreurStats = detailedLivreurStats.filter(
      (stat) => stat !== null
    );

    const activeLivreurs = filteredLivreurStats.length;

    const topPerformers = filteredLivreurStats
      .sort((a, b) => b.deliveredOrders - a.deliveredOrders)
      .slice(0, 5);

    res.json({
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
        globalDeliveryRate:
          totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0,
      },
      livreurStats: filteredLivreurStats,
      topPerformers,
    });
  } catch (error) {
    console.error("Error fetching global statistics:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      stack: error.stack,
    });
  }
});

// Route pour les commandes quotidiennes
router.get("/daily-orders", async (req, res) => {
  try {
    const dailyOrders = await prisma.$queryRaw`
      SELECT 
        DATE("dateAjout") AS date, 
        COUNT(*) AS total_orders,
        SUM(prix) AS total_prix
      FROM "Commande"
      GROUP BY DATE("dateAjout")
      ORDER BY DATE("dateAjout") ASC;
    `;

    const formattedData = dailyOrders.map((row) => ({
      date: row.date.toISOString().split("T")[0],
      total_orders: Number(row.total_orders),
      totalPrix: Number(row.total_prix) || 0,
    }));

    res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error fetching daily orders:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route pour les commandes mensuelles
router.get("/monthly-orders", async (req, res) => {
  try {
    const monthlyOrders = await prisma.$queryRaw`
      SELECT 
        TO_CHAR("dateAjout", 'YYYY-MM') AS month, 
        COUNT(*) AS total_orders
      FROM "Commande"
      GROUP BY TO_CHAR("dateAjout", 'YYYY-MM')
      ORDER BY TO_CHAR("dateAjout", 'YYYY-MM') ASC;
    `;

    const formattedData = monthlyOrders.map((row) => ({
      month: row.month,
      total_orders: Number(row.total_orders),
    }));

    res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error fetching monthly orders:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route pour obtenir le nombre d'utilisateurs par rôle
router.get("/usersNumbers", verifyAdminOrServiceClient, async (req, res) => {
  try {
    const roles = Object.values(Role);
    const countsByRole = {};

    for (const role of roles) {
      const count = await prisma.utilisateur.count({
        where: { role: role },
      });
      countsByRole[role] = count;
    }

    const totalUsers = Object.values(countsByRole).reduce(
      (acc, count) => acc + count,
      0
    );

    return res.status(200).json({ countsByRole, totalUsers });
  } catch (error) {
    console.error("Erreur : ", error);
    return res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});

module.exports = router;