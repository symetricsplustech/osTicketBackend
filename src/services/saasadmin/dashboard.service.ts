import type { Request } from 'express';
import { prisma } from '../../config/database';
import { checkDatabase } from '../../database/health-check';
import { redisHealth } from '../../config/redis';
import { env } from '../../config/env';
import { storage } from '../../config/storage';
import { fallbackSmtpConfig } from '../../config/email';
import { bucketKey, dateRangeFromQuery, pickInterval, startOfUtcDay, addUtcDays } from '../../shared/utils/dates';
import { getJobSchedulerState } from '../../jobs';

export async function getSummary() {
  const [
    tenantTotal,
    tenantActive,
    tenantSuspended,
    tenantProvisioning,
    tenantArchived,
    tenantFailed,
    staffTotal,
    staffActive,
    staffInvited,
    staffMfaEnabled,
    openSupportTickets,
    pendingApprovals,
    enabledIntegrations,
    integrationsError,
    activeWebhooks,
  ] = await Promise.all([
    prisma.tenant.count({ where: { deletedAt: null } }),
    prisma.tenant.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.tenant.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
    prisma.tenant.count({ where: { status: 'PROVISIONING', deletedAt: null } }),
    prisma.tenant.count({ where: { status: 'ARCHIVED', deletedAt: null } }),
    prisma.tenant.count({ where: { status: 'FAILED', deletedAt: null } }),
    prisma.user.count({ where: { userType: 'PLATFORM_STAFF', deletedAt: null } }),
    prisma.user.count({ where: { userType: 'PLATFORM_STAFF', status: 'ACTIVE', deletedAt: null } }),
    prisma.user.count({ where: { userType: 'PLATFORM_STAFF', status: 'INVITED', deletedAt: null } }),
    prisma.user.count({ where: { userType: 'PLATFORM_STAFF', mfaEnabled: true, deletedAt: null } }),
    prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING', 'REOPENED'] } } }),
    prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
    prisma.integration.count({ where: { status: 'ENABLED' } }),
    prisma.integration.count({ where: { status: 'ERROR' } }),
    prisma.webhook.count({ where: { isEnabled: true } }),
  ]);

  return {
    tenants: {
      total: tenantTotal,
      active: tenantActive,
      suspended: tenantSuspended,
      provisioning: tenantProvisioning,
      archived: tenantArchived,
      failed: tenantFailed,
    },
    staff: {
      total: staffTotal,
      active: staffActive,
      invited: staffInvited,
      mfaEnabled: staffMfaEnabled,
      mfaAdoptionPercent: staffTotal > 0 ? Math.round((staffMfaEnabled / staffTotal) * 100) : 0,
    },
    support: { openTickets: openSupportTickets },
    approvals: { pending: pendingApprovals },
    integrations: { enabled: enabledIntegrations, error: integrationsError },
    webhooks: { active: activeWebhooks },
    generatedAt: new Date().toISOString(),
  };
}

