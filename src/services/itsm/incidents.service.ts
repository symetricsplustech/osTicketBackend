import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import { buildOrderBy, buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import {
  USER_SUMMARY,
  assertTenantCategory,
  assertTenantDepartment,
  assertTenantLocation,
  assertTenantTeam,
  assertTenantUser,
  generateTicketNumber,
} from './shared';
import type { TenantActorContext } from '../tenantadmin/roles.service';
import type {
  AssignIncidentInput,
  CreateIncidentCommentInput,
  CreateIncidentInput,
  EscalateIncidentInput,
  ReopenIncidentInput,
  ResolveIncidentInput,
  UpdateIncidentInput,
} from '../../validators/itsm/incidents.validators';

const INCIDENT_INCLUDE = {
  caller: { select: USER_SUMMARY },
  assignee: { select: USER_SUMMARY },
  team: { select: { id: true, name: true, code: true } },
  department: { select: { id: true, name: true, code: true } },
  location: { select: { id: true, name: true, code: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.IncidentInclude;

async function findIncidentOrThrow(tenantId: string, incidentId: string) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, tenantId, deletedAt: null },
    include: INCIDENT_INCLUDE,
  });
  if (!incident) throw new NotFoundError('Incident');
  return incident;
}

export async function listIncidents(tenantId: string, req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.IncidentWhereInput = { tenantId, deletedAt: null };

  const statusKey = typeof query.status === 'string' && query.status ? query.status : undefined;
  const priorityKey = typeof query.priorityKey === 'string' && query.priorityKey ? query.priorityKey : undefined;
  const assigneeId = typeof query.assigneeId === 'string' && query.assigneeId ? query.assigneeId : undefined;
  const callerId = typeof query.callerId === 'string' && query.callerId ? query.callerId : undefined;
  const teamId = typeof query.teamId === 'string' && query.teamId ? query.teamId : undefined;
  const customerId = typeof query.customerId === 'string' && query.customerId ? query.customerId : undefined;

  if (statusKey) where.statusKey = statusKey;
  if (priorityKey) where.priorityKey = priorityKey;
  if (assigneeId) where.assigneeId = assigneeId;
  if (callerId) where.callerId = callerId;
  if (teamId) where.teamId = teamId;
  if (customerId) where.customerId = customerId;
  if (query.search) {
    where.OR = [
      { number: { contains: query.search, mode: 'insensitive' } },
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const orderBy = buildOrderBy(
    query,
    ['number', 'title', 'statusKey', 'priorityKey', 'createdAt', 'updatedAt', 'dueAt'],
    { createdAt: 'desc' } as Prisma.IncidentOrderByWithRelationInput,
  );
  const [rows, total] = await Promise.all([
    prisma.incident.findMany({ where, orderBy, ...paginationArgs(query), include: INCIDENT_INCLUDE }),
    prisma.incident.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getIncident(tenantId: string, incidentId: string) {
  return findIncidentOrThrow(tenantId, incidentId);
}

async function validateReferences(
  tenantId: string,
  input: {
    categoryId?: string | null;
    callerId?: string | null;
    assigneeId?: string | null;
    teamId?: string | null;
    departmentId?: string | null;
    locationId?: string | null;
  },
) {
  await assertTenantCategory(tenantId, input.categoryId);
  await assertTenantUser(tenantId, input.callerId, 'caller');
  await assertTenantUser(tenantId, input.assigneeId, 'assignee');
  await assertTenantTeam(tenantId, input.teamId);
  await assertTenantDepartment(tenantId, input.departmentId);
  await assertTenantLocation(tenantId, input.locationId);
}

export async function createIncident(tenantId: string, input: CreateIncidentInput, actor: TenantActorContext) {
  await validateReferences(tenantId, input);

  const count = await prisma.incident.count({ where: { tenantId } });
  const number = await generateTicketNumber(
    'incidents',
    'INC',
    async (candidate) => (await prisma.incident.count({ where: { tenantId, number: candidate } })) > 0,
    count + 1,
  );

  const incident = await prisma.incident.create({
    data: {
      tenantId,
      number,
      title: input.title,
      description: input.description ?? null,
      statusKey: input.statusKey ?? 'new',
      priorityKey: input.priorityKey ?? 'medium',
      impact: input.impact ?? 'MEDIUM',
      urgency: input.urgency ?? 'MEDIUM',
      categoryId: input.categoryId ?? null,
      source: input.source ?? 'PORTAL',
      channel: input.channel ?? null,
      callerId: input.callerId ?? actor.actorId ?? null,
      assigneeId: input.assigneeId ?? null,
      teamId: input.teamId ?? null,
      departmentId: input.departmentId ?? null,
      locationId: input.locationId ?? null,
      tags: input.tags ?? [],
      dueAt: input.dueAt ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      createdById: actor.actorId ?? null,
    },
    include: INCIDENT_INCLUDE,
  });

  await recordAudit({
    action: 'incident.created',
    resourceType: 'incident',
    resourceId: incident.id,
    tenantId,
    after: incident,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'incident.created', tenantId, payload: { incidentId: incident.id, number } });

  return incident;
}

export async function updateIncident(
  tenantId: string,
  incidentId: string,
  input: UpdateIncidentInput,
  actor: TenantActorContext,
) {
  const before = await findIncidentOrThrow(tenantId, incidentId);
  await validateReferences(tenantId, input);

  const data: Prisma.IncidentUpdateInput = {};
  const assign = <K extends keyof UpdateIncidentInput>(key: K) => {
    if (input[key] !== undefined) {
      (data as Record<string, unknown>)[key] = input[key];
    }
  };
  assign('title');
  assign('description');
  assign('statusKey');
  assign('priorityKey');
  assign('impact');
  assign('urgency');
  assign('categoryId');
  assign('source');
  assign('channel');
  assign('callerId');
  assign('teamId');
  assign('departmentId');
  assign('locationId');
  assign('tags');
  assign('dueAt');
  if (input.metadata !== undefined) data.metadata = input.metadata as Prisma.InputJsonValue;

  const incident = await prisma.incident.update({ where: { id: incidentId }, data, include: INCIDENT_INCLUDE });

  await recordAudit({
    action: 'incident.updated',
    resourceType: 'incident',
    resourceId: incidentId,
    tenantId,
    before,
    after: incident,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'incident.updated', tenantId, payload: { incidentId } });

  return incident;
}

export async function deleteIncident(tenantId: string, incidentId: string, actor: TenantActorContext) {
  const before = await findIncidentOrThrow(tenantId, incidentId);
  await prisma.incident.update({ where: { id: incidentId }, data: { deletedAt: new Date() } });

  await recordAudit({
    action: 'incident.deleted',
    resourceType: 'incident',
    resourceId: incidentId,
    tenantId,
    before,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'incident.deleted', tenantId, payload: { incidentId } });
}

export async function assignIncident(
  tenantId: string,
  incidentId: string,
  input: AssignIncidentInput,
  actor: TenantActorContext,
) {
  const before = await findIncidentOrThrow(tenantId, incidentId);
  await assertTenantUser(tenantId, input.assigneeId, 'assignee');
  await assertTenantTeam(tenantId, input.teamId);

  const incident = await prisma.incident.update({
    where: { id: incidentId },
    data: {
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
      ...(before.firstResponseAt ? {} : { firstResponseAt: new Date() }),
    },
    include: INCIDENT_INCLUDE,
  });

  await recordAudit({
    action: 'incident.assigned',
    resourceType: 'incident',
    resourceId: incidentId,
    tenantId,
    before: { assigneeId: before.assigneeId, teamId: before.teamId },
    after: { assigneeId: incident.assigneeId, teamId: incident.teamId },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'incident.assigned', tenantId, payload: { incidentId } });

  return incident;
}

export async function escalateIncident(
  tenantId: string,
  incidentId: string,
  input: EscalateIncidentInput,
  actor: TenantActorContext,
) {
  const before = await findIncidentOrThrow(tenantId, incidentId);
  const priorityKey = input.priorityKey ?? (before.priorityKey === 'critical' ? 'critical' : 'high');

  const metadata = (before.metadata as Record<string, unknown> | null) ?? {};
  const escalations = Array.isArray(metadata['escalations']) ? (metadata['escalations'] as unknown[]) : [];
  const nextMetadata = {
    ...metadata,
    escalations: [
      ...escalations,
      { at: new Date().toISOString(), by: actor.actorId ?? null, priorityKey, reason: input.reason ?? null },
    ],
  };

  const incident = await prisma.incident.update({
    where: { id: incidentId },
    data: { priorityKey, metadata: nextMetadata as Prisma.InputJsonValue },
    include: INCIDENT_INCLUDE,
  });

  await recordAudit({
    action: 'incident.escalated',
    resourceType: 'incident',
    resourceId: incidentId,
    tenantId,
    before: { priorityKey: before.priorityKey },
    after: { priorityKey: incident.priorityKey, reason: input.reason ?? null },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'incident.escalated', tenantId, payload: { incidentId, priorityKey } });

  return incident;
}

export async function resolveIncident(
  tenantId: string,
  incidentId: string,
  input: ResolveIncidentInput,
  actor: TenantActorContext,
) {
  const before = await findIncidentOrThrow(tenantId, incidentId);
  const now = new Date();

  const incident = await prisma.incident.update({
    where: { id: incidentId },
    data: {
      statusKey: 'resolved',
      resolutionNotes: input.resolutionNotes,
      resolutionCode: input.resolutionCode ?? null,
      resolvedAt: now,
      firstResponseAt: before.firstResponseAt ?? now,
    },
    include: INCIDENT_INCLUDE,
  });

  await recordAudit({
    action: 'incident.resolved',
    resourceType: 'incident',
    resourceId: incidentId,
    tenantId,
    before: { statusKey: before.statusKey },
    after: { statusKey: incident.statusKey, resolutionCode: incident.resolutionCode },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'incident.resolved', tenantId, payload: { incidentId } });

  return incident;
}

export async function reopenIncident(
  tenantId: string,
  incidentId: string,
  input: ReopenIncidentInput,
  actor: TenantActorContext,
) {
  const before = await findIncidentOrThrow(tenantId, incidentId);

  const incident = await prisma.incident.update({
    where: { id: incidentId },
    data: {
      statusKey: 'reopened',
      resolvedAt: null,
      closedAt: null,
      reopenedCount: { increment: 1 },
    },
    include: INCIDENT_INCLUDE,
  });

  await recordAudit({
    action: 'incident.reopened',
    resourceType: 'incident',
    resourceId: incidentId,
    tenantId,
    before: { statusKey: before.statusKey },
    after: { statusKey: incident.statusKey, reason: input.reason ?? null },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'incident.reopened', tenantId, payload: { incidentId } });

  return incident;
}

export async function listIncidentComments(tenantId: string, incidentId: string, req: Request) {
  await findIncidentOrThrow(tenantId, incidentId);
  const query = parseListQuery(req, { maxLimit: 100 });

  const where = { incidentId, tenantId };
  const [rows, total] = await Promise.all([
    prisma.incidentComment.findMany({
      where,
      include: { author: { select: USER_SUMMARY } },
      orderBy: { createdAt: 'asc' },
      ...paginationArgs(query),
    }),
    prisma.incidentComment.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function addIncidentComment(
  tenantId: string,
  incidentId: string,
  input: CreateIncidentCommentInput,
  actor: TenantActorContext,
) {
  await findIncidentOrThrow(tenantId, incidentId);

  const comment = await prisma.incidentComment.create({
    data: {
      tenantId,
      incidentId,
      authorId: actor.actorId ?? null,
      body: input.body,
      isInternal: input.isInternal ?? false,
    },
    include: { author: { select: USER_SUMMARY } },
  });

  await recordAudit({
    action: 'incident.comment.added',
    resourceType: 'incident',
    resourceId: incidentId,
    tenantId,
    after: { commentId: comment.id, isInternal: comment.isInternal },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? 'TENANT_USER',
    req: actor.req,
  });
  void publishEvent({ eventKey: 'incident.comment.added', tenantId, payload: { incidentId, commentId: comment.id } });

  return comment;
}
