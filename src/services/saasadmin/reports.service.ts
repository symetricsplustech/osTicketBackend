import path from 'path';
import type { Request } from 'express';
import type { Prisma, ReportJob } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { BadRequestError, NotFoundError, PreconditionFailedError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import { storage, resolveStoragePath } from '../../config/storage';
import { toCsv } from '../../shared/utils/csv';
import { bucketKey, dateRangeFromQuery, pickInterval } from '../../shared/utils/dates';

export interface ReportDefinition {
  key: string;
  name: string;
  description: string;
  category: string;
  columns: string[];
}

export interface ReportResult {
  columns: string[];
  rows: Record<string, unknown>[];
  summary?: Record<string, unknown>;
}

const TENANT_INVENTORY: ReportDefinition = {
  key: 'tenant-inventory',
  name: 'Tenant Inventory',
  description: 'All tenants with lifecycle status, provisioning state and resource counts.',
  category: 'tenants',
  columns: ['id', 'name', 'slug', 'status', 'provisioningStatus', 'timezone', 'members', 'domains', 'supportTickets', 'createdAt', 'activatedAt'],
};

const TENANT_USAGE: ReportDefinition = {
  key: 'tenant-usage',
  name: 'Tenant Usage',
  description: 'Aggregated per-tenant usage: members, service assignments, API keys, audit activity.',
  category: 'tenants',
  columns: ['tenantId', 'name', 'slug', 'status', 'members', 'enabledServices', 'apiKeys', 'auditEvents', 'lastActivityAt'],
};

const PLATFORM_ACTIVITY: ReportDefinition = {
  key: 'platform-activity',
  name: 'Platform Activity',
  description: 'Administrative activity volume per period with distinct actors.',
  category: 'operations',
  columns: ['period', 'events', 'successful', 'failed', 'denied', 'distinctActors'],
};

const SECURITY_SUMMARY: ReportDefinition = {
  key: 'security-summary',
  name: 'Security Summary',
  description: 'Login outcomes, MFA adoption and security events by severity.',
  category: 'security',
  columns: ['metric', 'value'],
};

const AUDIT_EVENTS: ReportDefinition = {
  key: 'audit-events',
  name: 'Audit Events Export',
  description: 'Detailed audit event rows with optional filters.',
  category: 'security',
  columns: ['id', 'createdAt', 'actorEmail', 'action', 'resourceType', 'resourceId', 'tenantId', 'outcome', 'ipAddress', 'requestId'],
};

const STAFF_ACCESS: ReportDefinition = {
  key: 'staff-access',
  name: 'Staff Access Review',
  description: 'Platform staff accounts with roles, MFA status and last sign-in.',
  category: 'security',
  columns: ['id', 'email', 'name', 'status', 'mfaEnabled', 'roles', 'lastLoginAt', 'createdAt'],
};

const API_KEY_USAGE: ReportDefinition = {
  key: 'api-key-usage',
  name: 'API Key Usage',
  description: 'API keys with request counts and error rates for the selected period.',
  category: 'integrations',
  columns: ['id', 'name', 'keyPrefix', 'scopes', 'requests', 'errors', 'lastUsedAt', 'revokedAt', 'expiresAt'],
};

const SUPPORT_TICKETS: ReportDefinition = {
  key: 'support-tickets',
  name: 'Support Ticket Report',
  description: 'Platform support tickets with status, priority, queue and SLA-relevant timestamps.',
  category: 'support',
  columns: ['ticketNumber', 'subject', 'status', 'priority', 'requesterEmail', 'assignee', 'queue', 'createdAt', 'resolvedAt'],
};

export const REPORT_CATALOG: ReportDefinition[] = [
  TENANT_INVENTORY,
  TENANT_USAGE,
  PLATFORM_ACTIVITY,
  SECURITY_SUMMARY,
  AUDIT_EVENTS,
  STAFF_ACCESS,
  API_KEY_USAGE,
  SUPPORT_TICKETS,
];

const catalogIndex = new Map(REPORT_CATALOG.map((definition) => [definition.key, definition]));

function rangeFilters(filters: Record<string, unknown>): { from: Date; to: Date } {
  return dateRangeFromQuery(filters, { days: 30 });
}

async function runTenantInventory(filters: Record<string, unknown>, limit: number): Promise<ReportResult> {
  const where: Prisma.TenantWhereInput = {
    deletedAt: null,
    ...(filters.status ? { status: filters.status as never } : {}),
  };
  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      _count: { select: { memberships: true, domains: true, supportTickets: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return {
    columns: TENANT_INVENTORY.columns,
    rows: tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      provisioningStatus: tenant.provisioningStatus,
      timezone: tenant.timezone,
      members: tenant._count.memberships,
      domains: tenant._count.domains,
      supportTickets: tenant._count.supportTickets,
      createdAt: tenant.createdAt.toISOString(),
      activatedAt: tenant.activatedAt?.toISOString() ?? '',
    })),
  };
}

