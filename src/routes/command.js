const {
  verifyAdmin,
  verifyClient,
  verifyLivreur,
  verifyClientOrServiceClientOrAdmin,
  verifyServiceclient,
  verifyAdminOrServiceClient,
} = require("../middleware/authMiddleware");
const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { generateCodeBarre } = require("../utils/codebarre");
const path = require("path");
const fs = require("fs");
const bwipjs = require("bwip-js");

const prisma = new PrismaClient();

const EtatCommande = {
  EN_ATTENTE: "EN_ATTENTE",
  A_ENLEVER: "A_ENLEVER",
  ENLEVE: "ENLEVE",
  AU_DEPOT: "AU_DEPOT",
  RETOUR_DEPOT: "RETOUR_DEPOT",
  EN_COURS: "EN_COURS",
  A_VERIFIER: "A_VERIFIER",
  LIVRES: "LIVRES",
  LIVRES_PAYES: "LIVRES_PAYES",
  ECHANGE: "ECHANGE",
  RETOUR_DEFINITIF: "RETOUR_DEFINITIF",
  RETOUR_INTER_AGENCE: "RETOUR_INTER_AGENCE",
  RETOUR_EXPEDITEURS: "RETOUR_EXPEDITEURS",
  RETOUR_RECU_PAYE: "RETOUR_RECU_PAYE",
  ABANDONNEE: "ABANDONNEE", // Use ABANDONNEE instead of Supprimee
};

// POST /command
router.post("/", verifyClientOrServiceClientOrAdmin, async (req, res) => {
  try {
    const code_a_barre = await generateCodeBarre();
    const clientId =
      req.user?.id ||
      req.user?.idClient ||
      req.user?.clientId ||
      req.body.idClient;

    const {
      nom_prioritaire,
      prenom_prioritaire,
      gouvernorat,
      ville,
      localite,
      codePostal,
      adresse,
      telephone1,
      telephone2,
      designation,
      prix,
      nb_article,
      mode_paiement,
      possible_ouvrir,
      possible_echange,
      remarque,
      code_a_barre_echange,
      nb_article_echange,
    } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "Client ID missing" });
    }

    const commande = await prisma.commande.create({
      data: {
        code_a_barre,
        nom_prioritaire,
        prenom_prioritaire,
        gouvernorat,
        ville,
        localite,
        codePostal,
        adresse,
        telephone1,
        telephone2,
        designation,
        prix,
        nb_article,
        etat: "EN_ATTENTE",
        mode_paiement,
        possible_ouvrir,
        possible_echange,
        remarque,
        est_imprimer: false,
        code_a_barre_echange,
        nb_article_echange,
        id_client: clientId,
      },
    });

    const historiqueCommande = await prisma.historiqueCommande.create({
      data: {
        etat: commande.etat,
        commentaire: "Commande initialisée",
        id_commande: commande.code_a_barre,
      },
    });

    return res
      .status(201)
      .json({ msg: "Commande ajoutée avec succès", code_a_barre });
  } catch (error) {
    console.error("Erreur : ", error);
    return res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});

// GET /command/:code_a_barre/print
router.get(
  "/:code_a_barre/print",
  verifyClientOrServiceClientOrAdmin,
  async (req, res) => {
    // Existing PDF generation code remains unchanged
    // ... (omitted for brevity, keep as provided)
  }
);

// DELETE /command/:codeBarre
router.delete("/:codeBarre", verifyClient, async (req, res) => {
  try {
    const { codeBarre } = req.params;

    // Verify the command exists and belongs to the client
    const commande = await prisma.commande.findUnique({
      where: { code_a_barre: codeBarre },
      select: { id_client: true, etat: true },
    });

    if (!commande) {
      return res.status(404).json({ msg: "Commande non trouvée" });
    }

    if (commande.id_client !== req.user.id) {
      return res.status(403).json({ msg: "Vous n'êtes pas autorisé à supprimer cette commande" });
    }

    if (commande.etat !== "ABANDONNEE") {
      return res.status(400).json({ msg: "Seule une commande abandonnée peut être supprimée définitivement" });
    }

    const deleteCommand = await prisma.commande.delete({
      where: { code_a_barre: codeBarre },
    });

    return res.status(200).json({
      msg: "Commande supprimée définitivement avec succès",
    });
  } catch (error) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ msg: "Commande non trouvée" });
    }
    return res.status(500).json({
      msg: "Une erreur est survenue lors de la suppression de la commande",
    });
  }
});

