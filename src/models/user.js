const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient()

router.post('/login', async (req,res) => {
  // TODO: writing queries for prisma 
    const user = await prisma.utilisateur.findUnique({where:{
      email: req.body.email 
    }})
    const secret = process.env.JWTSECRET;
    if(!user) {
        return res.status(400).send('The user not found');
    }
    
    
    // db password and compare
    
    if(user && bcrypt.compareSync(req.body.password, user.password)) {
        const token = jwt.sign(
            {
                id: user.id,
                isAdmin: user.isAdmin
            },
            secret,
            {expiresIn : '1d'}
        )


       
        res.status(200).send({user: user.email , token: token}) 
    } else {
       res.status(400).send('password is wrong!');
    }

    

    
})


router.post('/register', async (req,res)=>{
  // TODO:verify request role (must be admin)
  // TODO: based on token 


  // scenario : return unauthorized/invalid response


  // TODO: hash password before sending it to the database (SHA)

  let user = await prisma.utilisateur.create({data:{
    nom:req.body.nom,
    prenom:req.body.prenom,
    nomShop:req.body.nomShop,  
    email:req.body.email,
    gouvernerat:req.body.gouvernerat,
    ville:req.body.ville,
    localite :req.body.localite,
    codePostal :req.body.codePostal,
    addresse :req.body.addresse,
    telephone1 :req.body.telephone1,
    telephone2 :req.body.telephone2,
    codeTVA :req.body.codeTVA,
    cin :req.body.cin,
    role :req.body.role
  }})

    if(!user)
    return res.status(400).send('the user cannot be created!')

    // TODO: success : generate response object which have the message
    res.send(user);
})


module.exports =router;
