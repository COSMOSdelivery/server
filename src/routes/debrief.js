const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const {
  verifyAdmin,
  verifyLivreur,
  verifyAdminOrServiceClient,
} = require("../middleware/authMiddleware");

const prisma = new PrismaClient();

// POST /api/debriefs - Create a new debrief
router.post('/', verifyAdminOrServiceClient, async (req, res, next) => {
  try {
    const { deliveryAgentId, zone, commandeIds, notes, priority, workingHours } = req.body;

    // Validate input
    if (!deliveryAgentId || typeof deliveryAgentId !== 'number') {
      return res.status(400).json({ error: 'deliveryAgentId must be a valid integer' });
    }
    if (!zone || typeof zone !== 'string' || zone.trim() === '') {
      return res.status(400).json({ error: 'zone is required and must be a non-empty string' });
    }
    if (!commandeIds || !Array.isArray(commandeIds) || commandeIds.length === 0) {
      return res.status(400).json({ error: 'commandeIds must be a non-empty array of strings' });
    }

    // Verify deliveryAgentId exists
    const livreur = await prisma.livreur.findUnique({
      where: { idLivreur: deliveryAgentId },
    });
    if (!livreur) {
      return res.status(400).json({ error: 'Invalid deliveryAgentId: Livreur not found' });
    }

    // Verify commandeIds exist
    const commandes = await prisma.commande.findMany({
      where: { code_a_barre: { in: commandeIds } },
    });
    if (commandes.length !== commandeIds.length) {
      return res.status(400).json({ error: 'One or more commandeIds are invalid' });
    }

    // Get createdById from authenticated user
    const createdById = req.user?.id;
    if (!createdById) {
      return res.status(401).json({ error: 'Authenticated user ID not found' });
    }

    // Verify createdById exists
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: createdById },
    });
    if (!utilisateur) {
      return res.status(400).json({ error: 'Invalid createdById: Utilisateur not found' });
    }

    const debrief = await prisma.debrief.create({
      data: {
        deliveryAgentId,
        zone,
        notes,
        priority,
        workingHours,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        ordersPlanned: commandeIds.length,
        createdById,
        commandes: {
          connect: commandeIds.map(id => ({ code_a_barre: id })),
        },
      },
    });

    res.status(201).json({ debrief });
  } catch (error) {
    console.error('Debrief Creation Error:', error);
    next(error);
  }
});

// GET /api/debriefs - Get all debriefs (paginated, filtered)
router.get("/", verifyAdminOrServiceClient, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      deliveryAgentId,
      zone,
      sortBy = "date",
      search,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (status) where.status = status;
    if (deliveryAgentId) where.deliveryAgentId = parseInt(deliveryAgentId);
    if (zone) where.zone = { contains: zone, mode: "insensitive" };
    if (search) {
      where.OR = [
        { livreur: { utilisateur: { nom: { contains: search, mode: "insensitive" } } } },
        { livreur: { utilisateur: { prenom: { contains: search, mode: "insensitive" } } } },
        { id: { equals: parseInt(search) || undefined } },
      ];
    }

    const [debriefs, total] = await Promise.all([
      prisma.debrief.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: {
          [sortBy === "agent" ? "livreur_utilisateur_nom" : sortBy]: sortBy === "rate" ? "desc" : "desc",
        },
        include: {
          livreur: { include: { utilisateur: true } },
          commandes: true,
          createdBy: true,
        },
      }),
      prisma.debrief.count({ where }),
    ]);

    return res.json({ debriefs, total });
  } catch (error) {
    console.error("Erreur lors de la récupération des débriefs:", error);
    return res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});

