// Import necessary modules
const {
  verifyAdmin,
  verifyClient,
  verifyLivreur,
  verifyClientOrServiceClientOrAdmin,
  verifyServiceclient,
} = require("../middleware/authMiddleware"); // Importer le middleware
const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const bcrypt = require("bcrypt"); // For password hashing and comparison
const jwt = require("jsonwebtoken"); // For generating JSON Web Tokens
const { PrismaClient } = require("@prisma/client");
const { generateCodeBarre } = require("../utils/codebarre");
const path = require("path");
const fs = require("fs");
const bwipjs = require('bwip-js');

const prisma = new PrismaClient();

// TODO: Client create new command (ONLY CLIENT)

router.post("/", verifyClient, async (req, res) => {
  try {
    const code_a_barre = await generateCodeBarre();
    console.log("🔍 req.user object:", req.user);
    console.log("🔍 req.body:", req.body);

    // Try different ways to get client ID based on your auth middleware
    const clientId =
      req.user?.id ||
      req.user?.idClient ||
      req.user?.clientId ||
      req.body.idClient;

    console.log("🆔 Extracted clientId:", clientId);
    // Extraire les champs depuis req.body (comme déjà fait)
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
    console.log("🔢 Données envoyées à Prisma :", {
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
    });

    if (!clientId) {
      return res.status(400).json({ error: "Client ID missing" });
    }
    // Créer la commande avec code_a_barre string personnalisé
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

    // Créer l'historique ...

    console.log("command : ", commande);

    // add the record to the HisstoriqueCommand

    const historiqueCommande = await prisma.historiqueCommande.create({
      data: {
        etat: commande.etat,
        commentaire: "Commande initialisée",
        id_commande: commande.code_a_barre, // ✅ obligatoire
        // id_livreur: null // tu peux l'ajouter plus tard si nécessaire
      },
    });

    console.log("Historique créé : ", historiqueCommande);

    return res
      .status(201)
      .json({ msg: "Commande ajoutée avec succès", code_a_barre });
  } catch (error) {
    console.error("Erreur : ", error);
    return res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});
// Route pour imprimer une commande en PDF
router.get(
  "/:code_a_barre/print",
  verifyClientOrServiceClientOrAdmin,
  async (req, res) => {
    const { code_a_barre } = req.params;
    const token = req.headers["authorization"]?.split(" ")[1];
    let decoded;

    try {
      if (!token) {
        return res
          .status(401)
          .json({ error: "Token d'authentification manquant." });
      }

      decoded = jwt.verify(token, process.env.JWTSECRET);
      const id_client = decoded.id;
      console.log("Utilisateur:", { id: id_client, role: decoded.role });

      // Récupérer la commande avec les informations du client
      const commande = await prisma.commande.findUnique({
        where: { code_a_barre },
        include: {
          client: {
            include: {
              utilisateur: true,
            },
          },
        },
      });

      if (!commande) {
        return res.status(404).json({ error: "Commande non trouvée." });
      }

      // Vérification des autorisations
      if (
        commande.id_client !== id_client &&
        decoded.role !== "ADMIN" &&
        decoded.role !== "SERVICECLIENT"
      ) {
        return res.status(403).json({ error: "Accès non autorisé" });
      }

      // Créer un document PDF (A4: 595pt x 842pt)
      const doc = new PDFDocument({ 
        margin: 50, 
        size: "A4",
        info: {
          Title: `Commande ${code_a_barre}`,
          Author: 'Cosmos Dashboard',
          Subject: 'Bon de commande',
          Creator: 'Cosmos Dashboard',
          Producer: 'Cosmos Dashboard'
        }
      });

      // Définir le nom du fichier
      const filename = `commande_${code_a_barre}_${Date.now()}.pdf`;
      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const filePath = path.join(tempDir, filename);

      // Stream pour écrire le fichier
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Définir les couleurs et styles
      const colors = {
        primary: "#2563EB",     // Bleu moderne
        secondary: "#64748B",   // Gris ardoise
        accent: "#06B6D4",      // Cyan
        success: "#10B981",     // Vert
        warning: "#F59E0B",     // Orange
        danger: "#EF4444",      // Rouge
        light: "#F8FAFC",       // Gris très clair
        dark: "#1E293B",        // Gris très foncé
        border: "#E2E8F0"       // Gris bordure
      };

      const fonts = {
        regular: "Helvetica",
        bold: "Helvetica-Bold",
        italic: "Helvetica-Oblique"
      };

      // === EN-TÊTE ===
      // Fond d'en-tête avec dégradé simulé
      doc.rect(0, 0, 595, 120).fill(colors.primary);
      doc.rect(0, 100, 595, 20).fill(colors.accent);

      // Logo ou nom de l'entreprise
      const logoPath = path.join(__dirname, "../public/logo.png");
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 50, 25, { width: 80, height: 60 });
        } catch (logoError) {
          console.warn("Erreur lors du chargement du logo:", logoError);
          // Fallback avec texte stylé
          doc.font(fonts.bold).fontSize(24).fillColor("white");
          doc.text("COSMOS", 50, 40);
          doc.font(fonts.regular).fontSize(12);
          doc.text("Dashboard", 50, 70);
        }
      } else {
        // Fallback avec texte stylé
        doc.font(fonts.bold).fontSize(24).fillColor("white");
        doc.text("COSMOS", 50, 40);
        doc.font(fonts.regular).fontSize(12);
        doc.text("Dashboard", 50, 70);
      }

      // Informations d'en-tête (droite)
         doc.font(fonts.bold).fontSize(20).fillColor("white");
      doc.text("BON DE COMMANDE", 150, 35, { align: "center", width: 295 });
      
      doc.font(fonts.regular).fontSize(11).fillColor("white");
      doc.text(`N° ${commande.code_a_barre}`, 350, 60, { align: "right", width: 195 });
      doc.text(`${new Date(commande.dateAjout).toLocaleDateString("fr-FR")}`, 350, 75, { align: "right", width: 195 });

      // === CODE-BARRES ===
      let currentY = 150;
      
      try {
        const barcodeBuffer = await new Promise((resolve, reject) => {
          bwipjs.toBuffer(
            {
              bcid: "code128",
              text: commande.code_a_barre,
              scale: 2,
              height: 15,
              includetext: false,
              textxalign: "center",
            },
            (err, png) => {
              if (err) reject(err);
              else resolve(png);
            }
          );
        });

        // Cadre pour le code-barres
        doc.rect(50, currentY - 10, 200, 60).fill(colors.light).stroke(colors.border);
        doc.image(barcodeBuffer, 70, currentY, { width: 160, height: 30 });
        doc.font(fonts.regular).fontSize(9).fillColor(colors.secondary);
        doc.text(commande.code_a_barre, 70, currentY + 35, {
          align: "center",
          width: 160
        });
      } catch (barcodeError) {
        console.warn("Erreur génération code-barres:", barcodeError);
        // Fallback sans code-barres
        doc.rect(50, currentY - 10, 200, 60).fill(colors.light).stroke(colors.border);
        doc.font(fonts.bold).fontSize(14).fillColor(colors.primary);
        doc.text(commande.code_a_barre, 70, currentY + 15, {
          align: "center",
          width: 160
        });
      }

      // === INFORMATIONS CLIENT ===
      doc.font(fonts.bold).fontSize(14).fillColor(colors.primary);
      doc.text("INFORMATIONS CLIENT", 280, currentY - 5);
      
      const clientInfo = [
        `${commande.nom_prioritaire} ${commande.prenom_prioritaire}`,
        `${commande.adresse}`,
        `${commande.ville}, ${commande.gouvernorat}`,
        `${commande.codePostal}`,
        `Tél: ${commande.telephone1}${commande.telephone2 ? ` / ${commande.telephone2}` : ""}`
      ];

      doc.font(fonts.regular).fontSize(10).fillColor(colors.dark);
      clientInfo.forEach((info, index) => {
        doc.text(info, 280, currentY + 15 + (index * 12), { width: 265 });
      });

      currentY += 100;

      // === DÉTAILS DE LA COMMANDE ===
      doc.font(fonts.bold).fontSize(14).fillColor(colors.primary);
      doc.text("DÉTAILS DE LA COMMANDE", 50, currentY);
      currentY += 25;

      // Tableau moderne
      const tableConfig = {
        x: 50,
        y: currentY,
        width: 495,
        headers: ["DÉSIGNATION", "PRIX UNITAIRE", "QUANTITÉ", "MODE PAIEMENT"],
        colWidths: [200, 100, 80, 115],
        rowHeight: 35
      };

      // En-tête du tableau
      doc.rect(tableConfig.x, tableConfig.y, tableConfig.width, tableConfig.rowHeight)
         .fill(colors.primary);
      
      doc.font(fonts.bold).fontSize(10).fillColor("white");
      let xPos = tableConfig.x + 10;
      tableConfig.headers.forEach((header, i) => {
        doc.text(header, xPos, tableConfig.y + 12, {
          width: tableConfig.colWidths[i] - 10,
          align: "left"
        });
        xPos += tableConfig.colWidths[i];
      });

      // Ligne de données
      const dataY = tableConfig.y + tableConfig.rowHeight;
      doc.rect(tableConfig.x, dataY, tableConfig.width, tableConfig.rowHeight)
         .fill("white")
         .stroke(colors.border);

      const rowData = [
        commande.designation,
        `${commande.prix.toFixed(2)} TND`,
        commande.nb_article.toString(),
        commande.mode_paiement
      ];

      doc.font(fonts.regular).fontSize(10).fillColor(colors.dark);
      xPos = tableConfig.x + 10;
      rowData.forEach((data, i) => {
        doc.text(data, xPos, dataY + 10, {
          width: tableConfig.colWidths[i] - 10,
          align: i === 1 ? "right" : "left"
        });
        xPos += tableConfig.colWidths[i];
      });

      // Lignes verticales du tableau
      xPos = tableConfig.x;
      tableConfig.colWidths.forEach(width => {
        xPos += width;
        doc.moveTo(xPos, tableConfig.y)
           .lineTo(xPos, dataY + tableConfig.rowHeight)
           .stroke(colors.border);
      });

      currentY = dataY + tableConfig.rowHeight + 30;

      // === TOTAL ===
      const totalBoxY = currentY;
      doc.rect(350, totalBoxY, 195, 40).fill(colors.light).stroke(colors.primary);
      doc.font(fonts.bold).fontSize(16).fillColor(colors.primary);
      doc.text("TOTAL:", 360, totalBoxY + 12);
      doc.text(`${commande.prix.toFixed(2)} TND`, 450, totalBoxY + 12, { align: "right", width: 85 });

      currentY += 60;

      // === OPTIONS ET REMARQUES ===
      doc.font(fonts.bold).fontSize(12).fillColor(colors.primary);
      doc.text("OPTIONS DE LA COMMANDE", 50, currentY);
      currentY += 20;

      const options = [
        { label: "Ouvrable", value: commande.possible_ouvrir ? "Oui" : "Non", color: commande.possible_ouvrir ? colors.success : colors.danger },
        { label: "Échangeable", value: commande.possible_echange ? "Oui" : "Non", color: commande.possible_echange ? colors.success : colors.danger }
      ];

      options.forEach((option, index) => {
        const optionY = currentY + (index * 25);
        
        // Badge pour l'option
        doc.roundedRect(50, optionY, 15, 15, 3).fill(option.color);
        doc.font(fonts.bold).fontSize(8).fillColor("white");
        doc.text(option.value === "Oui" ? "✓" : "✗", 52, optionY + 3);
        
        doc.font(fonts.regular).fontSize(10).fillColor(colors.dark);
        doc.text(`${option.label}: ${option.value}`, 75, optionY + 3);
      });

      currentY += 60;

      // Informations d'échange si applicable
      if (commande.possible_echange && commande.code_a_barre_echange) {
        doc.font(fonts.bold).fontSize(12).fillColor(colors.primary);
        doc.text("INFORMATIONS D'ÉCHANGE", 50, currentY);
        currentY += 20;

        doc.font(fonts.regular).fontSize(10).fillColor(colors.dark);
        doc.text(`Code d'échange: ${commande.code_a_barre_echange}`, 50, currentY);
        currentY += 15;
        doc.text(`Quantité d'échange: ${commande.nb_article_echange || 0}`, 50, currentY);
        currentY += 25;
      }

      // Remarques
      if (commande.remarque && commande.remarque.trim()) {
        doc.font(fonts.bold).fontSize(12).fillColor(colors.primary);
        doc.text("REMARQUES", 50, currentY);
        currentY += 20;

        doc.rect(50, currentY - 5, 495, 40).fill(colors.light).stroke(colors.border);
        doc.font(fonts.italic).fontSize(10).fillColor(colors.dark);
        doc.text(commande.remarque, 60, currentY + 8, { width: 475, height: 25 });
        currentY += 50;
      }

      // === PIED DE PAGE ===
      const footerY = doc.page.height - 80;
      
      // Ligne de séparation
      doc.moveTo(50, footerY).lineTo(545, footerY).stroke(colors.border);
      
      doc.font(fonts.regular).fontSize(8).fillColor(colors.secondary);
      doc.text(`Document généré le ${new Date().toLocaleString("fr-FR")}`, 50, footerY + 15);

      // Finaliser le document
      doc.end();

      // Fonction helper pour obtenir la couleur du statut
      function getStatusColor(status) {
        const statusColors = {
          'EN_ATTENTE': colors.warning,
          'CONFIRMEE': colors.success,
          'EN_PREPARATION': colors.accent,
          'PRETE': colors.primary,
          'LIVREE': colors.success,
          'ANNULEE': colors.danger
        };
        return statusColors[status] || colors.secondary;
      }

      // Attendre que le fichier soit écrit
      stream.on("finish", () => {
        res.download(filePath, filename, (err) => {
          if (err) {
            console.error("Erreur lors du téléchargement du fichier:", err);
            return res
              .status(500)
              .json({ error: "Erreur lors du téléchargement du fichier." });
          }
          // Nettoyer le fichier temporaire
          fs.unlink(filePath, (err) => {
            if (err)
              console.error(
                "Erreur lors de la suppression du fichier temporaire:",
                err
              );
          });
        });
      });

      stream.on("error", (err) => {
        console.error("Erreur lors de l'écriture du fichier PDF:", err);
        res.status(500).json({ error: "Erreur lors de la génération du PDF." });
      });

      doc.on("error", (err) => {
        console.error("Erreur lors de la génération du PDF:", err);
        res.status(500).json({ error: "Erreur lors de la génération du PDF." });
      });

    } catch (error) {
      console.error(
        "Erreur lors de la génération du PDF de la commande:",
        error
      );
      res
        .status(500)
        .json({ error: "Erreur lors de la génération du PDF de la commande." });
    }
  }
);
module.exports = router;
// TODO: Client delete Command
router.delete("/:codeBarre", verifyClient, async (req, res) => {
  try {
    const deleteCommand = await prisma.commande.delete({
      where: {
        code_a_barre: req.params.codeBarre,
      },
    });
    if (!deleteCommand) {
      return res.status(400).json({
        msg: "Impossible de supprimer la commande",
      });
    }
    return res.status(200).json({
      msg: "Commande supprimée avec succès",
    });
  } catch (error) {
    console.error(error);

    // Si la commande n'est pas trouvée, Prisma lancera une erreur
    if (error.code === "P2025") {
      return res.status(404).json({
        msg: "Commande non trouvée",
      });
    }
    // Autres erreurs
    return res.status(500).json({
      msg: "Une erreur est survenue lors de la suppression de la commande",
    });
  }
});

