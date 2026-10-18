-- AlterTable
ALTER TABLE "tenant_service_desk_queues" ADD COLUMN     "teamId" TEXT;

-- CreateIndex
CREATE INDEX "tenant_service_desk_queues_tenantId_teamId_idx" ON "tenant_service_desk_queues"("tenantId", "teamId");
