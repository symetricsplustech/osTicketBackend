import { prisma } from "../../config/database";
import { createItsmCrudService } from "./crud";
import { withGeneratedNumber } from "./shared";
import type { TenantActorContext } from "../tenantadmin/roles.service";

const base = createItsmCrudService({
  resourceType: "known_error",
  label: "Known error",
  model: prisma.knownError,
  searchFields: ["title", "number", "description", "workaround", "rootCause"],
  allowedSortFields: [
    "title",
    "status",
    "number",
    "resolvedAt",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["status", "problemId", "ownerId"],
  mapInput: withGeneratedNumber({
    moduleKey: "known_errors",
    prefix: "KER",
    count: (tenantId) => prisma.knownError.count({ where: { tenantId } }),
    exists: async (tenantId, number) =>
      Boolean(
        await prisma.knownError.findFirst({
          where: { tenantId, number },
          select: { id: true },
        }),
      ),
  }),
});

export const knownErrorService = {
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
    if (status === "OPEN") patch.resolvedAt = null;
    return base.transition(tenantId, id, actor, action, status, patch);
  },
};
