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
        
        if (!userRole) {
            return res.status(403).send({ msg: "Access denied. Role not assigned." });
        }

        req.user = decoded; // Set decoded AFTER it's defined
        next(); // Proceed if the role is defined
        
    } catch (error) {
        return res.status(400).send({ msg: "Invalid token." });
    }
};
//middleware to verify if the user is either an Admin or a ServiceClient
const verifyAdminOrServiceClient = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extract the token from the Authorization header

    if (!token) {
        return res.status(401).send({ msg: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWTSECRET); // Verify the token using the secret key
        req.user = decoded; // Add the decoded user info to the request

        console.log("User role:", req.user.role); // Log the user role

        // Check if the user has either the 'ADMIN' or 'SERVICECLIENT' role
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SERVICECLIENT') {
            return res.status(403).send({ msg: "Permission denied. You are neither an Admin nor a ServiceClient." });
        }

        next(); // Proceed to the next middleware
    } catch (error) {
        return res.status(400).send({ msg: "Invalid token." });
    }
};
// Middleware pour vérifier si l'utilisateur est soit un Client soit un ServiceClient
const verifyClientOrServiceClient = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization

    if (!token) {
        return res.status(401).send({ msg: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWTSECRET); // Vérification du token
        req.user = decoded; // Ajouter toutes les informations de l'utilisateur décodées dans la requête
        
        // Vérification si l'utilisateur est un CLIENT ou un SERVICECLIENT
        if (req.user.role !== 'CLIENT' && req.user.role !== 'SERVICECLIENT') {
            return res.status(403).send({ msg: "Permission denied. You are neither a Client nor a ServiceClient." });
        }
        
        next(); // Passer à la suite
    } catch (error) {
        return res.status(400).send({ msg: "Invalid token." });
    }
};
// Middleware pour vérifier si l'utilisateur est soit un Client, soit un ServiceClient, soit un Admin
const verifyClientOrServiceClientOrAdmin = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Extrait le token de l'entête Authorization

    if (!token) {
        return res.status(401).send({ msg: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWTSECRET); // Vérification du token
        req.user = decoded; // Ajouter toutes les informations de l'utilisateur décodées dans la requête
        
        // Vérification si l'utilisateur est un CLIENT, un SERVICECLIENT ou un ADMIN
        if (req.user.role !== 'CLIENT' && req.user.role !== 'SERVICECLIENT' && req.user.role !== 'ADMIN') {
            return res.status(403).send({ msg: "Permission denied. You must be either a Client, a ServiceClient, or an Admin." });
        }
        
        next(); // Passer à la suite
    } catch (error) {
        return res.status(400).send({ msg: "Invalid token." });
    }
};
// Add the new middleware to exports
module.exports = { 
    verifyLogin, 
    verifyAdmin, 
    verifyClient, 
    verifyLivreur, 
    verifyServiceclient, 
    verifyAdminOrServiceClient,
    verifyClientOrServiceClient,
    verifyClientOrServiceClientOrAdmin// Export the new middleware
};