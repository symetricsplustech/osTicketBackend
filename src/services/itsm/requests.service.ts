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
  assertTenantTeam,
  assertTenantUser,
  generateTicketNumber,
} from "./shared";
import type { TenantActorContext } from "../tenantadmin/roles.service";
import type {
  AssignServiceRequestInput,
  CancelServiceRequestInput,
  CreateServiceRequestCommentInput,
  CreateServiceRequestInput,
  DecideServiceRequestInput,
  FulfillServiceRequestInput,
  UpdateServiceRequestInput,
} from "../../validators/itsm/requests.validators";

const REQUEST_INCLUDE = {
  assignee: { select: USER_SUMMARY },
  requestedFor: { select: USER_SUMMARY },
  team: { select: { id: true, name: true, code: true } },
} satisfies Prisma.ServiceRequestInclude;

async function findRequestOrThrow(tenantId: string, requestId: string) {
  const request = await prisma.serviceRequest.findFirst({
    where: { id: requestId, tenantId, deletedAt: null },
    include: REQUEST_INCLUDE,
  });
  if (!request) throw new NotFoundError("Service request");
  return request;
}

export async function listServiceRequests(tenantId: string, req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.ServiceRequestWhereInput = { tenantId, deletedAt: null };

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
  const requestedForId =
    typeof query.requestedForId === "string" && query.requestedForId
      ? query.requestedForId
      : undefined;
  const teamId =
    typeof query.teamId === "string" && query.teamId ? query.teamId : undefined;
  if (statusKey) where.statusKey = statusKey;
  if (priorityKey) where.priorityKey = priorityKey;
  if (assigneeId) where.assigneeId = assigneeId;
  if (requestedForId) where.requestedForId = requestedForId;
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
    { createdAt: "desc" } as Prisma.ServiceRequestOrderByWithRelationInput,
  );
  const [rows, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      orderBy,
      ...paginationArgs(query),
      include: REQUEST_INCLUDE,
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getServiceRequest(tenantId: string, requestId: string) {
  return findRequestOrThrow(tenantId, requestId);
}

export async function createServiceRequest(
  tenantId: string,
  input: CreateServiceRequestInput,
  actor: TenantActorContext,
) {
  await assertTenantUser(tenantId, input.requestedForId, "requester");
  await assertTenantUser(tenantId, input.assigneeId, "assignee");
  await assertTenantTeam(tenantId, input.teamId);

  const count = await prisma.serviceRequest.count({ where: { tenantId } });
  const number = await generateTicketNumber(
    "requests",
    "REQ",
    async (candidate) =>
      (await prisma.serviceRequest.count({
        where: { tenantId, number: candidate },
      })) > 0,
    count + 1,
  );

  const request = await prisma.serviceRequest.create({
    data: {
      tenantId,
      number,
      title: input.title,
      description: input.description ?? null,
      statusKey: input.statusKey ?? "new",
      priorityKey: input.priorityKey ?? "medium",
      catalogItemId: input.catalogItemId ?? null,
      requestedForId: input.requestedForId ?? actor.actorId ?? null,
      assigneeId: input.assigneeId ?? null,
      teamId: input.teamId ?? null,
      createdById: actor.actorId ?? null,
    },
    include: REQUEST_INCLUDE,
  });

  await recordAudit({
    action: "service_request.created",
    resourceType: "service_request",
    resourceId: request.id,
    tenantId,
    after: request,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "service_request.created",
    tenantId,
    payload: { requestId: request.id, number },
  });

  return request;
}

export async function updateServiceRequest(
  tenantId: string,
  requestId: string,
  input: UpdateServiceRequestInput,
  actor: TenantActorContext,
) {
  const before = await findRequestOrThrow(tenantId, requestId);
  await assertTenantUser(tenantId, input.requestedForId, "requester");
  await assertTenantUser(tenantId, input.assigneeId, "assignee");
  await assertTenantTeam(tenantId, input.teamId);

  const data: Prisma.ServiceRequestUpdateInput = {};
  for (const key of [
    "title",
    "description",
    "statusKey",
    "priorityKey",
    "catalogItemId",
    "requestedForId",
    "assigneeId",
    "teamId",
  ] as const) {
    if (input[key] !== undefined)
      (data as Record<string, unknown>)[key] = input[key];
  }

  const request = await prisma.serviceRequest.update({
    where: { id: requestId },
    data,
    include: REQUEST_INCLUDE,
  });

  await recordAudit({
    action: "service_request.updated",
    resourceType: "service_request",
    resourceId: requestId,
    tenantId,
    before,
    after: request,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "service_request.updated",
    tenantId,
    payload: { requestId },
  });

  return request;
}

export async function deleteServiceRequest(
  tenantId: string,
  requestId: string,
  actor: TenantActorContext,
) {
  const before = await findRequestOrThrow(tenantId, requestId);
  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    action: "service_request.deleted",
    resourceType: "service_request",
    resourceId: requestId,
    tenantId,
    before,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "service_request.deleted",
    tenantId,
    payload: { requestId },
  });
}

