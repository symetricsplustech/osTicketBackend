import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, PreconditionFailedError } from '../../shared/errors';
import { recordAudit } from '../../shared/audit';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { createItsmCrudService, assertUnique } from './crud';
import type { TenantActorContext } from '../tenantadmin/roles.service';

export const approvalPolicyService = createItsmCrudService({
  resourceType: 'approval_policy',
  label: 'Approval policy',
  model: prisma.tenantApprovalPolicy,
  statusField: null,
  searchFields: ['name', 'description', 'actionScope'],
  allowedSortFields: ['name', 'actionScope', 'isEnabled', 'createdAt', 'updatedAt'],
  filterFields: ['actionScope'],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === 'string' && input.name) {
      await assertUnique(prisma.tenantApprovalPolicy, tenantId, 'name', input.name, 'approval policy', existing?.id);
    }
  },
});

const requestBase = createItsmCrudService({
  resourceType: 'approval_request',
  label: 'Approval request',
  model: prisma.tenantApprovalRequest,
  setCreatedBy: false,
  softDelete: false,
  searchFields: ['actionKey', 'resourceType', 'reason'],
  allowedSortFields: ['status', 'actionKey', 'resourceType', 'createdAt', 'updatedAt'],
  filterFields: ['status', 'actionKey', 'resourceType', 'policyId'],
  include: { decisions: true, policy: { select: { id: true, name: true, minApprovals: true } } },
  mapInput: (input, { actor, existing }) => (existing ? input : { ...input, requestedById: actor.actorId ?? null }),
});

export const approvalRequestService = {
  ...requestBase,

  async decide(
    tenantId: string,
    id: string,
    actor: TenantActorContext,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string,
  ) {
    const request = await prisma.tenantApprovalRequest.findFirst({
      where: { id, tenantId },
      include: { decisions: true, policy: { select: { id: true, minApprovals: true } } },
    });
    if (!request) throw new NotFoundError('Approval request');
    if (request.status !== 'PENDING') throw new PreconditionFailedError('This approval request is no longer pending.');

    const approverId = actor.actorId ?? null;
    if (approverId) {
      await prisma.tenantApprovalDecision.upsert({
        where: { requestId_approverId: { requestId: id, approverId } },
        create: { tenantId, requestId: id, approverId, decision, reason: reason ?? null },
        update: { decision, reason: reason ?? null, decidedAt: new Date() },
      });
    } else {
      await prisma.tenantApprovalDecision.create({
        data: { tenantId, requestId: id, approverId: null, decision, reason: reason ?? null },
      });
    }

    const decisions = await prisma.tenantApprovalDecision.findMany({ where: { requestId: id, tenantId } });
    const rejected = decisions.some((d) => d.decision === 'REJECTED');
    const approved = decisions.filter((d) => d.decision === 'APPROVED').length;
    const min = request.policy?.minApprovals ?? 1;

    let status = 'PENDING';
    if (rejected) status = 'REJECTED';
    else if (approved >= min) status = 'APPROVED';

    const updated = await prisma.tenantApprovalRequest.update({
      where: { id },
      data: { status },
      include: { decisions: true, policy: { select: { id: true, name: true, minApprovals: true } } },
    });

    await recordAudit({
      action: `approval_request.${decision === 'APPROVED' ? 'approved' : 'rejected'}`,
      resourceType: 'approval_request',
      resourceId: id,
      tenantId,
      before: { status: request.status },
      after: { status: updated.status },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? 'TENANT_USER',
      req: actor.req,
    });
    return updated;
  },

  async listDecisions(tenantId: string, requestId: string, req: import('express').Request) {
    const request = await prisma.tenantApprovalRequest.findFirst({ where: { id: requestId, tenantId }, select: { id: true } });
    if (!request) throw new NotFoundError('Approval request');
    const query = parseListQuery(req, { maxLimit: 100 });
    const where = { requestId, tenantId };
    const [rows, total] = await Promise.all([
      prisma.tenantApprovalDecision.findMany({ where, orderBy: { decidedAt: 'desc' }, ...paginationArgs(query) }),
      prisma.tenantApprovalDecision.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },
};

export type ApprovalRequestWhere = Prisma.TenantApprovalRequestWhereInput;
