// Import necessary modules
const { verifyAdmin, verifyLogin } = require('../middleware/authMiddleware'); // Importer le middleware
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt'); // For password hashing and comparison
const jwt = require('jsonwebtoken'); // For generating JSON Web Tokens
const { PrismaClient, Prisma } = require('@prisma/client'); // Prisma ORM client

const prisma = new PrismaClient();
//login
router.post('/login', async (req, res) => {
   try{
       const { email, password } = req.body;


    const user = await prisma.utilisateur.findUnique({
        where: {email:email}
    });

    console.log({
      email: req.body.email,
    // password: bcrypt.hashSync(req.body.password, 10)
        password: bcrypt.hashSync("kharroubi123", 10)

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

//admin can creat user account
router.post('/creatAccount',verifyAdmin,  async (req, res) => {
    // Hash the password before saving it to the database
    try {
        const hashedPassword = bcrypt.hashSync(req.body.password, 10)
        const {
            nom, prenom, email, gouvernorat, ville, localite, codePostal, adresse,
            telephone1, telephone2, codeTVA, cin, role, nomShop
        } = req.body;
        const user = await prisma.utilisateur.create({
            data: {
                nom,
                prenom,
                email,
                password: hashedPassword,
                telephone1,
                telephone2,
                codeTVA,
                cin,
                role
            }
        });

        // Check the role and create associated records
        if (role === 'CLIENT') {
            await prisma.client.create({
                data: {
                    idClient: user.id,
                    nomShop,
                    gouvernorat,
                    ville,
                    localite,
                    codePostal,
                    adresse
                }
            });
        } else if (role === 'LIVREUR') {
            await prisma.livreur.create({
                data: {
                    idLivreur: user.id,
                    gouvernorat,
                    ville,
                    localite,
                    codePostal,
                    adresse
                }
            });
        } else if (role === 'ADMIN') {
            await prisma.admin.create({
                data: {
                    idAdmin: user.id
                }
            });
        } else {
            return res.status(400).send({ msg: "Invalid role specified!" });
        }

        // Success response without sensitive info
        res.status(201).send({
            message: "User created successfully",
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error creating account:', error);
        res.status(400).send({ msg: "The user cannot be created!" });
    }
})


//admin can delete user account
router.delete('/deleteUser/:id', verifyAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await prisma.utilisateur.findUnique({
            where: { id: userId }
        });
        if (!user) {
            return res.status(404).send({ msg: "Utilisateur non trouvé" });
        }
        // Delete associated records based on the user's role
        if (user.role === 'CLIENT') {
            await prisma.client.deleteMany({
                where: { idClient: userId }
            });
        } else if (user.role === 'LIVREUR') {
            await prisma.livreur.deleteMany({
                where: { idLivreur: userId }
            });
        } else if (user.role === 'ADMIN') {
            await prisma.admin.deleteMany({
                where: { idAdmin: userId }
            });
        }
        // Delete the user from the Utilisateur table
        await prisma.utilisateur.delete({
            where: { id: userId }
        });
        res.status(200).send({ msg: "Utilisateur supprimé avec succès" });
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'utilisateur:', error);
        res.status(500).send({ msg: "Erreur du serveur lors de la suppression de l'utilisateur" });
    }
});

//user can change password
router.put('/changePassword', verifyLogin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const token = req.headers['authorization']?.split(' ')[1]; // Extract the token from the Authorization header
        const decoded = jwt.verify(token, process.env.JWTSECRET); // Verify the token using the secret key

        const userId =  decoded.id; // Assuming `id` is included in JWT payload

        // Fetch user from the database
        const user = await prisma.utilisateur.findUnique({
            where: { id: userId }
        });
        if (!user) {
            return res.status(404).send({ msg: "Utilisateur non trouvé" });
        }
        // Check if current password matches
        const isPasswordValid = bcrypt.compareSync(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).send({ msg: "Mot de passe actuel incorrect" });
        }
        const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
        // Update the user's password in the database
        await prisma.utilisateur.update({
            where: { id: userId },
            data: { password: hashedNewPassword }
        });
        return res.status(200).send({ msg: "Mot de passe mis à jour avec succès" });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du mot de passe:', error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});







// Export the router module
module.exports = router;









