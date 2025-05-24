const defaultUser = require('./seeders/defaultUser.js');
async function initializeDatabase() {
    await defaultUser();
}

module.exports = initializeDatabase; // Exporter la fonction
