const express = require("express");
require('dotenv/config')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const authJwt = require("./middleware/expressjwt");
const usersRouter = require("./src/models/user")

const app = express()
const api = process.env.API_URL


// TODO: update paths




app.use(bodyParser.json())
app.use(morgan('tiny'))
app.use(authJwt())

//ROUTES 
app.use(`${api}/users`,usersRouter)

app.listen(3000,()=>{
  console.log(api)
  console.log("listening on port 3000")
})
