import { prisma } from "../../config/database";
import { NotFoundError } from "../../shared/errors";
import { createItsmCrudService, assertUnique } from "./crud";

const queueBase = createItsmCrudService({
  resourceType: "service_desk_queue",
  label: "Service desk queue",
  model: prisma.tenantServiceDeskQueue,
  searchFields: ["name", "email", "description"],
  allowedSortFields: ["name", "status", "isDefault", "createdAt", "updatedAt"],
  filterFields: ["status", "isDefault"],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === "string" && input.name) {
      await assertUnique(
        prisma.tenantServiceDeskQueue,
        tenantId,
        "name",
        input.name,
        "queue",
        existing?.id,
      );
    }
  },
});

const operatingHoursBase = createItsmCrudService({
  resourceType: "operating_hours",
  label: "Operating hours",
  model: prisma.tenantOperatingHours,
  statusField: null,
  setCreatedBy: false,
  searchFields: ["name", "timezone"],
  allowedSortFields: [
    "name",
    "timezone",
    "isDefault",
    "createdAt",
    "updatedAt",
  ],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === "string" && input.name) {
      await assertUnique(
        prisma.tenantOperatingHours,
        tenantId,
        "name",
        input.name,
        "operating hours",
        existing?.id,
      );
    }
  },
});

const routingRuleBase = createItsmCrudService({
  resourceType: "routing_rule",
  label: "Routing rule",
  model: prisma.tenantRoutingRule,
  statusField: null,
  searchFields: ["name"],
  allowedSortFields: [
    "name",
    "priority",
    "isEnabled",
    "sortOrder",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["queueId", "isEnabled"],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === "string" && input.name) {
      await assertUnique(
        prisma.tenantRoutingRule,
        tenantId,
        "name",
        input.name,
        "routing rule",
        existing?.id,
      );
    }
  },
});

export const serviceDeskQueueService = {
  ...queueBase,
  async setDefault(tenantId: string, id: string) {
    const queue = await prisma.tenantServiceDeskQueue.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!queue) throw new NotFoundError("Service desk queue");
    await prisma.$transaction([
      prisma.tenantServiceDeskQueue.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.tenantServiceDeskQueue.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);
    return prisma.tenantServiceDeskQueue.findUniqueOrThrow({ where: { id } });
  },
};

export const operatingHoursService = {
  ...operatingHoursBase,
  async setDefault(tenantId: string, id: string) {
    const record = await prisma.tenantOperatingHours.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!record) throw new NotFoundError("Operating hours");
    await prisma.$transaction([
      prisma.tenantOperatingHours.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.tenantOperatingHours.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);
    return prisma.tenantOperatingHours.findUniqueOrThrow({ where: { id } });
  },
};

export const routingRuleService = routingRuleBase;
