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

// Middleware pour vérifier si l'utilisateur est un administrateur
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


module.exports = { verifyAdmin,verifyLogin };