// PUT /command/:codeBarre
router.put("/:codeBarre", verifyClient, async (req, res) => {
  const { codeBarre } = req.params;
  const {
    nom_prioritaire,
    prenom_prioritaire,
    gouvernorat,
    ville,
    localite,
    codePostal,
    adresse,
    telephone1,
    telephone2,
    designation,
    prix,
    nb_article,
    mode_paiement,
    possible_ouvrir,
    possible_echange,
    remarque,
    code_a_barre_echange,
    nb_article_echange,
    etat,
  } = req.body;

  try {
    // Verify the command exists and belongs to the client
    const commande = await prisma.commande.findUnique({
      where: { code_a_barre: codeBarre },
      select: { etat: true, est_imprimer: true, id_client: true },
    });

    if (!commande) {
      return res.status(404).json({ msg: "Commande non trouvée" });
    }

    if (commande.id_client !== req.user.id) {
      return res.status(403).json({ msg: "Vous n'êtes pas autorisé à modifier cette commande" });
    }

    // Handle abandoning the command
    if (etat === "ABANDONNEE") {
      if (commande.etat !== "EN_ATTENTE") {
        return res.status(403).json({ msg: "Seules les commandes en attente peuvent être abandonnées" });
      }

      const [updatedCommande, historiqueCommande] = await prisma.$transaction([
        prisma.commande.update({
          where: { code_a_barre: codeBarre },
          data: { etat: "ABANDONNEE" },
        }),
        prisma.historiqueCommande.create({
          data: {
            etat: "ABANDONNEE",
            commentaire: "Commande abandonnée par le client",
            commande: {
              connect: { code_a_barre: codeBarre },
            },
          },
        }),
      ]);

      return res.status(200).json({
        msg: "Commande abandonnée avec succès",
        commande: updatedCommande,
      });
    }

    // Existing validation for full updates
    if (
      !nom_prioritaire ||
      !prenom_prioritaire ||
      !telephone1 ||
      !adresse ||
      !gouvernorat ||
      !ville ||
      !localite ||
      !codePostal ||
      !designation ||
      !prix ||
      !nb_article
    ) {
      return res.status(400).json({ msg: "Tous les champs obligatoires doivent être fournis" });
    }

    if (commande.etat !== "EN_ATTENTE") {
      return res.status(403).json({ msg: "Seules les commandes en attente peuvent être modifiées" });
    }

    if (commande.est_imprimer) {
      return res.status(403).json({ msg: "La commande ne peut être modifiée car le bordereau a été imprimé" });
    }

    // Update the command with full details
    const updatedCommande = await prisma.commande.update({
      where: { code_a_barre: codeBarre },
      data: {
        nom_prioritaire,
        prenom_prioritaire,
        gouvernorat,
        ville,
        localite,
        codePostal,
        adresse,
        telephone1,
        telephone2: telephone2 || null,
        designation,
        prix: parseFloat(prix),
        nb_article: parseInt(nb_article),
        mode_paiement: mode_paiement || "ESPECE",
        possible_ouvrir: possible_ouvrir || false,
        possible_echange: possible_echange || false,
        remarque: remarque || null,
        code_a_barre_echange: possible_echange ? parseInt(code_a_barre_echange) : null,
        nb_article_echange: possible_echange ? parseInt(nb_article_echange) : null,
      },
    });

    // Create a history record for the update
    const historiqueCommande = await prisma.historiqueCommande.create({
      data: {
        etat: updatedCommande.etat,
        commentaire: "Commande mise à jour par le client",
        commande: {
          connect: { code_a_barre: codeBarre },
        },
      },
    });

    return res.status(200).json({
      msg: "Commande mise à jour avec succès",
      commande: updatedCommande,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la commande:", {
      codeBarre,
      error: error.message,
      stack: error.stack,
    });

    if (error.code === "P2025") {
      return res.status(404).json({ msg: "Commande non trouvée" });
    }

    return res.status(500).json({
      msg: "Une erreur est survenue lors de la mise à jour de la commande",
    });
  }
});

