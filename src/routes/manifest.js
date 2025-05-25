const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const { verifyClient, verifyLogin, verifyServiceclient,verifyAdminOrServiceClient,verifyClientOrServiceClientOrAdmin } = require("../middleware/authMiddleware");
const prisma = new PrismaClient();
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// Route pour créer un manifeste
router.post("/",verifyClient, async (req, res) => {
    const commandes  = req.body.commandes;
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization
    const decoded = jwt.verify(token, process.env.JWTSECRET);
    const id_client= decoded.id;
    // Validation des données
    if (!id_client || !commandes) {
        return res.status(400).json({ error: "Données invalides. L'ID du client et une liste de commandes sont requis." });
    }

    try {
        // Vérifier si toutes les commandes existent
        const commandesExistantes = await prisma.commande.findMany({
            where: {
                code_a_barre: { in: commandes },
            },
        });

        if (commandesExistantes.length !== commandes.length) {
            return res.status(400).json({ error: "Une ou plusieurs commandes n'existent pas." });
        }
        // Créer le manifeste
        const manifeste = await prisma.manifeste.create({
            data: {
                id_client,
                commandes: {
                    connect: commandes.map((code_a_barre) => ({ code_a_barre })),
                },
            },
            include: {
                commandes: true, // Inclure les détails des commandes dans la réponse
            },
        });

        res.status(201).json(manifeste);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors de la création du manifeste." });
    }
});