// PUT /api/debriefs/:id - Update a debrief
router.put("/:id", verifyAdminOrServiceClient, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      zone,
      ordersDelivered,
      ordersPlanned,
      incidents,
      fuelCost,
      kmTraveled,
      workingHours,
      notes,
      priority,
      commandeIds,
    } = req.body;

    // Verify debrief exists
    const debrief = await prisma.debrief.findUnique({
      where: { id: parseInt(id) },
    });
    if (!debrief) {
      return res.status(404).json({ msg: "Débrief non trouvé" });
    }

    // Validate commandeIds if provided
    if (commandeIds) {
      const commandes = await prisma.commande.findMany({
        where: {
          code_a_barre: { in: commandeIds },
          gouvernorat: { in: zone ? zone.split(", ") : debrief.zone.split(", ") },
        },
      });
      if (commandes.length !== commandeIds.length) {
        return res.status(400).json({ msg: "Certaines commandes sont invalides ou non dans la zone spécifiée" });
      }
    }

    // Calculate delivery rate
    const deliveryRate =
      ordersDelivered && ordersPlanned
        ? (parseInt(ordersDelivered) / parseInt(ordersPlanned)) * 100
        : debrief.deliveryRate;

    // Update debrief
    const updatedDebrief = await prisma.debrief.update({
      where: { id: parseInt(id) },
      data: {
        zone,
        ordersDelivered: ordersDelivered ? parseInt(ordersDelivered) : undefined,
        ordersPlanned: ordersPlanned ? parseInt(ordersPlanned) : undefined,
        deliveryRate,
        incidents: incidents ? parseInt(incidents) : undefined,
        fuelCost: fuelCost ? parseFloat(fuelCost) : undefined,
        kmTraveled: kmTraveled ? parseFloat(kmTraveled) : undefined,
        workingHours,
        notes,
        priority,
        commandes: commandeIds
          ? { set: commandeIds.map((id) => ({ code_a_barre: id })) }
          : undefined,
      },
      include: {
        livreur: { include: { utilisateur: true } },
        commandes: true,
        createdBy: true,
      },
    });

    // Create history entries for new commande assignments
    if (commandeIds) {
      await prisma.historiqueCommande.createMany({
        data: commandeIds.map((code_a_barre) => ({
          etat: "A_ENLEVER",
          commentaire: `Réassigné au débrief ${id}`,
          id_commande: code_a_barre,
          id_livreur: debrief.deliveryAgentId,
        })),
      });
    }

    return res.json({
      msg: "Débrief mis à jour avec succès",
      debrief: updatedDebrief,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du débrief:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ msg: "Débrief non trouvé" });
    }
    return res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});

router.get("/open-delivery-agents", verifyAdmin, async (req, res) => {
  try {
    // Validate database connection
    await prisma.$connect().catch(err => {
      throw new Error(`Database connection failed: ${err.message}`);
    });

    const openDebriefs = await prisma.debrief.findMany({
      where: {
        status: "OPEN",
      },
      select: {
        deliveryAgentId: true,
      },
    });

    const agentIdsWithOpenDebriefs = [...new Set(openDebriefs.map(debrief => debrief.deliveryAgentId).filter(id => id !== null))];
    return res.json({ agentIds: agentIdsWithOpenDebriefs });
  } catch (error) {
    console.error("Erreur lors de la récupération des livreurs avec débriefs ouverts:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      meta: error.meta,
    });
    return res.status(500).json({ msg: "Erreur interne du serveur", error: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

// GET /api/debriefs/:id - Get a debrief by ID
// This route MUST come AFTER the specific routes above
router.get("/:id", verifyAdminOrServiceClient, async (req, res) => {
  try {
    // Parse and validate the ID parameter
    const debriefId = parseInt(req.params.id, 10);
    
    if (isNaN(debriefId)) {
      return res.status(400).json({ msg: "Invalid debrief ID" });
    }

    // Query the database with the parsed ID
    const debrief = await prisma.debrief.findUnique({
      where: {
        id: debriefId,
      },
      include: {
        livreur: {
          include: {
            utilisateur: true,
          },
        },
        commandes: true,
        createdBy: true,
      },
    });

    if (!debrief) {
      return res.status(404).json({ msg: "Debrief not found" });
    }

    return res.json({ debrief });
  } catch (error) {
    console.error("Erreur lors de la récupération du débrief:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    return res.status(500).json({ 
      msg: "Erreur interne du serveur", 
      error: error.message 
    });
  }
});
// POST /api/debriefs/:id/validate - Validate a debrief (set status to CLOSED)
router.post("/:id/validate", verifyAdminOrServiceClient, async (req, res) => {
  try {
    const debrief = await prisma.debrief.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!debrief) {
      return res.status(404).json({ msg: "Débrief non trouvé" });
    }

    if (debrief.status === "CLOSED") {
      return res.status(400).json({ msg: "Le débrief est déjà validé" });
    }

    const updatedDebrief = await prisma.debrief.update({
      where: { id: parseInt(req.params.id) },
      data: { status: "CLOSED" },
      include: {
        livreur: { include: { utilisateur: true } },
        commandes: true,
        createdBy: true,
      },
    });

    return res.json({
      msg: "Débrief validé avec succès",
      debrief: updatedDebrief,
    });
  } catch (error) {
    console.error("Erreur lors de la validation du débrief:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ msg: "Débrief non trouvé" });
    }
    return res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});

// GET /api/debriefs/livreur/:id_livreur - Get debriefs for a specific livreur
router.get("/livreur/:id_livreur", verifyLivreur, async (req, res) => {
  try {
    const id_livreur = parseInt(req.params.id_livreur);
    if (id_livreur !== req.user.id) {
      return res.status(403).json({ msg: "Non autorisé à voir les débriefs de ce livreur" });
    }

    const debriefs = await prisma.debrief.findMany({
      where: { deliveryAgentId: id_livreur },
      include: {
        livreur: { include: { utilisateur: true } },
        commandes: true,
        createdBy: true,
      },
    });

    return res.json(debriefs);
  } catch (error) {
    console.error("Erreur lors de la récupération des débriefs du livreur:", error);
    return res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});

module.exports = router;