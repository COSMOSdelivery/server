// Import necessary modules
const { verifyAdmin, verifyLogin,verifyAdminOrServiceClient } = require("../middleware/authMiddleware"); // Importer le middleware
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt"); // For password hashing and comparison
const jwt = require("jsonwebtoken"); // For generating JSON Web Tokens
const { PrismaClient } = require("@prisma/client"); // Prisma ORM client
const crypto = require('crypto');
const nodemailer = require('nodemailer'); 
const multer = require("multer");
const path = require("path");

// Configuration de Multer pour stocker les fichiers dans un dossier "uploads"
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Dossier où les fichiers seront stockés
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname)); // Nom de fichier unique
  },
});

// Filtrer les fichiers pour n'accepter que les images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Seules les images sont autorisées !"), false);
  }
};

// Créer une instance de Multer
const upload = multer({ storage, fileFilter });
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

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
router.post("/creatAccount",verifyAdminOrServiceClient, async (req, res) => {
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
router.delete("/deleteUser/:id",verifyAdminOrServiceClient, async (req, res) => {
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
router.get("/allClients", verifyAdminOrServiceClient, async (req, res) => {
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
router.get("/allLivreurs",verifyAdminOrServiceClient, async (req, res) => {
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

// Fonction pour envoyer un email avec l'OTP
async function sendOTPEmail(email, otp) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Code de réinitialisation de mot de passe",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Réinitialisation de votre mot de passe</h2>
                <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
                <p>Voici votre code de vérification:</p>
                <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; text-align: center; letter-spacing: 5px; font-weight: bold;">
                    ${otp}
                </div>
                <p>Ce code est valable pendant 10 minutes.</p>
                <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.</p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
}
router.get("/profile", verifyLogin, async (req, res) => {
    try {
        // Debug log
        console.log("Profile request received");
        console.log("Auth header:", req.headers.authorization);
        console.log("User from token:", req.user);

        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated properly"
            });
        }

        const userId = req.user.id;

        // Debug log
        console.log("Fetching user with ID:", userId);

        const user = await prisma.utilisateur.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Debug log
        console.log("User found:", user);

        let roleData = {};
        if (user.role) {
            switch (user.role) {
                case "CLIENT":
                    roleData = await prisma.client.findUnique({
                        where: { idClient: userId }
                    });
                    break;
                case "LIVREUR":
                    roleData = await prisma.livreur.findUnique({
                        where: { idLivreur: userId }
                    });
                    break;
                case "ADMIN":
                    roleData = await prisma.admin.findUnique({
                        where: { idAdmin: userId }
                    });
                    break;
                case "SERVICECLIENT":
                    roleData = await prisma.serviceclient.findUnique({
                        where: { idServiceclient: userId }
                    });
                    break;
            }
        }

        const profileData = {
            ...user,
            ...roleData
        };

        // Debug log
        console.log("Sending profile data:", profileData);

        res.status(200).json({
            success: true,
            profile: profileData
        });

    } catch (error) {
        console.error("Profile fetch error:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        // Vérifier si l'utilisateur existe
        const user = await prisma.utilisateur.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(200).send({
                success: true,
                message: "Si l'adresse email est associée à un compte, un code de réinitialisation sera envoyé.",
            });
        }

        // Générer un OTP de 6 chiffres
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Sauvegarder l'OTP dans la base de données
        await prisma.utilisateur.update({
            where: { id: user.id },
            data: {
                resetPasswordOtp: otp,
                resetPasswordOtpExpiry: otpExpiry,
            },
        });

        // Envoyer l'OTP par email
        await sendOTPEmail(email, otp);

        res.status(200).send({
            success: true,
            message: "Si l'adresse email est associée à un compte, un code de réinitialisation sera envoyé.",
        });
    } catch (error) {
        console.error("Erreur lors de la demande de réinitialisation:", error);
        res.status(500).send({ success: false, message: "Erreur du serveur" });
    }
});
// Route pour vérifier l'OTP et réinitialiser le mot de passe
router.post("/reset-password", async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        // Validation basique
        if (!email || !newPassword) {
            return res.status(400).send({
                success: false,
                message: "Tous les champs sont requis",
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).send({
                success: false,
                message: "Le mot de passe doit contenir au moins 8 caractères",
            });
        }

        // Vérifier si l'utilisateur existe
        const user = await prisma.utilisateur.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(400).send({
                success: false,
                message: "Informations de réinitialisation invalides",
            });
        }
        // Hasher le nouveau mot de passe
        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        // Mettre à jour le mot de passe et réinitialiser les champs OTP
        await prisma.utilisateur.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordOtp: null,
                resetPasswordOtpExpiry: null,
            },
        });

        res.status(200).send({
            success: true,
            message: "Mot de passe réinitialisé avec succès",
        });
    } catch (error) {
        console.error("Erreur lors de la réinitialisation du mot de passe:", error);
        res.status(500).send({ success: false, message: "Erreur du serveur" });
    }
});
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;

        // Vérifier si l'utilisateur existe
        const user = await prisma.utilisateur.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(400).json({ message: "Utilisateur non trouvé" });
        }

        // Vérifier si l'OTP est correct et non expiré
        if (user.resetPasswordOtp !== otp || !user.resetPasswordOtpExpiry || new Date() > new Date(user.resetPasswordOtpExpiry)) {
            return res.status(400).json({ message: "OTP invalide ou expiré" });
        }

        // Réinitialiser les champs OTP après validation
        await prisma.utilisateur.update({
            where: { email },
            data: {
                resetPasswordOtp: null,
                resetPasswordOtpExpiry: null,
            },
        });

        return res.status(200).json({ message: "OTP vérifié avec succès" });
    } catch (error) {
        console.error("Erreur lors de la vérification de l'OTP :", error);
        return res.status(500).json({ message: "Erreur serveur" });
    }
});
router.post(
    "/upload-profile-image",
    verifyLogin,
    upload.single("image"),
    async (req, res) => {
        try {
            const userId = req.user.id; // Get ID from authenticated user
            const filePath = req.file.path; // Get uploaded file path

            // Convert backslashes to forward slashes for URL compatibility
            const normalizedPath = filePath.replace(/\\/g, '/');

            // Update the user's profile image
            const updatedUser = await prisma.utilisateur.update({
                where: {
                    id: userId
                },
                data: {
                    imageUrl: normalizedPath
                }
            });

// In your /upload-profile-image route handler
res.json({
    success: true,
    message: "Photo de profil mise à jour avec succès",
    imageUrl: `${req.protocol}://${req.get('host')}/${normalizedPath}`
});
        } catch (error) {
            console.error("Erreur lors de la mise à jour de la photo de profil :", error);
            res.status(500).json({
                success: false,
                message: "Erreur du serveur",
                error: error.message
            });
        }
    }
);
// Export the router module
module.exports = router;