async function runTenantUsage(filters: Record<string, unknown>, limit: number): Promise<ReportResult> {
  const { from, to } = rangeFilters(filters);
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: {
          memberships: true,
          serviceAssignments: true,
          apiKeys: true,
          auditEvents: true,
        },
      },
    },
    orderBy: { name: 'asc' },
    take: limit,
  });

  const activityRows = await prisma.auditEvent.groupBy({
    by: ['tenantId'],
    where: { tenantId: { not: null }, createdAt: { gte: from, lte: to } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const activityIndex = new Map(activityRows.map((row) => [row.tenantId, row]));

  return {
    columns: TENANT_USAGE.columns,
    rows: tenants.map((tenant) => {
      const activity = activityIndex.get(tenant.id);
      return {
        tenantId: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        members: tenant._count.memberships,
        enabledServices: tenant._count.serviceAssignments,
        apiKeys: tenant._count.apiKeys,
        auditEvents: activity?._count._all ?? 0,
        lastActivityAt: activity?._max.createdAt?.toISOString() ?? '',
      };
    }),
  };
}

async function runPlatformActivity(filters: Record<string, unknown>): Promise<ReportResult> {
  const { from, to } = rangeFilters(filters);
  const interval = pickInterval(from, to);
  const events = await prisma.auditEvent.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { createdAt: true, outcome: true, actorId: true },
    orderBy: { createdAt: 'asc' },
  });

  const buckets = new Map<string, { events: number; successful: number; failed: number; denied: number; actors: Set<string> }>();
  for (const event of events) {
    const key = bucketKey(event.createdAt, interval);
    if (!buckets.has(key)) buckets.set(key, { events: 0, successful: 0, failed: 0, denied: 0, actors: new Set() });
    const bucket = buckets.get(key)!;
    bucket.events += 1;
    if (event.outcome === 'SUCCESS') bucket.successful += 1;
    else if (event.outcome === 'DENIED') bucket.denied += 1;
    else bucket.failed += 1;
    if (event.actorId) bucket.actors.add(event.actorId);
  }

  return {
    columns: PLATFORM_ACTIVITY.columns,
    rows: Array.from(buckets.entries()).map(([period, bucket]) => ({
      period,
      events: bucket.events,
      successful: bucket.successful,
      failed: bucket.failed,
      denied: bucket.denied,
      distinctActors: bucket.actors.size,
    })),
    summary: { totalEvents: events.length, from: from.toISOString(), to: to.toISOString() },
  };
}

async function runSecuritySummary(filters: Record<string, unknown>): Promise<ReportResult> {
  const { from, to } = rangeFilters(filters);
  const [logins, staff, mfaEnabled, securityBySeverity, privilegedActions, lockedAccounts] = await Promise.all([
    prisma.loginEvent.groupBy({ by: ['outcome'], where: { createdAt: { gte: from, lte: to } }, _count: { _all: true } }),
    prisma.user.count({ where: { userType: 'PLATFORM_STAFF', deletedAt: null } }),
    prisma.user.count({ where: { userType: 'PLATFORM_STAFF', mfaEnabled: true, deletedAt: null } }),
    prisma.securityEvent.groupBy({ by: ['severity'], where: { createdAt: { gte: from, lte: to } }, _count: { _all: true } }),
    prisma.auditEvent.count({
      where: {
        createdAt: { gte: from, lte: to },
        OR: [
          { action: { startsWith: 'tenant.' } },
          { action: { startsWith: 'staff.' } },
          { action: { startsWith: 'apikey.' } },
          { action: { startsWith: 'approval.approved' } },
        ],
      },
    }),
    prisma.user.count({ where: { lockedUntil: { gt: new Date() } } }),
  ]);

  const rows: Record<string, unknown>[] = [];
  for (const login of logins) rows.push({ metric: `logins.${login.outcome.toLowerCase()}`, value: login._count._all });
  for (const event of securityBySeverity) rows.push({ metric: `security_events.${event.severity.toLowerCase()}`, value: event._count._all });
  rows.push({ metric: 'staff.total', value: staff });
  rows.push({ metric: 'staff.mfa_enabled', value: mfaEnabled });
  rows.push({ metric: 'staff.mfa_adoption_percent', value: staff > 0 ? Math.round((mfaEnabled / staff) * 100) : 0 });
  rows.push({ metric: 'privileged_actions', value: privilegedActions });
  rows.push({ metric: 'locked_accounts', value: lockedAccounts });

  return { columns: SECURITY_SUMMARY.columns, rows };
}

