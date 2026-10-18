import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { checkInfrastructure } from '../../database/health-check';
import { storage } from '../../config/storage';
import { getJobSchedulerState, runNotificationDeliveryJob, runSlaMonitorJob, runWebhookRetryJob } from '../../jobs';
import { BadRequestError, NotFoundError, PreconditionFailedError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { provisionTenant } from './tenants.service';
import { getSettingValue, updateSetting } from './platform-settings.service';
import { SETTING_KEYS } from '../../shared/constants';
import type { Request } from 'express';

export interface MonitoredService {
  serviceKey: string;
  name: string;
  status: 'ok' | 'degraded' | 'down' | 'not-configured';
  detail: string;
  latencyMs?: number;
  checkedAt: string;
}

export async function getSystemHealth() {
  const infrastructure = await checkInfrastructure();
  const [queuedJobs, runningJobs, failedJobs, pendingWebhooks, pendingReports] = await Promise.all([
    prisma.backgroundJob.count({ where: { status: 'QUEUED' } }),
    prisma.backgroundJob.count({ where: { status: 'RUNNING' } }),
    prisma.backgroundJob.count({ where: { status: 'FAILED' } }),
    prisma.webhookDelivery.count({ where: { status: 'PENDING' } }),
    prisma.reportJob.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } }),
  ]);

  return {
    status: infrastructure.database.ok ? (failedJobs > 0 ? 'degraded' : 'healthy') : 'down',
    version: env.APP_VERSION,
    environment: env.NODE_ENV,
    uptimeSeconds: infrastructure.uptimeSeconds,
    memoryBytes: infrastructure.memoryBytes,
    database: infrastructure.database,
    redis: infrastructure.redis,
    storage: infrastructure.storage,
    queues: { queuedJobs, runningJobs, failedJobs, pendingWebhooks, pendingReports },
    scheduler: getJobSchedulerState(),
    checkedAt: new Date().toISOString(),
  };
}

export async function listServices(): Promise<MonitoredService[]> {
  const checkedAt = new Date().toISOString();
  const infrastructure = await checkInfrastructure();
  const [failedJobs, defaultProvider, pendingWebhooks] = await Promise.all([
    prisma.backgroundJob.count({ where: { status: 'FAILED' } }),
    prisma.emailProvider.findFirst({ where: { isDefault: true } }),
    prisma.webhookDelivery.count({ where: { status: 'PENDING', nextRetryAt: { lte: new Date() } } }),
  ]);

  return [
    {
      serviceKey: 'api',
      name: 'API Process',
      status: 'ok',
      detail: `Node ${process.version}, version ${env.APP_VERSION}`,
      checkedAt,
    },
    {
      serviceKey: 'database',
      name: 'PostgreSQL Database',
      status: infrastructure.database.ok ? 'ok' : 'down',
      detail: infrastructure.database.ok ? 'Reachable' : (infrastructure.database.error ?? 'Unreachable'),
      latencyMs: infrastructure.database.latencyMs,
      checkedAt,
    },
    {
      serviceKey: 'redis',
      name: 'Redis Cache',
      status: infrastructure.redis.connected ? 'ok' : infrastructure.redis.configured ? 'degraded' : 'not-configured',
      detail: infrastructure.redis.connected ? 'Connected' : infrastructure.redis.configured ? 'Configured but unreachable — in-memory fallback active' : 'Not configured — in-memory fallback active',
      checkedAt,
    },
    {
      serviceKey: 'storage',
      name: 'File Storage',
      status: infrastructure.storage.ok ? 'ok' : 'degraded',
      detail: `${infrastructure.storage.baseDir} (${Math.round(infrastructure.storage.usedBytes / 1024)} KB)`,
      checkedAt,
    },
    {
      serviceKey: 'email',
      name: 'Email Delivery',
      status: defaultProvider ? (defaultProvider.status === 'ACTIVE' ? 'ok' : 'degraded') : env.SMTP_HOST ? 'ok' : 'not-configured',
      detail: defaultProvider
        ? `Provider "${defaultProvider.name}" is ${defaultProvider.status.toLowerCase()}`
        : env.SMTP_HOST
          ? 'Environment SMTP configured'
          : 'No provider configured — outbound email is suppressed',
      checkedAt,
    },
    {
      serviceKey: 'background-jobs',
      name: 'Background Jobs',
      status: failedJobs > 0 ? 'degraded' : 'ok',
      detail: failedJobs > 0 ? `${failedJobs} failed job(s) require attention` : 'All jobs healthy',
      checkedAt,
    },
    {
      serviceKey: 'webhooks',
      name: 'Webhook Delivery',
      status: pendingWebhooks > 25 ? 'degraded' : 'ok',
      detail: `${pendingWebhooks} deliveries due`,
      checkedAt,
    },
  ];
}

