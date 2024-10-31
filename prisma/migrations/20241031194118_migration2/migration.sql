/*
  Warnings:

  - You are about to drop the `Colis` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Command` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Manifest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Retour` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Colis";

-- DropTable
DROP TABLE "Command";

-- DropTable
DROP TABLE "Manifest";

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "Retour";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nomShop" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "gouvernerat" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "localite" TEXT NOT NULL,
    "codePostal" TEXT NOT NULL,
    "addresse" TEXT NOT NULL,
    "telephone1" TEXT NOT NULL,
    "telephone2" TEXT NOT NULL,
    "codeTVA" TEXT NOT NULL,
    "cin" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "dateInscription" TIMESTAMP(3) NOT NULL,
    "derniereMiseAJour" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_cin_key" ON "Utilisateur"("cin");
