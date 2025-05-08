const defaultUser = require('C:\\Users\\ashre\\Desktop\\codex\\cosmos_dashboard\\server\\src\\seeders\\defaultUser.js');
async function initializeDatabase() {
    await defaultUser();
}

module.exports = initializeDatabase; // Exporter la fonction
