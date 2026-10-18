-- CreateTable
CREATE TABLE "tenant_approval_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "actionScope" TEXT NOT NULL,
    "conditions" JSONB,
    "approverRoleIds" JSONB NOT NULL DEFAULT '[]',
    "minApprovals" INTEGER NOT NULL DEFAULT 1,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_approval_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT,
    "actionKey" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "payload" JSONB,
    "reason" TEXT,
    "requestedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_approval_decisions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "approverId" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_sla_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "serviceLevels" JSONB NOT NULL DEFAULT '[]',
    "settings" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_sla_escalation_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slaPolicyId" TEXT,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "thresholdMinutes" INTEGER NOT NULL,
    "actions" JSONB NOT NULL DEFAULT '[]',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_sla_escalation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_business_calendars" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "workingHours" JSONB NOT NULL DEFAULT '{}',
    "holidays" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_business_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_workflows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "moduleKey" TEXT NOT NULL DEFAULT 'global',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "conditions" JSONB,
    "definition" JSONB NOT NULL DEFAULT '{}',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_workflow_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "changelog" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_workflow_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workflowId" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "context" JSONB,
    "steps" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_automation_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "moduleKey" TEXT NOT NULL DEFAULT 'global',
    "trigger" TEXT NOT NULL DEFAULT 'event',
    "eventKey" TEXT,
    "schedule" TEXT,
    "conditions" JSONB,
    "actions" JSONB NOT NULL DEFAULT '[]',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_automation_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "context" JSONB,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_notification_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'TEXT',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_notification_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "templateId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "conditions" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_notification_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleId" TEXT,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "payload" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_approval_policies_tenantId_actionScope_isEnabled_idx" ON "tenant_approval_policies"("tenantId", "actionScope", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_approval_policies_tenantId_name_key" ON "tenant_approval_policies"("tenantId", "name");

-- CreateIndex
CREATE INDEX "tenant_approval_requests_tenantId_status_idx" ON "tenant_approval_requests"("tenantId", "status");

-- CreateIndex
CREATE INDEX "tenant_approval_requests_tenantId_actionKey_idx" ON "tenant_approval_requests"("tenantId", "actionKey");

-- CreateIndex
CREATE INDEX "tenant_approval_decisions_tenantId_decision_idx" ON "tenant_approval_decisions"("tenantId", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_approval_decisions_requestId_approverId_key" ON "tenant_approval_decisions"("requestId", "approverId");

-- CreateIndex
CREATE INDEX "tenant_sla_policies_tenantId_status_idx" ON "tenant_sla_policies"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_sla_policies_tenantId_name_key" ON "tenant_sla_policies"("tenantId", "name");

-- CreateIndex
CREATE INDEX "tenant_sla_escalation_rules_tenantId_slaPolicyId_idx" ON "tenant_sla_escalation_rules"("tenantId", "slaPolicyId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_business_calendars_tenantId_name_key" ON "tenant_business_calendars"("tenantId", "name");

-- CreateIndex
CREATE INDEX "tenant_workflows_tenantId_status_idx" ON "tenant_workflows"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_workflows_tenantId_name_key" ON "tenant_workflows"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_workflow_versions_workflowId_version_key" ON "tenant_workflow_versions"("workflowId", "version");

-- CreateIndex
CREATE INDEX "tenant_workflow_runs_tenantId_status_idx" ON "tenant_workflow_runs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "tenant_automation_rules_tenantId_status_idx" ON "tenant_automation_rules"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_automation_rules_tenantId_name_key" ON "tenant_automation_rules"("tenantId", "name");

-- CreateIndex
CREATE INDEX "tenant_automation_runs_tenantId_status_idx" ON "tenant_automation_runs"("tenantId", "status");

-- CreateIndex
CREATE INDEX "tenant_notification_templates_tenantId_eventKey_idx" ON "tenant_notification_templates"("tenantId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_notification_templates_tenantId_name_key" ON "tenant_notification_templates"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_notification_rules_tenantId_name_key" ON "tenant_notification_rules"("tenantId", "name");

-- CreateIndex
CREATE INDEX "tenant_notification_logs_tenantId_status_idx" ON "tenant_notification_logs"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "tenant_approval_policies" ADD CONSTRAINT "tenant_approval_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_approval_requests" ADD CONSTRAINT "tenant_approval_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_approval_requests" ADD CONSTRAINT "tenant_approval_requests_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "tenant_approval_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_approval_decisions" ADD CONSTRAINT "tenant_approval_decisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_approval_decisions" ADD CONSTRAINT "tenant_approval_decisions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "tenant_approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_sla_policies" ADD CONSTRAINT "tenant_sla_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_sla_escalation_rules" ADD CONSTRAINT "tenant_sla_escalation_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_sla_escalation_rules" ADD CONSTRAINT "tenant_sla_escalation_rules_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "tenant_sla_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_business_calendars" ADD CONSTRAINT "tenant_business_calendars_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_workflows" ADD CONSTRAINT "tenant_workflows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_workflow_versions" ADD CONSTRAINT "tenant_workflow_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_workflow_versions" ADD CONSTRAINT "tenant_workflow_versions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "tenant_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_workflow_runs" ADD CONSTRAINT "tenant_workflow_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_workflow_runs" ADD CONSTRAINT "tenant_workflow_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "tenant_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_automation_rules" ADD CONSTRAINT "tenant_automation_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_automation_runs" ADD CONSTRAINT "tenant_automation_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_automation_runs" ADD CONSTRAINT "tenant_automation_runs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "tenant_automation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_notification_templates" ADD CONSTRAINT "tenant_notification_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_notification_rules" ADD CONSTRAINT "tenant_notification_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_notification_rules" ADD CONSTRAINT "tenant_notification_rules_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "tenant_notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_notification_logs" ADD CONSTRAINT "tenant_notification_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_notification_logs" ADD CONSTRAINT "tenant_notification_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "tenant_notification_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