// Route pour supprimer un manifeste
router.delete("/:id", verifyClient, async (req, res) => {
    const { id } = req.params; // ID du manifeste à supprimer
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization
    const decoded = jwt.verify(token, process.env.JWTSECRET);
    const id_client = decoded.id;
    try {
        // Vérifier si le manifeste existe
        const manifeste = await prisma.manifeste.findUnique({
            where: { id: parseInt(id) },
            include: { commandes: true }, // Inclure les commandes associées
        });

        if (!manifeste) {
            return res.status(404).json({ error: "Manifeste non trouvé." });
        }

        // Vérifier si le manifeste appartient au client
        if (manifeste.id_client !== id_client) {
            return res.status(403).json({ error: "Vous n'êtes pas autorisé à supprimer ce manifeste." });
        }

        // Récupérer les codes à barres des commandes
        const commandeIds = manifeste.commandes.map(commande => commande.code_a_barre);

        // Mettre à jour l'état des commandes à "en attente"
        await prisma.commande.updateMany({
            where: {
                code_a_barre: { in: commandeIds }
            },
            data: {
                etat: "EN_ATTENTE"
            }
        });

        // Supprimer les relations entre le manifeste et les commandes
        await prisma.manifeste.update({
            where: { id: parseInt(id) },
            data: {
                commandes: {
                    disconnect: manifeste.commandes.map((commande) => ({ code_a_barre: commande.code_a_barre })),
                },
            },
        });

        // Supprimer le manifeste
        await prisma.manifeste.delete({
            where: { id: parseInt(id) },
        });

        res.status(200).json({ message: "Manifeste supprimé avec succès." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors de la suppression du manifeste." });
    }
});

// Route pour supprimer une commande d'un manifeste
router.delete("/:id/order/:orderId", verifyClient, async (req, res) => {
    const { id, orderId } = req.params;
    const token = req.headers['authorization']?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWTSECRET);
    const id_client = decoded.id;

    try {
        const commande = await prisma.commande.findUnique({
            where: { code_a_barre: orderId },
            include: { Manifeste: true }, // Inclure le manifeste associé
        });
        
        console.log("Commande récupérée:", commande);
        console.log("Manifeste associé:", commande?.Manifeste);
        // Vérifier si le manifeste existe
        const manifeste = await prisma.manifeste.findUnique({
            where: { id: parseInt(id) },
            include: { commandes: true },
        });

        if (!manifeste) {
            return res.status(404).json({ error: "Manifeste non trouvé." });
        }

        // Vérifier si le manifeste appartient au client
        if (manifeste.id_client !== id_client) {
            return res.status(403).json({ error: "Vous n'êtes pas autorisé à modifier ce manifeste." });
        }

        // Vérifier si la commande existe dans le manifeste
        const commandeExistante = manifeste.commandes.find(
            (commande) => commande.code_a_barre === parseInt(orderId) // Convertir en entier pour être sûr
        );
        if (!commandeExistante) {
            return res.status(404).json({ error: "Commande non trouvée dans ce manifeste." });
        }

        // Mettre à jour l'état de la commande à "en attente"
        await prisma.commande.update({
            where: { code_a_barre: orderId },
            data: { etat: "EN_ATTENTE" }
        });

        // Supprimer la relation entre le manifeste et la commande
        await prisma.manifeste.update({
            where: { id: parseInt(id) },
            data: {
                commandes: {
                    disconnect: { code_a_barre: orderId },
                },
            },
        });

        res.status(200).json({ message: "Commande retirée du manifeste avec succès." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors du retrait de la commande." });
    }
});

// Route pour modifier un manifeste (pour client)
router.put("/:id", verifyClient, async (req, res) => {
    const { id } = req.params; // ID du manifeste à modifier
    const { commandesAjouter, commandesSupprimer } = req.body; // Commandes à ajouter ou supprimer
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization
    console.log(commandesAjouter)
    console.log(commandesSupprimer)
    let decoded;
    decoded = jwt.verify(token, process.env.JWTSECRET);
    const id_client = decoded.id; // ID du client extrait du token

    try {
        // Vérifier si le manifeste existe
        const manifeste = await prisma.manifeste.findUnique({
            where: { id: parseInt(id) },
            include: { commandes: true }, // Inclure les commandes associées
        });

        if (!manifeste) {
            return res.status(404).json({ error: "Manifeste non trouvé." });
        }

        // Vérifier si le manifeste appartient au client
        if (manifeste.id_client !== id_client) {
            return res.status(403).json({ error: "Vous n'êtes pas autorisé à modifier ce manifeste." });
        }

        // Vérifier si les commandes à ajouter existent
        if (commandesAjouter && commandesAjouter.length > 0) {
            const commandesExistantes = await prisma.commande.findMany({
                where: {
                    code_a_barre: { in: commandesAjouter },
                },
            });

            if (commandesExistantes.length !== commandesAjouter.length) {
                return res.status(400).json({ error: "Une ou plusieurs commandes à ajouter n'existent pas." });
            }
        }

        // Vérifier si les commandes à supprimer existent dans le manifeste
        if (commandesSupprimer && commandesSupprimer.length > 0) {
            const commandesDansManifeste = manifeste.commandes.map((commande) => commande.code_a_barre);
            const commandesNonTrouvees = commandesSupprimer.filter((code) => !commandesDansManifeste.includes(code));

            if (commandesNonTrouvees.length > 0) {
                return res.status(400).json({ error: "Une ou plusieurs commandes à supprimer ne sont pas dans ce manifeste." });
            }
        }

        // Mettre à jour le manifeste
        const manifesteMisAJour = await prisma.manifeste.update({
            where: { id: parseInt(id) },
            data: {
                commandes: {
                    connect: commandesAjouter?.map((code_a_barre) => ({ code_a_barre })) || [],
                    disconnect: commandesSupprimer?.map((code_a_barre) => ({ code_a_barre })) || [],
                },
            },
            include: {
                commandes: true, // Inclure les détails des commandes dans la réponse
            },
        });

        res.status(200).json(manifesteMisAJour);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors de la modification du manifeste." });
    }
});

// Route pour récupérer tous les manifestes d'un client
router.get("/", verifyClient, async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWTSECRET);
        const id_client = decoded.id;

        console.log("Récupération des manifestes pour le client:", id_client); // Log pour déboguer

        const manifestes = await prisma.manifeste.findMany({
            where: { id_client },
            include: { commandes: true },
        });

        console.log("Manifestes récupérés:", manifestes); // Log pour déboguer
        res.status(200).json(manifestes);
    } catch (error) {
        console.error("Erreur lors de la récupération des manifestes:", error); // Log pour déboguer
        res.status(500).json({ error: "Erreur lors de la récupération des manifestes." });
    }
});
// Route pour récupérer tous les manifestes (pour l'admin)
router.get("/getAllManifests", verifyAdminOrServiceClient, async (req, res) => {
    try {
        // Récupérer tous les manifestes
        const manifestes = await prisma.manifeste.findMany({
            include: {
              commandes: true,
              client: {
                select: {
                  nomShop: true,  // Retrieve fields from the Client model
                  gouvernorat: true,
                  ville: true,
                  localite: true,
                  codePostal: true,
                  adresse: true,
                  utilisateur: {  // Select fields from the related Utilisateur model
                    select: {
                      nom: true,
                      prenom: true,
                      email: true,
                      telephone1: true,
                      telephone2: true,
                      codeTVA: true,
                      cin: true,
                      role: true,
                    }
                  }
                }
              }
            },
            orderBy: {
              dateCreation: "desc"
            }
          });
          

        res.status(200).json(manifestes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors de la récupération des manifestes." });
    }
});

// Route pour récupérer une manifeste d'un client
router.get("/:id", verifyClient, async (req, res) => {
    const { id } = req.params; // ID du manifeste à récupérer
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization
    let decoded;
    decoded = jwt.verify(token, process.env.JWTSECRET);
    const id_client = decoded.id; // ID du client extrait du token
    try {
        // Récupérer le manifeste par ID
        const manifeste = await prisma.manifeste.findUnique({
            where: { id: parseInt(id) },
            include: {
                commandes: true, // Inclure les détails des commandes associées
                client: {
                    select: {
                        nom: true,
                        prenom: true,
                        email: true,
                        telephone: true,
                        adresse: true
                    }
                }
            },
        });

        // Vérifier si le manifeste existe
        if (!manifeste) {
            return res.status(404).json({ error: "Manifeste non trouvé." });
        }

        // Vérifier si le manifeste appartient au client
        if (manifeste.id_client !== id_client) {
            return res.status(403).json({ error: "Vous n'êtes pas autorisé à accéder à ce manifeste." });
        }

        res.status(200).json(manifeste);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors de la récupération du manifeste." });
    }
});
// Route pour imprimer un manifeste en PDF avec design moderne
router.get("/:id/print", verifyClientOrServiceClientOrAdmin, async (req, res) => {
    const { id } = req.params;
    const token = req.headers['authorization']?.split(' ')[1];
    let decoded;

    try {
        if (!token) {
            return res.status(401).json({ error: "Token d'authentification manquant." });
        }

        decoded = jwt.verify(token, process.env.JWTSECRET);
        const id_client = decoded.id;
        console.log("Utilisateur:", { id: id_client, role: decoded.role });

        // Récupérer le manifeste avec les informations du client
        const manifeste = await prisma.manifeste.findUnique({
            where: { id: parseInt(id) },
            include: {
                commandes: true,
                client: {
                    include: {
                        utilisateur: true,
                    },
                },
            },
        });

        if (!manifeste) {
            return res.status(404).json({ error: "Manifeste non trouvé." });
        }

        // Vérification des autorisations (client ou admin)
        if (manifeste.id_client !== id_client && decoded.role !== 'ADMIN' && decoded.role !== 'SERVICECLIENT') {
            return res.status(403).json({ error: "Accès non autorisé" });
        }

        // Créer un document PDF (A4: 595pt x 842pt)
        const doc = new PDFDocument({ 
            margin: 50, 
            size: "A4",
            info: {
                Title: `Manifeste ${id}`,
                Author: 'Cosmos Dashboard',
                Subject: 'Manifeste de livraison',
                Creator: 'Cosmos Dashboard',
                Producer: 'Cosmos Dashboard'
            }
        });

        // Définir le nom du fichier
        const filename = `manifeste_${id}_${Date.now()}.pdf`;
        const tempDir = path.join(__dirname, '../temp');
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
        doc.text("MANIFESTE DE LIVRAISON", 150, 35, { align: "center", width: 295 });
        
        doc.font(fonts.regular).fontSize(11).fillColor("white");
        doc.text(`N° ${manifeste.id}`, 350, 60, { align: "right", width: 195 });
        doc.text(`${new Date(manifeste.dateCreation).toLocaleDateString("fr-FR")}`, 350, 75, { align: "right", width: 195 });

        let currentY = 150;

        // === INFORMATIONS CLIENT ===
        doc.font(fonts.bold).fontSize(14).fillColor(colors.primary);
        doc.text("INFORMATIONS CLIENT", 50, currentY);
        currentY += 25;

        // Cadre pour les informations client
        doc.rect(50, currentY - 5, 495, 80).fill(colors.light).stroke(colors.border);
        
        const clientInfo = [
            `Nom: ${manifeste.client.nom} ${manifeste.client.prenom}`,
            `Email: ${manifeste.client.email}`,
            `Téléphone: ${manifeste.client.telephone}`,
            `Adresse: ${manifeste.client.adresse || 'Non spécifiée'}`
        ];

        doc.font(fonts.regular).fontSize(10).fillColor(colors.dark);
        clientInfo.forEach((info, index) => {
            doc.text(info, 60, currentY + 5 + (index * 15), { width: 475 });
        });

        currentY += 100;

        // === RÉSUMÉ DU MANIFESTE ===
        const totalCommandes = manifeste.commandes.length;
        const totalPrix = manifeste.commandes.reduce((sum, cmd) => sum + cmd.prix, 0);

        // Boîtes de résumé
        const boxWidth = 150;
        const boxHeight = 60;
        const boxSpacing = 20;

        // Nombre de commandes
        doc.rect(50, currentY, boxWidth, boxHeight).fill(colors.accent).stroke(colors.border);
        doc.font(fonts.bold).fontSize(16).fillColor("white");
        doc.text(totalCommandes.toString(), 50, currentY + 15, { align: "center", width: boxWidth });
        doc.font(fonts.regular).fontSize(10);
        doc.text("COMMANDES", 50, currentY + 35, { align: "center", width: boxWidth });

        // Prix total
        doc.rect(50 + boxWidth + boxSpacing, currentY, boxWidth, boxHeight).fill(colors.success).stroke(colors.border);
        doc.font(fonts.bold).fontSize(14).fillColor("white");
        doc.text(`${totalPrix.toFixed(2)} TND`, 50 + boxWidth + boxSpacing, currentY + 18, { align: "center", width: boxWidth });
        doc.font(fonts.regular).fontSize(10);
        doc.text("MONTANT TOTAL", 50 + boxWidth + boxSpacing, currentY + 35, { align: "center", width: boxWidth });

        // Statut du manifeste
        doc.rect(50 + (boxWidth + boxSpacing) * 2, currentY, boxWidth, boxHeight).fill(colors.primary).stroke(colors.border);
        doc.font(fonts.bold).fontSize(12).fillColor("white");
        doc.text("ACTIF", 50 + (boxWidth + boxSpacing) * 2, currentY + 20, { align: "center", width: boxWidth });
        doc.font(fonts.regular).fontSize(10);
        doc.text("STATUT", 50 + (boxWidth + boxSpacing) * 2, currentY + 35, { align: "center", width: boxWidth });

        currentY += boxHeight + 40;

        // === TABLEAU DES COMMANDES ===
        doc.font(fonts.bold).fontSize(14).fillColor(colors.primary);
        doc.text("LISTE DES COMMANDES", 50, currentY);
        currentY += 25;

        // Configuration du tableau
        const tableConfig = {
            x: 50,
            y: currentY,
            width: 495,
            headers: ["CODE", "DÉSIGNATION", "PRIX", "ÉTAT"],
            colWidths: [90, 220, 80, 105],
            rowHeight: 35
        };

        // Fonction pour dessiner l'en-tête du tableau
        function drawTableHeader(y) {
            doc.rect(tableConfig.x, y, tableConfig.width, tableConfig.rowHeight)
               .fill(colors.primary);
            
            doc.font(fonts.bold).fontSize(10).fillColor("white");
            let xPos = tableConfig.x + 10;
            tableConfig.headers.forEach((header, i) => {
                doc.text(header, xPos, y + 12, {
                    width: tableConfig.colWidths[i] - 10,
                    align: "left"
                });
                xPos += tableConfig.colWidths[i];
            });
            return y + tableConfig.rowHeight;
        }

        // Dessiner l'en-tête initial
        let tableY = drawTableHeader(currentY);

        // Données du tableau
        manifeste.commandes.forEach((commande, index) => {
            // Vérifier si on a besoin d'une nouvelle page
            if (tableY > 700) {
                doc.addPage();
                tableY = 50;
                
                // Redessiner l'en-tête sur la nouvelle page
                tableY = drawTableHeader(tableY);
            }

            // Couleur de fond alternée pour les lignes
            const bgColor = index % 2 === 0 ? "white" : colors.light;
            doc.rect(tableConfig.x, tableY, tableConfig.width, tableConfig.rowHeight)
               .fill(bgColor)
               .stroke(colors.border);

            // Couleur selon l'état
            const stateColor = getStatusColor(commande.etat);

            const rowData = [
                commande.code_a_barre,
                commande.designation,
                `${commande.prix.toFixed(2)} TND`,
                commande.etat
            ];

            doc.font(fonts.regular).fontSize(9).fillColor(colors.dark);
            let xPos = tableConfig.x + 10;
            
            rowData.forEach((data, i) => {
                if (i === 3) { // État - avec couleur spéciale
                    doc.fillColor(stateColor);
                    doc.font(fonts.bold);
                } else {
                    doc.fillColor(colors.dark);
                    doc.font(fonts.regular);
                }
                
                doc.text(data, xPos, tableY + 12, {
                    width: tableConfig.colWidths[i] - 10,
                    align: i === 2 ? "right" : "left" // Prix aligné à droite
                });
                xPos += tableConfig.colWidths[i];
            });

            // Lignes verticales du tableau
            xPos = tableConfig.x;
            tableConfig.colWidths.forEach(width => {
                xPos += width;
                doc.moveTo(xPos, tableY)
                   .lineTo(xPos, tableY + tableConfig.rowHeight)
                   .stroke(colors.border);
            });

            tableY += tableConfig.rowHeight;
        });

        // === TOTAL FINAL ===
        const totalBoxY = tableY + 20;
        doc.rect(350, totalBoxY, 195, 50).fill(colors.primary).stroke(colors.border);
        doc.font(fonts.bold).fontSize(14).fillColor("white");
        doc.text("TOTAL GÉNÉRAL:", 360, totalBoxY + 12);
        doc.font(fonts.bold).fontSize(16);
        doc.text(`${totalPrix.toFixed(2)} TND`, 450, totalBoxY + 30, { align: "right", width: 85 });

        // === PIED DE PAGE ===
        const footerY = doc.page.height - 80;
        
        // Ligne de séparation
        doc.moveTo(50, footerY).lineTo(545, footerY).stroke(colors.border);
        
        doc.font(fonts.regular).fontSize(8).fillColor(colors.secondary);
        doc.text(`Document généré le ${new Date().toLocaleString("fr-FR")}`, 50, footerY + 15);
        doc.text(`Manifeste N° ${manifeste.id}`, 400, footerY + 15, { align: "right", width: 145 });

        // Fonction helper pour obtenir la couleur du statut
        function getStatusColor(status) {
            const statusColors = {
                'EN_ATTENTE': colors.warning,
                'CONFIRMEE': colors.success,
                'EN_PREPARATION': colors.accent,
                'PRETE': colors.primary,
                'LIVREE': colors.success,
                'ANNULEE': colors.danger,
                'EXPEDIEE': colors.accent,
                'RETOURNEE': colors.warning
            };
            return statusColors[status] || colors.secondary;
        }

        // Finaliser le document
        doc.end();

        // Attendre que le fichier soit écrit
        stream.on('finish', () => {
            // Envoyer le fichier
            res.download(filePath, filename, (err) => {
                if (err) {
                    console.error('Erreur lors du téléchargement du fichier:', err);
                    return res.status(500).json({ error: "Erreur lors du téléchargement du fichier." });
                }

                // Supprimer le fichier temporaire après envoi
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Erreur lors de la suppression du fichier temporaire:', err);
                });
            });
        });

        stream.on('error', (err) => {
            console.error('Erreur lors de l\'écriture du fichier PDF:', err);
            res.status(500).json({ error: "Erreur lors de la génération du PDF." });
        });

        doc.on('error', (err) => {
            console.error('Erreur lors de la génération du PDF:', err);
            res.status(500).json({ error: "Erreur lors de la génération du PDF." });
        });

    } catch (error) {
        console.error('Erreur lors de la génération du manifeste PDF:', error);
        res.status(500).json({ error: "Erreur lors de la génération du manifeste PDF." });
    }
});
//Route pour imprimer un bordereau de manifeste
router.get("/:id/bordereau", verifyClientOrServiceClientOrAdmin, async (req, res) => {
    const { id } = req.params;
    const token = req.headers['authorization']?.split(' ')[1];
    let decoded;
    
    try {
        decoded = jwt.verify(token, process.env.JWTSECRET);
        const id_client = decoded.id;

        // Récupérer le manifeste avec les informations du client et des commandes
        const manifeste = await prisma.manifeste.findUnique({
            where: { id: parseInt(id) },
            include: {
                commandes: true,
                client: true
            },
        });

        if (!manifeste) {
            return res.status(404).json({ error: "Manifeste non trouvé." });
        }

        // Vérification des autorisations (client ou admin)
        if (manifeste.id_client !== id_client && decoded.role !== 'ADMIN' && decoded.role !== 'SERVICECLIENT') {
            return res.status(403).json({ error: "Accès non autorisé" });
        }

        // Créer un document PDF
        const doc = new PDFDocument({ margin: 50 });
        
        // Définir le nom du fichier
        const filename = `bordereau_${id}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../temp', filename);
        
        // S'assurer que le dossier temporaire existe
        if (!fs.existsSync(path.join(__dirname, '../temp'))) {
            fs.mkdirSync(path.join(__dirname, '../temp'), { recursive: true });
        }
        
        // Stream pour écrire le fichier
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        
        // Ajouter en-tête
        doc.fontSize(20).text('BORDEREAU DE LIVRAISON', { align: 'center' });
        doc.moveDown();
        
        // Informations du bordereau
        doc.fontSize(12);
        doc.text(`Référence Manifeste: ${manifeste.id}`);
        doc.text(`Date d'émission: ${new Date().toLocaleDateString('fr-FR')}`);
        doc.moveDown();
        // Informations du transporteur
        doc.fontSize(14).text('Transporteur', { underline: true });
        doc.fontSize(12);
        doc.text('Nom du transporteur: ___________________________');
        doc.text('Numéro de véhicule: ___________________________');
        doc.text('Signature chauffeur: ___________________________');
        doc.moveDown(2);
        
        // Résumé du manifeste
        doc.fontSize(14).text('Récapitulatif', { underline: true });
        doc.fontSize(12);
        doc.text(`Nombre total de colis: ${manifeste.commandes.length}`);
        doc.text(`Valeur totale: ${manifeste.commandes.reduce((total, cmd) => total + cmd.prix, 0).toFixed(2)} TND`);
        doc.moveDown(2);
        
        // Liste des colis (codes à barres)
        doc.fontSize(14).text('Liste des codes à barres', { underline: true });
        doc.moveDown();
        
        // Afficher les codes à barres en colonnes (3 colonnes)
        const codesBarres = manifeste.commandes.map(cmd => cmd.code_a_barre);
        const columns = 3;
        const colWidth = 160;
        
        for (let i = 0; i < codesBarres.length; i += columns) {
            let rowY = doc.y;
            for (let j = 0; j < columns; j++) {
                if (i + j < codesBarres.length) {
                    doc.text(codesBarres[i + j], 50 + (j * colWidth), rowY, { width: colWidth });
                }
            }
            doc.moveDown();
            if (doc.y > 700) {
                doc.addPage();
            }
        }
        doc.moveDown(2);
        
        // Section signatures et cachets
        doc.fontSize(14).text('Validation de livraison', { underline: true });
        doc.moveDown();
        
        // Tableau de signatures
        const signatureData = [
            { role: 'Préparé par', nom: '_________________', date: '_________________', signature: '' },
            { role: 'Livré par', nom: '_________________', date: '_________________', signature: '' },
            { role: 'Reçu par', nom: '_________________', date: '_________________', signature: '' }
        ];
        
        const signatureTableTop = doc.y;
        const signatureColWidths = [100, 140, 140, 100];
        let sigX = 50;
        
        // En-têtes
        doc.fontSize(11);
        ['Rôle', 'Nom', 'Date', 'Signature'].forEach((header, i) => {
            doc.text(header, sigX, signatureTableTop, { width: signatureColWidths[i], align: 'left' });
            sigX += signatureColWidths[i];
        });
        
        doc.moveTo(50, signatureTableTop + 20).lineTo(480, signatureTableTop + 20).stroke();
        
        // Données
        let sigY = signatureTableTop + 30;
        signatureData.forEach((row) => {
            sigX = 50;
            doc.text(row.role, sigX, sigY, { width: signatureColWidths[0], align: 'left' });
            sigX += signatureColWidths[0];
            doc.text(row.nom, sigX, sigY, { width: signatureColWidths[1], align: 'left' });
            sigX += signatureColWidths[1];
            doc.text(row.date, sigX, sigY, { width: signatureColWidths[2], align: 'left' });
            sigY += 30;
        });
        
        // Cadre pour le cachet
        doc.moveTo(350, sigY).rect(130, 80).stroke();
        doc.text('Cachet', 400, sigY + 35, { align: 'center' });
        
        // Pied de page
        doc.fontSize(10);
        const pageBottom = doc.page.height - 50;
        doc.text(`Document généré le ${new Date().toLocaleString('fr-FR')}`, 50, pageBottom);
        doc.text('Page 1 sur 1', 450, pageBottom, { align: 'right' });
        
        // Finaliser le document
        doc.end();
        
        // Attendre que le fichier soit écrit
        stream.on('finish', () => {
            // Envoyer le fichier
            res.download(filePath, filename, (err) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Erreur lors du téléchargement du fichier');
                }
                
                // Supprimer le fichier temporaire après envoi
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Erreur lors de la suppression du fichier temporaire:', err);
                });
            });
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors de la génération du bordereau PDF." });
    }
});

module.exports = router;