import type { ApprovalRequest } from '@prisma/client';
import type { Request as ExpressRequest } from 'express';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { ForbiddenError, NotFoundError, PreconditionFailedError } from '../../shared/errors';
import { parseListQuery, paginationArgs, buildPaginationMeta } from '../../shared/pagination';
import { recordAudit, recordSecurityEvent } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import { createCrudService } from '../../shared/crud';

type ApprovalExecutor = (request: ApprovalRequest) => Promise<void>;

const executors = new Map<string, ApprovalExecutor>();

export function registerApprovalExecutor(actionKey: string, executor: ApprovalExecutor): void {
  executors.set(actionKey, executor);
}

export const approvalPolicyCrud = createCrudService({
  model: prisma.approvalPolicy as never,
  resourceType: 'approval-policy',
  searchFields: ['name', 'actionScope'],
  filterableFields: ['isEnabled', 'actionScope'],
  allowedSortFields: ['name', 'actionScope', 'createdAt', 'updatedAt'],
  defaultOrderBy: { createdAt: 'desc' },
});

interface ApprovalConditions {
  tenantIds?: string[];
  resourceTypes?: string[];
}

function conditionsMatch(policyConditions: unknown, context: { tenantId?: string | null; resourceType: string }): boolean {
  if (!policyConditions || typeof policyConditions !== 'object') return true;
  const conditions = policyConditions as ApprovalConditions;
  if (conditions.tenantIds?.length && (!context.tenantId || !conditions.tenantIds.includes(context.tenantId))) return false;
  if (conditions.resourceTypes?.length && !conditions.resourceTypes.includes(context.resourceType)) return false;
  return true;
}

