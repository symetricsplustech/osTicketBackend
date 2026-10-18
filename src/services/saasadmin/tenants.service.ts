import type { Request } from 'express';
import { Prisma, type Tenant } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { ConflictError, NotFoundError, PreconditionFailedError } from '../../shared/errors';
import { createCrudService } from '../../shared/crud';
import { paginationArgs, parseListQuery } from '../../shared/pagination';
import { buildPaginationMeta } from '../../shared/pagination';
import { recordAudit, recordSecurityEvent } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import { slugify } from '../../shared/utils/sanitize';
import { ensureTenantSystemRoles } from '../../shared/permissions/tenant-sync';
import { evaluateApproval } from './approvals.service';
import { ApprovalRequiredError } from '../../shared/errors';
import type { CreateTenantInput, ImpersonationInput, UpdateTenantInput } from '../../validators/saasadmin/tenants.validators';

const TENANT_INCLUDE = {
  _count: {
    select: {
      memberships: true,
      domains: true,
      serviceAssignments: true,
      slaAssignments: true,
      workflowAssignments: true,
    },
  },
} satisfies Prisma.TenantInclude;

export const tenantCrud = createCrudService<Tenant>({
  model: prisma.tenant as never,
  resourceType: 'tenant',
  searchFields: ['name', 'slug', 'primaryContactEmail', 'primaryContactName'],
  filterableFields: ['status', 'provisioningStatus'],
  allowedSortFields: ['name', 'slug', 'status', 'createdAt', 'updatedAt', 'activatedAt'],
  defaultOrderBy: { createdAt: 'desc' },
  softDelete: true,
  include: TENANT_INCLUDE,
  events: { created: 'tenant.created', updated: 'tenant.updated' },
});

export interface ActorContext {
  actorId?: string | null;
  req?: Request;
}

export interface ProvisioningResult {
  status: 'COMPLETED' | 'FAILED';
  steps: { step: string; status: 'ok' | 'failed'; detail?: string }[];
  error?: string;
}

const PROVISIONING_STEPS = [
  'settings',
  'itsm-configuration',
  'service-assignments',
  'knowledge-settings',
  'cmdb-configuration',
  'numbering-preview',
] as const;