// PUT /command/:codeBarre/restore
router.put("/:codeBarre/restore", verifyClient, async (req, res) => {
  const { codeBarre } = req.params;

  try {
    const commande = await prisma.commande.findUnique({
      where: { code_a_barre: codeBarre },
      select: { etat: true, id_client: true },
    });

    if (!commande) {
      return res.status(404).json({ msg: "Commande non trouvée" });
    }

    if (commande.id_client !== req.user.id) {
      return res.status(403).json({ msg: "Vous n'êtes pas autorisé à restaurer cette commande" });
    }

    if (commande.etat !== "ABANDONNEE") {
      return res.status(400).json({ msg: "Seules les commandes abandonnées peuvent être restaurées" });
    }

    const [updatedCommande, historiqueCommande] = await prisma.$transaction([
      prisma.commande.update({
        where: { code_a_barre: codeBarre },
        data: { etat: "EN_ATTENTE" },
      }),
      prisma.historiqueCommande.create({
        data: {
          etat: "EN_ATTENTE",
          commentaire: "Commande restaurée par le client",
          commande: {
            connect: { code_a_barre: codeBarre },
          },
        },
      }),
    ]);

    return res.status(200).json({
      msg: "Commande restaurée avec succès",
      commande: updatedCommande,
    });
  } catch (error) {
    console.error("Erreur lors de la restauration de la commande:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ msg: "Commande non trouvée" });
    }
    return res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});

// GET /command/clientAllCommands
router.get(
  "/clientAllCommands",
  verifyClientOrServiceClientOrAdmin,
  async (req, res) => {
    try {
      const commands = await prisma.commande.findMany({
        where: { id_client: req.user.id }, // Use req.user.id
        include: {
          livreur: {
            include: {
              utilisateur: true,
            },
          },
        },
      });
      res.status(200).send(commands);
    } catch (error) {
      console.error("Erreur lors de la récupération des commandes:", error);
      res.status(500).send({ msg: "Erreur du serveur" });
    }
  }
);

// GET /command/livreurAllCommands/:id_livreur
router.get(
  "/livreurAllCommands/:id_livreur",
  verifyLivreur,
  async (req, res) => {
    const id_livreur = parseInt(req.params.id_livreur);
    const { region } = req.query;

    try {
      const commands = await prisma.commande.findMany({
        where: {
          id_livreur: id_livreur,
          gouvernorat: region ? region : undefined,
        },
      });
      res.status(200).send(commands);
    } catch (error) {
      console.error("Erreur lors de la récupération des commandes:", error);
      res.status(500).send({ msg: "Erreur du serveur" });
    }
  }
);

// GET /command/allCommands
router.get("/allCommands", verifyAdminOrServiceClient, async (req, res) => {
  try {
    const { searchTerm, statusFilter, sortBy } = req.query;

    const whereConditions = [];

    // 💡 Filtrage par etat
    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'OPEN') {
        whereConditions.push({ etat: { in: ['EN_ATTENTE', 'A_ENLEVER'] } });
      } else {
        whereConditions.push({ etat: statusFilter });
      }
    }

    // 🔍 Filtrage par searchTerm
    if (searchTerm) {
      whereConditions.push({
        OR: [
          { code_a_barre: { contains: searchTerm, mode: 'insensitive' } },
          { nom_prioritaire: { contains: searchTerm, mode: 'insensitive' } },
          { prenom_prioritaire: { contains: searchTerm, mode: 'insensitive' } },
          { adresse: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    const orderBy = sortBy
      ? { [sortBy === 'date' ? 'dateAjout' : 'etat']: sortBy === 'date' ? 'desc' : 'asc' }
      : { dateAjout: 'desc' };

    const commandes = await prisma.commande.findMany({
      where,
      orderBy,
      select: {
        code_a_barre: true,
        nom_prioritaire: true,
        prenom_prioritaire: true,
        telephone1: true,
        etat: true,
        remarque: true,
        prix: true,
        gouvernorat: true,
        dateAjout: true,
        nb_article: true,
      },
    });

    return res.status(200).json(commandes);
  } catch (error) {
    console.error('Erreur :', error);
    return res.status(500).json({ msg: 'Erreur interne du serveur' });
  }
});

router.post("/setaDeleveryPerson", verifyAdminOrServiceClient, async (req, res) => {
  try {
    const { deliveryAgentId, zone, commandeIds, notes } = req.body;

    if (!deliveryAgentId || !zone || !commandeIds || !Array.isArray(commandeIds) || commandeIds.length === 0) {
      return res.status(400).json({ msg: 'Champs obligatoires manquants' });
    }

    const livreur = await prisma.livreur.findUnique({
      where: { idLivreur: parseInt(deliveryAgentId) },
      include: { utilisateur: true },
    });
    if (!livreur || livreur.gouvernorat.trim().toLowerCase() !== zone.trim().toLowerCase()) {
      return res.status(400).json({ msg: 'Livreur invalide ou zone non correspondante' });
    }

    const commands = await prisma.commande.findMany({
      where: {
        code_a_barre: { in: commandeIds },
        etat: 'EN_ATTENTE',
        gouvernorat: { equals: zone, mode: 'insensitive' },
      },
    });
    if (commands.length !== commandeIds.length) {
      return res.status(400).json({ msg: 'Certaines commandes sont invalides' });
    }

    const updatedCommands = await prisma.$transaction(
      commands.map((command) =>
        prisma.commande.update({
          where: { code_a_barre: command.code_a_barre },
          data: { id_livreur: parseInt(deliveryAgentId), etat: 'A_ENLEVER' },
        })
      )
    );

    await prisma.$transaction(
      commands.map((command) =>
        prisma.historiqueCommande.create({
          data: {
            etat: 'A_ENLEVER',
            commentaire: notes || 'Pickup assigné',
            commande: { connect: { code_a_barre: command.code_a_barre } },
            livreur: { connect: { idLivreur: parseInt(deliveryAgentId) } },
          },
        })
      )
    );

    return res.status(201).json({
      msg: 'Livreur affecté avec succès',
      pickup: { id: updatedCommands[0].code_a_barre, deliveryAgent: livreur.utilisateur.name, zone, commandeIds },
    });
  } catch (error) {
    console.error('Erreur : ', error);
    return res.status(500).json({ msg: 'Erreur interne du serveur' });
  }
});

// GET /command/:codeBarre
router.get("/:codeBarre", async (req, res) => {
  const codeBarre = req.params.codeBarre;

  try {
    const commande = await prisma.commande.findUnique({
      where: { code_a_barre: codeBarre },
      include: {
        livreur: {
          include: {
            utilisateur: true,
          },
        },
      },
    });

    if (!commande) {
      return res.status(404).json({ msg: "Commande non trouvée" });
    }

    return res.status(200).json(commande);
  } catch (error) {
    console.error("Erreur récupération commande :", error);
    return res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});

// POST /command/setCommandStatus
router.post("/setCommandStatus", verifyLivreur, async (req, res) => {
  try {
    const { id_livreur, code_a_barre, commentaire, state } = req.body;
    let command = await prisma.commande.findUnique({
      where: { code_a_barre: code_a_barre },
    });

    if (!command) {
      return res.status(404).send({ msg: "Commande n'existe pas." });
    }

    if (command.id_livreur !== id_livreur) {
      return res
        .status(403)
        .send({ msg: "Permission refusée. Vous n'êtes pas le livreur." });
    }

    if (!Object.values(EtatCommande).includes(state)) {
      return res
        .status(400)
        .json({ error: `Valeur d'état invalide : ${state}` });
    }

    command = await prisma.commande.update({
      where: { code_a_barre: code_a_barre },
      data: { etat: state },
    });

    const histCommand = await prisma.historiqueCommande.create({
      data: {
        etat: state,
        commentaire: commentaire,
        commande: {
          connect: { code_a_barre: code_a_barre },
        },
        livreur: {
          connect: { idLivreur: id_livreur },
        },
      },
    });

    res.status(200).send({ command, histCommand });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la commande:", error);
    res.status(500).send({ msg: "Erreur du serveur" });
  }
});

// POST /command/modifyStatus
router.post("/modifyStatus", verifyAdminOrServiceClient, async (req, res) => {
  try {
    const { code_a_barre, state, commentaire } = req.body;

    if (!code_a_barre || !state) {
      return res
        .status(400)
        .json({ msg: "Champs obligatoires manquants: code_a_barre et state" });
    }

    if (!Object.values(EtatCommande).includes(state)) {
      return res.status(400).json({ msg: `État invalide: ${state}` });
    }

    const command = await prisma.commande.findUnique({
      where: { code_a_barre: code_a_barre },
    });

    if (!command) {
      return res.status(404).json({ msg: "Commande non trouvée" });
    }

    const [updatedCommand, historiqueCommande] = await prisma.$transaction([
      prisma.commande.update({
        where: { code_a_barre: code_a_barre },
        data: { etat: state },
      }),
      prisma.historiqueCommande.create({
        data: {
          etat: state,
          commentaire: commentaire || "Statut modifié",
          commande: {
            connect: { code_a_barre: code_a_barre },
          },
          livreur: command.id_livreur
            ? { connect: { idLivreur: command.id_livreur } }
            : undefined,
        },
      }),
    ]);

    console.log(
      `Statut de la commande ${code_a_barre} modifié à ${state} par l'utilisateur ${req.user.id}`
    );

    return res.status(200).json({
      msg: "Statut de la commande mis à jour avec succès",
      command: updatedCommand,
      history: historiqueCommande,
    });
  } catch (error) {
    console.error("Erreur lors de la modification du statut : ", error);
    return res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});

module.exports = router;