export async function assignServiceRequest(
  tenantId: string,
  requestId: string,
  input: AssignServiceRequestInput,
  actor: TenantActorContext,
) {
  const before = await findRequestOrThrow(tenantId, requestId);
  await assertTenantUser(tenantId, input.assigneeId, "assignee");
  await assertTenantTeam(tenantId, input.teamId);

  const request = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      ...(input.assigneeId !== undefined
        ? { assigneeId: input.assigneeId }
        : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
    },
    include: REQUEST_INCLUDE,
  });

  await recordAudit({
    action: "service_request.assigned",
    resourceType: "service_request",
    resourceId: requestId,
    tenantId,
    before: { assigneeId: before.assigneeId, teamId: before.teamId },
    after: { assigneeId: request.assigneeId, teamId: request.teamId },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "service_request.assigned",
    tenantId,
    payload: { requestId },
  });

  return request;
}

export async function decideServiceRequest(
  tenantId: string,
  requestId: string,
  input: DecideServiceRequestInput,
  actor: TenantActorContext,
) {
  const before = await findRequestOrThrow(tenantId, requestId);

  const request = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      approvalStatus: input.decision,
      statusKey: input.decision === "APPROVED" ? "approved" : "rejected",
    },
    include: REQUEST_INCLUDE,
  });

  await recordAudit({
    action: `service_request.${input.decision === "APPROVED" ? "approved" : "rejected"}`,
    resourceType: "service_request",
    resourceId: requestId,
    tenantId,
    before: { approvalStatus: before.approvalStatus },
    after: { approvalStatus: request.approvalStatus, note: input.note ?? null },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "service_request.decision",
    tenantId,
    payload: { requestId, decision: input.decision },
  });

  return request;
}

export async function fulfillServiceRequest(
  tenantId: string,
  requestId: string,
  input: FulfillServiceRequestInput,
  actor: TenantActorContext,
) {
  const before = await findRequestOrThrow(tenantId, requestId);
  const now = new Date();

  const request = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { statusKey: "fulfilled", fulfilledAt: now },
    include: REQUEST_INCLUDE,
  });

  await recordAudit({
    action: "service_request.fulfilled",
    resourceType: "service_request",
    resourceId: requestId,
    tenantId,
    before: { statusKey: before.statusKey },
    after: { statusKey: request.statusKey, note: input.note ?? null },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "service_request.fulfilled",
    tenantId,
    payload: { requestId },
  });

  return request;
}

export async function cancelServiceRequest(
  tenantId: string,
  requestId: string,
  input: CancelServiceRequestInput,
  actor: TenantActorContext,
) {
  const before = await findRequestOrThrow(tenantId, requestId);

  const request = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { statusKey: "cancelled", closedAt: new Date() },
    include: REQUEST_INCLUDE,
  });

  await recordAudit({
    action: "service_request.cancelled",
    resourceType: "service_request",
    resourceId: requestId,
    tenantId,
    before: { statusKey: before.statusKey },
    after: { statusKey: request.statusKey, reason: input.reason },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "service_request.cancelled",
    tenantId,
    payload: { requestId },
  });

  return request;
}

export async function listServiceRequestComments(
  tenantId: string,
  requestId: string,
  req: Request,
) {
  await findRequestOrThrow(tenantId, requestId);
  const query = parseListQuery(req, { maxLimit: 100 });
  const where = { serviceRequestId: requestId, tenantId };
  const [rows, total] = await Promise.all([
    prisma.serviceRequestComment.findMany({
      where,
      include: { author: { select: USER_SUMMARY } },
      orderBy: { createdAt: "asc" },
      ...paginationArgs(query),
    }),
    prisma.serviceRequestComment.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function addServiceRequestComment(
  tenantId: string,
  requestId: string,
  input: CreateServiceRequestCommentInput,
  actor: TenantActorContext,
) {
  await findRequestOrThrow(tenantId, requestId);
  const comment = await prisma.serviceRequestComment.create({
    data: {
      tenantId,
      serviceRequestId: requestId,
      authorId: actor.actorId ?? null,
      body: input.body,
      isInternal: input.isInternal ?? false,
    },
    include: { author: { select: USER_SUMMARY } },
  });

  await recordAudit({
    action: "service_request.comment.added",
    resourceType: "service_request",
    resourceId: requestId,
    tenantId,
    after: { commentId: comment.id, isInternal: comment.isInternal },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "service_request.comment.added",
    tenantId,
    payload: { requestId, commentId: comment.id },
  });

  return comment;
}