export async function provisionTenant(tenantId: string, actor: ActorContext = {}): Promise<ProvisioningResult> {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
  if (!tenant) throw new NotFoundError('Tenant');

  const steps: ProvisioningResult['steps'] = [];
  const provisioning = await prisma.tenantProvisioning.create({
    data: { tenantId, status: 'IN_PROGRESS', startedAt: new Date(), steps: [] },
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      provisioningStatus: 'IN_PROGRESS',
      provisionAttempts: { increment: 1 },
      provisionError: null,
    },
  });

  const job = await prisma.backgroundJob.create({
    data: {
      type: 'TENANT_PROVISIONING',
      status: 'RUNNING',
      startedAt: new Date(),
      payload: { tenantId, attempt: tenant.provisionAttempts + 1 },
      createdById: actor.actorId ?? null,
    },
  });

  const runStep = async (step: (typeof PROVISIONING_STEPS)[number]): Promise<void> => {
    try {
      switch (step) {
        case 'settings': {
          const defaults: { key: string; value: Prisma.InputJsonValue }[] = [
            { key: 'general.timezone', value: tenant.timezone },
            { key: 'general.locale', value: tenant.locale },
            { key: 'notifications.enabled', value: true },
            { key: 'portal.selfServiceEnabled', value: true },
          ];
          for (const setting of defaults) {
            await prisma.tenantSetting.upsert({
              where: { tenantId_key: { tenantId, key: setting.key } },
              create: { tenantId, key: setting.key, value: setting.value, updatedById: actor.actorId ?? null },
              update: {},
            });
          }
          break;
        }
        case 'itsm-configuration': {
          const modules = await prisma.itsmModuleConfig.findMany({ where: { isEnabled: true } });
          for (const module of modules) {
            await prisma.tenantItsmConfiguration.upsert({
              where: { tenantId_moduleKey: { tenantId, moduleKey: module.moduleKey } },
              create: { tenantId, moduleKey: module.moduleKey, overrides: {}, updatedById: actor.actorId ?? null },
              update: {},
            });
          }
          break;
        }
        case 'service-assignments': {
          const services = await prisma.serviceDefinition.findMany({
            where: { status: 'ENABLED', deletedAt: null },
            select: { id: true },
          });
          for (const service of services) {
            await prisma.tenantServiceAssignment.upsert({
              where: { tenantId_serviceId: { tenantId, serviceId: service.id } },
              create: { tenantId, serviceId: service.id, isEnabled: true, assignedById: actor.actorId ?? null },
              update: {},
            });
          }
          break;
        }
        case 'knowledge-settings': {
          await prisma.knowledgeTenantSetting.upsert({
            where: { tenantId },
            create: {
              tenantId,
              settings: { reviewsEnabled: true, tenantAuthoringEnabled: true },
              updatedById: actor.actorId ?? null,
            },
            update: {},
          });
          break;
        }
        case 'cmdb-configuration': {
          await prisma.tenantCmdbConfiguration.upsert({
            where: { tenantId },
            create: {
              tenantId,
              settings: { discoveryEnabled: false, assetLifecycleEnabled: true },
              updatedById: actor.actorId ?? null,
            },
            update: {},
          });
          break;
        }
        case 'numbering-preview': {
          const rules = await prisma.numberingRule.findMany({ where: { isActive: true } });
          await prisma.tenantSetting.upsert({
            where: { tenantId_key: { tenantId, key: 'itsm.numberingRules' } },
            create: {
              tenantId,
              key: 'itsm.numberingRules',
              value: rules.map((rule) => ({ moduleKey: rule.moduleKey, prefix: rule.prefix, padding: rule.padding })),
              updatedById: actor.actorId ?? null,
            },
            update: {},
          });
          break;
        }
        default:
          break;
      }
      steps.push({ step, status: 'ok' });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      steps.push({ step, status: 'failed', detail });
      throw error;
    }
  };

  try {
    for (const step of PROVISIONING_STEPS) {
      await runStep(step);
    }

    await prisma.$transaction([
      prisma.tenant.update({
        where: { id: tenantId },
        data: { provisioningStatus: 'COMPLETED', provisionedAt: new Date(), provisionError: null },
      }),
      prisma.tenantProvisioning.update({
        where: { id: provisioning.id },
        data: { status: 'COMPLETED', steps: steps as unknown as Prisma.InputJsonValue, completedAt: new Date() },
      }),
      prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date(), result: { steps: steps as unknown as Prisma.InputJsonValue } },
      }),
    ]);

    await recordAudit({
      action: 'tenant.provisioning.completed',
      resourceType: 'tenant',
      resourceId: tenantId,
      tenantId,
      actorId: actor.actorId ?? null,
      req: actor.req,
      metadata: { steps: steps.map((entry) => entry.step) },
    });
    void publishEvent({ eventKey: 'tenant.provisioning.completed', tenantId, payload: { tenantId } });

    return { status: 'COMPLETED', steps };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ tenantId, error: message }, 'Tenant provisioning failed');

    await prisma.$transaction([
      prisma.tenant.update({
        where: { id: tenantId },
        data: { provisioningStatus: 'FAILED', provisionError: message.slice(0, 500), status: 'FAILED' },
      }),
      prisma.tenantProvisioning.update({
        where: { id: provisioning.id },
        data: { status: 'FAILED', steps: steps as unknown as Prisma.InputJsonValue, error: message.slice(0, 500), completedAt: new Date() },
      }),
      prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', completedAt: new Date(), error: message.slice(0, 500) },
      }),
    ]);

    await recordAudit({
      action: 'tenant.provisioning.failed',
      resourceType: 'tenant',
      resourceId: tenantId,
      tenantId,
      outcome: 'FAILURE',
      actorId: actor.actorId ?? null,
      req: actor.req,
      metadata: { error: message.slice(0, 300) },
    });
    void publishEvent({ eventKey: 'tenant.provisioning.failed', tenantId, payload: { tenantId, error: message.slice(0, 300) } });

    return { status: 'FAILED', steps, error: message };
  }
}

