/*
  Warnings:

  - The primary key for the `Commande` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "FeedbackCommande" DROP CONSTRAINT "FeedbackCommande_id_commande_fkey";

-- DropForeignKey
ALTER TABLE "HistoriqueCommande" DROP CONSTRAINT "HistoriqueCommande_id_commande_fkey";

-- DropForeignKey
ALTER TABLE "Paiement" DROP CONSTRAINT "Paiement_id_commande_fkey";

-- AlterTable
ALTER TABLE "Commande" DROP CONSTRAINT "Commande_pkey",
ALTER COLUMN "code_a_barre" DROP DEFAULT,
ALTER COLUMN "code_a_barre" SET DATA TYPE TEXT,
ADD CONSTRAINT "Commande_pkey" PRIMARY KEY ("code_a_barre");
DROP SEQUENCE "Commande_code_a_barre_seq";

-- AlterTable
ALTER TABLE "FeedbackCommande" ALTER COLUMN "id_commande" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "HistoriqueCommande" ALTER COLUMN "id_commande" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Paiement" ALTER COLUMN "id_commande" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "HistoriqueCommande" ADD CONSTRAINT "HistoriqueCommande_id_commande_fkey" FOREIGN KEY ("id_commande") REFERENCES "Commande"("code_a_barre") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackCommande" ADD CONSTRAINT "FeedbackCommande_id_commande_fkey" FOREIGN KEY ("id_commande") REFERENCES "Commande"("code_a_barre") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_id_commande_fkey" FOREIGN KEY ("id_commande") REFERENCES "Commande"("code_a_barre") ON DELETE SET NULL ON UPDATE CASCADE;