export async function evaluateApproval(input: {
  actionKey: string;
  resourceType: string;
  resourceId?: string | null;
  tenantId?: string | null;
  payload: Record<string, unknown>;
  req: ExpressRequest;
}): Promise<ApprovalRequest | null> {
  const policies = await prisma.approvalPolicy.findMany({
    where: { actionScope: input.actionKey, isEnabled: true },
    orderBy: { createdAt: 'asc' },
  });

  const matching = policies.find((entry) => conditionsMatch(entry.conditions, input));
  if (!matching) return null;

  const requesterRoles = input.req.auth?.roles ?? [];
  if (requesterRoles.includes('platform-owner')) return null;

  const request = await prisma.approvalRequest.create({
    data: {
      policyId: matching.id,
      actionKey: input.actionKey,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      payload: input.payload as object,
      requestedById: input.req.auth!.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await recordAudit({
    action: 'approval.requested',
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? undefined,
    tenantId: input.tenantId ?? undefined,
    after: { approvalRequestId: request.id, policyId: matching.id, actionKey: input.actionKey },
    req: input.req,
  });
  void publishEvent({
    eventKey: 'approval.requested',
    tenantId: input.tenantId ?? null,
    payload: { approvalRequestId: request.id, actionKey: input.actionKey },
  });

  return request;
}

export async function listRequests(req: ExpressRequest, extraWhere?: Record<string, unknown>) {
  const query = parseListQuery(req, { maxLimit: 50 });
  const where: Record<string, unknown> = {
    ...(extraWhere ?? {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.actionKey ? { actionKey: query.actionKey } : {}),
    ...(query.search
      ? {
          OR: [
            { actionKey: { contains: query.search, mode: 'insensitive' } },
            { resourceType: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        policy: { select: { id: true, name: true, minApprovals: true } },
        decisions: {
          include: { approver: { select: { id: true, email: true, firstName: true, lastName: true } } },
          orderBy: { decidedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...paginationArgs(query),
    }),
    prisma.approvalRequest.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getRequest(requestId: string) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: {
      requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      policy: true,
      decisions: {
        include: { approver: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { decidedAt: 'asc' },
      },
    },
  });
  if (!request) throw new NotFoundError('Approval request');
  return request;
}

export async function listMyPending(userId: string, req: ExpressRequest) {
  const query = parseListQuery(req, { maxLimit: 50 });
  const roleAssignments = await prisma.staffRoleAssignment.findMany({
    where: { userId },
    select: { roleId: true },
  });
  const roleIds = roleAssignments.map((assignment) => assignment.roleId);

  const policies = await prisma.approvalPolicy.findMany({
    where: { isEnabled: true },
    select: { id: true, approverRoleIds: true },
  });
  const eligiblePolicyIds = policies
    .filter((policy) => {
      const approvers = Array.isArray(policy.approverRoleIds) ? (policy.approverRoleIds as unknown[]).map(String) : [];
      return approvers.some((roleId) => roleIds.includes(roleId));
    })
    .map((policy) => policy.id);

  const where = {
    status: 'PENDING' as const,
    OR: [
      ...(eligiblePolicyIds.length ? [{ policyId: { in: eligiblePolicyIds } }] : []),
      { policy: { approverRoleIds: { array_contains: roleIds } } },
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        policy: { select: { id: true, name: true, minApprovals: true } },
        decisions: true,
      },
      orderBy: { createdAt: 'asc' },
      ...paginationArgs(query),
    }),
    prisma.approvalRequest.count({ where }),
  ]);

  const filtered = rows.filter((request) => !request.decisions.some((decision) => decision.approverId === userId));
  return { rows: filtered, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function decideRequest(input: {
  requestId: string;
  decision: 'APPROVED' | 'REJECTED';
  reason?: string;
  approverId: string;
  req: ExpressRequest;
}) {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: input.requestId },
    include: { policy: true, decisions: true },
  });
  if (!request) throw new NotFoundError('Approval request');
  if (request.status !== 'PENDING') {
    throw new PreconditionFailedError(`This request has already been ${request.status.toLowerCase()}.`);
  }
  if (request.expiresAt && request.expiresAt.getTime() < Date.now()) {
    await prisma.approvalRequest.update({ where: { id: request.id }, data: { status: 'EXPIRED' } });
    throw new PreconditionFailedError('This approval request has expired.');
  }
  if (request.decisions.some((decision) => decision.approverId === input.approverId)) {
    throw new PreconditionFailedError('You have already recorded a decision on this request.');
  }

  await prisma.approvalDecision.create({
    data: {
      requestId: request.id,
      approverId: input.approverId,
      decision: input.decision,
      reason: input.reason ?? null,
    },
  });

  if (input.decision === 'REJECTED') {
    await prisma.approvalRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } });
    await recordAudit({
      action: 'approval.rejected',
      resourceType: request.resourceType,
      resourceId: request.resourceId ?? undefined,
      after: { approvalRequestId: request.id, reason: input.reason },
      req: input.req,
    });
    void publishEvent({ eventKey: 'approval.rejected', payload: { approvalRequestId: request.id } });
    return getRequest(request.id);
  }

  const minApprovals = request.policy?.minApprovals ?? 1;
  const approvalCount = request.decisions.filter((decision) => decision.decision === 'APPROVED').length + 1;

  if (approvalCount < minApprovals) {
    await recordAudit({
      action: 'approval.approved.partial',
      resourceType: request.resourceType,
      resourceId: request.resourceId ?? undefined,
      metadata: { approvalRequestId: request.id, approvalCount, minApprovals },
      req: input.req,
    });
    return getRequest(request.id);
  }

  const executor = executors.get(request.actionKey);
  if (!executor) {
    logger.error({ actionKey: request.actionKey, requestId: request.id }, 'No executor registered for approval action');
    await recordAudit({
      action: 'approval.execution.failed',
      resourceType: request.resourceType,
      resourceId: request.resourceId ?? undefined,
      outcome: 'FAILURE',
      metadata: { approvalRequestId: request.id, reason: 'NO_EXECUTOR' },
      req: input.req,
    });
    throw new PreconditionFailedError('This approval action cannot be executed because no handler is registered.');
  }

  try {
    await executor(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message, requestId: request.id }, 'Approved action execution failed');
    throw error;
  }

  await prisma.approvalRequest.update({ where: { id: request.id }, data: { status: 'APPROVED' } });
  await recordAudit({
    action: 'approval.approved',
    resourceType: request.resourceType,
    resourceId: request.resourceId ?? undefined,
    after: { approvalRequestId: request.id, approvalCount },
    req: input.req,
  });
  await recordSecurityEvent({
    eventType: 'approvals.privileged_action.executed',
    severity: 'HIGH',
    req: input.req,
    details: { approvalRequestId: request.id, actionKey: request.actionKey },
  });
  void publishEvent({ eventKey: 'approval.approved', payload: { approvalRequestId: request.id, actionKey: request.actionKey } });

  return getRequest(request.id);
}

export async function cancelRequest(requestId: string, actorId: string, req: ExpressRequest) {
  const request = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError('Approval request');
  if (request.status !== 'PENDING') {
    throw new PreconditionFailedError(`This request has already been ${request.status.toLowerCase()}.`);
  }
  if (request.requestedById !== actorId && !req.auth?.permissions.includes('admin.approvals.act')) {
    throw new ForbiddenError('Only the requester or an approval manager can cancel this request.');
  }

  const updated = await prisma.approvalRequest.update({ where: { id: requestId }, data: { status: 'CANCELLED' } });
  await recordAudit({
    action: 'approval.cancelled',
    resourceType: request.resourceType,
    resourceId: request.resourceId ?? undefined,
    after: { approvalRequestId: requestId },
    req,
  });
  void publishEvent({ eventKey: 'approval.cancelled', payload: { approvalRequestId: requestId } });
  return updated;
}

export async function expireStaleRequests(): Promise<number> {
  const result = await prisma.approvalRequest.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return result.count;
}
