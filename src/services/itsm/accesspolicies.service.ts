import type { Request } from 'express';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { createItsmCrudService, assertUnique } from './crud';
import type { TenantActorContext } from '../tenantadmin/roles.service';

const policyBase = createItsmCrudService({
  resourceType: 'access_policy',
  label: 'Access policy',
  model: prisma.tenantAccessPolicy,
  statusField: null,
  searchFields: ['name', 'description', 'policyType'],
  allowedSortFields: ['name', 'priority', 'policyType', 'createdAt', 'updatedAt'],
  defaultOrderBy: { priority: 'desc' },
  filterFields: ['policyType'],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === 'string' && input.name) {
      await assertUnique(prisma.tenantAccessPolicy, tenantId, 'name', input.name, 'access policy', existing?.id);
    }
  },
});

export const accessPolicyService = {
  ...policyBase,
  async listAssignments(tenantId: string, policyId: string, req: Request) {
    const policy = await prisma.tenantAccessPolicy.findFirst({ where: { id: policyId, tenantId, deletedAt: null }, select: { id: true } });
    if (!policy) throw new NotFoundError('Access policy');
    const query = parseListQuery(req, { maxLimit: 100 });
    const where = { tenantId, policyId };
    const [rows, total] = await Promise.all([
      prisma.tenantAccessPolicyAssignment.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginationArgs(query) }),
      prisma.tenantAccessPolicyAssignment.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async createAssignment(tenantId: string, policyId: string, input: { subjectType: string; subjectId: string }, actor: TenantActorContext) {
    const policy = await prisma.tenantAccessPolicy.findFirst({ where: { id: policyId, tenantId, deletedAt: null }, select: { id: true } });
    if (!policy) throw new NotFoundError('Access policy');
    const dup = await prisma.tenantAccessPolicyAssignment.findFirst({ where: { policyId, subjectType: input.subjectType, subjectId: input.subjectId }, select: { id: true } });
    if (dup) throw new ConflictError('This subject is already assigned to the policy.');
    const assignment = await prisma.tenantAccessPolicyAssignment.create({ data: { tenantId, policyId, subjectType: input.subjectType, subjectId: input.subjectId } });
    await recordAudit({
      action: 'access_policy.assignment.created',
      resourceType: 'access_policy',
      resourceId: policyId,
      tenantId,
      after: assignment,
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return assignment;
  },

  async removeAssignment(tenantId: string, policyId: string, assignmentId: string, actor: TenantActorContext) {
    const assignment = await prisma.tenantAccessPolicyAssignment.findFirst({ where: { id: assignmentId, tenantId, policyId } });
    if (!assignment) throw new NotFoundError('Access policy assignment');
    await prisma.tenantAccessPolicyAssignment.delete({ where: { id: assignmentId } });
    await recordAudit({
      action: 'access_policy.assignment.deleted',
      resourceType: 'access_policy',
      resourceId: policyId,
      tenantId,
      before: assignment,
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
  },
};