export async function createTenant(input: CreateTenantInput, actor: ActorContext): Promise<Tenant & { provisioning: ProvisioningResult }> {
  const slug = input.slug ?? slugify(input.name);
  if (!slug) throw new ConflictError('A valid tenant slug could not be derived from the provided name.');

  const existing = await prisma.tenant.findFirst({ where: { OR: [{ slug }, { name: input.name }] } });
  if (existing) {
    throw new ConflictError(
      existing.slug === slug ? `A tenant with the slug "${slug}" already exists.` : `A tenant named "${input.name}" already exists.`,
    );
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: input.name,
      slug,
      status: 'PROVISIONING',
      provisioningStatus: 'NOT_STARTED',
      primaryContactName: input.primaryContactName ?? null,
      primaryContactEmail: input.primaryContactEmail ?? null,
      timezone: input.timezone ?? 'UTC',
      locale: input.locale ?? 'en-US',
      industry: input.industry ?? null,
      website: input.website ?? null,
      notes: input.notes ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      createdById: actor.actorId ?? null,
    },
  });

  await recordAudit({
    action: 'tenant.created',
    resourceType: 'tenant',
    resourceId: tenant.id,
    tenantId: tenant.id,
    after: tenant,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({ eventKey: 'tenant.created', tenantId: tenant.id, payload: { tenantId: tenant.id, slug, name: tenant.name } });

  // Provision the protected tenant (Organization Admin) system roles for the new organization.
  await ensureTenantSystemRoles(prisma, tenant.id);

  const provisioning = await provisionTenant(tenant.id, actor);
  const refreshed = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
  return { ...refreshed, provisioning };
}

export async function performTenantActivation(tenantId: string, actor: ActorContext): Promise<Tenant> {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
  if (!tenant) throw new NotFoundError('Tenant');
  if (tenant.status === 'ACTIVE') throw new PreconditionFailedError('Tenant is already active.');
  if (tenant.status === 'ARCHIVED') throw new PreconditionFailedError('Archived tenants cannot be activated.');
  if (tenant.provisioningStatus !== 'COMPLETED') {
    throw new PreconditionFailedError('Tenant cannot be activated until provisioning has completed successfully.');
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: 'ACTIVE', activatedAt: new Date(), suspendedAt: null, suspendedReason: null },
  });

  await recordAudit({
    action: 'tenant.activated',
    resourceType: 'tenant',
    resourceId: tenantId,
    tenantId,
    before: { status: tenant.status },
    after: { status: 'ACTIVE' },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({ eventKey: 'tenant.activated', tenantId, payload: { tenantId } });
  return updated;
}

export async function performTenantSuspend(tenantId: string, reason: string, actor: ActorContext): Promise<Tenant> {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
  if (!tenant) throw new NotFoundError('Tenant');
  if (tenant.status === 'SUSPENDED') throw new PreconditionFailedError('Tenant is already suspended.');
  if (tenant.status === 'ARCHIVED') throw new PreconditionFailedError('Archived tenants cannot be suspended.');

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: 'SUSPENDED', suspendedAt: new Date(), suspendedReason: reason },
  });

  await prisma.session.updateMany({
    where: {
      user: { memberships: { some: { tenantId } } },
      revokedAt: null,
    },
    data: { revokedAt: new Date(), revokedReason: 'TENANT_SUSPENDED' },
  });

  await recordAudit({
    action: 'tenant.suspended',
    resourceType: 'tenant',
    resourceId: tenantId,
    tenantId,
    before: { status: tenant.status },
    after: { status: 'SUSPENDED', reason },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({ eventKey: 'tenant.suspended', tenantId, payload: { tenantId, reason } });
  return updated;
}

export async function performTenantReactivate(tenantId: string, actor: ActorContext): Promise<Tenant> {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
  if (!tenant) throw new NotFoundError('Tenant');
  if (tenant.status !== 'SUSPENDED') throw new PreconditionFailedError('Only suspended tenants can be reactivated.');

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: 'ACTIVE', suspendedAt: null, suspendedReason: null },
  });

  await recordAudit({
    action: 'tenant.reactivated',
    resourceType: 'tenant',
    resourceId: tenantId,
    tenantId,
    before: { status: tenant.status },
    after: { status: 'ACTIVE' },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({ eventKey: 'tenant.reactivated', tenantId, payload: { tenantId } });
  return updated;
}

export async function performTenantArchive(tenantId: string, reason: string, actor: ActorContext): Promise<Tenant> {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
  if (!tenant) throw new NotFoundError('Tenant');
  if (tenant.status === 'ARCHIVED') throw new PreconditionFailedError('Tenant is already archived.');
  if (tenant.status === 'ACTIVE') {
    throw new PreconditionFailedError('Suspend the tenant before archiving it.');
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: 'ARCHIVED', archivedAt: new Date(), archivedReason: reason },
  });

  await prisma.$transaction([
    prisma.session.updateMany({
      where: { user: { memberships: { some: { tenantId } } }, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'TENANT_ARCHIVED' },
    }),
    prisma.apiKey.updateMany({
      where: { tenantId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'TENANT_ARCHIVED' },
    }),
  ]);

  await recordAudit({
    action: 'tenant.archived',
    resourceType: 'tenant',
    resourceId: tenantId,
    tenantId,
    before: { status: tenant.status },
    after: { status: 'ARCHIVED', reason },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({ eventKey: 'tenant.archived', tenantId, payload: { tenantId, reason } });
  return updated;
}

export async function requestSuspension(tenantId: string, reason: string, actor: ActorContext): Promise<Tenant> {
  if (actor.req) {
    const approval = await evaluateApproval({
      actionKey: 'tenant.suspend',
      resourceType: 'tenant',
      resourceId: tenantId,
      payload: { tenantId, reason },
      req: actor.req,
    });
    if (approval) {
      throw new ApprovalRequiredError('Suspending this tenant requires approval. A request has been created.', {
        approvalRequestId: approval.id,
      });
    }
  }
  return performTenantSuspend(tenantId, reason, actor);
}

export async function requestArchive(tenantId: string, reason: string, actor: ActorContext): Promise<Tenant> {
  if (actor.req) {
    const approval = await evaluateApproval({
      actionKey: 'tenant.archive',
      resourceType: 'tenant',
      resourceId: tenantId,
      payload: { tenantId, reason },
      req: actor.req,
    });
    if (approval) {
      throw new ApprovalRequiredError('Archiving this tenant requires approval. A request has been created.', {
        approvalRequestId: approval.id,
      });
    }
  }
  return performTenantArchive(tenantId, reason, actor);
}

export async function getTenantOverview(tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    include: {
      _count: {
        select: {
          memberships: true,
          domains: true,
          serviceAssignments: true,
          slaAssignments: true,
          workflowAssignments: true,
          itsmConfigurations: true,
          supportTickets: true,
          apiKeys: true,
        },
      },
      domains: { select: { id: true, domain: true, status: true, type: true } },
      provisionings: { orderBy: { createdAt: 'desc' }, take: 1 },
      knowledgeSetting: true,
      cmdbConfiguration: true,
    },
  });
  if (!tenant) throw new NotFoundError('Tenant');

  const enabledServices = await prisma.tenantServiceAssignment.count({ where: { tenantId, isEnabled: true } });
  const recentAuditCount = await prisma.auditEvent.count({
    where: { tenantId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });

  return {
    tenant,
    operational: {
      enabledServices,
      recentActivityEvents: recentAuditCount,
      lastProvisioning: tenant.provisionings[0] ?? null,
    },
    configuration: {
      knowledgeSettings: tenant.knowledgeSetting?.settings ?? null,
      cmdbSettings: tenant.cmdbConfiguration?.settings ?? null,
      moduleOverrides: tenant._count.itsmConfigurations,
    },
  };
}

