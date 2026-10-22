import { prisma } from "../../config/database";

const OPEN_INCIDENT_STATUSES = ["resolved", "closed", "cancelled"];
const OPEN_REQUEST_STATUSES = ["fulfilled", "closed", "cancelled"];

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export const dashboardService = {
  async overview(tenantId: string) {
    const now = new Date();
    const [
      openIncidents,
      openProblems,
      openChanges,
      openRequests,
      activeAssets,
      configurationItems,
      knowledgeArticles,
      majorIncidents,
      pendingApprovals,
      breachedIncidents,
    ] = await Promise.all([
      prisma.incident.count({
        where: {
          tenantId,
          deletedAt: null,
          statusKey: { notIn: OPEN_INCIDENT_STATUSES },
        },
      }),
      prisma.problem.count({
        where: {
          tenantId,
          deletedAt: null,
          statusKey: { notIn: ["resolved", "closed", "cancelled"] },
        },
      }),
      prisma.change.count({
        where: {
          tenantId,
          deletedAt: null,
          statusKey: {
            notIn: ["completed", "closed", "cancelled", "rejected"],
          },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          tenantId,
          deletedAt: null,
          statusKey: { notIn: OPEN_REQUEST_STATUSES },
        },
      }),
      prisma.asset.count({ where: { tenantId, deletedAt: null } }),
      prisma.configurationItem.count({ where: { tenantId, deletedAt: null } }),
      prisma.knowledgeArticle.count({
        where: { tenantId, deletedAt: null, status: "PUBLISHED" },
      }),
      prisma.majorIncident.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { notIn: ["RESOLVED", "CLOSED"] },
        },
      }),
      prisma.tenantApprovalRequest.count({
        where: { tenantId, status: "PENDING" },
      }),
      prisma.incident.count({
        where: {
          tenantId,
          deletedAt: null,
          slaBreached: true,
          statusKey: { notIn: OPEN_INCIDENT_STATUSES },
        },
      }),
    ]);

    return {
      incidents: { open: openIncidents, slaBreached: breachedIncidents },
      problems: { open: openProblems },
      changes: { open: openChanges },
      requests: { open: openRequests },
      assets: { total: activeAssets },
      configurationItems: { total: configurationItems },
      knowledge: { published: knowledgeArticles },
      majorIncidents: { open: majorIncidents },
      approvals: { pending: pendingApprovals },
      generatedAt: now.toISOString(),
    };
  },

  async incidentSummary(tenantId: string) {
    const where = { tenantId, deletedAt: null as null };
    const [byStatus, byPriority, total, breached, reopened] = await Promise.all(
      [
        prisma.incident.groupBy({
          by: ["statusKey"],
          where,
          _count: { _all: true },
        }),
        prisma.incident.groupBy({
          by: ["priorityKey"],
          where,
          _count: { _all: true },
        }),
        prisma.incident.count({ where }),
        prisma.incident.count({ where: { ...where, slaBreached: true } }),
        prisma.incident.count({
          where: { ...where, reopenedCount: { gt: 0 } },
        }),
      ],
    );
    return {
      total,
      breached,
      reopened,
      byStatus: byStatus.map((r) => ({
        key: r.statusKey,
        count: r._count._all,
      })),
      byPriority: byPriority.map((r) => ({
        key: r.priorityKey,
        count: r._count._all,
      })),
    };
  },

  async workload(tenantId: string, limit = 10) {
    const grouped = await prisma.incident.groupBy({
      by: ["assigneeId"],
      where: {
        tenantId,
        deletedAt: null,
        assigneeId: { not: null },
        statusKey: { notIn: OPEN_INCIDENT_STATUSES },
      },
      _count: { _all: true },
      orderBy: { _count: { assigneeId: "desc" } },
      take: limit,
    });
    const ids = grouped
      .map((r) => r.assigneeId)
      .filter((id): id is string => Boolean(id));
    const users = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const map = new Map(users.map((u) => [u.id, u]));
    return grouped.map((r) => ({
      assigneeId: r.assigneeId,
      assignee: r.assigneeId ? (map.get(r.assigneeId) ?? null) : null,
      openIncidents: r._count._all,
    }));
  },

  async trends(tenantId: string, days = 14) {
    const since = startOfDay(
      new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000),
    );
    const [created, resolved] = await Promise.all([
      prisma.incident.findMany({
        where: { tenantId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      prisma.incident.findMany({
        where: { tenantId, resolvedAt: { gte: since } },
        select: { resolvedAt: true },
      }),
    ]);
    const buckets: Record<
      string,
      { date: string; created: number; resolved: number }
    > = {};
    for (let i = 0; i < days; i += 1) {
      const d = startOfDay(new Date(since.getTime() + i * 24 * 60 * 60 * 1000));
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { date: key, created: 0, resolved: 0 };
    }
    for (const row of created) {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (buckets[key]) buckets[key].created += 1;
    }
    for (const row of resolved) {
      if (!row.resolvedAt) continue;
      const key = row.resolvedAt.toISOString().slice(0, 10);
      if (buckets[key]) buckets[key].resolved += 1;
    }
    return Object.values(buckets);
  },

  async activity(tenantId: string, limit = 20) {
    const events = await prisma.auditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        actorEmail: true,
        outcome: true,
        createdAt: true,
      },
    });
    return events;
  },
};
