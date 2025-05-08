-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_id_livreur_fkey" FOREIGN KEY ("id_livreur") REFERENCES "Livreur"("idLivreur") ON DELETE SET NULL ON UPDATE CASCADE;