export async function getServiceDetail(serviceKey: string): Promise<MonitoredService> {
  const services = await listServices();
  const service = services.find((entry) => entry.serviceKey === serviceKey);
  if (!service) throw new NotFoundError('Monitored service');
  return service;
}

export async function getQueues() {
  const [jobCounts, webhookCounts, reportCounts, deliveryCounts] = await Promise.all([
    prisma.backgroundJob.groupBy({ by: ['type', 'status'], _count: { _all: true } }),
    prisma.webhookDelivery.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.reportJob.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.deliveryLog.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  return {
    backgroundJobsByType: jobCounts.map((row) => ({ type: row.type, status: row.status, count: row._count._all })),
    webhookDeliveries: webhookCounts.map((row) => ({ status: row.status, count: row._count._all })),
    reportJobs: reportCounts.map((row) => ({ status: row.status, count: row._count._all })),
    emailDeliveries: deliveryCounts.map((row) => ({ status: row.status, count: row._count._all })),
    scheduler: getJobSchedulerState(),
    generatedAt: new Date().toISOString(),
  };
}

export async function listJobs(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where = {
    ...(query.type ? { type: String(query.type) } : {}),
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.search ? { type: { contains: query.search, mode: 'insensitive' as const } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.backgroundJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, email: true } } },
      ...paginationArgs(query),
    }),
    prisma.backgroundJob.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getJob(jobId: string) {
  const job = await prisma.backgroundJob.findUnique({
    where: { id: jobId },
    include: { createdBy: { select: { id: true, email: true } } },
  });
  if (!job) throw new NotFoundError('Background job');
  return job;
}

export async function retryJob(jobId: string, req: Request) {
  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError('Background job');
  if (job.status === 'RUNNING') throw new PreconditionFailedError('A running job cannot be retried.');
  if (job.status === 'COMPLETED') throw new PreconditionFailedError('Completed jobs cannot be retried.');

  await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: 'QUEUED',
      error: null,
      result: undefined,
      attempts: job.attempts + 1,
      scheduledFor: new Date(),
      startedAt: null,
      completedAt: null,
    },
  });

  let executionResult: Record<string, unknown> | null = null;
  try {
    if (job.type === 'TENANT_PROVISIONING') {
      const payload = (job.payload ?? {}) as Record<string, unknown>;
      const tenantId = typeof payload['tenantId'] === 'string' ? payload['tenantId'] : null;
      if (!tenantId) throw new BadRequestError('The job payload does not contain a tenantId.');
      const result = await provisionTenant(tenantId, { actorId: req.auth?.userId ?? null, req });
      executionResult = { provisioningStatus: result.status };
    } else if (job.type === 'WEBHOOK_RETRY') {
      executionResult = await runWebhookRetryJob();
    } else if (job.type === 'NOTIFICATION_DELIVERY') {
      executionResult = await runNotificationDeliveryJob();
    } else if (job.type === 'SLA_MONITOR') {
      executionResult = await runSlaMonitorJob();
    }

    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: executionResult ? 'COMPLETED' : 'QUEUED',
        result: executionResult ? (executionResult as object) : undefined,
        completedAt: executionResult ? new Date() : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ jobId, error: message }, 'Job retry failed');
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: message.slice(0, 500), completedAt: new Date() },
    });
    throw error;
  }

  await recordAudit({ action: 'system-administration.job.retried', resourceType: 'background-job', resourceId: jobId, req });
  return getJob(jobId);
}

export async function cancelJob(jobId: string, req: Request) {
  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError('Background job');
  if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
    throw new PreconditionFailedError(`Job is already ${job.status.toLowerCase()}.`);
  }
  const updated = await prisma.backgroundJob.update({
    where: { id: jobId },
    data: { status: 'CANCELLED', completedAt: new Date() },
  });
  await recordAudit({ action: 'system-administration.job.cancelled', resourceType: 'background-job', resourceId: jobId, req });
  return updated;
}

