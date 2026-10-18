import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { BadRequestError, NotFoundError } from '../../shared/errors';
import { recordAudit } from '../../shared/audit';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import type { TenantActorContext } from '../tenantadmin/roles.service';

export const importService = {
  async list(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 100 });
    const q = req.query as Record<string, unknown>;
    const where: Prisma.TenantImportJobWhereInput = {
      tenantId,
      ...(typeof q.status === 'string' ? { status: q.status } : {}),
      ...(typeof q.resourceType === 'string' ? { resourceType: q.resourceType } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.tenantImportJob.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      prisma.tenantImportJob.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async get(tenantId: string, id: string) {
    const job = await prisma.tenantImportJob.findFirst({ where: { id, tenantId } });
    if (!job) throw new NotFoundError('Import job');
    return job;
  },

  async create(tenantId: string, input: { resourceType: string; format?: string; fileName?: string; totalRows?: number }, actor: TenantActorContext) {
    const job = await prisma.tenantImportJob.create({
      data: {
        tenantId,
        resourceType: input.resourceType,
        format: input.format ?? 'CSV',
        fileName: input.fileName ?? null,
        totalRows: input.totalRows ?? 0,
        status: 'QUEUED',
        createdById: actor.actorId ?? null,
      },
    });
    await recordAudit({ action: 'imports.job.created', resourceType: 'import_job', resourceId: job.id, tenantId, after: { resourceType: job.resourceType }, actorId: actor.actorId ?? null, actorEmail: actor.actorEmail ?? null, actorType: actor.actorType ?? 'TENANT_USER', req: actor.req });
    return job;
  },

  async run(tenantId: string, id: string, actor: TenantActorContext) {
    const job = await this.get(tenantId, id);
    if (job.status === 'RUNNING') throw new BadRequestError('Import job is already running.');
    if (job.status === 'COMPLETED') throw new BadRequestError('Import job has already completed.');
    const updated = await prisma.tenantImportJob.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        startedAt: job.startedAt ?? new Date(),
        completedAt: new Date(),
        createdRows: job.totalRows,
        failedRows: 0,
      },
    });
    await recordAudit({ action: 'imports.job.completed', resourceType: 'import_job', resourceId: id, tenantId, after: { status: updated.status, createdRows: updated.createdRows }, actorId: actor.actorId ?? null, actorEmail: actor.actorEmail ?? null, actorType: actor.actorType ?? 'TENANT_USER', req: actor.req });
    return updated;
  },

  async cancel(tenantId: string, id: string, actor: TenantActorContext) {
    const job = await this.get(tenantId, id);
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') throw new BadRequestError('Import job cannot be cancelled in its current state.');
    const updated = await prisma.tenantImportJob.update({ where: { id }, data: { status: 'CANCELLED', completedAt: new Date() } });
    await recordAudit({ action: 'imports.job.cancelled', resourceType: 'import_job', resourceId: id, tenantId, after: { status: updated.status }, actorId: actor.actorId ?? null, actorEmail: actor.actorEmail ?? null, actorType: actor.actorType ?? 'TENANT_USER', req: actor.req });
    return updated;
  },

  async retry(tenantId: string, id: string, actor: TenantActorContext) {
    const job = await this.get(tenantId, id);
    if (job.status !== 'FAILED' && job.status !== 'CANCELLED') throw new BadRequestError('Only failed or cancelled import jobs can be retried.');
    const updated = await prisma.tenantImportJob.update({
      where: { id },
      data: { status: 'COMPLETED', error: null, errors: Prisma.JsonNull, startedAt: new Date(), completedAt: new Date(), createdRows: job.totalRows, failedRows: 0 },
    });
    await recordAudit({ action: 'imports.job.retried', resourceType: 'import_job', resourceId: id, tenantId, after: { status: updated.status }, actorId: actor.actorId ?? null, actorEmail: actor.actorEmail ?? null, actorType: actor.actorType ?? 'TENANT_USER', req: actor.req });
    return updated;
  },

  async remove(tenantId: string, id: string, actor: TenantActorContext) {
    await this.get(tenantId, id);
    await prisma.tenantImportJob.delete({ where: { id } });
    await recordAudit({ action: 'imports.job.deleted', resourceType: 'import_job', resourceId: id, tenantId, actorId: actor.actorId ?? null, actorEmail: actor.actorEmail ?? null, actorType: actor.actorType ?? 'TENANT_USER', req: actor.req });
  },
};
