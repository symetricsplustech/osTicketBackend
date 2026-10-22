import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../config/database";
import { NotFoundError } from "../../shared/errors";
import {
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { createReportJob } from "./reports.service";
import type { AuditExportInput } from "../../validators/saasadmin/audit.validators";

const PRIVILEGED_ACTION_PREFIXES = [
  "tenant.",
  "staff.",
  "role.",
  "apikey.",
  "platform-setting.",
  "auth.mfa.",
  "approval.",
  "integration.",
  "webhook.",
  "support.",
  "system-administration.",
];

interface EventFilters {
  action?: string;
  resourceType?: string;
  resourceId?: string;
  tenantId?: string;
  actorId?: string;
  outcome?: string;
  from?: string;
  to?: string;
  search?: string;
}

function buildEventWhere(filters: EventFilters): Prisma.AuditEventWhereInput {
  return {
    ...(filters.action
      ? { action: { contains: filters.action, mode: "insensitive" } }
      : {}),
    ...(filters.resourceType ? { resourceType: filters.resourceType } : {}),
    ...(filters.resourceId ? { resourceId: filters.resourceId } : {}),
    ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.outcome ? { outcome: filters.outcome as never } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { action: { contains: filters.search, mode: "insensitive" } },
            { resourceType: { contains: filters.search, mode: "insensitive" } },
            { resourceId: { contains: filters.search, mode: "insensitive" } },
            { actorEmail: { contains: filters.search, mode: "insensitive" } },
            { requestId: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function searchEvents(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where = buildEventWhere(query as EventFilters);
  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        tenant: { select: { id: true, name: true, slug: true } },
      },
      ...paginationArgs(query),
    }),
    prisma.auditEvent.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getEvent(eventId: string) {
  const event = await prisma.auditEvent.findUnique({
    where: { id: eventId },
    include: {
      actor: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
      tenant: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!event) throw new NotFoundError("Audit event");
  return event;
}

export async function listActors(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const grouped = await prisma.auditEvent.groupBy({
    by: ["actorId"],
    where: { actorId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { actorId: "desc" } },
    take: 100,
  });

  const actorIds = grouped.map((row) => row.actorId!).filter(Boolean);
  const users = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      userType: true,
    },
  });
  const userIndex = new Map(users.map((user) => [user.id, user]));

  const rows = grouped
    .map((row) => {
      const user = userIndex.get(row.actorId!);
      return {
        actorId: row.actorId,
        email: user?.email ?? null,
        name: user ? `${user.firstName} ${user.lastName}` : null,
        userType: user?.userType ?? null,
        eventCount: row._count._all,
      };
    })
    .filter(
      (row) =>
        !query.search ||
        row.email?.toLowerCase().includes(query.search.toLowerCase()) ||
        row.actorId?.includes(query.search),
    );

  const total = rows.length;
  return {
    rows: rows.slice((query.page - 1) * query.limit, query.page * query.limit),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function resourceHistory(
  resourceType: string,
  resourceId: string,
  req: Request,
) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where = { resourceType, resourceId };
  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      ...paginationArgs(query),
    }),
    prisma.auditEvent.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function securityEvents(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.SecurityEventWhereInput = {
    ...(query.severity ? { severity: query.severity as never } : {}),
    ...(query.eventType
      ? {
          eventType: { contains: String(query.eventType), mode: "insensitive" },
        }
      : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(String(query.from)) } : {}),
            ...(query.to ? { lte: new Date(String(query.to)) } : {}),
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      ...paginationArgs(query),
    }),
    prisma.securityEvent.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function loginEvents(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.LoginEventWhereInput = {
    ...(query.outcome ? { outcome: query.outcome as never } : {}),
    ...(query.search
      ? { email: { contains: query.search, mode: "insensitive" } }
      : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(String(query.from)) } : {}),
            ...(query.to ? { lte: new Date(String(query.to)) } : {}),
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.loginEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginationArgs(query),
    }),
    prisma.loginEvent.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function privilegedActions(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.AuditEventWhereInput = {
    OR: PRIVILEGED_ACTION_PREFIXES.map((prefix) => ({
      action: { startsWith: prefix },
    })),
    ...(query.search
      ? { actorEmail: { contains: query.search, mode: "insensitive" } }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      ...paginationArgs(query),
    }),
    prisma.auditEvent.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function requestAuditExport(
  input: AuditExportInput,
  requestedById: string,
) {
  return createReportJob({
    reportKey: "audit-events",
    kind: "EXPORT",
    format: input.format,
    filters: (input.filters ?? {}) as Record<string, unknown>,
    requestedById,
  });
}
