// Import necessary modules
const { verifyAdmin,verifyClient, verifyLogin, verifyLivreur} = require("../middleware/authMiddleware"); // Importer le middleware
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // For password hashing and comparison
const jwt = require('jsonwebtoken'); // For generating JSON Web Tokens
const { PrismaClient } = require('@prisma/client'); // Prisma ORM client

const prisma = new PrismaClient();

// TODO: Client create new command (ONLY CLIENT)

router.post('/',verifyClient,async (req,res)=>{
    try {
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization
    const decoded = jwt.verify(token, process.env.JWTSECRET);
    req.userId = decoded.id;

    // get the necessary fields to create a command record
    // a command should always be in "pending" state
    const {nom_prioritaire, prenom_prioritaire,gouvernorat,ville,localite,codePostal,adresse,telephone1,telephone2,designation,prix,nb_article,nb_colis,mode_paiement,possible_ouvrir,possible_echange,remarque} = req.body
    // Validation des champs requis
        if (!nom_prioritaire || !prenom_prioritaire || !gouvernorat || !ville || !localite || !codePostal || !adresse || !telephone1 || !designation || !prix || !nb_article || !nb_colis || !mode_paiement) {
            return res.status(400).json({ msg: "Champs obligatoires manquants" });
        }
    const commande = await prisma.commande.create({
      data:{
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
        nb_colis,
        etat:"EN_ATTENTE",
        mode_paiement,
        possible_ouvrir,
        possible_echange,
        remarque,
        id_client:req.userId,
      }
    })

    console.log("command : ",commande)

    // add the record to the HisstoriqueCommand

    const historiqueCommande = await prisma.historiqueCommande.create({
      data:{
        etat:commande.etat,
          //id_commande :commande.code_a_barre,
          //id_livreur: null, // Pas de livreur pour une commande initiale
          commentaire: "Commande initialisée",
          commande: {
              connect: { code_a_barre: commande.code_a_barre } // Utilisation de "connect" pour lier une commande existante via son code_a_barre
          }
      }
    })
    console.log("Historique créé : ", historiqueCommande);
    return res.status(201).json({
        msg: "Commande ajoutée avec succès"
    })
    } catch (error) {
        console.error("Erreur : ", error);
        return res.status(500).json({ msg: "Erreur interne du serveur" });
    }
    })

// TODO: Client delete Command
router.delete('/:codeBarre',verifyClient,async (req,res)=>{
    try {
    const deleteCommand = await prisma.commande.delete({
        where:{
            code_a_barre: parseInt(req.params.codeBarre)
        }
    })
    if(!deleteCommand){
        return res.status(400).json({
            msg: "Impossible de supprimer la commande"
        })
    }
    return res.status(200).json({
        msg: "Commande supprimée avec succès"
    })
    } catch (error) {
        console.error(error);

        // Si la commande n'est pas trouvée, Prisma lancera une erreur
        if (error.code === 'P2025') {
            return res.status(404).json({
                msg: "Commande non trouvée"
            });
        }
        // Autres erreurs
        return res.status(500).json({
            msg: "Une erreur est survenue lors de la suppression de la commande"
        });
    }
});

// TODO: Client modify Command
router.put('/:codeBarre',verifyClient,async (req,res)=>{


    const {nom_prioritaire,prenom_prioritaire,gouvernorat,ville,localite,codePostal,adresse,telephone1,telephone2,designation,prix,nb_article,nb_colis,mode_paiement,possible_ouvrir,possible_echange,remarque} = req.body
    try {
    const updateCommand = await prisma.commande.update({
        where:{
            code_a_barre:parseInt(req.params.codeBarre)
        },
        data:{
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
            nb_colis,
            mode_paiement,
            possible_ouvrir,
            possible_echange,
            remarque,
        }
    })
        // Vérification si la commande a été mise à jour
        if (!updateCommand) {
            return res.status(400).json({
                msg: "La commande n'a pas pu être mise à jour"
            });
        }
        // Réponse réussie
        return res.status(200).json({
            msg: "Commande mise à jour avec succès"
        });
    } catch (error) {
        console.error(error);
        // Si la commande n'est pas trouvée, Prisma lancera une erreur
        if (error.code === 'P2025') {
            return res.status(404).json({
                msg: "Commande non trouvée"
            });
        }
        return res.status(500).json({
            msg: "Erreur lors de la mise à jour de la commande"
        });
    }
})


