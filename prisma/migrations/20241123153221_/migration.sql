/*
  Warnings:

  - The values [UTILISATEUR] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `addresse` on the `Utilisateur` table. All the data in the column will be lost.
  - You are about to drop the column `codePostal` on the `Utilisateur` table. All the data in the column will be lost.
  - You are about to drop the column `gouvernerat` on the `Utilisateur` table. All the data in the column will be lost.
  - You are about to drop the column `localite` on the `Utilisateur` table. All the data in the column will be lost.
  - You are about to drop the column `nomShop` on the `Utilisateur` table. All the data in the column will be lost.
  - You are about to drop the column `ville` on the `Utilisateur` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECE', 'CHEQUE', 'ESPECE_ou_CHEQUE');

-- CreateEnum
CREATE TYPE "EtatCommande" AS ENUM ('EN_ATTENTE', 'AU_DEPOT', 'EN_COURS', 'A_VERIFIER', 'LIVRES', 'LIVRES_PAYES', 'ECHANGE', 'REMBOURSES', 'RETOUR_DEFINITIF', 'RETOUR_INTER_AGENCE', 'RETOUR_EXPEDITEURS', 'RETOUR_RECU_PAYES');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('CLIENT', 'ADMIN', 'LIVREUR', 'SERVICECLIENT');
ALTER TABLE "Utilisateur" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;

-- AlterTable
ALTER TABLE "Utilisateur" DROP COLUMN "addresse",
DROP COLUMN "codePostal",
DROP COLUMN "gouvernerat",
DROP COLUMN "localite",
DROP COLUMN "nomShop",
DROP COLUMN "ville",
ALTER COLUMN "telephone2" DROP NOT NULL,
ALTER COLUMN "dateInscription" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Admin" (
    "idAdmin" SERIAL NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("idAdmin")
);

-- CreateTable
CREATE TABLE "Serviceclient" (
    "idServiceclient" SERIAL NOT NULL,

    CONSTRAINT "Serviceclient_pkey" PRIMARY KEY ("idServiceclient")
);

-- CreateTable
CREATE TABLE "Client" (
    "idClient" SERIAL NOT NULL,
    "nomShop" TEXT NOT NULL,
    "gouvernorat" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "localite" TEXT NOT NULL,
    "codePostal" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("idClient")
);

-- CreateTable
CREATE TABLE "Livreur" (
    "idLivreur" SERIAL NOT NULL,
    "gouvernorat" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "localite" TEXT NOT NULL,
    "codePostal" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,

    CONSTRAINT "Livreur_pkey" PRIMARY KEY ("idLivreur")
);

-- CreateTable
CREATE TABLE "Commande" (
    "code_a_barre" SERIAL NOT NULL,
    "nom_Prenom_prioritaire" TEXT NOT NULL,
    "gouvernorat" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "localite" TEXT NOT NULL,
    "codePostal" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "telephone1" TEXT NOT NULL,
    "telephone2" TEXT,
    "designation" TEXT NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,
    "nb_article" INTEGER NOT NULL,
    "nb_colis" INTEGER NOT NULL,
    "etat" "EtatCommande" NOT NULL,
    "mode_paiement" "ModePaiement" NOT NULL,
    "possible_ouvrir" BOOLEAN NOT NULL,
    "possible_echange" BOOLEAN NOT NULL,
    "remarque" TEXT,
    "dateAjout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniereMiseAJour" TIMESTAMP(3) NOT NULL,
    "id_client" INTEGER NOT NULL,

    CONSTRAINT "Commande_pkey" PRIMARY KEY ("code_a_barre")
);

-- CreateTable
CREATE TABLE "HistoriqueCommande" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "etat" "EtatCommande" NOT NULL,
    "commentaire" TEXT,
    "id_commande" INTEGER NOT NULL,
    "id_livreur" INTEGER NOT NULL,

    CONSTRAINT "HistoriqueCommande_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HistoriqueCommande_id_commande_id_livreur_date_key" ON "HistoriqueCommande"("id_commande", "id_livreur", "date");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_idAdmin_fkey" FOREIGN KEY ("idAdmin") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Serviceclient" ADD CONSTRAINT "Serviceclient_idServiceclient_fkey" FOREIGN KEY ("idServiceclient") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_idClient_fkey" FOREIGN KEY ("idClient") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Livreur" ADD CONSTRAINT "Livreur_idLivreur_fkey" FOREIGN KEY ("idLivreur") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "Client"("idClient") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueCommande" ADD CONSTRAINT "HistoriqueCommande_id_commande_fkey" FOREIGN KEY ("id_commande") REFERENCES "Commande"("code_a_barre") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueCommande" ADD CONSTRAINT "HistoriqueCommande_id_livreur_fkey" FOREIGN KEY ("id_livreur") REFERENCES "Livreur"("idLivreur") ON DELETE CASCADE ON UPDATE CASCADE;
