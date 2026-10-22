import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import {
  ConflictError,
  NotFoundError,
  PreconditionFailedError,
} from "../../shared/errors";
import {
  buildOrderBy,
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import { publishEvent } from "../../shared/events";
import type {
  AssignTicketInput,
  CreateQueueInput,
  CreateTicketInput,
  ReplyTicketInput,
  ResolveTicketInput,
  UpdateQueueInput,
  UpdateTicketInput,
} from "../../validators/saasadmin/support.validators";

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

const TICKET_LIST_INCLUDE = {
  queue: { select: { id: true, name: true } },
  assignee: { select: SAFE_USER_SELECT },
  tenant: { select: { id: true, name: true, slug: true } },
  _count: { select: { replies: true } },
} satisfies Prisma.SupportTicketInclude;

const TICKET_DETAIL_INCLUDE = {
  queue: true,
  assignee: { select: SAFE_USER_SELECT },
  tenant: { select: { id: true, name: true, slug: true } },
  replies: {
    include: { author: { select: SAFE_USER_SELECT } },
    orderBy: { createdAt: "asc" },
    take: 200,
  },
  assignments: {
    include: {
      assignedTo: { select: SAFE_USER_SELECT },
      assignedBy: { select: SAFE_USER_SELECT },
    },
    orderBy: { createdAt: "asc" },
  },
  _count: { select: { replies: true, assignments: true } },
} satisfies Prisma.SupportTicketInclude;

const QUEUE_LIST_INCLUDE = {
  _count: { select: { tickets: true } },
} satisfies Prisma.SupportQueueInclude;

const TICKET_STATUS_VALUES = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
] as const;
const TICKET_PRIORITY_VALUES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const TICKET_SORT_FIELDS = [
  "ticketNumber",
  "subject",
  "status",
  "priority",
  "createdAt",
  "updatedAt",
  "resolvedAt",
];
const QUEUE_SORT_FIELDS = ["name", "isDefault", "createdAt", "updatedAt"];
const RESOLVABLE_STATUSES: readonly string[] = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "REOPENED",
];
const REOPENABLE_STATUSES: readonly string[] = ["RESOLVED", "CLOSED"];
const OPEN_TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "REOPENED",
] as const;

const TICKET_NUMBER_MAX_ATTEMPTS = 5;
const HISTORY_MAX_LIMIT = 100;

export interface SupportActorContext {
  actorId?: string | null;
  req?: Request;
}

function requireActorId(actor: SupportActorContext): string {
  if (!actor.actorId) {
    throw new PreconditionFailedError(
      "A signed-in platform user is required for this action.",
    );
  }
  return actor.actorId;
}