export async function getTenantGrowth(req: Request) {
  const { from, to } = dateRangeFromQuery(req.query as Record<string, unknown>, { days: 90 });
  const interval = pickInterval(from, to);

  const tenants = await prisma.tenant.findMany({
    where: { createdAt: { gte: from, lte: to }, deletedAt: null },
    select: { createdAt: true, activatedAt: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  const buckets = new Map<string, { created: number; activated: number }>();
  for (let cursor = startOfUtcDay(from); cursor <= to; cursor = addUtcDays(cursor, 1)) {
    buckets.set(bucketKey(cursor, interval), { created: 0, activated: 0 });
  }

  for (const tenant of tenants) {
    const createdBucket = bucketKey(tenant.createdAt, interval);
    if (buckets.has(createdBucket)) buckets.get(createdBucket)!.created += 1;
    if (tenant.activatedAt && tenant.activatedAt >= from && tenant.activatedAt <= to) {
      const activatedBucket = bucketKey(tenant.activatedAt, interval);
      if (buckets.has(activatedBucket)) buckets.get(activatedBucket)!.activated += 1;
    }
  }

  const priorTotal = await prisma.tenant.count({ where: { createdAt: { lt: from }, deletedAt: null } });
  let cumulative = priorTotal;
  const series = Array.from(buckets.entries()).map(([bucket, counts]) => {
    cumulative += counts.created;
    return { period: bucket, created: counts.created, activated: counts.activated, cumulativeTenants: cumulative };
  });

  return { interval, from: from.toISOString(), to: to.toISOString(), series, newInRange: tenants.length };
}

export async function getTenantStatusBreakdown() {
  const grouped = await prisma.tenant.groupBy({
    by: ['status'],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  const provisioning = await prisma.tenant.groupBy({
    by: ['provisioningStatus'],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  return {
    byStatus: grouped.map((row) => ({ status: row.status, count: row._count._all })),
    byProvisioning: provisioning.map((row) => ({ status: row.provisioningStatus, count: row._count._all })),
  };
}

export async function getPlatformHealth() {
  const database = await checkDatabase();
  const [jobCounts, webhookBacklog, emailProvider, recentErrors] = await Promise.all([
    prisma.backgroundJob.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.webhookDelivery.count({ where: { status: 'PENDING' } }),
    prisma.emailProvider.findFirst({ where: { isDefault: true }, select: { id: true, name: true, status: true, lastTestedAt: true } }),
    prisma.securityEvent.count({
      where: { severity: { in: ['HIGH', 'CRITICAL'] }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const emailStatus = emailProvider
    ? { source: 'database', name: emailProvider.name, status: emailProvider.status, lastTestedAt: emailProvider.lastTestedAt }
    : fallbackSmtpConfig()
      ? { source: 'environment', name: 'SMTP (environment)', status: 'CONFIGURED' as const, lastTestedAt: null }
      : { source: 'none', name: null, status: 'NOT_CONFIGURED' as const, lastTestedAt: null };

  const scheduler = getJobSchedulerState();
  const failingJobs = jobCounts.find((row) => row.status === 'FAILED')?._count._all ?? 0;

  const components = [
    { name: 'database', status: database.ok ? 'ok' : 'down', detail: `${database.latencyMs}ms` },
    {
      name: 'redis',
      status: redisHealth().connected ? 'ok' : redisHealth().configured ? 'degraded' : 'not-configured',
      detail: redisHealth().connected ? 'connected' : redisHealth().configured ? 'unreachable — using in-memory fallback' : 'in-memory fallback',
    },
    { name: 'storage', status: 'ok', detail: `${Math.round(storage.statSizeSync() / 1024)} KB used` },
    { name: 'email', status: emailStatus.status === 'ACTIVE' || emailStatus.status === 'CONFIGURED' ? 'ok' : 'attention', detail: emailStatus.name ?? 'no provider configured' },
    { name: 'background-jobs', status: failingJobs > 0 ? 'attention' : 'ok', detail: `${failingJobs} failed` },
    { name: 'webhooks', status: webhookBacklog > 20 ? 'attention' : 'ok', detail: `${webhookBacklog} pending deliveries` },
  ];

  return {
    status: components.some((component) => component.status === 'down') ? 'down' : components.some((component) => component.status === 'attention' || component.status === 'degraded') ? 'degraded' : 'healthy',
    environment: env.NODE_ENV,
    version: env.APP_VERSION,
    uptimeSeconds: Math.round(process.uptime()),
    components,
    email: emailStatus,
    jobs: {
      schedulerRunning: scheduler.started,
      byStatus: jobCounts.map((row) => ({ status: row.status, count: row._count._all })),
    },
    recentHighSeverityEvents24h: recentErrors,
    checkedAt: new Date().toISOString(),
  };
}

export async function getRecentActivity(req: Request) {
  const limit = Math.min(50, Math.max(1, Number.parseInt(String((req.query as Record<string, unknown>).limit ?? '20'), 10) || 20));
  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      actor: { select: { id: true, email: true, firstName: true, lastName: true } },
      tenant: { select: { id: true, name: true, slug: true } },
    },
  });
  return events.map((event) => ({
    id: event.id,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    outcome: event.outcome,
    actor: event.actor ? { id: event.actor.id, email: event.actor.email, name: `${event.actor.firstName} ${event.actor.lastName}` } : { email: event.actorEmail },
    tenant: event.tenant,
    requestId: event.requestId,
    createdAt: event.createdAt,
  }));
}

export async function getAlerts() {
  const now = Date.now();
  const alerts: { id: string; severity: 'info' | 'warning' | 'critical'; category: string; title: string; detail: string; link: string }[] = [];

  const failedProvisioning = await prisma.tenant.findMany({
    where: { provisioningStatus: 'FAILED', deletedAt: null },
    select: { id: true, name: true, slug: true, provisionError: true },
    take: 10,
  });
  for (const tenant of failedProvisioning) {
    alerts.push({
      id: `tenant-provisioning-${tenant.id}`,
      severity: 'critical',
      category: 'provisioning',
      title: `Provisioning failed for ${tenant.name}`,
      detail: tenant.provisionError ?? 'Provisioning did not complete.',
      link: `/saas-admin/tenants/${tenant.id}/provisioning`,
    });
  }

  const failingWebhooks = await prisma.webhook.findMany({
    where: { failureCount: { gte: 3 }, isEnabled: true },
    select: { id: true, name: true, failureCount: true },
    take: 10,
  });
  for (const webhook of failingWebhooks) {
    alerts.push({
      id: `webhook-${webhook.id}`,
      severity: 'warning',
      category: 'webhooks',
      title: `Webhook ${webhook.name} is failing`,
      detail: `${webhook.failureCount} consecutive delivery failures.`,
      link: `/saas-admin/webhooks/${webhook.id}`,
    });
  }

  const errorIntegrations = await prisma.integration.findMany({
    where: { status: 'ERROR' },
    select: { id: true, name: true, lastTestResult: true },
    take: 10,
  });
  for (const integration of errorIntegrations) {
    alerts.push({
      id: `integration-${integration.id}`,
      severity: 'warning',
      category: 'integrations',
      title: `Integration ${integration.name} is in error`,
      detail: integration.lastTestResult ?? 'The most recent connectivity test failed.',
      link: `/saas-admin/integrations/${integration.id}`,
    });
  }

  const failedJobs = await prisma.backgroundJob.count({ where: { status: 'FAILED' } });
  if (failedJobs > 0) {
    alerts.push({
      id: 'background-jobs-failed',
      severity: 'warning',
      category: 'jobs',
      title: `${failedJobs} background job(s) failed`,
      detail: 'Review and retry failed jobs from System Administration.',
      link: '/saas-admin/system-administration/jobs',
    });
  }

  const stuckApprovals = await prisma.approvalRequest.count({
    where: { status: 'PENDING', createdAt: { lt: new Date(now - 48 * 60 * 60 * 1000) } },
  });
  if (stuckApprovals > 0) {
    alerts.push({
      id: 'approvals-stale',
      severity: 'info',
      category: 'approvals',
      title: `${stuckApprovals} approval request(s) pending over 48 hours`,
      detail: 'Pending platform actions are waiting for approvers.',
      link: '/saas-admin/approvals/requests',
    });
  }

  const requireMfa = await prisma.platformSetting.findUnique({ where: { key: 'security.requireMfaForStaff' } });
  if (requireMfa && (requireMfa.value as unknown) === true) {
    const staffWithoutMfa = await prisma.user.count({
      where: { userType: 'PLATFORM_STAFF', status: 'ACTIVE', mfaEnabled: false, deletedAt: null },
    });
    if (staffWithoutMfa > 0) {
      alerts.push({
        id: 'staff-mfa-missing',
        severity: 'warning',
        category: 'security',
        title: `${staffWithoutMfa} active staff account(s) without MFA`,
        detail: 'Platform policy requires MFA for staff. These accounts are non-compliant.',
        link: '/saas-admin/staff',
      });
    }
  }

  const expiringKeys = await prisma.apiKey.findMany({
    where: {
      revokedAt: null,
      expiresAt: { not: null, lte: new Date(now + 14 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, name: true, expiresAt: true },
    take: 10,
  });
  for (const key of expiringKeys) {
    const expired = key.expiresAt && key.expiresAt.getTime() < now;
    alerts.push({
      id: `api-key-${key.id}`,
      severity: expired ? 'warning' : 'info',
      category: 'api-keys',
      title: expired ? `API key ${key.name} has expired` : `API key ${key.name} expires soon`,
      detail: key.expiresAt ? `Expires ${key.expiresAt.toISOString()}` : '',
      link: `/saas-admin/api-keys/${key.id}`,
    });
  }

  return { alerts, count: alerts.length, generatedAt: new Date().toISOString() };
}

export async function getWorkQueue(req: Request) {
  const limit = Math.min(25, Math.max(1, Number.parseInt(String((req.query as Record<string, unknown>).limit ?? '10'), 10) || 10));

  const [approvals, tickets, jobs, pendingDeliveries] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: { requestedBy: { select: { email: true, firstName: true, lastName: true } } },
    }),
    prisma.supportTicket.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING', 'REOPENED'] } },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true, ticketNumber: true, subject: true, priority: true, status: true, createdAt: true },
    }),
    prisma.backgroundJob.findMany({
      where: { status: { in: ['QUEUED', 'FAILED'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, type: true, status: true, attempts: true, error: true, createdAt: true },
    }),
    prisma.webhookDelivery.count({ where: { status: 'PENDING', nextRetryAt: { lte: new Date() } } }),
  ]);

  return {
    pendingApprovals: approvals.map((approval) => ({
      id: approval.id,
      actionKey: approval.actionKey,
      resourceType: approval.resourceType,
      resourceId: approval.resourceId,
      requestedBy: approval.requestedBy.email,
      createdAt: approval.createdAt,
    })),
    openSupportTickets: tickets,
    backgroundJobs: jobs,
    webhookDeliveriesDue: pendingDeliveries,
    counts: {
      pendingApprovals: await prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
      openSupportTickets: await prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING', 'REOPENED'] } } }),
      failedJobs: await prisma.backgroundJob.count({ where: { status: 'FAILED' } }),
    },
  };
}
