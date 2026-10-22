-- CreateTable
CREATE TABLE "tenant_email_providers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "fromName" TEXT,
    "fromEmail" TEXT NOT NULL,
    "replyTo" TEXT,
    "configEnc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestResult" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_email_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_email_providers_tenantId_status_idx" ON "tenant_email_providers"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_email_providers_tenantId_key_key" ON "tenant_email_providers"("tenantId", "key");

-- AddForeignKey
ALTER TABLE "tenant_email_providers" ADD CONSTRAINT "tenant_email_providers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
