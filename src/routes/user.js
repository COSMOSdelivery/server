// Import necessary modules
const { verifyAdmin, verifyLogin } = require("../middleware/authMiddleware"); // Importer le middleware
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt"); // For password hashing and comparison
const jwt = require("jsonwebtoken"); // For generating JSON Web Tokens
const { PrismaClient } = require("@prisma/client"); // Prisma ORM client

const prisma = new PrismaClient();
//login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.utilisateur.findUnique({
            where: { email: email },
        });

        console.log({
            email: req.body.email,
            password: bcrypt.hashSync(req.body.password, 10),
        });

        const secret = process.env.JWTSECRET;
        if (!user) {
            return res.status(400).send({ msg: "Utilisateur non trouvé" });
        }

        // Compare provided password with hashed password in database
        if (bcrypt.compareSync(password, user.password)) {
            // Generate a JWT token if password is correct
            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                },
                secret, // Secret key for signing the token
                { expiresIn: "1d" } // Token expiration set to 1 day
            );

            // Send response with user email and generated token
            return res.status(200).send({
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                role: user.role, //used to display the corresponding interface in the frontend
                token: token,
            });
        } else {
            // Password is incorrect
            return res.status(400).send({ msg: "Mot de passe incorrect!" });
        }
    } catch (error) {
        console.error("Erreur lors de la connexion:", error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});

//admin can creat user account
router.post("/creatAccount", verifyAdmin, async (req, res) => {
    // Hash the password before saving it to the database
    try {
        const hashedPassword = bcrypt.hashSync(req.body.password, 10);
        const {
            nom,
            prenom,
            email,
            gouvernorat,
            ville,
            localite,
            codePostal,
            adresse,
            telephone1,
            telephone2,
            codeTVA,
            cin,
            role,
            nomShop,
            fraisLivraison,
            fraisRetour
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
                role,
            },
        });

        // Check the role and create associated records
        if (role === "CLIENT") {
            await prisma.client.create({
                data: {
                    idClient: user.id,
                    nomShop,
                    gouvernorat,
                    ville,
                    localite,
                    codePostal,
                    adresse,
                    fraisLivraison,
                    fraisRetour
                },
            });
        } else if (role === "LIVREUR") {
            await prisma.livreur.create({
                data: {
                    idLivreur: user.id,
                    gouvernorat
                },
            });
        } else if (role === "ADMIN") {
            await prisma.admin.create({
                data: {
                    idAdmin: user.id,
                },
            });
        } else if (role === "SERVICECLIENT") {
            await prisma.serviceclient.create({
                data: {
                    idServiceclient: user.id,
                },
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
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Error creating account:", error);
        res.status(400).send({ msg: "The user cannot be created!" });
    }
});

//admin can delete user account
router.delete("/deleteUser/:id", verifyAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await prisma.utilisateur.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).send({ msg: "Utilisateur non trouvé" });
        }
        // Delete associated records based on the user's role
        if (user.role === "CLIENT") {
            await prisma.client.deleteMany({
                where: { idClient: userId },
            });
        } else if (user.role === "LIVREUR") {
            await prisma.livreur.deleteMany({
                where: { idLivreur: userId },
            });
        } else if (user.role === "ADMIN") {
            await prisma.admin.deleteMany({
                where: { idAdmin: userId },
            });
        } else if (user.role === "SERVICECLIENT") {
            await prisma.serviceclient.deleteMany({
                where: { idServiceclient: userId },
            });
        }

        // Delete the user from the Utilisateur table
        await prisma.utilisateur.delete({
            where: { id: userId },
        });
        res.status(200).send({ msg: "Utilisateur supprimé avec succès" });
    } catch (error) {
        console.error("Erreur lors de la suppression de l'utilisateur:", error);
        res.status(500).send({
            msg: "Erreur du serveur lors de la suppression de l'utilisateur",
        });
    }
});

//user can change password
router.put("/changePassword", verifyLogin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const token = req.headers["authorization"]?.split(" ")[1]; // Extract the token from the Authorization header
        const decoded = jwt.verify(token, process.env.JWTSECRET); // Verify the token using the secret key

        const userId = decoded.id; // Assuming `id` is included in JWT payload

        // Fetch user from the database
        const user = await prisma.utilisateur.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).send({ msg: "Utilisateur non trouvé" });
        }
        // Check if current password matches
        const isPasswordValid = bcrypt.compareSync(
            currentPassword,
            user.password
        );
        if (!isPasswordValid) {
            return res
                .status(400)
                .send({ msg: "Mot de passe actuel incorrect" });
        }
        const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
        // Update the user's password in the database
        await prisma.utilisateur.update({
            where: { id: userId },
            data: { password: hashedNewPassword },
        });
        return res
            .status(200)
            .send({ msg: "Mot de passe mis à jour avec succès" });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du mot de passe:", error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});

// admin can update user's password
router.put("/updatePassword/:id", verifyAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await prisma.utilisateur.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).send({ msg: "Utilisateur non trouvé" });
        }
        const { newPassword } = req.body;
        const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
        // Update the user's password in the database
        await prisma.utilisateur.update({
            where: { id: userId },
            data: { password: hashedNewPassword },
        });
        return res
            .status(200)
            .send({ msg: "Mot de passe mis à jour avec succès" });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du mot de passe:", error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});

