// Import necessary modules
const { verifyAdmin,verifyClient,verifyLivreur,verifyClientOrServiceClientOrAdmin,verifyServiceclient,verifyAdminOrServiceClient} = require("../middleware/authMiddleware"); // Importer le middleware
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
    const {nom_prioritaire, prenom_prioritaire,gouvernorat,ville,localite,codePostal,adresse,telephone1,telephone2,designation,prix,nb_article,mode_paiement,possible_ouvrir,possible_echange,remarque,code_a_barre_echange,nb_article_echange} = req.body
    // Validation des champs requis
        if (!nom_prioritaire || !prenom_prioritaire || !gouvernorat || !ville || !localite || !codePostal || !adresse || !telephone1 || !designation || !prix || !nb_article ) {
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
        etat:"EN_ATTENTE",
        mode_paiement,
        possible_ouvrir,
        possible_echange,
        remarque,
          est_imprimer:false,
          code_a_barre_echange,
          nb_article_echange,
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


    const {nom_prioritaire,prenom_prioritaire,gouvernorat,ville,localite,codePostal,adresse,telephone1,telephone2,designation,prix,nb_article,mode_paiement,possible_ouvrir,possible_echange,remarque,          code_a_barre_echange, nb_article_echange} = req.body
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
            mode_paiement,
            possible_ouvrir,
            possible_echange,
            remarque,
            code_a_barre_echange,
            nb_article_echange
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
router.get('/clientAllCommands',verifyClient, async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWTSECRET);
        const id_client = decoded.id;
        // Récupération des commandes de l'utilisateur connecté
        const commands = await prisma.commande.findMany({
            where: {id_client },
            include: {
                livreur: {
                    include: {
                        utilisateur: true
                    }
                }
            }
        });
        res.status(200).send(commands); // Réponse avec les commandes
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes:', error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});

router.get('/AllCommands',verifyAdminOrServiceClient, async (req, res) => {
    try {
        // Récupération des commandes de l'utilisateur connecté
        const commands = await prisma.commande.findMany({
            where: { id_client: req.body.id_client },
            include: {
                livreur: {
                    include: {
                        utilisateur: true
                    }
                }
            }
        });
        res.status(200).send(commands); // Réponse avec les commandes
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes:', error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});

router.get('/livreurAllCommands/:id_livreur', verifyLivreur, async (req, res) => {
    const id_livreur = parseInt(req.params.id_livreur);
    const { region } = req.query; // Récupérer le paramètre de région

    try {
        const commands = await prisma.commande.findMany({
            where: { 
                id_livreur: id_livreur,
                gouvernorat: region ? region : undefined // Filtrer par région si elle est fournie
            }
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
        const commands = await prisma.commande.findMany({
            include: {
                livreur: {
                    include: {
                        utilisateur: true,
                        gouvernorat:true
                    }
                    
                }
            }
        });
        return res.status(200).json(commands);
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes:', error);
        return res.status(500).json({ msg: "Erreur interne du serveur" });
    }
});

// setAdeleveryPerson ---------------serviceClient----------------
// request body: {id_commande:*,id_livreur:*} + Bearar token
router.post('/setaDeleveryPerson', verifyServiceclient, async (req, res) => {
    try {
        const { code_a_barre, id_livreur } = req.body;

        // Validation des entrées
        if (!code_a_barre || !id_livreur) {
            return res.status(400).json({ msg: "Code à barre et ID livreur sont requis" });
        }

        const codeBarreInt = parseInt(code_a_barre);
        const idLivreurInt = parseInt(id_livreur);
        if (isNaN(codeBarreInt) || isNaN(idLivreurInt)) {
            return res.status(400).json({ msg: "Code à barre ou ID livreur invalide" });
        }

        // Vérifier l'existence de la commande et du livreur
        const [commande, livreur] = await prisma.$transaction([
            prisma.commande.findUnique({
                where: { code_a_barre: codeBarreInt }
            }),
            prisma.livreur.findUnique({
                where: { idLivreur: idLivreurInt },
                include: { utilisateur: true }
            })
        ]);

        if (!commande) {
            return res.status(404).json({ msg: "Commande non trouvée" });
        }
        if (!livreur) {
            return res.status(404).json({ msg: "Livreur non trouvé" });
        }

        // Vérifier la correspondance des gouvernorats
        if (livreur.gouvernorat?.toLowerCase() !== commande.gouvernorat?.toLowerCase()) {
            return res.status(400).json({
                msg: `Le gouvernorat du livreur (${livreur.gouvernorat || "non spécifié"}) ne correspond pas à celui de la commande (${commande.gouvernorat || "non spécifié"})`
            });
        }

        // Mettre à jour la commande et créer l'historique dans une transaction
        const [updatedCommand, historiqueCommande] = await prisma.$transaction([
            prisma.commande.update({
                where: { code_a_barre: codeBarreInt },
                data: {
                    id_livreur: idLivreurInt,
                    etat: EtatCommande.A_ENLEVER
                }
            }),
            prisma.historiqueCommande.create({
                data: {
                    etat: EtatCommande.A_ENLEVER,
                    commentaire: `Livreur ${livreur.utilisateur.nom} ${livreur.utilisateur.prenom} affecté`,
                    commande: { connect: { code_a_barre: codeBarreInt } },
                    livreur: { connect: { idLivreur: idLivreurInt } }
                }
            })
        ]);

        console.log("Commande mise à jour : ", updatedCommand);
        console.log("Historique créé : ", historiqueCommande);

        return res.status(200).json({ msg: "Livreur affecté avec succès", commande: updatedCommand });
    } catch (error) {
        console.error("Erreur lors de l'affectation du livreur : ", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ msg: "Commande ou livreur non trouvé" });
        }
        return res.status(500).json({ msg: "Erreur interne du serveur" });
    }
});


// setCommandStatus by deelevry person
// state : must be in enum EtatCommande:
// request body: {id_livreur,id_commande:*,state:*} + Bearar token
const EtatCommandeLivreur = {
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
    RETOUR_RECU_PAYE: 'RETOUR_RECU_PAYE',
};
const EtatCommande = {
    EN_ATTENTE: 'EN_ATTENTE',
    A_ENLEVER: 'A_ENLEVER',
    ENLEVE: 'ENLEVE',
    AU_DEPOT: 'AU_DEPOT',
    RETOUR_DEPOT: 'RETOUR_DEPOT',
    EN_COURS: 'EN_COURS',
    A_VERIFIER: 'A_VERIFIER',
    LIVRES: 'LIVRES',
    LIVRES_PAYES: 'LIVRES_PAYES',
    ECHANGE: 'ECHANGE',
    RETOUR_DEFINITIF: 'RETOUR_DEFINITIF',
    RETOUR_INTER_AGENCE: 'RETOUR_INTER_AGENCE',
    RETOUR_EXPEDITEURS: 'RETOUR_EXPEDITEURS',
    RETOUR_RECU_PAYE: 'RETOUR_RECU_PAYE',
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

router.post('/modifyStatus', verifyServiceclient, async (req, res) => {
    try {
        const { code_a_barre, state, commentaire } = req.body;

        // Validate input
        if (!code_a_barre || !state) {
            return res.status(400).json({ msg: "Champs obligatoires manquants: code_a_barre et state" });
        }

        if (isNaN(parseInt(code_a_barre))) {
            return res.status(400).json({ msg: "Le code à barre doit être un nombre valide" });
        }

        // Check if the state is valid
        if (!Object.values(EtatCommande).includes(state)) {
            return res.status(400).json({ msg: `État invalide: ${state}` });
        }

        // Find the command
        const command = await prisma.commande.findUnique({
            where: { code_a_barre: parseInt(code_a_barre) }
        });

        if (!command) {
            return res.status(404).json({ msg: "Commande non trouvée" });
        }

        // Use a transaction to ensure atomicity
        const [updatedCommand, historiqueCommande] = await prisma.$transaction([
            prisma.commande.update({
                where: { code_a_barre: parseInt(code_a_barre) },
                data: { etat: state }
            }),
            prisma.historiqueCommande.create({
                data: {
                    etat: state,
                    commentaire: commentaire || "Statut modifié",
                    commande: {
                        connect: { code_a_barre: parseInt(code_a_barre) }
                    },
                    livreur: command.id_livreur ? { connect: { idLivreur: command.id_livreur } } : undefined
                }
            })
        ]);

        // Log the status change
        console.log(`Statut de la commande ${code_a_barre} modifié à ${state} par l'utilisateur ${req.user.id}`);

        // Return success response
        return res.status(200).json({
            msg: "Statut de la commande mis à jour avec succès",
            command: updatedCommand,
            history: historiqueCommande
        });

    } catch (error) {
        console.error("Erreur lors de la modification du statut : ", error);
        return res.status(500).json({ msg: "Erreur interne du serveur" });
    }
});
module.exports = router;