// TODO: Client modify Command
router.put("/:codeBarre", verifyClient, async (req, res) => {
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
  try {
    const updateCommand = await prisma.commande.update({
      where: {
        code_a_barre: req.params.codeBarre,
      },
      data: {
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
      },
    });
    // Vérification si la commande a été mise à jour
    if (!updateCommand) {
      return res.status(400).json({
        msg: "La commande n'a pas pu être mise à jour",
      });
    }
    // Réponse réussie
    return res.status(200).json({
      msg: "Commande mise à jour avec succès",
    });
  } catch (error) {
    console.error(error);
    // Si la commande n'est pas trouvée, Prisma lancera une erreur
    if (error.code === "P2025") {
      return res.status(404).json({
        msg: "Commande non trouvée",
      });
    }
    return res.status(500).json({
      msg: "Erreur lors de la mise à jour de la commande",
    });
  }
});

router.get(
  "/clientAllCommands",
  verifyClientOrServiceClientOrAdmin,
  async (req, res) => {
    try {
      // Récupération des commandes de l'utilisateur connecté
      const commands = await prisma.commande.findMany({
        where: { id_client: req.body.id_client },
        include: {
          livreur: {
            include: {
              utilisateur: true,
            },
          },
        },
      });
      res.status(200).send(commands); // Réponse avec les commandes
    } catch (error) {
      console.error("Erreur lors de la récupération des commandes:", error);
      res.status(500).send({ msg: "Erreur du serveur" });
    }
  }
);

