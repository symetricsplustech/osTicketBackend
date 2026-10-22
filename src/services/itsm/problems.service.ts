import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { NotFoundError } from "../../shared/errors";
import {
  buildOrderBy,
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import { publishEvent } from "../../shared/events";
import {
  USER_SUMMARY,
  assertTenantCategory,
  assertTenantTeam,
  assertTenantUser,
  generateTicketNumber,
} from "./shared";
import type { TenantActorContext } from "../tenantadmin/roles.service";
import type {
  AssignProblemInput,
  CreateProblemCommentInput,
  CreateProblemInput,
  ResolveProblemInput,
  UpdateProblemInput,
} from "../../validators/itsm/problems.validators";

const PROBLEM_INCLUDE = {
  assignee: { select: USER_SUMMARY },
  team: { select: { id: true, name: true, code: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProblemInclude;

async function findProblemOrThrow(tenantId: string, problemId: string) {
  const problem = await prisma.problem.findFirst({
    where: { id: problemId, tenantId, deletedAt: null },
    include: PROBLEM_INCLUDE,
  });
  if (!problem) throw new NotFoundError("Problem");
  return problem;
}

export async function listProblems(tenantId: string, req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.ProblemWhereInput = { tenantId, deletedAt: null };

  const statusKey =
    typeof query.status === "string" && query.status ? query.status : undefined;
  const priorityKey =
    typeof query.priorityKey === "string" && query.priorityKey
      ? query.priorityKey
      : undefined;
  const assigneeId =
    typeof query.assigneeId === "string" && query.assigneeId
      ? query.assigneeId
      : undefined;
  const teamId =
    typeof query.teamId === "string" && query.teamId ? query.teamId : undefined;
  if (statusKey) where.statusKey = statusKey;
  if (priorityKey) where.priorityKey = priorityKey;
  if (assigneeId) where.assigneeId = assigneeId;
  if (teamId) where.teamId = teamId;
  if (query.search) {
    where.OR = [
      { number: { contains: query.search, mode: "insensitive" } },
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const orderBy = buildOrderBy(
    query,
    ["number", "title", "statusKey", "priorityKey", "createdAt", "updatedAt"],
    { createdAt: "desc" } as Prisma.ProblemOrderByWithRelationInput,
  );
  const [rows, total] = await Promise.all([
    prisma.problem.findMany({
      where,
      orderBy,
      ...paginationArgs(query),
      include: PROBLEM_INCLUDE,
    }),
    prisma.problem.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getProblem(tenantId: string, problemId: string) {
  return findProblemOrThrow(tenantId, problemId);
}

export async function createProblem(
  tenantId: string,
  input: CreateProblemInput,
  actor: TenantActorContext,
) {
  await assertTenantCategory(tenantId, input.categoryId);
  await assertTenantUser(tenantId, input.assigneeId, "assignee");
  await assertTenantTeam(tenantId, input.teamId);

  const count = await prisma.problem.count({ where: { tenantId } });
  const number = await generateTicketNumber(
    "problems",
    "PRB",
    async (candidate) =>
      (await prisma.problem.count({ where: { tenantId, number: candidate } })) >
      0,
    count + 1,
  );

  const problem = await prisma.problem.create({
    data: {
      tenantId,
      number,
      title: input.title,
      description: input.description ?? null,
      statusKey: input.statusKey ?? "new",
      priorityKey: input.priorityKey ?? "medium",
      impact: input.impact ?? "MEDIUM",
      categoryId: input.categoryId ?? null,
      assigneeId: input.assigneeId ?? null,
      teamId: input.teamId ?? null,
      rootCause: input.rootCause ?? null,
      workaround: input.workaround ?? null,
      isKnownError: input.isKnownError ?? false,
      createdById: actor.actorId ?? null,
    },
    include: PROBLEM_INCLUDE,
  });

  await recordAudit({
    action: "problem.created",
    resourceType: "problem",
    resourceId: problem.id,
    tenantId,
    after: problem,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "problem.created",
    tenantId,
    payload: { problemId: problem.id, number },
  });

  return problem;
}

export async function updateProblem(
  tenantId: string,
  problemId: string,
  input: UpdateProblemInput,
  actor: TenantActorContext,
) {
  const before = await findProblemOrThrow(tenantId, problemId);
  await assertTenantCategory(tenantId, input.categoryId);
  await assertTenantUser(tenantId, input.assigneeId, "assignee");
  await assertTenantTeam(tenantId, input.teamId);

  const data: Prisma.ProblemUpdateInput = {};
  for (const key of [
    "title",
    "description",
    "statusKey",
    "priorityKey",
    "impact",
    "categoryId",
    "assigneeId",
    "teamId",
    "rootCause",
    "workaround",
    "resolutionNotes",
    "isKnownError",
  ] as const) {
    if (input[key] !== undefined)
      (data as Record<string, unknown>)[key] = input[key];
  }

  const problem = await prisma.problem.update({
    where: { id: problemId },
    data,
    include: PROBLEM_INCLUDE,
  });

  await recordAudit({
    action: "problem.updated",
    resourceType: "problem",
    resourceId: problemId,
    tenantId,
    before,
    after: problem,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "problem.updated",
    tenantId,
    payload: { problemId },
  });

  return problem;
}

export async function deleteProblem(
  tenantId: string,
  problemId: string,
  actor: TenantActorContext,
) {
  const before = await findProblemOrThrow(tenantId, problemId);
  await prisma.problem.update({
    where: { id: problemId },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    action: "problem.deleted",
    resourceType: "problem",
    resourceId: problemId,
    tenantId,
    before,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "problem.deleted",
    tenantId,
    payload: { problemId },
  });
}

export async function assignProblem(
  tenantId: string,
  problemId: string,
  input: AssignProblemInput,
  actor: TenantActorContext,
) {
  const before = await findProblemOrThrow(tenantId, problemId);
  await assertTenantUser(tenantId, input.assigneeId, "assignee");
  await assertTenantTeam(tenantId, input.teamId);

  const problem = await prisma.problem.update({
    where: { id: problemId },
    data: {
      ...(input.assigneeId !== undefined
        ? { assigneeId: input.assigneeId }
        : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
    },
    include: PROBLEM_INCLUDE,
  });

  await recordAudit({
    action: "problem.assigned",
    resourceType: "problem",
    resourceId: problemId,
    tenantId,
    before: { assigneeId: before.assigneeId, teamId: before.teamId },
    after: { assigneeId: problem.assigneeId, teamId: problem.teamId },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "problem.assigned",
    tenantId,
    payload: { problemId },
  });

  return problem;
}

export async function resolveProblem(
  tenantId: string,
  problemId: string,
  input: ResolveProblemInput,
  actor: TenantActorContext,
) {
  const before = await findProblemOrThrow(tenantId, problemId);
  const now = new Date();

  const problem = await prisma.problem.update({
    where: { id: problemId },
    data: {
      statusKey: "resolved",
      resolutionNotes: input.resolutionNotes,
      rootCause: input.rootCause ?? before.rootCause,
      isKnownError: input.isKnownError ?? before.isKnownError,
      resolvedAt: now,
    },
    include: PROBLEM_INCLUDE,
  });

  await recordAudit({
    action: "problem.resolved",
    resourceType: "problem",
    resourceId: problemId,
    tenantId,
    before: { statusKey: before.statusKey },
    after: { statusKey: problem.statusKey },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "problem.resolved",
    tenantId,
    payload: { problemId },
  });

  return problem;
}

export async function listProblemComments(
  tenantId: string,
  problemId: string,
  req: Request,
) {
  await findProblemOrThrow(tenantId, problemId);
  const query = parseListQuery(req, { maxLimit: 100 });
  const where = { problemId, tenantId };
  const [rows, total] = await Promise.all([
    prisma.problemComment.findMany({
      where,
      include: { author: { select: USER_SUMMARY } },
      orderBy: { createdAt: "asc" },
      ...paginationArgs(query),
    }),
    prisma.problemComment.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function addProblemComment(
  tenantId: string,
  problemId: string,
  input: CreateProblemCommentInput,
  actor: TenantActorContext,
) {
  await findProblemOrThrow(tenantId, problemId);
  const comment = await prisma.problemComment.create({
    data: {
      tenantId,
      problemId,
      authorId: actor.actorId ?? null,
      body: input.body,
      isInternal: input.isInternal ?? false,
    },
    include: { author: { select: USER_SUMMARY } },
  });

  await recordAudit({
    action: "problem.comment.added",
    resourceType: "problem",
    resourceId: problemId,
    tenantId,
    after: { commentId: comment.id, isInternal: comment.isInternal },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "problem.comment.added",
    tenantId,
    payload: { problemId, commentId: comment.id },
  });

  return comment;
}