async function runAuditEvents(filters: Record<string, unknown>, limit: number): Promise<ReportResult> {
  const { from, to } = rangeFilters(filters);
  const where: Prisma.AuditEventWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(filters.action ? { action: { contains: String(filters.action), mode: 'insensitive' } } : {}),
    ...(filters.resourceType ? { resourceType: String(filters.resourceType) } : {}),
    ...(filters.tenantId ? { tenantId: String(filters.tenantId) } : {}),
    ...(filters.actorId ? { actorId: String(filters.actorId) } : {}),
  };
  const events = await prisma.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
  return {
    columns: AUDIT_EVENTS.columns,
    rows: events.map((event) => ({
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      actorEmail: event.actorEmail ?? '',
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId ?? '',
      tenantId: event.tenantId ?? '',
      outcome: event.outcome,
      ipAddress: event.ipAddress ?? '',
      requestId: event.requestId ?? '',
    })),
  };
}

async function runStaffAccess(limit: number): Promise<ReportResult> {
  const staff = await prisma.user.findMany({
    where: { userType: 'PLATFORM_STAFF', deletedAt: null },
    include: { staffRoleAssignments: { include: { role: { select: { key: true } } } } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  return {
    columns: STAFF_ACCESS.columns,
    rows: staff.map((user) => ({
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      roles: user.staffRoleAssignments.map((assignment) => assignment.role.key).join(' | '),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? '',
      createdAt: user.createdAt.toISOString(),
    })),
  };
}

async function runApiKeyUsage(filters: Record<string, unknown>, limit: number): Promise<ReportResult> {
  const { from, to } = rangeFilters(filters);
  const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  const usage = await prisma.apiKeyUsage.groupBy({
    by: ['apiKeyId'],
    where: { createdAt: { gte: from, lte: to } },
    _count: { _all: true },
  });
  const usageIndex = new Map(usage.map((row) => [row.apiKeyId, row._count._all]));
  const errors = await prisma.apiKeyUsage.groupBy({
    by: ['apiKeyId'],
    where: { createdAt: { gte: from, lte: to }, statusCode: { gte: 400 } },
    _count: { _all: true },
  });
  const errorIndex = new Map(errors.map((row) => [row.apiKeyId, row._count._all]));

  return {
    columns: API_KEY_USAGE.columns,
    rows: keys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: Array.isArray(key.scopes) ? (key.scopes as unknown[]).join(' | ') : '',
      requests: usageIndex.get(key.id) ?? 0,
      errors: errorIndex.get(key.id) ?? 0,
      lastUsedAt: key.lastUsedAt?.toISOString() ?? '',
      revokedAt: key.revokedAt?.toISOString() ?? '',
      expiresAt: key.expiresAt?.toISOString() ?? '',
    })),
  };
}

async function runSupportTickets(filters: Record<string, unknown>, limit: number): Promise<ReportResult> {
  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.priority ? { priority: filters.priority as never } : {}),
    },
    include: {
      assignee: { select: { email: true } },
      queue: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return {
    columns: SUPPORT_TICKETS.columns,
    rows: tickets.map((ticket) => ({
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      requesterEmail: ticket.requesterEmail,
      assignee: ticket.assignee?.email ?? '',
      queue: ticket.queue?.name ?? '',
      createdAt: ticket.createdAt.toISOString(),
      resolvedAt: ticket.resolvedAt?.toISOString() ?? '',
    })),
  };
}

export async function executeReport(reportKey: string, filters: Record<string, unknown>, limit: number): Promise<ReportResult> {
  const definition = catalogIndex.get(reportKey);
  if (!definition) throw new NotFoundError(`Report "${reportKey}"`);
  const cappedLimit = Math.min(limit, env.REPORT_MAX_ROWS);

  switch (reportKey) {
    case 'tenant-inventory':
      return runTenantInventory(filters, cappedLimit);
    case 'tenant-usage':
      return runTenantUsage(filters, cappedLimit);
    case 'platform-activity':
      return runPlatformActivity(filters);
    case 'security-summary':
      return runSecuritySummary(filters);
    case 'audit-events':
      return runAuditEvents(filters, cappedLimit);
    case 'staff-access':
      return runStaffAccess(cappedLimit);
    case 'api-key-usage':
      return runApiKeyUsage(filters, cappedLimit);
    case 'support-tickets':
      return runSupportTickets(filters, cappedLimit);
    default:
      throw new NotFoundError(`Report "${reportKey}"`);
  }
}

