import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import { buildOrderBy, buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import { USER_SUMMARY, assertTenantCategory, assertTenantTeam, assertTenantUser, generateTicketNumber } from './shared';
import type { TenantActorContext } from '../tenantadmin/roles.service';
import type {
  AssignChangeInput,
  CompleteChangeInput,
  CreateChangeCommentInput,
  CreateChangeInput,
  DecideChangeInput,
  ImplementChangeInput,
  RollbackChangeInput,
  UpdateChangeInput,
} from '../../validators/itsm/changes.validators';

const CHANGE_INCLUDE = {
  assignee: { select: USER_SUMMARY },
  requestedBy: { select: USER_SUMMARY },
  team: { select: { id: true, name: true, code: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.ChangeInclude;

async function findChangeOrThrow(tenantId: string, changeId: string) {
  const change = await prisma.change.findFirst({
    where: { id: changeId, tenantId, deletedAt: null },
    include: CHANGE_INCLUDE,
  });
  if (!change) throw new NotFoundError('Change');
  return change;
}

export async function listChanges(tenantId: string, req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.ChangeWhereInput = { tenantId, deletedAt: null };

  const statusKey = typeof query.status === 'string' && query.status ? query.status : undefined;
  const priorityKey = typeof query.priorityKey === 'string' && query.priorityKey ? query.priorityKey : undefined;
  const changeTypeKey = typeof query.changeTypeKey === 'string' && query.changeTypeKey ? query.changeTypeKey : undefined;
  const assigneeId = typeof query.assigneeId === 'string' && query.assigneeId ? query.assigneeId : undefined;
  const teamId = typeof query.teamId === 'string' && query.teamId ? query.teamId : undefined;
  if (statusKey) where.statusKey = statusKey;
  if (priorityKey) where.priorityKey = priorityKey;
  if (changeTypeKey) where.changeTypeKey = changeTypeKey;
  if (assigneeId) where.assigneeId = assigneeId;
  if (teamId) where.teamId = teamId;
  if (query.search) {
    where.OR = [
      { number: { contains: query.search, mode: 'insensitive' } },
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const orderBy = buildOrderBy(
    query,
    ['number', 'title', 'statusKey', 'priorityKey', 'plannedStartAt', 'createdAt', 'updatedAt'],
    { createdAt: 'desc' } as Prisma.ChangeOrderByWithRelationInput,
  );
  const [rows, total] = await Promise.all([
    prisma.change.findMany({ where, orderBy, ...paginationArgs(query), include: CHANGE_INCLUDE }),
    prisma.change.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getChange(tenantId: string, changeId: string) {
  return findChangeOrThrow(tenantId, changeId);
}

export async function createChange(tenantId: string, input: CreateChangeInput, actor: TenantActorContext) {
  await assertTenantCategory(tenantId, input.categoryId);
  await assertTenantUser(tenantId, input.assigneeId, 'assignee');
  await assertTenantUser(tenantId, input.requestedById, 'requester');
  await assertTenantTeam(tenantId, input.teamId);

  const count = await prisma.change.count({ where: { tenantId } });
  const number = await generateTicketNumber(
    'changes',
    'CHG',
    async (candidate) => (await prisma.change.count({ where: { tenantId, number: candidate } })) > 0,
    count + 1,
  );

  const change = await prisma.change.create({
    data: {
      tenantId,
      number,
      title: input.title,
      description: input.description ?? null,
      statusKey: input.statusKey ?? 'new',
      priorityKey: input.priorityKey ?? 'medium',
      changeTypeKey: input.changeTypeKey ?? 'normal',
      riskKey: input.riskKey ?? 'medium',
      impact: input.impact ?? 'MEDIUM',
      categoryId: input.categoryId ?? null,
      assigneeId: input.assigneeId ?? null,
      teamId: input.teamId ?? null,
      requestedById: input.requestedById ?? actor.actorId ?? null,
      implementationPlan: input.implementationPlan ?? null,
      rollbackPlan: input.rollbackPlan ?? null,
      testPlan: input.testPlan ?? null,
      plannedStartAt: input.plannedStartAt ?? null,
      plannedEndAt: input.plannedEndAt ?? null,
      createdById: actor.actorId ?? null,
    },
    include: CHANGE_INCLUDE,
  });

  await recordAudit({
    action: 'change.created',
    resourceType: 'change',
    resourceId: change.id,
    tenantId,
    after: change,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'change.created', tenantId, payload: { changeId: change.id, number } });

  return change;
}

export async function updateChange(
  tenantId: string,
  changeId: string,
  input: UpdateChangeInput,
  actor: TenantActorContext,
) {
  const before = await findChangeOrThrow(tenantId, changeId);
  await assertTenantCategory(tenantId, input.categoryId);
  await assertTenantUser(tenantId, input.assigneeId, 'assignee');
  await assertTenantUser(tenantId, input.requestedById, 'requester');
  await assertTenantTeam(tenantId, input.teamId);

  const data: Prisma.ChangeUpdateInput = {};
  for (const key of [
    'title',
    'description',
    'statusKey',
    'priorityKey',
    'changeTypeKey',
    'riskKey',
    'impact',
    'categoryId',
    'assigneeId',
    'teamId',
    'requestedById',
    'implementationPlan',
    'rollbackPlan',
    'testPlan',
    'plannedStartAt',
    'plannedEndAt',
  ] as const) {
    if (input[key] !== undefined) (data as Record<string, unknown>)[key] = input[key];
  }

  const change = await prisma.change.update({ where: { id: changeId }, data, include: CHANGE_INCLUDE });

  await recordAudit({
    action: 'change.updated',
    resourceType: 'change',
    resourceId: changeId,
    tenantId,
    before,
    after: change,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'change.updated', tenantId, payload: { changeId } });

  return change;
}

export async function deleteChange(tenantId: string, changeId: string, actor: TenantActorContext) {
  const before = await findChangeOrThrow(tenantId, changeId);
  await prisma.change.update({ where: { id: changeId }, data: { deletedAt: new Date() } });

  await recordAudit({
    action: 'change.deleted',
    resourceType: 'change',
    resourceId: changeId,
    tenantId,
    before,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'change.deleted', tenantId, payload: { changeId } });
}

export async function assignChange(
  tenantId: string,
  changeId: string,
  input: AssignChangeInput,
  actor: TenantActorContext,
) {
  const before = await findChangeOrThrow(tenantId, changeId);
  await assertTenantUser(tenantId, input.assigneeId, 'assignee');
  await assertTenantTeam(tenantId, input.teamId);

  const change = await prisma.change.update({
    where: { id: changeId },
    data: {
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
    },
    include: CHANGE_INCLUDE,
  });

  await recordAudit({
    action: 'change.assigned',
    resourceType: 'change',
    resourceId: changeId,
    tenantId,
    before: { assigneeId: before.assigneeId, teamId: before.teamId },
    after: { assigneeId: change.assigneeId, teamId: change.teamId },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'change.assigned', tenantId, payload: { changeId } });

  return change;
}

export async function decideChange(
  tenantId: string,
  changeId: string,
  input: DecideChangeInput,
  actor: TenantActorContext,
) {
  const before = await findChangeOrThrow(tenantId, changeId);

  const change = await prisma.change.update({
    where: { id: changeId },
    data: {
      approvalStatus: input.decision,
      statusKey: input.decision === 'APPROVED' ? 'approved' : 'rejected',
    },
    include: CHANGE_INCLUDE,
  });

  await recordAudit({
    action: `change.${input.decision === 'APPROVED' ? 'approved' : 'rejected'}`,
    resourceType: 'change',
    resourceId: changeId,
    tenantId,
    before: { approvalStatus: before.approvalStatus },
    after: { approvalStatus: change.approvalStatus, note: input.note ?? null },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'change.decision', tenantId, payload: { changeId, decision: input.decision } });

  return change;
}

export async function implementChange(
  tenantId: string,
  changeId: string,
  input: ImplementChangeInput,
  actor: TenantActorContext,
) {
  const before = await findChangeOrThrow(tenantId, changeId);

  const change = await prisma.change.update({
    where: { id: changeId },
    data: {
      statusKey: 'implementing',
      actualStartAt: input.actualStartAt ?? before.actualStartAt ?? new Date(),
    },
    include: CHANGE_INCLUDE,
  });

  await recordAudit({
    action: 'change.implementation_started',
    resourceType: 'change',
    resourceId: changeId,
    tenantId,
    before: { statusKey: before.statusKey },
    after: { statusKey: change.statusKey, note: input.note ?? null },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'change.implementation_started', tenantId, payload: { changeId } });

  return change;
}

export async function completeChange(
  tenantId: string,
  changeId: string,
  input: CompleteChangeInput,
  actor: TenantActorContext,
) {
  const before = await findChangeOrThrow(tenantId, changeId);
  const now = new Date();
  const close = input.close ?? false;

  const change = await prisma.change.update({
    where: { id: changeId },
    data: {
      statusKey: close ? 'closed' : 'completed',
      actualEndAt: input.actualEndAt ?? before.actualEndAt ?? now,
      closedAt: close ? now : before.closedAt,
    },
    include: CHANGE_INCLUDE,
  });

  await recordAudit({
    action: 'change.completed',
    resourceType: 'change',
    resourceId: changeId,
    tenantId,
    before: { statusKey: before.statusKey },
    after: { statusKey: change.statusKey, note: input.note ?? null },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'change.completed', tenantId, payload: { changeId } });

  return change;
}

export async function rollbackChange(
  tenantId: string,
  changeId: string,
  input: RollbackChangeInput,
  actor: TenantActorContext,
) {
  const before = await findChangeOrThrow(tenantId, changeId);

  const change = await prisma.change.update({
    where: { id: changeId },
    data: { statusKey: 'rolled_back', actualEndAt: new Date() },
    include: CHANGE_INCLUDE,
  });

  await recordAudit({
    action: 'change.rolled_back',
    resourceType: 'change',
    resourceId: changeId,
    tenantId,
    before: { statusKey: before.statusKey },
    after: { statusKey: change.statusKey, reason: input.reason },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'change.rolled_back', tenantId, payload: { changeId } });

  return change;
}

export async function listChangeComments(tenantId: string, changeId: string, req: Request) {
  await findChangeOrThrow(tenantId, changeId);
  const query = parseListQuery(req, { maxLimit: 100 });
  const where = { changeId, tenantId };
  const [rows, total] = await Promise.all([
    prisma.changeComment.findMany({
      where,
      include: { author: { select: USER_SUMMARY } },
      orderBy: { createdAt: 'asc' },
      ...paginationArgs(query),
    }),
    prisma.changeComment.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function addChangeComment(
  tenantId: string,
  changeId: string,
  input: CreateChangeCommentInput,
  actor: TenantActorContext,
) {
  await findChangeOrThrow(tenantId, changeId);
  const comment = await prisma.changeComment.create({
    data: {
      tenantId,
      changeId,
      authorId: actor.actorId ?? null,
      body: input.body,
      isInternal: input.isInternal ?? false,
    },
    include: { author: { select: USER_SUMMARY } },
  });

  await recordAudit({
    action: 'change.comment.added',
    resourceType: 'change',
    resourceId: changeId,
    tenantId,
    after: { commentId: comment.id, isInternal: comment.isInternal },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'change.comment.added', tenantId, payload: { changeId, commentId: comment.id } });

  return comment;
}
