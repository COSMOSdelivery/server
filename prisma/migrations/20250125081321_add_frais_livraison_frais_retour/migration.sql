/*
  Warnings:

  - The values [LIVRES_PAYES,REMBOURSES,RETOUR_RECU_PAYES] on the enum `EtatCommande` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `nb_colis` on the `Commande` table. All the data in the column will be lost.
  - You are about to drop the column `adresse` on the `Livreur` table. All the data in the column will be lost.
  - You are about to drop the column `codePostal` on the `Livreur` table. All the data in the column will be lost.
  - You are about to drop the column `localite` on the `Livreur` table. All the data in the column will be lost.
  - You are about to drop the column `ville` on the `Livreur` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EtatFeedback" AS ENUM ('EN_COURS', 'RESOLU', 'EN_ATTENTE');

-- AlterEnum
BEGIN;
CREATE TYPE "EtatCommande_new" AS ENUM ('EN_ATTENTE', 'A_ENLEVER', 'AU_DEPOT', 'RETOUR_DEPOT', 'EN_COURS', 'A_VERIFIER', 'LIVRES', 'LIVRES_PAYE', 'ECHANGE', 'REMBOURSE', 'RETOUR_DEFINITIF', 'RETOUR_INTER_AGENCE', 'RETOUR_EXPEDITEURS', 'RETOUR_RECU');
ALTER TABLE "Commande" ALTER COLUMN "etat" TYPE "EtatCommande_new" USING ("etat"::text::"EtatCommande_new");
ALTER TABLE "HistoriqueCommande" ALTER COLUMN "etat" TYPE "EtatCommande_new" USING ("etat"::text::"EtatCommande_new");
ALTER TYPE "EtatCommande" RENAME TO "EtatCommande_old";
ALTER TYPE "EtatCommande_new" RENAME TO "EtatCommande";
DROP TYPE "EtatCommande_old";
COMMIT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "fraisLivraison" DOUBLE PRECISION NOT NULL DEFAULT 7,
ADD COLUMN     "fraisRetour" DOUBLE PRECISION NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "Commande" DROP COLUMN "nb_colis",
ADD COLUMN     "code_a_barre_echange" INTEGER,
ADD COLUMN     "est_imprimer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manifesteId" INTEGER,
ADD COLUMN     "nb_article_echange" INTEGER;

-- AlterTable
ALTER TABLE "Livreur" DROP COLUMN "adresse",
DROP COLUMN "codePostal",
DROP COLUMN "localite",
DROP COLUMN "ville";

-- CreateTable
CREATE TABLE "Manifeste" (
    "id" SERIAL NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_client" INTEGER NOT NULL,
    "estImprime" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Manifeste_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_manifesteId_fkey" FOREIGN KEY ("manifesteId") REFERENCES "Manifeste"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manifeste" ADD CONSTRAINT "Manifeste_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "Client"("idClient") ON DELETE RESTRICT ON UPDATE CASCADE;
