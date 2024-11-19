const swaggerAutogen = require("swagger-autogen")();

const doc = {
    info: {
        title: "API Documentation",
        description: "Documentation",
    },
    host: "localhost:3000",
    schemes: ["http"],
    consumes: ["application/json"],
    produces: ["application/json"],
};
const outputFile = "./swagger-output.json"; // Fichier généré
const endpointsFiles = ["../src/routes/user.js"];

swaggerAutogen(outputFile, endpointsFiles,doc).then(()=>{require("../index.js");});

