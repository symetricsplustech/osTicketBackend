import { prisma } from "../../config/database";
import { createItsmCrudService } from "./crud";
import { withGeneratedNumber } from "./shared";
import type { TenantActorContext } from "../tenantadmin/roles.service";

const base = createItsmCrudService({
  resourceType: "release",
  label: "Release",
  model: prisma.release,
  searchFields: ["name", "version", "number", "description"],
  allowedSortFields: [
    "name",
    "version",
    "status",
    "type",
    "plannedStartAt",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["status", "type", "ownerId", "teamId"],
  mapInput: withGeneratedNumber({
    moduleKey: "releases",
    prefix: "REL",
    count: (tenantId) => prisma.release.count({ where: { tenantId } }),
    exists: async (tenantId, number) =>
      Boolean(
        await prisma.release.findFirst({
          where: { tenantId, number },
          select: { id: true },
        }),
      ),
  }),
});

export const releaseService = {
  ...base,
  async transition(
    tenantId: string,
    id: string,
    actor: TenantActorContext,
    action: string,
    status: string,
    extra: Record<string, unknown> = {},
  ) {
    const patch: Record<string, unknown> = { ...extra };
    if (status === "IN_PROGRESS" && patch.actualStartAt === undefined)
      patch.actualStartAt = new Date();
    if (status === "DEPLOYED" && patch.actualEndAt === undefined)
      patch.actualEndAt = new Date();
    return base.transition(tenantId, id, actor, action, status, patch);
  },
};
