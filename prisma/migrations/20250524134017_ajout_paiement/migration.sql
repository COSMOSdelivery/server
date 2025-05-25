-- CreateEnum
CREATE TYPE "StatutPaiement" AS ENUM ('NON_PAYE', 'PAYE', 'EN_ATTENTE', 'REFUSE');

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "statutPaiement" "StatutPaiement" NOT NULL DEFAULT 'NON_PAYE';

-- CreateTable
CREATE TABLE "Paiement" (
    "id" SERIAL NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montant" DOUBLE PRECISION NOT NULL,
    "mode" "ModePaiement" NOT NULL,
    "statut" "StatutPaiement" NOT NULL DEFAULT 'EN_ATTENTE',
    "id_client" INTEGER NOT NULL,
    "id_commande" INTEGER,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "Client"("idClient") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_id_commande_fkey" FOREIGN KEY ("id_commande") REFERENCES "Commande"("code_a_barre") ON DELETE SET NULL ON UPDATE CASCADE;