function pickEnum<T extends string>(
  allowed: readonly T[],
  value: unknown,
): T | undefined {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function ticketNumberPrefix(year: number): string {
  return `SUP-${year}-`;
}

function formatTicketNumber(year: number, sequence: number): string {
  return `${ticketNumberPrefix(year)}${String(sequence).padStart(5, "0")}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function findTicketOrThrow(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });
  if (!ticket) throw new NotFoundError("Support ticket");
  return ticket;
}

async function assertTenantExists(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!tenant) throw new NotFoundError("Tenant");
}

async function assertQueueExists(queueId: string): Promise<void> {
  const queue = await prisma.supportQueue.findUnique({
    where: { id: queueId },
    select: { id: true },
  });
  if (!queue) throw new NotFoundError("Support queue");
}

async function resolveQueueId(queueId?: string | null): Promise<string | null> {
  if (queueId) {
    await assertQueueExists(queueId);
    return queueId;
  }
  const defaultQueue = await prisma.supportQueue.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return defaultQueue?.id ?? null;
}

export async function listTickets(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const status = pickEnum(TICKET_STATUS_VALUES, query["status"]);
  const priority = pickEnum(TICKET_PRIORITY_VALUES, query["priority"]);
  const queueId = pickString(query["queueId"]);
  const assigneeId = pickString(query["assigneeId"]);
  const tenantId = pickString(query["tenantId"]);

  const where: Prisma.SupportTicketWhereInput = {
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(queueId ? { queueId } : {}),
    ...(assigneeId ? { assigneeId } : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(query.search
      ? {
          OR: [
            { subject: { contains: query.search, mode: "insensitive" } },
            { requesterEmail: { contains: query.search, mode: "insensitive" } },
            { ticketNumber: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy = buildOrderBy(query, TICKET_SORT_FIELDS, {
    createdAt: "desc" as const,
  });

  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy,
      include: TICKET_LIST_INCLUDE,
      ...paginationArgs(query),
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function createTicket(
  input: CreateTicketInput,
  actor: SupportActorContext,
) {
  const actorId = requireActorId(actor);

  if (input.tenantId) {
    await assertTenantExists(input.tenantId);
  }
  const queueId = await resolveQueueId(input.queueId);

  const baseData: Omit<
    Prisma.SupportTicketUncheckedCreateInput,
    "ticketNumber"
  > = {
    subject: input.subject,
    description: input.description,
    priority: input.priority,
    category: input.category ?? null,
    requesterName: input.requesterName,
    requesterEmail: input.requesterEmail,
    tenantId: input.tenantId ?? null,
    queueId,
    createdById: actorId,
    tags:
      input.tags && input.tags.length > 0
        ? (input.tags as Prisma.InputJsonValue)
        : Prisma.DbNull,
  };

  const year = new Date().getFullYear();
  const prefix = ticketNumberPrefix(year);
  const existingCount = await prisma.supportTicket.count({
    where: { ticketNumber: { startsWith: prefix } },
  });

  for (let attempt = 0; attempt < TICKET_NUMBER_MAX_ATTEMPTS; attempt += 1) {
    const ticketNumber = formatTicketNumber(year, existingCount + 1 + attempt);
    try {
      const ticket = await prisma.supportTicket.create({
        data: { ...baseData, ticketNumber },
        include: TICKET_DETAIL_INCLUDE,
      });

      await recordAudit({
        action: "support.ticket.created",
        resourceType: "support-ticket",
        resourceId: ticket.id,
        tenantId: ticket.tenantId,
        after: ticket,
        actorId,
        req: actor.req,
      });
      void publishEvent({
        eventKey: "support.ticket.created",
        tenantId: ticket.tenantId,
        payload: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          priority: ticket.priority,
        },
      });

      return ticket;
    } catch (error) {
      if (
        !isUniqueConstraintError(error) ||
        attempt === TICKET_NUMBER_MAX_ATTEMPTS - 1
      ) {
        throw error;
      }
      logger.warn(
        {
          ticketNumber,
          attempt: attempt + 1,
          maxAttempts: TICKET_NUMBER_MAX_ATTEMPTS,
        },
        "Support ticket number conflict; retrying with the next sequence",
      );
    }
  }

  throw new ConflictError(
    "Unable to allocate a unique support ticket number. Please retry.",
  );
}

export async function getTicket(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: TICKET_DETAIL_INCLUDE,
  });
  if (!ticket) throw new NotFoundError("Support ticket");
  return ticket;
}

export async function updateTicket(
  ticketId: string,
  input: UpdateTicketInput,
  actor: SupportActorContext,
) {
  const ticket = await findTicketOrThrow(ticketId);
  if (ticket.status === "CLOSED") {
    throw new PreconditionFailedError(
      "Closed support tickets cannot be updated.",
    );
  }

  const data: Prisma.SupportTicketUncheckedUpdateInput = {};
  if (input.subject !== undefined) data.subject = input.subject;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.category !== undefined) data.category = input.category;
  if (input.tags !== undefined) data.tags = input.tags as Prisma.InputJsonValue;
  if (input.queueId !== undefined) {
    if (input.queueId !== null) {
      await assertQueueExists(input.queueId);
    }
    data.queueId = input.queueId;
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data,
    include: TICKET_DETAIL_INCLUDE,
  });

  await recordAudit({
    action: "support.ticket.updated",
    resourceType: "support-ticket",
    resourceId: ticketId,
    tenantId: ticket.tenantId,
    before: ticket,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function assignTicket(
  ticketId: string,
  input: AssignTicketInput,
  actor: SupportActorContext,
) {
  const actorId = requireActorId(actor);
  const ticket = await findTicketOrThrow(ticketId);

  const assignee = await prisma.user.findFirst({
    where: {
      id: input.assigneeId,
      userType: "PLATFORM_STAFF",
      deletedAt: null,
    },
    select: SAFE_USER_SELECT,
  });
  if (!assignee) throw new NotFoundError("Assignee");

  const updateData: Prisma.SupportTicketUncheckedUpdateInput = {
    assigneeId: assignee.id,
  };
  if (ticket.status === "OPEN") {
    updateData.status = "IN_PROGRESS";
  }

  const [, assignment] = await prisma.$transaction([
    prisma.supportTicket.update({ where: { id: ticketId }, data: updateData }),
    prisma.supportAssignment.create({
      data: {
        ticketId,
        assignedToId: assignee.id,
        assignedById: actorId,
        note: input.note ?? null,
      },
    }),
  ]);

  await recordAudit({
    action: "support.ticket.assigned",
    resourceType: "support-ticket",
    resourceId: ticketId,
    tenantId: ticket.tenantId,
    before: { assigneeId: ticket.assigneeId, status: ticket.status },
    after: {
      assigneeId: assignee.id,
      status: updateData.status ?? ticket.status,
    },
    metadata: { assignmentId: assignment.id, assigneeEmail: assignee.email },
    actorId,
    req: actor.req,
  });

  return getTicket(ticketId);
}

export async function replyToTicket(
  ticketId: string,
  input: ReplyTicketInput,
  actor: SupportActorContext,
) {
  const actorId = requireActorId(actor);
  const ticket = await findTicketOrThrow(ticketId);
  if (ticket.status === "CLOSED") {
    throw new PreconditionFailedError(
      "Closed support tickets cannot receive replies.",
    );
  }

  const reply = await prisma.supportReply.create({
    data: {
      ticketId,
      authorId: actorId,
      body: input.body,
      isInternal: input.isInternal,
    },
    include: { author: { select: SAFE_USER_SELECT } },
  });

  if (ticket.status === "OPEN" || ticket.status === "PENDING") {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "IN_PROGRESS" },
    });
  }

  await recordAudit({
    action: "support.ticket.replied",
    resourceType: "support-ticket",
    resourceId: ticketId,
    tenantId: ticket.tenantId,
    metadata: { replyId: reply.id, isInternal: reply.isInternal },
    actorId,
    req: actor.req,
  });

  return reply;
}

export async function resolveTicket(
  ticketId: string,
  input: ResolveTicketInput,
  actor: SupportActorContext,
) {
  const actorId = requireActorId(actor);
  const ticket = await findTicketOrThrow(ticketId);
  if (!RESOLVABLE_STATUSES.includes(ticket.status)) {
    throw new PreconditionFailedError(
      `Support tickets in status ${ticket.status} cannot be resolved.`,
    );
  }

  const resolvedAt = new Date();
  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "RESOLVED", resolvedAt },
    include: TICKET_DETAIL_INCLUDE,
  });

  let resolutionReplyId: string | null = null;
  if (input.resolutionNote) {
    const reply = await prisma.supportReply.create({
      data: {
        ticketId,
        authorId: actorId,
        body: input.resolutionNote,
        isInternal: true,
      },
    });
    resolutionReplyId = reply.id;
  }

  await recordAudit({
    action: "support.ticket.resolved",
    resourceType: "support-ticket",
    resourceId: ticketId,
    tenantId: ticket.tenantId,
    before: { status: ticket.status, resolvedAt: ticket.resolvedAt },
    after: { status: "RESOLVED", resolvedAt },
    metadata: resolutionReplyId ? { resolutionReplyId } : undefined,
    actorId,
    req: actor.req,
  });
  void publishEvent({
    eventKey: "support.ticket.resolved",
    tenantId: ticket.tenantId,
    payload: { ticketId, ticketNumber: ticket.ticketNumber, resolutionReplyId },
  });

  return updated;
}

export async function reopenTicket(
  ticketId: string,
  actor: SupportActorContext,
) {
  const ticket = await findTicketOrThrow(ticketId);
  if (!REOPENABLE_STATUSES.includes(ticket.status)) {
    throw new PreconditionFailedError(
      `Support tickets in status ${ticket.status} cannot be reopened.`,
    );
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "REOPENED", resolvedAt: null, closedAt: null },
    include: TICKET_DETAIL_INCLUDE,
  });

  await recordAudit({
    action: "support.ticket.reopened",
    resourceType: "support-ticket",
    resourceId: ticketId,
    tenantId: ticket.tenantId,
    before: { status: ticket.status },
    after: { status: "REOPENED" },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function getTicketHistory(ticketId: string, req: Request) {
  await findTicketOrThrow(ticketId);

  const query = parseListQuery(req, { maxLimit: HISTORY_MAX_LIMIT });
  const auditWhere: Prisma.AuditEventWhereInput = {
    resourceType: "support-ticket",
    resourceId: ticketId,
  };

  const [auditRows, total, replies] = await Promise.all([
    prisma.auditEvent.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      ...paginationArgs(query),
    }),
    prisma.auditEvent.count({ where: auditWhere }),
    prisma.supportReply.findMany({
      where: { ticketId },
      include: { author: { select: SAFE_USER_SELECT } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    audit: {
      rows: auditRows,
      meta: buildPaginationMeta(query.page, query.limit, total),
    },
    replies,
  };
}

export async function listQueues(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.SupportQueueWhereInput = {
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const orderBy = buildOrderBy(query, QUEUE_SORT_FIELDS, {
    createdAt: "desc" as const,
  });

  const [rows, total] = await Promise.all([
    prisma.supportQueue.findMany({
      where,
      orderBy,
      include: QUEUE_LIST_INCLUDE,
      ...paginationArgs(query),
    }),
    prisma.supportQueue.count({ where }),
  ]);

  const queueIds = rows.map((queue) => queue.id);
  const openCounts = queueIds.length
    ? await prisma.supportTicket.groupBy({
        by: ["queueId"],
        where: {
          queueId: { in: queueIds },
          status: { in: [...OPEN_TICKET_STATUSES] },
        },
        _count: { _all: true },
      })
    : [];
  const openByQueue = new Map<string | null, number>(
    openCounts.map((group) => [group.queueId, group._count._all] as const),
  );

  const data = rows.map((queue) => {
    const { _count, ...rest } = queue;
    return {
      ...rest,
      ticketCounts: {
        open: openByQueue.get(queue.id) ?? 0,
        total: _count.tickets,
      },
    };
  });

  return {
    rows: data,
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function createQueue(
  input: CreateQueueInput,
  actor: SupportActorContext,
) {
  const existing = await prisma.supportQueue.findFirst({
    where: { name: input.name },
    select: { id: true },
  });
  if (existing)
    throw new ConflictError(
      `A support queue named "${input.name}" already exists.`,
    );

  const queue = input.isDefault
    ? (
        await prisma.$transaction([
          prisma.supportQueue.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
          }),
          prisma.supportQueue.create({
            data: {
              name: input.name,
              description: input.description ?? null,
              email: input.email ?? null,
              isDefault: true,
            },
            include: QUEUE_LIST_INCLUDE,
          }),
        ])
      )[1]
    : await prisma.supportQueue.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          email: input.email ?? null,
          isDefault: false,
        },
        include: QUEUE_LIST_INCLUDE,
      });

  await recordAudit({
    action: "support.queue.created",
    resourceType: "support-queue",
    resourceId: queue.id,
    after: queue,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return queue;
}

export async function updateQueue(
  queueId: string,
  input: UpdateQueueInput,
  actor: SupportActorContext,
) {
  const queue = await prisma.supportQueue.findUnique({
    where: { id: queueId },
  });
  if (!queue) throw new NotFoundError("Support queue");

  if (input.name !== undefined && input.name !== queue.name) {
    const existing = await prisma.supportQueue.findFirst({
      where: { name: input.name },
      select: { id: true },
    });
    if (existing && existing.id !== queueId) {
      throw new ConflictError(
        `A support queue named "${input.name}" already exists.`,
      );
    }
  }

  const data: Prisma.SupportQueueUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.email !== undefined) data.email = input.email;
  if (input.isDefault !== undefined) data.isDefault = input.isDefault;

  let updated: Prisma.SupportQueueGetPayload<{
    include: typeof QUEUE_LIST_INCLUDE;
  }>;
  if (input.isDefault === true) {
    const results = await prisma.$transaction([
      prisma.supportQueue.updateMany({
        where: { isDefault: true, NOT: { id: queueId } },
        data: { isDefault: false },
      }),
      prisma.supportQueue.update({
        where: { id: queueId },
        data,
        include: QUEUE_LIST_INCLUDE,
      }),
    ]);
    updated = results[1];
  } else {
    updated = await prisma.supportQueue.update({
      where: { id: queueId },
      data,
      include: QUEUE_LIST_INCLUDE,
    });
  }

  await recordAudit({
    action: "support.queue.updated",
    resourceType: "support-queue",
    resourceId: queueId,
    before: queue,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}
