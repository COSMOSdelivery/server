// Import necessary modules
const { verifyAdmin } = require('../middleware/authMiddleware'); // Importer le middleware
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // For password hashing and comparison
const jwt = require('jsonwebtoken'); // For generating JSON Web Tokens
const { PrismaClient, Prisma } = require('@prisma/client'); // Prisma ORM client

const prisma = new PrismaClient();
router.post('/login', async (req, res) => {
   try{
       const { email, password } = req.body;


    const user = await prisma.utilisateur.findUnique({
        where: {email:email}
    });

    console.log({
      email: req.body.email,
     password: bcrypt.hashSync(req.body.password, 10)
  })

    const secret = process.env.JWTSECRET;
    if (!user) {
        return res.status(400).send({msg:"Utilisateur non trouvé"});
    }

    // Compare provided password with hashed password in database
    if (bcrypt.compareSync(password, user.password)) {
        // Generate a JWT token if password is correct
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            secret,                 // Secret key for signing the token
            { expiresIn: '1d' }     // Token expiration set to 1 day
        );

        // Send response with user email and generated token
        return res.status(200).send({
          nom:user.nom,
          prenom:user.prenom,
          email: user.email,
          role:user.role, //used to display the corresponding interface in the frontend
          token: token
        });
    } else {
        // Password is incorrect
        return res.status(400).send({msg:"Mot de passe incorrect!"});
    }
   } catch (error) {
       console.error('Erreur lors de la connexion:', error);
       res.status(500).send({msg:"Erreur du serveur"});
   }
});





router.post('/creatAccount',verifyAdmin,  async (req, res) => {
    // Hash the password before saving it to the database
    try {
        // Create a new user in the database with the hashed password
        const hashedPassword = bcrypt.hashSync(req.body.password, 10) 

        let user = await prisma.utilisateur.create({
            data: {
                nom: req.body.nom,
                prenom: req.body.prenom,
                nomShop: req.body.nomShop,
                email: req.body.email,
                gouvernorat: req.body.gouvernorat,
                ville: req.body.ville,
                localite: req.body.localite,
                codePostal: req.body.codePostal,
                adresse: req.body.adresse,
                telephone1: req.body.telephone1,
                telephone2: req.body.telephone2,
                codeTVA: req.body.codeTVA,
                cin: req.body.cin,
                role: req.body.role,
                password: hashedPassword
            }
        });

        // Success: send response with the new user data (without sensitive info)
        res.status(201).send({
            message: "User created successfully",
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
      console.log(error)
        res.status(400).send({msg:"The user cannot be created!"});
    }
});

// Export the router module
module.exports = router;