export async function getTenantHealth(tenantId: string) {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
  if (!tenant) throw new NotFoundError('Tenant');

  const [domains, failedDomains, pendingApprovals, failedJobs] = await Promise.all([
    prisma.tenantDomain.count({ where: { tenantId } }),
    prisma.tenantDomain.count({ where: { tenantId, status: 'FAILED' } }),
    prisma.approvalRequest.count({ where: { resourceType: 'tenant', resourceId: tenantId, status: 'PENDING' } }),
    prisma.backgroundJob.count({
      where: { type: 'TENANT_PROVISIONING', status: 'FAILED', payload: { path: ['tenantId'], equals: tenantId } },
    }),
  ]);

  const checks = [
    { name: 'provisioning', status: tenant.provisioningStatus === 'COMPLETED' ? 'ok' : 'attention', detail: tenant.provisioningStatus },
    { name: 'lifecycle', status: tenant.status === 'FAILED' ? 'attention' : 'ok', detail: tenant.status },
    { name: 'domains', status: failedDomains > 0 ? 'attention' : 'ok', detail: `${domains - failedDomains}/${domains} healthy` },
    { name: 'approvals', status: pendingApprovals > 0 ? 'attention' : 'ok', detail: `${pendingApprovals} pending` },
    { name: 'provisioning-jobs', status: failedJobs > 0 ? 'attention' : 'ok', detail: `${failedJobs} failed` },
  ];

  const status = checks.some((check) => check.status === 'attention') ? 'degraded' : 'healthy';
  return { tenantId, status, checks, checkedAt: new Date().toISOString() };
}

