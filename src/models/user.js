// Import necessary modules
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // For password hashing and comparison
const jwt = require('jsonwebtoken'); // For generating JSON Web Tokens
const { PrismaClient, Prisma } = require('@prisma/client'); // Prisma ORM client

const prisma = new PrismaClient();

router.post('/login', async (req, res) => {
    const user = await prisma.utilisateur.findUnique({
        where: {
            email: req.body.email,
        }
    });

    console.log({
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password, 10)
  })
    
    const secret = process.env.JWTSECRET; 

    
    // Compare provided password with hashed password in database
    if (user && bcrypt.compareSync(req.body.password, user.password)) {
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
        res.status(200).send({
          nom:user.nom,
          prenom:user.prenom, 
          email: user.email, 
          role:user.role, //used to display the corresponding interface in the frontend
          token: token 
        });
    } else {
        // Password is incorrect
        res.status(400).send('Password is wrong!');
    }
});





router.post('/register',  async (req, res) => {
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
                gouvernerat: req.body.gouvernerat,
                ville: req.body.ville,
                localite: req.body.localite,
                codePostal: req.body.codePostal,
                addresse: req.body.addresse,
                telephone1: req.body.telephone1,
                telephone2: req.body.telephone2,
                codeTVA: req.body.codeTVA,
                cin: req.body.cin,
                role: req.body.Role,
                password: hashedPassword,
                dateInscription:req.body.dateInscription
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
        res.status(400).send('The user cannot be created!');
    }
});

// Export the router module
module.exports = router;
