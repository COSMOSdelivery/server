const defaultUser = require('C:\\Users\\PC-ASUS\\Desktop\\cosmos\\server\\src\\seeders\\defaultUser.js');
async function initializeDatabase() {
    await defaultUser();
}

module.exports = initializeDatabase; // Exporter la fonction
