const { verifyServiceclient,verifyAdmin, verifyLogin } = require('../middleware/authMiddleware'); // Importer le middleware
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client'); // Prisma ORM client

const prisma = new PrismaClient();

// Histroique de commande: 
// getById,getAll,(return all info (hist+command)join)
// Client & Delevery can only retrieve his own commands history

// Admin can retrieve all commands history just he has to provide the commannd's id
// Request: GET /getCommandHistory request.body = {commandId: Int}+ Bearer token
router.get('/', verifyLogin, async (req, res) => {
  try {
    const { code_a_barre } = req.query; // Change from req.body to req.query
    if (!code_a_barre) {
      return res.status(400).json({ error: "code_a_barre est requis" });
    }

    const command = await prisma.commande.findUnique({
      where: {
        code_a_barre: code_a_barre,
      },
    });

    if (!command) {
      return res.status(404).json({ error: "Commande n'existe pas." });
    }

    const history = await prisma.historiqueCommande.findMany({
      where: {
        id_commande: code_a_barre,
      },
      orderBy: {
        date: 'asc',
      },
    });

    res.status(200).json({ command, history });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique de la commande:', error);
    res.status(500).json({ msg: "Erreur interne du serveur" });
  }
});



/*
// Get specific command history by id
// Request: GET /getCommandHistoryById-admin request.body = {commandHistoryId: Int}+ Bearer token

router.get('getCommandHistoryById-admin', verifyLogin, async (req, res) => {
    const { commandHistoryId } = req.body;
    const history = await prisma.historiqueCommande.findUnique({
        where: {
            id: commandHistoryId
        }
    });
    if (history) {
        res.json(history);
    } else {
        res.json({ error: "Command history not found" });
    }
});


// Client service can retrieve all commands history just he has to provide the commannd's id
// Request: GET /getCommandHistory request.body = {commandId: Int}+ Bearer token
router.get('getCommandHistory-service', verifyServiceclient, async (req, res) => {
    const { commandId } = req.body;
    const command = await prisma.commande.findUnique({
        where: {
            id: commandId
        }
    });
    if (command) {
        const history = await prisma.historiqueCommande.findMany({
            where: {
                commandId: commandId
            }
        });
     res.json([command,history]);
    } else {
        res.json({ error: "Command not found" });
    }
} )

// Get specific command history by id
// Request: GET /getCommandHistoryById-service request.body = {commandHistoryId: Int}+ Bearer token
router.get('getCommandHistoryById-service', verifyServiceclient,  async (req, res) => {
    const { commandHistoryId } = req.body;
    const history = await prisma.historiqueCommande.findUnique({
        where: {
            id: commandHistoryId
        }
    });
    if (history) {
        res.json(history);
    } else {
        res.json({ error: "Command history not found" });
    }
});



// Get all commands history for client
// Request: GET /getCommandHistory-client request.body = {clientId: Int,commandId:Int}+ Bearer token
router.get('getCommandHistory-client', verifyLogin, async (req, res) => {
 const { clientId, commandId } = req.body;
 const client = await prisma.client.findUnique({
  where: {
   id: clientId
  }
 });
 if (!client) {
  res.json({ error: "Client not found" });
  return;
 }
    const command = await prisma.commande.findUnique({
        where: {
            id: commandId
        }
    });
    if (command && command.clientId == clientId) {
        const history = await prisma.historiqueCommande.findMany({
            where: {
                commandId: commandId
            }
        });
     res.json([command,history]);
    } else {
        res.json({ error: "Command not found" });
    }
});
// Get specific command history by id
// Request: GET /getCommandHistoryById-admin request.body = {clientId: Int,commandHistoryId: Int}+ Bearer token
router.get('getCommandHistoryById-client', verifyLogin, async (req, res) => {
 const { clientId, commandHistoryId } = req.body;
 const client = await prisma.client.findUnique({
  where: {
   id: clientId
  }
 });
 if (!client) {
  res.json({ error: "Client not found" });
  return;
 }
    const history = await prisma.historiqueCommande.findUnique({
        where: {
            id: commandHistoryId
        }
    });
    if (history && history.command.clientId == clientId) {
        res.json(history);
    } else {
        res.json({ error: "Command history not found" });
    }
});

// Get all commands history for delivery
// Request: GET /getCommandHistory-delivery request.body = {deliveryId: Int,commandId:Int}+ Bearer token
router.get('getCommandHistory-delivery', verifyLogin, async (req, res) => {
 const { deliveryId, commandId } = req.body;
 const delivery = await prisma.livreur.findUnique({
  where: {
   id: deliveryId
  }
 });
 if (!delivery) {
  res.json({ error: "Delivery not found" });
  return;
 }
    const command = await prisma.commande.findUnique({
        where: {
            id: commandId
        }
    });
    if (command && command.livreurId == deliveryId) {
        const history = await prisma.historiqueCommande.findMany({
            where: {
                commandId: commandId
            }
        });
     res.json([command,history]);
    } else {
        res.json({ error: "Command not found" });
    }
});
// Get specific command history by id
// Request: GET /getCommandHistoryById-delivery request.body = {deliveryId: Int,commandHistoryId: Int}+ Bearer token
router.get('getCommandHistoryById-delivery', verifyLogin, async (req, res) => {
 const { deliveryId, commandHistoryId } = req.body;
 const delivery = await prisma.livreur.findUnique({
  where: {
   id: deliveryId
  }
 });
 if (!delivery) {
  res.json({ error: "Delivery not found" });
  return;
 }
    const history = await prisma.historiqueCommande.findUnique({
        where: {
            id: commandHistoryId
        }
    });
    if (history && history.command.livreurId == deliveryId) {
        res.json(history);
    } else {
        res.json({ error: "Command history not found" });
    }
});
*/
module.exports = router;
