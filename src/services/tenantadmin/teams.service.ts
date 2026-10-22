import type { Request } from "express";
import { prisma } from "../../config/database";
import { NotFoundError, ValidationError } from "../../shared/errors";
import {
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import { publishEvent } from "../../shared/events";
import { createTenantCrudService } from "./structure-crud";
import type { TenantActorContext } from "./roles.service";
import type {
  AddTeamMemberInput,
  AssignTeamQueueInput,
} from "../../validators/tenantadmin/teams.validators";

const USER_SUMMARY = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  jobTitle: true,
  status: true,
} as const;

async function findTeamOrThrow(tenantId: string, teamId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!team) throw new NotFoundError("Team");
  return team;
}

async function assertMembers(tenantId: string, userIds: string[]) {
  const unique = Array.from(new Set(userIds));
  if (unique.length === 0) return;
  const found = await prisma.tenantMembership.count({
    where: { tenantId, userId: { in: unique } },
  });
  if (found !== unique.length) {
    throw new ValidationError(
      "One or more selected users are not members of this organization.",
    );
  }
}

export const teamService = createTenantCrudService({
  resourceType: "team",
  label: "Team",
  model: prisma.team,
  codeField: "code",
  searchFields: ["name", "code", "description", "email"],
  allowedSortFields: ["name", "code", "status", "createdAt", "updatedAt"],
  include: {
    department: { select: { id: true, name: true, code: true } },
    lead: { select: USER_SUMMARY },
    _count: { select: { members: true } },
  },
  async validate(tenantId, input) {
    const departmentId = input.departmentId;
    if (typeof departmentId === "string" && departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!department)
        throw new ValidationError(
          "The selected department could not be found.",
        );
    }
    const leadId = input.leadId;
    if (typeof leadId === "string" && leadId) {
      await assertMembers(tenantId, [leadId]);
    }
  },
});

export async function listTeamMembers(
  tenantId: string,
  teamId: string,
  req: Request,
) {
  await findTeamOrThrow(tenantId, teamId);
  const query = parseListQuery(req, { maxLimit: 100 });

  const where = { teamId, tenantId };
  const [rows, total] = await Promise.all([
    prisma.teamMember.findMany({
      where,
      include: { user: { select: USER_SUMMARY } },
      orderBy: { joinedAt: "asc" },
      ...paginationArgs(query),
    }),
    prisma.teamMember.count({ where }),
  ]);

  return {
    rows: rows.map((member) => ({
      ...member.user,
      teamMemberId: member.id,
      role: member.role,
      isLead: member.isLead,
      joinedAt: member.joinedAt,
    })),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function addTeamMember(
  tenantId: string,
  teamId: string,
  input: AddTeamMemberInput,
  actor: TenantActorContext,
) {
  await findTeamOrThrow(tenantId, teamId);
  await assertMembers(tenantId, [input.userId]);

  const member = await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId, userId: input.userId } },
    create: {
      tenantId,
      teamId,
      userId: input.userId,
      role: input.role ?? "MEMBER",
      isLead: input.isLead ?? false,
    },
    update: {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isLead !== undefined ? { isLead: input.isLead } : {}),
    },
    include: { user: { select: USER_SUMMARY } },
  });

  await recordAudit({
    action: "team.member.added",
    resourceType: "team",
    resourceId: teamId,
    tenantId,
    after: { userId: input.userId, role: member.role, isLead: member.isLead },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "team.member.added",
    tenantId,
    payload: { teamId, userId: input.userId },
  });

  return {
    ...member.user,
    teamMemberId: member.id,
    role: member.role,
    isLead: member.isLead,
    joinedAt: member.joinedAt,
  };
}

export async function removeTeamMember(
  tenantId: string,
  teamId: string,
  userId: string,
  actor: TenantActorContext,
) {
  await findTeamOrThrow(tenantId, teamId);
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!member) throw new NotFoundError("Team member");

  await prisma.teamMember.delete({ where: { id: member.id } });

  await recordAudit({
    action: "team.member.removed",
    resourceType: "team",
    resourceId: teamId,
    tenantId,
    before: { userId, role: member.role, isLead: member.isLead },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "team.member.removed",
    tenantId,
    payload: { teamId, userId },
  });
}

// ---------------------------------------------------------------------------
// Team queues (service desk queues assigned to a team)
// ---------------------------------------------------------------------------

export async function listTeamQueues(
  tenantId: string,
  teamId: string,
  req: Request,
) {
  await findTeamOrThrow(tenantId, teamId);
  const query = parseListQuery(req, { maxLimit: 100 });

  const where = { tenantId, teamId, deletedAt: null };
  const [rows, total] = await Promise.all([
    prisma.tenantServiceDeskQueue.findMany({
      where,
      orderBy: { name: "asc" },
      ...paginationArgs(query),
      select: {
        id: true,
        name: true,
        email: true,
        isDefault: true,
        status: true,
        operatingHoursId: true,
        teamId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.tenantServiceDeskQueue.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function assignTeamQueue(
  tenantId: string,
  teamId: string,
  input: AssignTeamQueueInput,
  actor: TenantActorContext,
) {
  await findTeamOrThrow(tenantId, teamId);
  const queue = await prisma.tenantServiceDeskQueue.findFirst({
    where: { id: input.queueId, tenantId, deletedAt: null },
    select: { id: true, name: true, teamId: true },
  });
  if (!queue) throw new NotFoundError("Queue");

  const updated = await prisma.tenantServiceDeskQueue.update({
    where: { id: queue.id },
    data: { teamId },
    select: { id: true, name: true, teamId: true },
  });

  await recordAudit({
    action: "team.queue.assigned",
    resourceType: "team",
    resourceId: teamId,
    tenantId,
    before: { queueId: queue.id, teamId: queue.teamId },
    after: { queueId: updated.id, teamId: updated.teamId },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "team.queue.assigned",
    tenantId,
    payload: { teamId, queueId: queue.id },
  });

  return updated;
}

export async function unassignTeamQueue(
  tenantId: string,
  teamId: string,
  queueId: string,
  actor: TenantActorContext,
) {
  await findTeamOrThrow(tenantId, teamId);
  const queue = await prisma.tenantServiceDeskQueue.findFirst({
    where: { id: queueId, tenantId, teamId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!queue) throw new NotFoundError("Queue assignment");

  await prisma.tenantServiceDeskQueue.update({
    where: { id: queue.id },
    data: { teamId: null },
  });

  await recordAudit({
    action: "team.queue.unassigned",
    resourceType: "team",
    resourceId: teamId,
    tenantId,
    before: { queueId: queue.id, teamId },
    after: { queueId: queue.id, teamId: null },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "team.queue.unassigned",
    tenantId,
    payload: { teamId, queueId: queue.id },
  });

  return { queueId: queue.id, teamId, removed: true as const };
}
