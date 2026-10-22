import { prisma } from "../../config/database";
import { createItsmCrudService } from "./crud";
import { withGeneratedNumber } from "./shared";
import type { TenantActorContext } from "../tenantadmin/roles.service";

const base = createItsmCrudService({
  resourceType: "major_incident",
  label: "Major incident",
  model: prisma.majorIncident,
  searchFields: ["title", "number", "description", "impactSummary"],
  allowedSortFields: [
    "title",
    "status",
    "severity",
    "number",
    "startedAt",
    "resolvedAt",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["status", "severity", "incidentId", "commanderId"],
  mapInput: withGeneratedNumber({
    moduleKey: "major_incidents",
    prefix: "MIM",
    count: (tenantId) => prisma.majorIncident.count({ where: { tenantId } }),
    exists: async (tenantId, number) =>
      Boolean(
        await prisma.majorIncident.findFirst({
          where: { tenantId, number },
          select: { id: true },
        }),
      ),
  }),
});

export const majorIncidentService = {
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
    if (status === "RESOLVED" && patch.resolvedAt === undefined)
      patch.resolvedAt = new Date();
    if (status === "CLOSED" && patch.resolvedAt === undefined)
      patch.resolvedAt = new Date();
    return base.transition(tenantId, id, actor, action, status, patch);
  },
};
