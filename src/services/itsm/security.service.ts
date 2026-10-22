import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../config/database";
import { NotFoundError } from "../../shared/errors";
import {
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import { publishEvent } from "../../shared/events";
import type { TenantActorContext } from "../tenantadmin/roles.service";

export const SECURITY_SETTINGS_KEY = "security.settings";

export const DEFAULT_SECURITY_SETTINGS: Record<string, unknown> = {
  enforceMfa: false,
  mfaGracePeriodDays: 7,
  sessionIdleTimeoutMinutes: 60,
  maxConcurrentSessions: 5,
  passwordMinLength: 12,
  passwordRequireComplexity: true,
  passwordExpiryDays: 0,
  allowPersonalAccessTokens: true,
  ipAllowlistEnabled: false,
  ipAllowlist: [] as string[],
  failedLoginLockoutThreshold: 10,
  failedLoginLockoutMinutes: 30,
};

export const securityService = {
  async overview(tenantId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const [bySeverity, recentCount, activeSessions, members, mfaUsers] =
      await Promise.all([
        prisma.securityEvent.groupBy({
          by: ["severity"],
          where: { tenantId, createdAt: { gte: since } },
          _count: { _all: true },
        }),
        prisma.securityEvent.count({
          where: { tenantId, createdAt: { gte: since } },
        }),
        prisma.session.count({
          where: {
            activeTenantId: tenantId,
            revokedAt: null,
            expiresAt: { gt: now },
          },
        }),
        prisma.tenantMembership.count({
          where: { tenantId, status: "ACTIVE" },
        }),
        prisma.tenantMembership.count({
          where: {
            tenantId,
            status: "ACTIVE",
            user: { mfaFactors: { some: { verifiedAt: { not: null } } } },
          },
        }),
      ]);
    return {
      windowDays: 30,
      securityEvents: {
        total: recentCount,
        bySeverity: bySeverity.map((r) => ({
          severity: r.severity,
          count: r._count._all,
        })),
      },
      sessions: { active: activeSessions },
      members: {
        active: members,
        withMfa: mfaUsers,
        mfaAdoption: members ? Math.round((mfaUsers / members) * 100) : 0,
      },
      generatedAt: now.toISOString(),
    };
  },

  async listSessions(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 200 });
    const where = { activeTenantId: tenantId };
    const [rows, total] = await Promise.all([
      prisma.session.findMany({
        where,
        orderBy: { lastUsedAt: "desc" },
        ...paginationArgs(query),
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.session.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async revokeSession(
    tenantId: string,
    sessionId: string,
    actor: TenantActorContext,
  ) {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, activeTenantId: tenantId },
    });
    if (!session) throw new NotFoundError("Session");
    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedReason: "Revoked by tenant administrator",
      },
    });
    await recordAudit({
      action: "security.session.revoked",
      resourceType: "session",
      resourceId: sessionId,
      tenantId,
      after: { userId: session.userId },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return {
      id: updated.id,
      userId: updated.userId,
      revokedAt: updated.revokedAt,
    };
  },
};