export async function getMaintenanceSettings() {
  const [enabled, message, allowedIps] = await Promise.all([
    getSettingValue<boolean>(SETTING_KEYS.MAINTENANCE_MODE),
    getSettingValue<string>(SETTING_KEYS.MAINTENANCE_MESSAGE),
    getSettingValue<string[]>(SETTING_KEYS.MAINTENANCE_ALLOWED_IPS),
  ]);
  return { enabled: Boolean(enabled), message: message ?? '', allowedIps: Array.isArray(allowedIps) ? allowedIps : [] };
}

export async function updateMaintenanceSettings(
  input: { enabled?: boolean; message?: string; allowedIps?: string[] },
  req: Request,
) {
  if (input.enabled !== undefined) await updateSetting(SETTING_KEYS.MAINTENANCE_MODE, input.enabled, req);
  if (input.message !== undefined) await updateSetting(SETTING_KEYS.MAINTENANCE_MESSAGE, input.message, req);
  if (input.allowedIps !== undefined) await updateSetting(SETTING_KEYS.MAINTENANCE_ALLOWED_IPS, input.allowedIps, req);
  return getMaintenanceSettings();
}

export async function runDiagnostics() {
  const infrastructure = await checkInfrastructure();
  const checks: { name: string; status: 'ok' | 'warning' | 'failed'; detail: string }[] = [];

  checks.push({
    name: 'database',
    status: infrastructure.database.ok ? 'ok' : 'failed',
    detail: infrastructure.database.ok ? `Query round-trip ${infrastructure.database.latencyMs}ms` : infrastructure.database.error ?? 'Unreachable',
  });

  checks.push({
    name: 'redis',
    status: infrastructure.redis.connected ? 'ok' : 'warning',
    detail: infrastructure.redis.connected ? 'Connected' : 'Not connected — cache falls back to process memory',
  });

  try {
    const probeKey = path.join('diagnostics', `probe-${Date.now()}.txt`);
    await storage.writeFile(probeKey, 'probe');
    const exists = await storage.exists(probeKey);
    await storage.deleteFile(probeKey);
    checks.push({ name: 'storage-write', status: exists ? 'ok' : 'failed', detail: `Writable at ${storage.baseDir}` });
  } catch (error) {
    checks.push({
      name: 'storage-write',
      status: 'failed',
      detail: error instanceof Error ? error.message : 'Storage write probe failed',
    });
  }

  const configChecks: { name: string; ok: boolean }[] = [
    { name: 'JWT_SECRET', ok: env.JWT_SECRET.length >= 32 },
    { name: 'ENCRYPTION_KEY', ok: Boolean(env.ENCRYPTION_KEY) },
    { name: 'DATABASE_URL', ok: Boolean(env.DATABASE_URL) },
    { name: 'SMTP_CONFIGURED', ok: Boolean(env.SMTP_HOST) },
    { name: 'REDIS_CONFIGURED', ok: Boolean(env.REDIS_URL) },
  ];
  for (const check of configChecks) {
    checks.push({
      name: `config.${check.name}`,
      status: check.ok ? 'ok' : 'warning',
      detail: check.ok ? 'Configured' : 'Not configured',
    });
  }

  const stuckJobs = await prisma.backgroundJob.count({
    where: { status: 'RUNNING', startedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) } },
  });
  checks.push({
    name: 'stuck-jobs',
    status: stuckJobs > 0 ? 'warning' : 'ok',
    detail: stuckJobs > 0 ? `${stuckJobs} job(s) running longer than 30 minutes` : 'No stuck jobs',
  });

  return {
    checkedAt: new Date().toISOString(),
    status: checks.some((check) => check.status === 'failed') ? 'failed' : checks.some((check) => check.status === 'warning') ? 'warning' : 'ok',
    checks,
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssBytes: process.memoryUsage().rss,
      heapUsedBytes: process.memoryUsage().heapUsed,
    },
    storage: { baseDir: storage.baseDir, freeBytes: safeFreeBytes() },
  };
}

function safeFreeBytes(): number | null {
  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(storage.baseDir);
      return Number(stats.bavail) * Number(stats.bsize);
    }
  } catch {
    /* not supported on this platform */
  }
  return null;
}

export async function getVersion() {
  let prismaVersion = 'unknown';
  try {
    const requireFromHere = createRequire(__filename);
    prismaVersion = (requireFromHere('@prisma/client/package.json') as { version: string }).version;
  } catch {
    /* package metadata unavailable */
  }
  return {
    appName: env.APP_NAME,
    appVersion: env.APP_VERSION,
    environment: env.NODE_ENV,
    nodeVersion: process.version,
    prismaClientVersion: prismaVersion,
    apiPrefix: env.API_PREFIX,
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  };
}