// Update only admin , use wajdi's(heritage) approach
// champ role reste
router.put("/updateUser/:id", verifyAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await prisma.utilisateur.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).send({ msg: "Utilisateur non trouvé" });
        }
        const {
            nom,
            prenom,
            email,
            password,
            gouvernorat,
            ville,
            localite,
            codePostal,
            adresse,
            telephone1,
            telephone2,
            codeTVA,
            cin,
            role,
            nomShop,
            fraisLivraison,
            fraisRetour
        } = req.body;
        // Update the user's information in the Utilisateur table
        if(password)
        {
            const hashedNewPassword = bcrypt.hashSync(password, 10);
            await prisma.utilisateur.update({
                where: { id: userId },
                data: {
                    nom,
                    prenom,
                    email,
                    password: hashedNewPassword,
                    telephone1,
                    telephone2,
                    codeTVA,
                    cin,
                },
            });
        }
        else
        {
            await prisma.utilisateur.update({
                where: { id: userId },
                data: {
                    nom,
                    prenom,
                    email,
                    telephone1,
                    telephone2,
                    codeTVA,
                    cin,
                },
            });

        }
        if(role) {
            // Update associated records based on the user's role
            if (role === "CLIENT") {
                await prisma.client.update({
                    where: {idClient: userId},
                    data: {
                        nomShop,
                        gouvernorat,
                        ville,
                        localite,
                        codePostal,
                        adresse,
                        fraisLivraison,
                        fraisRetour
                    },
                });
            } else if (role === "LIVREUR") {
                await prisma.livreur.update({
                    where: {idLivreur: userId},
                    data: {
                        gouvernorat
                    },
                });
            }
        }
        res.status(200).send({ msg: "Utilisateur mis à jour avec succès" });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'utilisateur:", error);
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});

// get all users ,check for the role to know which table to query
router.get("/allUsers", verifyAdmin, async (req, res) => {
    try {
        let allUsers = [];

        // Get all users
        const users = await prisma.utilisateur.findMany();
        console.log(users);

        // Use Promise.all to handle asynchronous mapping
        allUsers = await Promise.all(
            users.map(async (user) => {
                if (user.role === "CLIENT") {
                    const client = await prisma.client.findUnique({
                        where: { idClient: user.id },
                    });
                    return { ...user, ...client };
                } else if (user.role === "LIVREUR") {
                    const livreur = await prisma.livreur.findUnique({
                        where: { idLivreur: user.id },
                    });
                    return { ...user, ...livreur };
                } else if (user.role === "ADMIN") {
                    const admin = await prisma.admin.findUnique({
                        where: { idAdmin: user.id },
                    });
                    return { ...user, ...admin };
                } else if (user.role === "SERVICECLIENT") {
                    const serviceclient = await prisma.serviceclient.findUnique({
                        where: { idServiceclient: user.id },
                    });
                    return { ...user, ...serviceclient };
                }
                return user; // Return the user if no matching role is found
            })
        );

        res.status(200).send(allUsers);
    } catch (error) {
        console.error(
            "Erreur lors de la récupération des utilisateurs:",
            error
        );
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});


// get all clients ,check for the role to know which table to query
router.get("/allClients", verifyAdmin, async (req, res) => {
    try {
        let allUsers = [];

        const users = await prisma.utilisateur.findMany({
            where: {client: {
                    isNot: null,
                },},
        });
        console.log(users);
        allUsers = await Promise.all(
            users.map(async (user) => {
                if (user.role === "CLIENT") {
                    const client = await prisma.client.findUnique({
                        where: { idClient: user.id },
                    });
                    return { ...user, ...client };
                }
            })
        );
        res.status(200).send(allUsers);
    } catch (error) {
        console.error(
            "Erreur lors de la récupération des clients:",
            error
        );
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});


// get all Livreurs ,check for the role to know which table to query
router.get("/allLivreurs", verifyAdmin, async (req, res) => {
    try {
        let allUsers = [];

        const users = await prisma.utilisateur.findMany({
            where: {livreur: {
                    isNot: null,
                },},
        });
        console.log(users);
        allUsers = await Promise.all(
            users.map(async (user) => {
                if (user.role === "LIVREUR") {
                    const livreur = await prisma.livreur.findUnique({
                        where: { idLivreur: user.id },
                    });
                    return { ...user, ...livreur };
                }
            })
        );
        res.status(200).send(allUsers);
    } catch (error) {
        console.error(
            "Erreur lors de la récupération des livreurs:",
            error
        );
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});
// get all ServiceClients ,check for the role to know which table to query
router.get("/allServiceClients", verifyAdmin, async (req, res) => {
    try {
        let allUsers = [];

        const users = await prisma.utilisateur.findMany({
            where: {serviceclient: {
                    isNot: null,
                },},
        });
        console.log(users);
        allUsers = await Promise.all(
            users.map(async (user) => {
                if (user.role === "SERVICECLIENT") {
                    const serviceclient = await prisma.serviceclient.findUnique({
                        where: { idServiceclient: user.id },
                    });
                    return { ...user, ...serviceclient };
                }
            })
        );
        res.status(200).send(allUsers);
    } catch (error) {
        console.error(
            "Erreur lors de la récupération des serviceclients:",
            error
        );
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});

// get all Admins ,check for the role to know which table to query
router.get("/allAdmins", verifyAdmin, async (req, res) => {
    try {
        let allUsers = [];

        const users = await prisma.utilisateur.findMany({
            where: {admin: {
                    isNot: null,
                },},
        });
        console.log(users);
        allUsers = await Promise.all(
            users.map(async (user) => {
                if (user.role === "ADMIN") {
                    const admin = await prisma.admin.findUnique({
                        where: { idAdmin: user.id },
                    });
                    return { ...user, ...admin };
                }
            })
        );
        res.status(200).send(allUsers);
    } catch (error) {
        console.error(
            "Erreur lors de la récupération des admins:",
            error
        );
        res.status(500).send({ msg: "Erreur du serveur" });
    }
});
// Export the router module
module.exports = router;