router.get(
  "/livreurAllCommands/:id_livreur",
  verifyLivreur,
  async (req, res) => {
    const id_livreur = parseInt(req.params.id_livreur);
    const { region } = req.query; // Récupérer le paramètre de région

    try {
      const commands = await prisma.commande.findMany({
        where: {
          id_livreur: id_livreur,
          gouvernorat: region ? region : undefined, // Filtrer par région si elle est fournie
        },
      });
      res.status(200).send(commands);
    } catch (error) {
      console.error("Erreur lors de la récupération des commandes:", error);
      res.status(500).send({ msg: "Erreur du serveur" });
    }
  }
);

// getAllCommands- serviceClient/admin
router.get("/allCommands", verifyAdmin, async (req, res) => {
  try {
    const commands = await prisma.commande.findMany();
    res.status(200).send(commands);
  } catch (error) {
    console.error("Erreur lors de la récupération des commandes:", error);
    res.status(500).send({ msg: "Erreur du serveur" });
  }
});

// setAdeleveryPerson ---------------serviceClient----------------
// request body: {code_a_barre:*,id_livreur:*} + Bearar token
router.post("/setaDeleveryPerson", verifyServiceclient, async (req, res) => {
  try {
    const { code_a_barre, id_livreur } = req.body;
    const updateCommand = await prisma.commande.update({
      where: {
        code_a_barre: code_a_barre,
      },
      data: {
        id_livreur: parseInt(id_livreur),
        etat: "A_ENLEVER",
      },
    });
    // Vérification si la commande a été mise à jour
    if (!updateCommand) {
      return res.status(400).json({
        msg: "Le livreur ne peux pas être affecter",
      });
    }
    const historiqueCommande = await prisma.historiqueCommande.create({
      data: {
        etat: "EN_COURS",
        commentaire: "En cours de livraison",
        commande: {
          connect: { code_a_barre: code_a_barre }, // Utilisation de "connect" pour lier une commande existante via son code_a_barre
        },
        livreur: {
          connect: { idLivreur: id_livreur }, // Utilisation de "connect" pour lier une commande existante via son code_a_barre
        },
      },
    });
    console.log("Historique créé : ", historiqueCommande);
    return res.status(201).json({
      msg: "Livreur affecter avec succès",
    });
  } catch (error) {
    console.error("Erreur : ", error);
    return res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});

// Récupérer une commande par son code_a_barre
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

// setCommandStatus by delivery person
// request body: {id_livreur, code_a_barre, commentaire, state} + Bearer token
const EtatCommandeLivreur = {
  EN_ATTENTE: "EN_ATTENTE",
  AU_DEPOT: "AU_DEPOT",
  EN_COURS: "EN_COURS",
  A_VERIFIER: "A_VERIFIER",
  LIVRES: "LIVRES",
  LIVRES_PAYES: "LIVRES_PAYES",
  ECHANGE: "ECHANGE",
  REMBOURSES: "REMBOURSES",
  RETOUR_DEFINITIF: "RETOUR_DEFINITIF",
  RETOUR_INTER_AGENCE: "RETOUR_INTER_AGENCE",
  RETOUR_EXPEDITEURS: "RETOUR_EXPEDITEURS",
  RETOUR_RECU_PAYE: "RETOUR_RECU_PAYE",
};
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
};
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
          connect: { code_a_barre: code_a_barre }, // Utilisation de "connect" pour lier une commande existante via son code_a_barre
        },
        livreur: {
          connect: { idLivreur: id_livreur }, // Utilisation de "connect" pour lier une commande existante via son code_a_barre
        },
      },
    });
    res.status(200).send({ command, histCommand });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la commande:", error);
    res.status(500).send({ msg: "Erreur du serveur" });
  }
});

router.post("/modifyStatus", verifyServiceclient, async (req, res) => {
  try {
    const { code_a_barre, state, commentaire } = req.body;

    // Validate input
    if (!code_a_barre || !state) {
      return res
        .status(400)
        .json({ msg: "Champs obligatoires manquants: code_a_barre et state" });
    }

    // Plus besoin de vérifier si code_a_barre est un nombre, on le traite comme string

    // Check if the state is valid
    if (!Object.values(EtatCommande).includes(state)) {
      return res.status(400).json({ msg: `État invalide: ${state}` });
    }

    // Find the command
    const command = await prisma.commande.findUnique({
      where: { code_a_barre: code_a_barre },
    });

    if (!command) {
      return res.status(404).json({ msg: "Commande non trouvée" });
    }

    // Use a transaction to ensure atomicity
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

    // Log the status change
    console.log(
      `Statut de la commande ${code_a_barre} modifié à ${state} par l'utilisateur ${req.user.id}`
    );

    // Return success response
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