export async function getCatalog() {
  return REPORT_CATALOG.map((definition) => ({ ...definition, formats: ['JSON', 'CSV'] }));
}

export async function runReport(input: { reportKey: string; filters?: Record<string, unknown>; limit: number }, requestedById: string, req: Request) {
  const startedAt = Date.now();
  const result = await executeReport(input.reportKey, input.filters ?? {}, input.limit);

  const job = await prisma.reportJob.create({
    data: {
      kind: 'REPORT',
      reportKey: input.reportKey,
      format: 'JSON',
      filters: (input.filters ?? {}) as Prisma.InputJsonValue,
      status: 'COMPLETED',
      requestedById,
      rowCount: result.rows.length,
      startedAt: new Date(startedAt),
      completedAt: new Date(),
    },
  });

  await recordAudit({
    action: 'reports.run',
    resourceType: 'report',
    resourceId: job.id,
    metadata: { reportKey: input.reportKey, rowCount: result.rows.length, durationMs: Date.now() - startedAt },
    req,
  });

  return { runId: job.id, reportKey: input.reportKey, columns: result.columns, rows: result.rows, summary: result.summary, rowCount: result.rows.length };
}

export async function listRuns(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.ReportJobWhereInput = {
    ...(query.kind ? { kind: query.kind as never } : {}),
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.search ? { reportKey: { contains: query.search, mode: 'insensitive' } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.reportJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } } },
      ...paginationArgs(query),
    }),
    prisma.reportJob.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getRun(runId: string) {
  const job = await prisma.reportJob.findUnique({
    where: { id: runId },
    include: { requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  if (!job) throw new NotFoundError('Report run');
  return job;
}

export function exportExpiresAt(job: Pick<ReportJob, 'kind' | 'completedAt' | 'createdAt'>): Date | null {
  if (job.kind !== 'EXPORT') return null;
  const base = job.completedAt ?? job.createdAt;
  return new Date(base.getTime() + env.REPORT_EXPORT_TTL_HOURS * 60 * 60 * 1000);
}

function serializeJob(job: ReportJob & { requestedBy?: unknown }) {
  const expiresAt = job.status === 'COMPLETED' ? exportExpiresAt(job) : null;
  const expired = Boolean(expiresAt && expiresAt.getTime() <= Date.now());
  const { filePath, ...rest } = job;
  return {
    ...rest,
    hasFile: Boolean(filePath),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    expired,
    downloadable: job.status === 'COMPLETED' && Boolean(filePath) && !expired,
  };
}

export async function listExports(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const status = typeof query.status === 'string' ? query.status.toUpperCase() : undefined;
  const validStatuses = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'];

  const where: Prisma.ReportJobWhereInput = {
    kind: 'EXPORT',
    ...(query.reportKey ? { reportKey: String(query.reportKey) } : {}),
    ...(status && validStatuses.includes(status) ? { status: status as Prisma.ReportJobWhereInput['status'] } : {}),
    ...(query.search ? { reportKey: { contains: String(query.search), mode: 'insensitive' } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.reportJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...paginationArgs(query),
      include: { requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } } },
    }),
    prisma.reportJob.count({ where }),
  ]);

  return { rows: rows.map(serializeJob), meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getExport(exportId: string) {
  const job = await prisma.reportJob.findUnique({
    where: { id: exportId },
    include: { requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });
  if (!job || job.kind !== 'EXPORT') throw new NotFoundError('Export');
  return serializeJob(job);
}

export async function getDownload(runId: string): Promise<{ job: ReportJob; absolutePath: string; fileName: string }> {
  const job = await getRun(runId);
  if (job.status !== 'COMPLETED') throw new PreconditionFailedError('The report has not completed yet.');
  if (!job.filePath) throw new PreconditionFailedError('This run does not have a downloadable file. Use an export to generate one.');
  const expiresAt = exportExpiresAt(job);
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new PreconditionFailedError('This export has expired. Generate a new export to download the data again.');
  }
  if (!(await storage.exists(job.filePath))) throw new NotFoundError('Report file');
  return { job, absolutePath: resolveStoragePath(job.filePath), fileName: path.basename(job.filePath) };
}

export async function createReportJob(input: {
  reportKey: string;
  kind: 'REPORT' | 'EXPORT';
  format: 'CSV' | 'JSON';
  filters: Record<string, unknown>;
  requestedById: string;
  tenantScope?: string | null;
}) {
  if (!catalogIndex.has(input.reportKey)) {
    throw new BadRequestError(`Unknown report "${input.reportKey}".`);
  }
  const job = await prisma.reportJob.create({
    data: {
      kind: input.kind,
      reportKey: input.reportKey,
      format: input.format,
      filters: input.filters as Prisma.InputJsonValue,
      status: 'QUEUED',
      requestedById: input.requestedById,
      tenantScope: input.tenantScope ?? null,
    },
  });
  await recordAudit({
    action: input.kind === 'EXPORT' ? 'reports.export.requested' : 'reports.job.created',
    resourceType: 'report',
    resourceId: job.id,
    metadata: { reportKey: input.reportKey, format: input.format },
  });
  return job;
}

async function processJob(job: ReportJob): Promise<void> {
  await prisma.reportJob.update({ where: { id: job.id }, data: { status: 'RUNNING', startedAt: new Date() } });
  try {
    const filters = (job.filters ?? {}) as Record<string, unknown>;
    const result = await executeReport(job.reportKey, filters, env.REPORT_MAX_ROWS);
    const extension = job.format === 'CSV' ? 'csv' : 'json';
    const relativeKey = path.join('reports', `${job.id}.${extension}`);
    const content = job.format === 'CSV' ? toCsv(result.rows, result.columns) : JSON.stringify(result, null, 2);
    await storage.writeFile(relativeKey, content);

    await prisma.reportJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', rowCount: result.rows.length, filePath: relativeKey, completedAt: new Date(), error: null },
    });

    await recordAudit({
      action: 'reports.completed',
      resourceType: 'report',
      resourceId: job.id,
      actorId: job.requestedById,
      metadata: { reportKey: job.reportKey, rowCount: result.rows.length, format: job.format },
    });
    void publishEvent({
      eventKey: 'report.completed',
      tenantId: job.tenantScope,
      payload: { reportJobId: job.id, reportKey: job.reportKey, rowCount: result.rows.length },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ reportJobId: job.id, error: message }, 'Report job failed');
    await prisma.reportJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', error: message.slice(0, 500), completedAt: new Date() },
    });
    await recordAudit({
      action: 'reports.failed',
      resourceType: 'report',
      resourceId: job.id,
      actorId: job.requestedById,
      outcome: 'FAILURE',
      metadata: { reportKey: job.reportKey, error: message.slice(0, 300) },
    });
  }
}

