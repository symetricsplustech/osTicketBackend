import { prisma } from "../../config/database";
import { NotFoundError, PreconditionFailedError } from "../../shared/errors";
import { recordAudit } from "../../shared/audit";
import {
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { createItsmCrudService, assertUnique } from "./crud";
import type { TenantActorContext } from "../tenantadmin/roles.service";

const workflowBase = createItsmCrudService({
  resourceType: "workflow",
  label: "Workflow",
  model: prisma.tenantWorkflow,
  searchFields: ["name", "description", "moduleKey"],
  allowedSortFields: [
    "name",
    "status",
    "moduleKey",
    "currentVersion",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["status", "moduleKey"],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === "string" && input.name) {
      await assertUnique(
        prisma.tenantWorkflow,
        tenantId,
        "name",
        input.name,
        "workflow",
        existing?.id,
      );
    }
  },
});

export const workflowService = {
  ...workflowBase,

  async publish(
    tenantId: string,
    id: string,
    actor: TenantActorContext,
    changelog?: string,
  ) {
    const workflow = await prisma.tenantWorkflow.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!workflow) throw new NotFoundError("Workflow");
    const version = workflow.currentVersion + 1;
    const [updated] = await prisma.$transaction([
      prisma.tenantWorkflow.update({
        where: { id },
        data: { currentVersion: version, status: "ACTIVE" },
      }),
      prisma.tenantWorkflowVersion.create({
        data: {
          tenantId,
          workflowId: id,
          version,
          definition: workflow.definition ?? {},
          changelog: changelog ?? null,
          publishedById: actor.actorId ?? null,
          publishedAt: new Date(),
        },
      }),
    ]);
    await recordAudit({
      action: "workflow.published",
      resourceType: "workflow",
      resourceId: id,
      tenantId,
      after: { currentVersion: version, status: "ACTIVE" },
      actorId: actor.actorId ?? null,
      actorEmail: actor.actorEmail ?? null,
      actorType: actor.actorType ?? "TENANT_USER",
      req: actor.req,
    });
    return updated;
  },

  async listVersions(
    tenantId: string,
    workflowId: string,
    req: import("express").Request,
  ) {
    const workflow = await prisma.tenantWorkflow.findFirst({
      where: { id: workflowId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!workflow) throw new NotFoundError("Workflow");
    const query = parseListQuery(req, { maxLimit: 100 });
    const where = { workflowId, tenantId };
    const [rows, total] = await Promise.all([
      prisma.tenantWorkflowVersion.findMany({
        where,
        orderBy: { version: "desc" },
        ...paginationArgs(query),
      }),
      prisma.tenantWorkflowVersion.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },
};

const runBase = createItsmCrudService({
  resourceType: "workflow_run",
  label: "Workflow run",
  model: prisma.tenantWorkflowRun,
  setCreatedBy: false,
  softDelete: false,
  searchFields: ["resourceType", "error"],
  allowedSortFields: [
    "status",
    "resourceType",
    "startedAt",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["status", "workflowId", "resourceType", "resourceId"],
  include: { workflow: { select: { id: true, name: true } } },
});

export const workflowRunService = {
  ...runBase,
  async transition(
    tenantId: string,
    id: string,
    actor: TenantActorContext,
    action: string,
    status: string,
    extra: Record<string, unknown> = {},
  ) {
    const patch: Record<string, unknown> = { ...extra };
    if (
      status === "COMPLETED" ||
      status === "FAILED" ||
      status === "CANCELLED"
    ) {
      if (patch.completedAt === undefined) patch.completedAt = new Date();
    }
    return runBase.transition(tenantId, id, actor, action, status, patch);
  },

  async start(
    tenantId: string,
    input: Record<string, unknown>,
    actor: TenantActorContext,
  ) {
    const workflowId = (input.workflowId as string | undefined) ?? null;
    if (workflowId) {
      const workflow = await prisma.tenantWorkflow.findFirst({
        where: { id: workflowId, tenantId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!workflow) throw new NotFoundError("Workflow");
      if (workflow.status !== "ACTIVE")
        throw new PreconditionFailedError("Only active workflows can be run.");
    }
    return runBase.create(tenantId, { ...input, status: "RUNNING" }, actor);
  },
};
