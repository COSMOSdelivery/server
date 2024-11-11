const expressJwt = require('express-jwt');

function authJwt() {
    const secret = process.env.JWTSECRET;
    const api = process.env.API_URL;
    return expressJwt.expressjwt({
        secret:secret,
        algorithms: ['HS256'],
        isRevoked: isRevoked
    }).unless({
        path: [
            `${api}/users/login`,
            `${api}/users/creatAccount`,
        ]
    })
}

async function isRevoked(req, token){
  if(!token.payload.isAdmin) {
     return true;
  }
}

module.exports = authJwt
