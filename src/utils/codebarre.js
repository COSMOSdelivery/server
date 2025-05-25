const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
async function generateCodeBarre() {
  const lastCommande = await prisma.commande.findFirst({
    orderBy: { code_a_barre: 'desc' }
  });

  let newNumber = 1;

  if (lastCommande) {
    const lastNumberStr = lastCommande.code_a_barre.slice(4);
    const lastNumber = parseInt(lastNumberStr, 10);
    if (!isNaN(lastNumber)) {
      newNumber = lastNumber + 1;
    }
  }

  return `COS-${newNumber.toString().padStart(6, '0')}`;
}

module.exports = { generateCodeBarre };
