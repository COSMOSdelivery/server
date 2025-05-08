-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "resetPasswordOtp" TEXT,
ADD COLUMN     "resetPasswordOtpExpiry" TIMESTAMP(3);