router.get('/clientAllCommands', verifyClient, async (req, res) => {
    try {
        // Récupération des commandes de l'utilisateur connecté
        const commands = await prisma.commande.findMany({
            where: { id_client: req.body.id_client }
        });
        res.status(200).send(commands); // Réponse avec les commandes
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes:', error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});

// getAllCommands-livreur
router.get('/livreurAllCommands',verifyLivreur, async (req, res) => {
    console.log(req.body.id_livreur)
    try {
        const commands = await prisma.commande.findMany({
            where: { id_livreur: req.body.id_livreur }
        });
        res.status(200).send(commands);
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes:', error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});

// getAllCommands- serviceClient/admin
router.get('/allCommands', verifyAdmin, async (req, res) => {
    try {
        const commands = await prisma.commande.findMany();
        res.status(200).send(commands);
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes:', error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});

// setAdeleveryPerson ---------------serviceClient----------------
// request body: {id_commande:*,id_livreur:*} + Bearar token
router.post('/setAdeleveryPerson',verifyAdmin, async (req, res) => {
    try {
        const { code_a_barre, id_livreur } = req.body;
        const updateCommand = await prisma.commande.update({
        where:{
            code_a_barre:parseInt(code_a_barre)
        },
        data: {id_livreur:parseInt(id_livreur),
        etat:"EN_COURS"}
    })
    // Vérification si la commande a été mise à jour
    if (!updateCommand) {
        return res.status(400).json({
            msg: "Le livreur ne peux pas être affecter"
        });
    }
        const historiqueCommande = await prisma.historiqueCommande.create({
            data:{
                etat: "EN_COURS",
                commentaire: "En cours de livraison",
                commande: {
                    connect: { code_a_barre: code_a_barre } // Utilisation de "connect" pour lier une commande existante via son code_a_barre
                },
                livreur: {
                    connect: {idLivreur: id_livreur } // Utilisation de "connect" pour lier une commande existante via son code_a_barre
                }
            }
        })
        console.log("Historique créé : ", historiqueCommande);
        return res.status(201).json({
            msg: "Livreur affecter avec succès"
        })
    } catch (error) {
        console.error("Erreur : ", error);
        return res.status(500).json({ msg: "Erreur interne du serveur" });
    }
});


// setCommandStatus by deelevry person
// state : must be in enum EtatCommande:
// request body: {id_livreur,id_commande:*,state:*} + Bearar token
const EtatCommande = {
    EN_ATTENTE: 'EN_ATTENTE',
    AU_DEPOT: 'AU_DEPOT',
    EN_COURS: 'EN_COURS',
    A_VERIFIER: 'A_VERIFIER',
    LIVRES: 'LIVRES',
    LIVRES_PAYES: 'LIVRES_PAYES',
    ECHANGE: 'ECHANGE',
    REMBOURSES: 'REMBOURSES',
    RETOUR_DEFINITIF: 'RETOUR_DEFINITIF',
    RETOUR_INTER_AGENCE: 'RETOUR_INTER_AGENCE',
    RETOUR_EXPEDITEURS: 'RETOUR_EXPEDITEURS',
    RETOUR_RECU_PAYES: 'RETOUR_RECU_PAYES',
};

router.post('/setCommandStatus',verifyLivreur, async (req, res) => {
    try {
        const { id_livreur,code_a_barre,commentaire, state } = req.body;
        let command = await prisma.commande.findUnique({
            where: { code_a_barre: code_a_barre }
        });
        if (!command) {
            return res.status(404).send({msg:"Command n'existe pas."});
        }
        if (command.id_livreur !== id_livreur) {
            return res.status(403).send({msg: "Permission refusée. Vous n'êtes pas le livreur."});
        }
        if (!Object.values(EtatCommande).includes(state)) {
            return res.status(400).json({error: `Valeur d'état invalide : ${state}`});
        }
        command = await prisma.commande.update({
            where: { code_a_barre: code_a_barre },
            data: { etat: state }
        });
        const histCommand= await prisma.historiqueCommande.create({
            data:{
                etat: state,
                commentaire: commentaire,
                commande: {
                    connect: { code_a_barre: code_a_barre } // Utilisation de "connect" pour lier une commande existante via son code_a_barre
                },
                livreur: {
                    connect: {idLivreur: id_livreur } // Utilisation de "connect" pour lier une commande existante via son code_a_barre
                }
            }
        });
        res.status(200).send({command,histCommand});

    } catch (error) {
        console.error('Erreur lors de la mise à jour de la commande:', error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});




module.exports = router;