export async function processQueuedReportJobs(limit = 3): Promise<number> {
  const jobs = await prisma.reportJob.findMany({
    where: { status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  for (const job of jobs) {
    await processJob(job);
  }
  return jobs.length;
}

export async function cancelExport(exportId: string, req: Request) {
  const job = await prisma.reportJob.findUnique({ where: { id: exportId } });
  if (!job) throw new NotFoundError('Export');
  if (job.status !== 'QUEUED') throw new PreconditionFailedError('Only queued exports can be cancelled.');
  const updated = await prisma.reportJob.update({ where: { id: exportId }, data: { status: 'CANCELLED', completedAt: new Date() } });
  await recordAudit({ action: 'reports.export.cancelled', resourceType: 'report', resourceId: exportId, req });
  return updated;
}

export async function getTenantUsageOverview(req: Request) {
  const result = await runTenantUsage(req.query as Record<string, unknown>, 200);
  return { generatedAt: new Date().toISOString(), rows: result.rows, columns: result.columns };
}

export async function getActivityOverview(req: Request) {
  const result = await runPlatformActivity(req.query as Record<string, unknown>);
  return { generatedAt: new Date().toISOString(), rows: result.rows, summary: result.summary };
}

export async function getSecurityOverview(req: Request) {
  const result = await runSecuritySummary(req.query as Record<string, unknown>);
  const recentFailures = await prisma.loginEvent.findMany({
    where: { outcome: { in: ['FAILURE', 'LOCKED', 'MFA_FAILED'] }, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return {
    generatedAt: new Date().toISOString(),
    metrics: result.rows,
    recentFailedLogins: recentFailures.map((event) => ({
      email: event.email,
      outcome: event.outcome,
      failureReason: event.failureReason,
      ipAddress: event.ipAddress,
      createdAt: event.createdAt,
    })),
  };
}
