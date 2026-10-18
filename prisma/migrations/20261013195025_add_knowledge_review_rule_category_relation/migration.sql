-- AddForeignKey
ALTER TABLE "knowledge_review_rules" ADD CONSTRAINT "knowledge_review_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "knowledge_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
