import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { recordAudit } from '../../shared/audit';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import type { TenantActorContext } from '../tenantadmin/roles.service';
import { reportsService } from './reports.service';

export const exportService = {
  async list(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 100 });
    const where = { tenantScope: tenantId, kind: 'EXPORT' as const };
    const [rows, total] = await Promise.all([
      prisma.reportJob.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      prisma.reportJob.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async run(tenantId: string, input: { resourceKey: string; format?: string; filters?: Record<string, unknown> }, actor: TenantActorContext) {
    const job = await prisma.reportJob.create({
      data: {
        kind: 'EXPORT',
        reportKey: input.resourceKey,
        format: input.format ?? 'CSV',
        filters: (input.filters ?? {}) as Prisma.InputJsonValue,
        status: 'QUEUED',
        requestedById: actor.actorId ?? null,
        tenantScope: tenantId,
      },
    });
    await recordAudit({ action: 'exports.run.requested', resourceType: 'export_job', resourceId: job.id, tenantId, after: { resourceKey: job.reportKey }, actorId: actor.actorId ?? null, actorEmail: actor.actorEmail ?? null, actorType: actor.actorType ?? 'TENANT_USER', req: actor.req });
    return job;
  },

  get(tenantId: string, id: string) {
    return reportsService.getRun(tenantId, id, 'EXPORT');
  },

  cancel(tenantId: string, id: string, actor: TenantActorContext) {
    return reportsService.cancelRun(tenantId, id, actor, 'EXPORT');
  },
};
