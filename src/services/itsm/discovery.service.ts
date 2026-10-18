import type { Request } from 'express';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { createItsmCrudService } from './crud';
import type { TenantActorContext } from '../tenantadmin/roles.service';

const base = createItsmCrudService({
  resourceType: 'discovery_run',
  label: 'Discovery run',
  model: prisma.discoveryRun,
  searchFields: ['name', 'profileKey'],
  allowedSortFields: ['name', 'status', 'startedAt', 'completedAt', 'createdAt', 'updatedAt'],
  filterFields: ['status', 'profileKey', 'mode'],
  include: { _count: { select: { results: true } } },
});

export const discoveryRunService = {
  ...base,
  async start(tenantId: string, id: string, actor: TenantActorContext) {
    return base.transition(tenantId, id, actor, 'started', 'RUNNING', { startedAt: new Date() });
  },
  async complete(tenantId: string, id: string, actor: TenantActorContext) {
    return base.transition(tenantId, id, actor, 'completed', 'COMPLETED', { completedAt: new Date() });
  },
  async fail(tenantId: string, id: string, actor: TenantActorContext, error?: string) {
    return base.transition(tenantId, id, actor, 'failed', 'FAILED', { completedAt: new Date(), error: error ?? null });
  },
  async listResults(tenantId: string, runId: string, req: Request) {
    await base.get(tenantId, runId);
    const query = parseListQuery(req, { maxLimit: 100 });
    const where = { runId, tenantId, deletedAt: null };
    const [rows, total] = await Promise.all([
      prisma.discoveryResult.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      prisma.discoveryResult.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },
};

export const discoveryResultService = createItsmCrudService({
  resourceType: 'discovery_result',
  label: 'Discovery result',
  model: prisma.discoveryResult,
  setCreatedBy: false,
  searchFields: ['name', 'hostname', 'ipAddress'],
  allowedSortFields: ['name', 'status', 'action', 'createdAt', 'updatedAt'],
  filterFields: ['runId', 'status', 'action', 'ciTypeKey'],
  validate: async (tenantId, input, existing) => {
    const runId = (input.runId as string | undefined) ?? existing?.runId;
    const run = await prisma.discoveryRun.findFirst({ where: { id: runId, tenantId, deletedAt: null }, select: { id: true } });
    if (!run) throw new NotFoundError('Discovery run');
  },
});

export async function getDiscoveryResult(tenantId: string, id: string) {
  const record = await prisma.discoveryResult.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { run: { select: { id: true, name: true, status: true } } },
  });
  if (!record) throw new NotFoundError('Discovery result');
  return record;
}
