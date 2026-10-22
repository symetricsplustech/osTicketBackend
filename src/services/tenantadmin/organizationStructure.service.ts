import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { recordAudit } from "../../shared/audit";
import { publishEvent } from "../../shared/events";
import type { TenantActorContext } from "./roles.service";
import type { UpdateOrganizationStructureInput } from "../../validators/tenantadmin/organizationStructure.validators";

export const ORGANIZATION_STRUCTURE_KEY = "organization.structure";

type StructureValue = Record<string, unknown>;

const DEFAULT_STRUCTURE: StructureValue = {
  reportingMode: "DEPARTMENT",
  rootNodeId: null,
  nodes: [],
};

async function readStructure(tenantId: string): Promise<StructureValue> {
  const setting = await prisma.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId, key: ORGANIZATION_STRUCTURE_KEY } },
  });
  const value = setting?.value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...DEFAULT_STRUCTURE, ...(value as StructureValue) };
  }
  return { ...DEFAULT_STRUCTURE };
}

export async function getOrganizationStructure(tenantId: string) {
  const [structure, departments, teams] = await Promise.all([
    readStructure(tenantId),
    prisma.department.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, code: true, parentId: true },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        departmentId: true,
        leadId: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    ...structure,
    departments,
    teams,
    summary: {
      departmentCount: departments.length,
      teamCount: teams.length,
      nodeCount: Array.isArray(structure.nodes)
        ? (structure.nodes as unknown[]).length
        : 0,
    },
  };
}

export async function updateOrganizationStructure(
  actor: TenantActorContext,
  input: UpdateOrganizationStructureInput,
) {
  const before = await readStructure(actor.tenantId);
  const next: StructureValue = {
    reportingMode:
      input.reportingMode ?? (before.reportingMode as string) ?? "DEPARTMENT",
    rootNodeId:
      input.rootNodeId !== undefined
        ? input.rootNodeId
        : ((before.rootNodeId as string | null) ?? null),
    nodes:
      input.nodes !== undefined
        ? input.nodes
        : ((before.nodes as unknown[]) ?? []),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };

  const setting = await prisma.tenantSetting.upsert({
    where: {
      tenantId_key: {
        tenantId: actor.tenantId,
        key: ORGANIZATION_STRUCTURE_KEY,
      },
    },
    create: {
      tenantId: actor.tenantId,
      key: ORGANIZATION_STRUCTURE_KEY,
      value: next as Prisma.InputJsonValue,
      updatedById: actor.actorId ?? null,
    },
    update: {
      value: next as Prisma.InputJsonValue,
      updatedById: actor.actorId ?? null,
    },
  });

  await recordAudit({
    action: "organization.structure.updated",
    resourceType: "organization-structure",
    resourceId: setting.id,
    tenantId: actor.tenantId,
    before,
    after: next,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "organization.structure.updated",
    tenantId: actor.tenantId,
    payload: { id: setting.id },
  });

  return getOrganizationStructure(actor.tenantId);
}
