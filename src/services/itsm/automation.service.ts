import { prisma } from '../../config/database';
import type { Prisma } from '@prisma/client';
import { NotFoundError, PreconditionFailedError } from '../../shared/errors';
import { recordAudit } from '../../shared/audit';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { createItsmCrudService, assertUnique } from './crud';
import type { TenantActorContext } from '../tenantadmin/roles.service';

const ruleBase = createItsmCrudService({
  resourceType: 'automation_rule',
  label: 'Automation rule',
  model: prisma.tenantAutomationRule,
  searchFields: ['name', 'description', 'moduleKey', 'eventKey'],
  allowedSortFields: ['name', 'status', 'trigger', 'isEnabled', 'runCount', 'lastRunAt', 'createdAt', 'updatedAt'],
  filterFields: ['status', 'trigger', 'moduleKey', 'isEnabled'],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === 'string' && input.name) {
      await assertUnique(prisma.tenantAutomationRule, tenantId, 'name', input.name, 'automation rule', existing?.id);
    }
  },
});

const runBase = createItsmCrudService({
  resourceType: 'automation_run',
  label: 'Automation run',
  model: prisma.tenantAutomationRun,
  setCreatedBy: false,
  softDelete: false,
  searchFields: ['trigger', 'error'],
  allowedSortFields: ['status', 'trigger', 'startedAt', 'createdAt', 'updatedAt'],
  filterFields: ['status', 'ruleId', 'trigger'],
  include: { rule: { select: { id: true, name: true } } },
});

export const automationRuleService = {
  ...ruleBase,

  async run(tenantId: string, id: string, actor: TenantActorContext, context?: Record<string, unknown>) {
    const rule = await prisma.tenantAutomationRule.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!rule) throw new NotFoundError('Automation rule');
    if (!rule.isEnabled) throw new PreconditionFailedError('This automation rule is disabled.');

    const [run] = await prisma.$transaction([
      prisma.tenantAutomationRun.create({
        data: { tenantId, ruleId: id, status: 'RUNNING', trigger: 'manual', context: (context ?? {}) as Prisma.InputJsonValue },
      }),
      prisma.tenantAutomationRule.update({
        where: { id },
        data: { lastRunAt: new Date(), runCount: { increment: 1 } },
      }),
    ]);

    await recordAudit({
      action: 'automation_rule.run',
      resourceType: 'automation_rule',
      resourceId: id,
      tenantId,
      after: { runId: run.id },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return run;
  },

  async listRuns(tenantId: string, ruleId: string, req: import('express').Request) {
    const rule = await prisma.tenantAutomationRule.findFirst({ where: { id: ruleId, tenantId, deletedAt: null }, select: { id: true } });
    if (!rule) throw new NotFoundError('Automation rule');
    const query = parseListQuery(req, { maxLimit: 100 });
    const where = { ruleId, tenantId };
    const [rows, total] = await Promise.all([
      prisma.tenantAutomationRun.findMany({ where, orderBy: { startedAt: 'desc' }, ...paginationArgs(query) }),
      prisma.tenantAutomationRun.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },
};

export const automationRunService = {
  ...runBase,
  async transition(
    tenantId: string,
    id: string,
    actor: TenantActorContext,
    action: string,
    status: string,
    extra: Record<string, unknown> = {},
  ) {
    const patch: Record<string, unknown> = { ...extra };
    if ((status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') && patch.completedAt === undefined) {
      patch.completedAt = new Date();
    }
    return runBase.transition(tenantId, id, actor, action, status, patch);
  },
};
