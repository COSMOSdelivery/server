const jwt = require('jsonwebtoken');

// Middleware pour vérifier si l'utilisateur est un administrateur
const verifyAdmin = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization

    if (!token) {
        return res.status(401).send({msg:"Access denied. No token provided."});
    }

    try {
        const decoded = jwt.verify(token, process.env.JWTSECRET); // Vérification du token
        req.user = decoded; // Ajouter toutes les informations de l'utilisateur décodées dans la requête
        if (req.user.role !== 'ADMIN') { // Vérification du rôle
            return res.status(403).send({msg:"Permission denied. You are not an admin."});
        }
        next(); // Passer à la suite
    } catch (error) {
        return res.status(400).send({msg:"Invalid token."});
    }
};

// Middleware pour vérifier si l'utilisateur est un client
const verifyClient = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization

    if (!token) {
        return res.status(401).send({msg:"Access denied. No token provided."});
    }
    try {
        const decoded = jwt.verify(token, process.env.JWTSECRET); // Vérification du token
        req.user = decoded; // Ajouter toutes les informations de l'utilisateur décodées dans la requête
        if (req.user.role !== 'CLIENT') { // Vérification du rôle
            return res.status(403).send({msg:"Permission denied. You are not a client."});
        }
        next(); // Passer à la suite
    } catch (error) {
        return res.status(400).send({msg:"Invalid token."});
    }
};

// Middleware pour vérifier si l'utilisateur est un Livreur
const verifyLivreur = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization
    if (!token) {
        return res.status(401).send({msg:"Access denied. No token provided."});
    }
    try {
        const decoded = jwt.verify(token, process.env.JWTSECRET); // Vérification du token
        req.user = decoded; // Ajouter toutes les informations de l'utilisateur décodées dans la requête
        if (req.user.role !== 'LIVREUR') { // Vérification du rôle
            return res.status(403).send({msg:"Permission denied. You are not a LIVREUR."});
        }
        next(); // Passer à la suite
    } catch (error) {
        return res.status(400).send({msg:"Invalid token."});
    }
};

// Middleware pour vérifier si l'utilisateur est un serviceClient
const verifyServiceclient = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization
    if (!token) {
        return res.status(401).send({msg:"Access denied. No token provided."});
    }
    try {
        const decoded = jwt.verify(token, process.env.JWTSECRET); // Vérification du token
        req.user = decoded; // Ajouter toutes les informations de l'utilisateur décodées dans la requête
        if (req.user.role !== 'SERVICECLIENT') { // Vérification du rôle
            return res.status(403).send({msg:"Permission denied. You are not a SERVICECLIENT."});
        }
        next(); // Passer à la suite
    } catch (error) {
        return res.status(400).send({msg:"Invalid token."});
    }
};





// Middleware pour vérifier si l'utilisateur est connecter
const verifyLogin = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extract the token from the Authorization header

    if (!token) {
        return res.status(401).send({ msg: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWTSECRET); // Verify the token using the secret key
        const userRole = decoded.role;
        if (userRole) {
            next(); // Proceed if the role is defined
        } else {
            return res.status(403).send({ msg: "Access denied. Role not assigned." });
        }
    } catch (error) {
        return res.status(400).send({ msg: "Invalid token." });
    }
};


module.exports = { verifyLogin, verifyAdmin,verifyClient,verifyLivreur,verifyServiceclient };
