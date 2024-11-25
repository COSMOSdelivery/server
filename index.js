require('dotenv/config')
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger/swagger-output.json");
const express = require("express");
const bodyParser = require('body-parser')
const morgan = require('morgan')
const authJwt = require("./src/middleware/expressjwt");
const usersRouter = require("./src/routes/user")
const feedbackRouter = require("./src/routes/feedback")
const commandRouter = require("./src/routes/command")
const commandHistory = require("./src/routes/historiqueCommande")
const cors = require('cors');

const app = express()
const api = process.env.API_URL


// TODO: update paths


app.use(bodyParser.json())
app.use(morgan('tiny'))
app.use(cors());

//ROUTES
app.use(`${api}/users`,usersRouter)
app.use(`${api}/feedback`, feedbackRouter);
app.use(`${api}/command`, commandRouter);
app.use(`${api}/commandHistory`,commandHistory)

// Ajouter Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(3000,()=>{
  console.log("Serveur lancé sur http://localhost:3000");
  console.log("Documentation disponible sur http://localhost:3000/api-docs");
})
