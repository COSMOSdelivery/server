// Import necessary modules
const { verifyAdmin, verifyLogin } = require('../middleware/authMiddleware'); // Importer le middleware
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // For password hashing and comparison
const jwt = require('jsonwebtoken'); // For generating JSON Web Tokens
const { PrismaClient, Prisma, EtatCommande } = require('@prisma/client'); // Prisma ORM client

const prisma = new PrismaClient();

// TODO: Client create new command (ONLY CLIENT)

router.post('/command',async (req,res)=>{
  // to create a command a token should be verified
    // verify if the user is a client from jwt token
    
    const token = req.headers['authorization']?.split(' ')[1]; // Extract the token from the Authorization header
    const payload = jwt.decode(token); 
    console.log("payload:",payload);
    
    // verify client Role
    if(payload.role!="CLIENT"){
      return res.status(401).json({
        msg:"Cannot create command, clients only"
      })
    }
    // const userId =  decoded.id; // Assuming `id` is included in JWT payload

    // get the necessary fields to create a command record
    // a command should always be in "pending" state
    const {nom_Prenom_prioritaire,gouvernorat,ville,localite,codePostal,adresse,telephone1,telephone2,designation,prix,nb_article,nb_colis,mode_paiement,possible_ouvrir,possible_echange,remarque} = req.body 

    const commande = await prisma.commande.create({
      data:{
        nom_Prenom_prioritaire,
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
        id_client:payload.id,
      }
    })

    console.log("command : ",commande)

    // add the record to the HisstoriqueCommand

    const HistoriqueCommande = await prisma.historiqueCommande.create({
      data:{
        code_a_barre:commande.code_a_barre,
        etat:commande.etat,
        commentaire:commande.designation,
        commande:commande
      }
    })


    if(!HistoriqueCommande){
      return res.status(401).json({
        msg:"cannot save command in historique commande"
      })
    }

    return res.status(201).json({
      msg:"command added successfully"
    })




    // 
    
    // add the necessary fields in HistoriqueCommand table 
    // const HistoriqueCommande = await prisma.historiqueCommande.create({
    //   data:{
    //     date:dateAjout,
    //     etat,
    //     commentaire,
    //     id_commande, //get the command id after you add the command to the database
    //     id_livreur,
    //     commande,
    //     livreur
    //   }
    })

    // Fetch user from the database
    // const user = await prisma.client.findUnique({
    //     where: { id: userId }
    // });

    // const command = await prisma.command.create({
    //   data: {
         
    //   }
  // });
  
// })

// TODO: Client delete Command
router.delete('/command/:codeBarre',verifyLogin,async (req,res)=>{
    // verify if the user is a client from jwt token
     
    const token = req.headers['authorization']?.split(' ')[1]; // Extract the token from the Authorization header
    const payload = jwt.decode(token); 
    console.log("payload:",payload);
    
    // verify client Role
    if(payload.role!="CLIENT"){
      return res.status(401).json({
        msg:"Cannot create command, clients only"
      })
    }


    const deleteCommand = await prisma.commande.delete({
      where:{
         code_a_barre: parseInt(req.params.codeBarre)
      }
    })

    if(!deleteCommand){
      return res.status(400).json({
        msg:"could not delete the commmand"
      })
    }

    return res.status(200).json({
      msg:"commande deleted successfully"
    })
})

// TODO: Client modify Command
router.put('/command/:codeBarre',verifyLogin,async (req,res)=>{
    // verify if the user is a client from jwt token
    // the client shouldn't update the status of the command
     
    const token = req.headers['authorization']?.split(' ')[1]; // Extract the token from the Authorization header
    const payload = jwt.decode(token); 
    console.log("payload:",payload);
    
    // verify client Role
    if(payload.role!="CLIENT"){
      return res.status(401).json({
        msg:"Cannot create command, clients only"
      })
    }

    const {nom_Prenom_prioritaire,gouvernorat,ville,localite,codePostal,adresse,telephone1,telephone2,designation,prix,nb_article,nb_colis,mode_paiement,possible_ouvrir,possible_echange,remarque} = req.body 

    const updateCommand = await prisma.commande.update({
      where:{
        code_a_barre:req.params.codeBarre
      },
      data:{
        nom_Prenom_prioritaire,
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

    if(!updateCommand){
      return res.status(400).json({
        msg:"could not update the command"
      })
    }

    return res.status(400).json({
      msg:"Command updated successfully"
    })
})


module.exports = router;
