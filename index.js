require("dotenv/config");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger/swagger-output.json");
const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const authJwt = require("./src/middleware/expressjwt");
const usersRouter = require("./src/routes/user");
const feedbackRouter = require("./src/routes/feedback");
const commandRouter = require("./src/routes/command");
const commandHistoryRouter = require("./src/routes/historiqueCommande");
const manifestRouter = require("./src/routes/manifest");
const clientStatRouter = require("./src/routes/stat");
const initializeDatabase = require("./src/initbd");
const path = require("path");


const cors = require("cors");
const app = express();
app.use(express.static("public"));
const api = process.env.API_URL;

app.use(bodyParser.json());
app.use(morgan("tiny"));
app.use(cors({
  origin: 'http://localhost:3100', // Your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
//ROUTES
app.use(`${api}/users`, usersRouter);
app.use(`${api}/feedback`, feedbackRouter);
app.use(`${api}/command`, commandRouter);
app.use(`${api}/commandHistory`, commandHistoryRouter);
app.use(`${api}/manifest`, manifestRouter);
app.use(`${api}/stat`, clientStatRouter);
const paiementRouter = require('./src/routes/paiement');
app.use(`${api}/paiements`, paiementRouter);


// Ajouter Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// Add this to your Express server setup
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(3001, () => {
  console.log("Serveur lancé sur http://localhost:3001");
  console.log("Documentation disponible sur http://localhost:3001/api-docs");
});

initializeDatabase()
  .then(() => console.log("Base de données initialisée avec succès"))
  .catch(console.error);
