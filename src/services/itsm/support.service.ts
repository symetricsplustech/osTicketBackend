import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { BadRequestError, NotFoundError } from "../../shared/errors";
import {
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import type { TenantActorContext } from "../tenantadmin/roles.service";

async function nextTicketNumber() {
  const total = await prisma.supportTicket.count();
  return `ST-${String(total + 1).padStart(6, "0")}`;
}

export const supportService = {
  async list(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 100 });
    const q = req.query as Record<string, unknown>;
    const where: Prisma.SupportTicketWhereInput = {
      tenantId,
      ...(typeof q.status === "string" ? { status: q.status as never } : {}),
      ...(typeof q.priority === "string"
        ? { priority: q.priority as never }
        : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: "insensitive" } },
              { ticketNumber: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paginationArgs(query),
        include: { _count: { select: { replies: true } } },
      }),
      prisma.supportTicket.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async get(tenantId: string, id: string) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, tenantId },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundError("Support ticket");
    return ticket;
  },

  async create(
    tenantId: string,
    input: {
      subject: string;
      description: string;
      priority?: string;
      category?: string;
    },
    actor: TenantActorContext,
  ) {
    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber: await nextTicketNumber(),
        subject: input.subject,
        description: input.description,
        priority: (input.priority as never) ?? "NORMAL",
        category: input.category ?? null,
        requesterName: actor.actorEmail ?? "Tenant Administrator",
        requesterEmail: actor.actorEmail ?? "unknown@tenant.local",
        tenantId,
        createdById: actor.actorId ?? null,
      },
    });
    await recordAudit({
      action: "support.ticket.created",
      resourceType: "support_ticket",
      resourceId: ticket.id,
      tenantId,
      after: { ticketNumber: ticket.ticketNumber, subject: ticket.subject },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return ticket;
  },

  async update(
    tenantId: string,
    id: string,
    input: {
      subject?: string;
      description?: string;
      priority?: string;
      category?: string;
    },
    actor: TenantActorContext,
  ) {
    await this.assertTicket(tenantId, id);
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.priority !== undefined
          ? { priority: input.priority as never }
          : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
      },
    });
    await recordAudit({
      action: "support.ticket.updated",
      resourceType: "support_ticket",
      resourceId: id,
      tenantId,
      after: input,
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return ticket;
  },

  async reply(
    tenantId: string,
    id: string,
    input: { body: string; isInternal?: boolean },
    actor: TenantActorContext,
  ) {
    await this.assertTicket(tenantId, id);
    if (!actor.actorId)
      throw new BadRequestError("An actor is required to reply.");
    const reply = await prisma.supportReply.create({
      data: {
        ticketId: id,
        authorId: actor.actorId,
        body: input.body,
        isInternal: input.isInternal ?? false,
      },
    });
    await recordAudit({
      action: "support.ticket.replied",
      resourceType: "support_ticket",
      resourceId: id,
      tenantId,
      after: { replyId: reply.id },
      actorId: actor.actorId,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return reply;
  },

  async transition(
    tenantId: string,
    id: string,
    status: string,
    actor: TenantActorContext,
  ) {
    await this.assertTicket(tenantId, id);
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        status: status as never,
        ...(status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
        ...(status === "CLOSED" ? { closedAt: new Date() } : {}),
        ...(status === "REOPENED" ? { resolvedAt: null, closedAt: null } : {}),
      },
    });
    await recordAudit({
      action: `support.ticket.${status.toLowerCase()}`,
      resourceType: "support_ticket",
      resourceId: id,
      tenantId,
      after: { status },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return ticket;
  },

  async assertTicket(tenantId: string, id: string) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!ticket) throw new NotFoundError("Support ticket");
  },
};
