const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const {verifyClient, verifyLogin} = require("../middleware/authMiddleware");
const prisma = new PrismaClient();

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
router.delete("/:id",verifyClient, async (req, res) => {
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

// Route pour modifier un manifeste (pour client)
router.put("/:id",verifyClient, async (req, res) => {
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
router.get("/",verifyClient, async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization
    let decoded;
    decoded = jwt.verify(token, process.env.JWTSECRET);
    const id_client = decoded.id; // ID du client extrait du token

    try {
        // Récupérer tous les manifestes du client
        const manifestes = await prisma.manifeste.findMany({
            where: { id_client },
            include: {
                commandes: true, // Inclure les détails des commandes associées
            },
        });

        res.status(200).json(manifestes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors de la récupération des manifestes." });
    }
});

// Route pour récupérer une manifestes d'un client
router.get("/:id",verifyClient, async (req, res) => {
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

module.exports = router;