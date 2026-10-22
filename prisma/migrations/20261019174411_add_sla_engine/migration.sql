-- CreateEnum
CREATE TYPE "SlaClockEventType" AS ENUM ('START', 'PAUSE', 'RESUME', 'COMPLETE', 'BREACH', 'RECALCULATE');

-- CreateEnum
CREATE TYPE "SlaInstanceStatus" AS ENUM ('RUNNING', 'PAUSED', 'MET', 'BREACHED', 'EXEMPT');

-- CreateTable
CREATE TABLE "ticket_sla_instances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT,
    "slaPolicyId" TEXT,
    "milestone" TEXT NOT NULL,
    "priorityKey" TEXT NOT NULL,
    "targetMinutes" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pausedDuration" INTEGER NOT NULL DEFAULT 0,
    "status" "SlaInstanceStatus" NOT NULL DEFAULT 'RUNNING',
    "breached" BOOLEAN NOT NULL DEFAULT false,
    "breachedAt" TIMESTAMP(3),
    "policyKey" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ticket_sla_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_clock_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slaInstanceId" TEXT NOT NULL,
    "type" "SlaClockEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "reason" TEXT,
    "pausedMinutes" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_clock_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_sla_instances_tenantId_incidentId_milestone_idx" ON "ticket_sla_instances"("tenantId", "incidentId", "milestone");

-- CreateIndex
CREATE INDEX "ticket_sla_instances_tenantId_status_idx" ON "ticket_sla_instances"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ticket_sla_instances_tenantId_deadlineAt_idx" ON "ticket_sla_instances"("tenantId", "deadlineAt");

-- CreateIndex
CREATE INDEX "ticket_sla_instances_deadlineAt_idx" ON "ticket_sla_instances"("deadlineAt");

-- CreateIndex
CREATE INDEX "sla_clock_events_tenantId_slaInstanceId_idx" ON "sla_clock_events"("tenantId", "slaInstanceId");

-- CreateIndex
CREATE INDEX "sla_clock_events_tenantId_type_occurredAt_idx" ON "sla_clock_events"("tenantId", "type", "occurredAt");

-- AddForeignKey
ALTER TABLE "ticket_sla_instances" ADD CONSTRAINT "ticket_sla_instances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla_instances" ADD CONSTRAINT "ticket_sla_instances_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla_instances" ADD CONSTRAINT "ticket_sla_instances_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "tenant_sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_clock_events" ADD CONSTRAINT "sla_clock_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_clock_events" ADD CONSTRAINT "sla_clock_events_slaInstanceId_fkey" FOREIGN KEY ("slaInstanceId") REFERENCES "ticket_sla_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_clock_events" ADD CONSTRAINT "sla_clock_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