export async function listTenantUsers(tenantId: string, req: Request) {
  const query = parseListQuery(req);
  const where = {
    tenantId,
    ...(query.search
      ? {
          user: {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
            ],
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.tenantMembership.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            status: true,
            lastLoginAt: true,
            mfaEnabled: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...paginationArgs(query),
    }),
    prisma.tenantMembership.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function listTenantActivity(tenantId: string, req: Request) {
  const query = parseListQuery(req);
  const where = { tenantId };
  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
    prisma.auditEvent.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getProvisioningStatus(tenantId: string) {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true, status: true, provisioningStatus: true, provisionAttempts: true, provisionError: true, provisionedAt: true },
  });
  if (!tenant) throw new NotFoundError('Tenant');

  const [latest, jobs] = await Promise.all([
    prisma.tenantProvisioning.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    prisma.backgroundJob.findMany({
      where: { type: 'TENANT_PROVISIONING', payload: { path: ['tenantId'], equals: tenantId } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, status: true, attempts: true, error: true, startedAt: true, completedAt: true, createdAt: true },
    }),
  ]);

  return { tenant, latestRun: latest, recentJobs: jobs };
}

export async function requestImpersonation(tenantId: string, input: ImpersonationInput, actor: ActorContext) {
  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
  if (!tenant) throw new NotFoundError('Tenant');
  if (tenant.status === 'ARCHIVED') throw new PreconditionFailedError('Support access is not available for archived tenants.');
  if (!actor.actorId) throw new PreconditionFailedError('A signed-in platform user is required to request support access.');

  const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60 * 1000);
  const session = await prisma.impersonationSession.create({
    data: {
      tenantId,
      requestedById: actor.actorId,
      targetUserId: input.userId ?? null,
      reason: input.reason,
      status: 'ACTIVE',
      startsAt: new Date(),
      expiresAt,
    },
  });

  await recordSecurityEvent({
    eventType: 'tenants.impersonation.granted',
    severity: 'HIGH',
    userId: actor.actorId,
    tenantId,
    req: actor.req,
    details: { impersonationSessionId: session.id, expiresAt: expiresAt.toISOString(), reason: input.reason },
  });
  await recordAudit({
    action: 'tenant.impersonation.requested',
    resourceType: 'tenant',
    resourceId: tenantId,
    tenantId,
    actorId: actor.actorId,
    after: { impersonationSessionId: session.id, expiresAt },
    req: actor.req,
  });

  return session;
}

export async function updateTenant(tenantId: string, input: UpdateTenantInput, actor: ActorContext): Promise<Tenant> {
  const existing = await tenantCrud.getById(tenantId);
  const data: Prisma.TenantUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.primaryContactName !== undefined) data.primaryContactName = input.primaryContactName;
  if (input.primaryContactEmail !== undefined) data.primaryContactEmail = input.primaryContactEmail;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.locale !== undefined) data.locale = input.locale;
  if (input.industry !== undefined) data.industry = input.industry;
  if (input.website !== undefined) data.website = input.website;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.metadata !== undefined) data.metadata = input.metadata as Prisma.InputJsonValue;

  const updated = await prisma.tenant.update({ where: { id: tenantId }, data });
  await recordAudit({
    action: 'tenant.updated',
    resourceType: 'tenant',
    resourceId: tenantId,
    tenantId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  return updated;
}
