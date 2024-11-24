/*
  Warnings:

  - You are about to drop the column `id_commande` on the `HistoriqueCommande` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code_a_barre,id_livreur,date]` on the table `HistoriqueCommande` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code_a_barre` to the `HistoriqueCommande` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "HistoriqueCommande" DROP CONSTRAINT "HistoriqueCommande_id_commande_fkey";

-- DropIndex
DROP INDEX "HistoriqueCommande_id_commande_id_livreur_date_key";

-- AlterTable
ALTER TABLE "HistoriqueCommande" DROP COLUMN "id_commande",
ADD COLUMN     "code_a_barre" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "HistoriqueCommande_code_a_barre_id_livreur_date_key" ON "HistoriqueCommande"("code_a_barre", "id_livreur", "date");

-- AddForeignKey
ALTER TABLE "HistoriqueCommande" ADD CONSTRAINT "HistoriqueCommande_code_a_barre_fkey" FOREIGN KEY ("code_a_barre") REFERENCES "Commande"("code_a_barre") ON DELETE CASCADE ON UPDATE CASCADE;
