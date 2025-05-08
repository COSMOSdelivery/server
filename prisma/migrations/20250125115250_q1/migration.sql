/*
  Warnings:

  - The values [REMBOURSE,RETOUR_RECU] on the enum `EtatCommande` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EtatCommande_new" AS ENUM ('EN_ATTENTE', 'A_ENLEVER', 'ENLEVE', 'AU_DEPOT', 'RETOUR_DEPOT', 'EN_COURS', 'A_VERIFIER', 'LIVRES', 'LIVRES_PAYE', 'ECHANGE', 'RETOUR_DEFINITIF', 'RETOUR_INTER_AGENCE', 'RETOUR_EXPEDITEURS', 'RETOUR_RECU_PAYE');
ALTER TABLE "Commande" ALTER COLUMN "etat" TYPE "EtatCommande_new" USING ("etat"::text::"EtatCommande_new");
ALTER TABLE "HistoriqueCommande" ALTER COLUMN "etat" TYPE "EtatCommande_new" USING ("etat"::text::"EtatCommande_new");
ALTER TYPE "EtatCommande" RENAME TO "EtatCommande_old";
ALTER TYPE "EtatCommande_new" RENAME TO "EtatCommande";
DROP TYPE "EtatCommande_old";
COMMIT;
