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

export const TENANT_REPORTS = [
  {
    key: "incidents",
    name: "Incident Report",
    description: "Incident volumes, status and priority breakdown.",
  },
  {
    key: "problems",
    name: "Problem Report",
    description: "Problem backlog and resolution throughput.",
  },
  {
    key: "changes",
    name: "Change Report",
    description: "Change success rate, risk and schedule adherence.",
  },
  {
    key: "requests",
    name: "Service Request Report",
    description: "Request fulfilment metrics and catalog usage.",
  },
  {
    key: "sla",
    name: "SLA Compliance Report",
    description: "SLA attainment and breach analysis.",
  },
  {
    key: "assets",
    name: "Asset Inventory Report",
    description: "Asset allocation and lifecycle status.",
  },
  {
    key: "cmdb",
    name: "CMDB Report",
    description: "Configuration item inventory and relationships.",
  },
  {
    key: "agent_performance",
    name: "Agent Performance Report",
    description: "Workload and resolution performance by agent.",
  },
  {
    key: "audit",
    name: "Audit Report",
    description: "Tenant audit trail of configuration and record changes.",
  },
];

export const reportsService = {
  catalog() {
    return TENANT_REPORTS;
  },

  async listRuns(tenantId: string, req: Request) {
    const query = parseListQuery(req, { maxLimit: 100 });
    const where = { tenantScope: tenantId, kind: "REPORT" as const };
    const [rows, total] = await Promise.all([
      prisma.reportJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paginationArgs(query),
      }),
      prisma.reportJob.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },

  async run(
    tenantId: string,
    input: {
      reportKey: string;
      format?: string;
      filters?: Record<string, unknown>;
    },
    actor: TenantActorContext,
  ) {
    if (!TENANT_REPORTS.some((r) => r.key === input.reportKey))
      throw new BadRequestError(`Unknown report: ${input.reportKey}`);
    const job = await prisma.reportJob.create({
      data: {
        kind: "REPORT",
        reportKey: input.reportKey,
        format: input.format ?? "JSON",
        filters: (input.filters ?? {}) as Prisma.InputJsonValue,
        status: "QUEUED",
        requestedById: actor.actorId ?? null,
        tenantScope: tenantId,
      },
    });
    await recordAudit({
      action: "reports.run.requested",
      resourceType: "report_job",
      resourceId: job.id,
      tenantId,
      after: { reportKey: job.reportKey },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return job;
  },

  async getRun(
    tenantId: string,
    id: string,
    kind: "REPORT" | "EXPORT" = "REPORT",
  ) {
    const job = await prisma.reportJob.findFirst({
      where: { id, tenantScope: tenantId, kind },
    });
    if (!job) throw new NotFoundError("Report run");
    return job;
  },

  async cancelRun(
    tenantId: string,
    id: string,
    actor: TenantActorContext,
    kind: "REPORT" | "EXPORT" = "REPORT",
  ) {
    const job = await prisma.reportJob.findFirst({
      where: { id, tenantScope: tenantId, kind },
    });
    if (!job) throw new NotFoundError("Report run");
    if (job.status === "COMPLETED" || job.status === "FAILED")
      throw new BadRequestError(
        "Completed or failed jobs cannot be cancelled.",
      );
    const updated = await prisma.reportJob.update({
      where: { id },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    await recordAudit({
      action: "reports.run.cancelled",
      resourceType: "report_job",
      resourceId: id,
      tenantId,
      after: { status: updated.status },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return updated;
  },
};
