// Import necessary modules
const { verifyAdmin, verifyLogin } = require('../middleware/authMiddleware'); // Importer le middleware
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // For password hashing and comparison
const jwt = require('jsonwebtoken'); // For generating JSON Web Tokens
const { PrismaClient, Prisma } = require('@prisma/client'); // Prisma ORM client

const prisma = new PrismaClient();

// getAllCommands-client
// Filring commands from the front-end
// request body: id_user:*,role:*} + Bearar token
router.get('/getAllCommands-client', verifyLogin, async (req, res) => {
 try {
  if (req.role !== 'CLIENT') { 
   return res.status(403).send({msg:"Permission denied. You are not a client."});
  }
        const commands = await prisma.commande.findMany({
            where: { id_client: req.id_user }
        });
        res.status(200).send(commands);
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes:', error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});

// getAllCommands-livreur
router.get('/getAllCommands-livreur', verifyLogin, async (req, res) => {
 try {
  if (req.role !== 'LIVREUR') { 
   return res.status(403).send({msg:"Permission denied. You are not a delivery person."});
  }
        const commands = await prisma.commande.findMany({
            where: { id_livreur: req.id_user }
        });
        res.status(200).send(commands);
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes:', error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});
// getAllCommands-admin
router.get('/getAllCommands-admin', verifyAdmin, async (req, res) => {
    try {
        const commands = await prisma.commande.findMany();
        res.status(200).send(commands);
    } catch (error) {
        console.error('Erreur lors de la récupération des commandes:', error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});

// setAdeleveryPerson
// request body: {id_commande:*,id_livreur:*} + Bearar token
router.put('/setAdeleveryPerson', verifyAdmin, async (req, res) => {
    try {
     const { id_commande, id_livreur } = req.body;
     const command =  await prisma.historiqueCommande.findOne({ where: { id: id_commande } });
     if (!command) { 
      return res.status(404).send({msg:"Command not found in history."});
     }
        const histCommand = await prisma.historiqueCommande.update({
            where: { id: id_commande },
            data: { ...command,id_livreur: id_livreur }
        });
        res.status(200).send(histCommand);
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la commande:', error);
        res.status(500).send({ msg: "Erreur du serveur" });
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

router.put('/setCommandStatus', verifyLogin, async (req, res) => {
    try {
        const { id_livreur,id_commande,commentaire, state } = req.body;
     let command = await prisma.historiqueCommande.findOne({
      where: { id: id_commande }
     });
     if (!command) { 
      return res.status(404).send({msg:"Command not found."});
     }
     if (command.id_livreur !== id_livreur) { 
      return res.status(403).send({msg:"Permission denied. You are not the delivery person."});
     }
     if (!Object.values(EtatCommande).includes(state)) {
    return res.status(400).json({ error: `Invalid etat value: ${state}` });
     }
         command = await prisma.commande.update({
            where: { id: id_commande },
            data: { etat: state }
         });
     const histCommand= await prisma.historiqueCommande.create({
      data: {
       id_commande: id_commande,
       etat: state,
       id_livreur: id_livreur,
       commentaire:commentaire
      }
     });
        res.status(200).send({command,histCommand});
    
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la commande:', error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});