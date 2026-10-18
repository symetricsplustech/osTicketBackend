import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import type { TenantActorContext } from '../tenantadmin/roles.service';

function parseRange(req: Request) {
  const q = req.query as Record<string, unknown>;
  const from = typeof q.from === 'string' ? new Date(q.from) : undefined;
  const to = typeof q.to === 'string' ? new Date(q.to) : undefined;
  return { from: from && !Number.isNaN(from.getTime()) ? from : undefined, to: to && !Number.isNaN(to.getTime()) ? to : undefined };
}

export const auditService = {
  async listEvents(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 200 });
    const q = req.query as Record<string, unknown>;
    const { from, to } = parseRange(req);
    const where: Prisma.AuditEventWhereInput = {
      tenantId,
      ...(typeof q.action === 'string' ? { action: q.action } : {}),
      ...(typeof q.resourceType === 'string' ? { resourceType: q.resourceType } : {}),
      ...(typeof q.resourceId === 'string' ? { resourceId: q.resourceId } : {}),
      ...(typeof q.actorId === 'string' ? { actorId: q.actorId } : {}),
      ...(typeof q.outcome === 'string' ? { outcome: q.outcome as never } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(query.search ? { OR: [{ action: { contains: query.search, mode: 'insensitive' } }, { resourceType: { contains: query.search, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      prisma.auditEvent.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async getEvent(tenantId: string, id: string) {
    const event = await prisma.auditEvent.findFirst({ where: { id, tenantId } });
    if (!event) throw new NotFoundError('Audit event');
    return event;
  },

  async resourceHistory(tenantId: string, resourceType: string, resourceId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 200 });
    const where = { tenantId, resourceType, resourceId };
    const [rows, total] = await Promise.all([
      prisma.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      prisma.auditEvent.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async listActors(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 200 });
    const grouped = await prisma.auditEvent.groupBy({
      by: ['actorId', 'actorEmail'],
      where: { tenantId, actorId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { actorId: 'desc' } },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    const distinct = await prisma.auditEvent.findMany({ where: { tenantId, actorId: { not: null } }, distinct: ['actorId'], select: { actorId: true } });
    return {
      rows: grouped.map((r) => ({ actorId: r.actorId, actorEmail: r.actorEmail, eventCount: r._count._all })),
      meta: buildPaginationMeta(query.page, query.limit, distinct.length),
    };
  },

  async listSecurityEvents(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 200 });
    const q = req.query as Record<string, unknown>;
    const where: Prisma.SecurityEventWhereInput = {
      tenantId,
      ...(typeof q.severity === 'string' ? { severity: q.severity as never } : {}),
      ...(typeof q.eventType === 'string' ? { eventType: q.eventType } : {}),
      ...(query.search ? { eventType: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.securityEvent.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      prisma.securityEvent.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async requestExport(tenantId: string, filters: Record<string, unknown>, actor: TenantActorContext) {
    const job = await prisma.reportJob.create({
      data: {
        kind: 'EXPORT',
        reportKey: 'audit',
        format: 'CSV',
        filters: filters as Prisma.InputJsonValue,
        status: 'QUEUED',
        requestedById: actor.actorId ?? null,
        tenantScope: tenantId,
      },
    });
    await recordAudit({
      action: 'audit.export.requested',
      resourceType: 'audit_export',
      resourceId: job.id,
      tenantId,
      after: job,
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return job;
  },
};
