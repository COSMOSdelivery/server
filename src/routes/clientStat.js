const express = require('express');
const router = express.Router();
const { PrismaClient, EtatCommande} = require('@prisma/client');
const { verifyClient } = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken"); // Importer le middleware

const prisma = new PrismaClient();

// Route pour obtenir le nombre de commandes pour tous les états d'un client spécifique
router.get('/', verifyClient, async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization
        let decoded;
        decoded = jwt.verify(token, process.env.JWTSECRET);
        const id_client = decoded.id; // ID du client extrait du token

        // Récupérer tous les états possibles de l'enum EtatCommande
        const etats = Object.values(EtatCommande); // Convertir l'enum en tableau

        // Obtenir le nombre de commandes pour chaque état et le sum de prix
        const results = {};

        for (const etat of etats) {
            const count = await prisma.commande.count({
                where: {
                    id_client: id_client,
                    etat: etat
                }
            });
            const sumPrix = await prisma.commande.aggregate({
                where: {
                    id_client: id_client,
                    etat: etat
                },
                _sum: {
                    prix: true // Calculer la somme des prix pour cet état
                }
            });
            results[etat] = {
                count: count, // Nombre de commandes
                totalPrix: sumPrix._sum.prix || 0 // Cumul des prix (0 si aucune commande)
            };        }

        // Retourner les résultats
        return res.status(200).json({ results  });
    } catch (error) {
        console.error("Erreur : ", error);
        return res.status(500).json({ msg: "Erreur interne du serveur" });
    }
});

module.exports = router;