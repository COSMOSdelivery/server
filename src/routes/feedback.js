// Import necessary modules
const { verifyClient, verifyLogin, verifyAdminOrServiceClient} = require("../middleware/authMiddleware"); // Importer le middleware
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client"); // Prisma ORM client
const prisma = new PrismaClient();

//le client creer une feedback
router.post('/',verifyClient,  async (req, res) => {
    const {titre, commentaire, id_commande} = req.body;
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization
    const decoded = jwt.verify(token, process.env.JWTSECRET);
    const id_client= decoded.id;
    if (!commentaire || !titre || !id_commande) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    try {
        const feedback = await prisma.feedbackCommande.create({
            data: {
                titre,
                commentaire,
                id_commande,
                id_client,
            },
        });
        res.status(201).json(feedback);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la création du feedback.' });
    }
});


// Obtenir tous les feedbacks
router.get('/', verifyClient, async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWTSECRET);
        const id_client = decoded.id;
        console.log("Récupération des manifestes pour le client:", id_client); // Log pour déboguer

        const feedbacks = await prisma.feedbackCommande.findMany({
            where: { id_client },
        });
        res.status(200).json(feedbacks);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des feedbacks.' });
    }
});

router.get("/getAllFeedbacks", verifyAdminOrServiceClient, async (req, res) => {
    try {
        const feedbacks = await prisma.feedbackCommande.findMany({
            include: {
                client: {
                    select: {
                        idClient: true, // Ensure the relation key is included
                        nomShop: true,
                        gouvernorat: true,
                        ville: true,
                        localite: true,
                        codePostal: true,
                        adresse: true,
                        utilisateur: {
                            select: {
                                nom: true,
                                prenom: true,
                                email: true,
                                telephone1: true,
                            },
                        },
                    },
                },
                commande: {
                    select: {
                        code_a_barre: true,
                        designation: true,
                        prix: true,
                        etat: true,
                    },
                },
            },
            orderBy: { dateAjout: "desc" },
        });

        // CORRECTION: Ajouter cette ligne qui manquait
        res.status(200).json(feedbacks);
        
    } catch (error) {
        console.error("Erreur lors de la récupération des feedbacks:", error);
        res.status(500).json({ error: "Erreur lors de la récupération des feedbacks." });
    }
});


// Obtenir tous les feedbacks pour une commande donnée
router.get('/commande/:idCommande',verifyLogin, async (req, res) => {
    const { idCommande } = req.params;

    try {
        const feedbacks = await prisma.feedbackCommande.findMany({
            where: { id_commande: parseInt(idCommande) },
        });
        res.status(200).json(feedbacks);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des feedbacks.' });
    }
});

// Obtenir un feedback spécifique par ID
router.get('/:id', verifyLogin,async (req, res) => {
    const { id } = req.params;

    try {
        const feedback = await prisma.feedbackCommande.findUnique({
            where: { id: parseInt(id) },
        });

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback non trouvé.' });
        }

        res.status(200).json(feedback);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération du feedback.' });
    }
});

// Mettre à jour un feedback
router.put('/:id',verifyLogin, async (req, res) => {
    const { id } = req.params;
    const { titre, commentaire } = req.body;

    try {
        const feedback = await prisma.feedbackCommande.update({
            where: { id: parseInt(id) },
            data: { titre, commentaire },
        });
        res.status(200).json(feedback);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la mise à jour du feedback.' });
    }
});

// Supprimer un feedback
router.delete('/:id', verifyLogin,async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.feedbackCommande.delete({
            where: { id: parseInt(id) },
        });
        res.status(200).json({ message: 'Feedback supprimé avec succès.' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la suppression du feedback.' });
    }
});

module.exports = router;
