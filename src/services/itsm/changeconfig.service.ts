import { prisma } from "../../config/database";
import { createItsmCrudService, assertUnique } from "./crud";

export const changeTypeService = createItsmCrudService({
  resourceType: "change_type",
  label: "Change type",
  model: prisma.tenantChangeType,
  statusField: null,
  searchFields: ["name", "code", "description"],
  allowedSortFields: ["name", "code", "riskLevel", "createdAt", "updatedAt"],
  validate: async (tenantId, input, existing) => {
    if (typeof input.code === "string" && input.code) {
      await assertUnique(
        prisma.tenantChangeType,
        tenantId,
        "code",
        input.code,
        "change type",
        existing?.id,
      );
    }
  },
});

export const changeTemplateService = createItsmCrudService({
  resourceType: "change_template",
  label: "Change template",
  model: prisma.tenantChangeTemplate,
  statusField: null,
  searchFields: ["name", "description"],
  allowedSortFields: ["name", "createdAt", "updatedAt"],
  filterFields: ["changeTypeId"],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === "string" && input.name) {
      await assertUnique(
        prisma.tenantChangeTemplate,
        tenantId,
        "name",
        input.name,
        "change template",
        existing?.id,
      );
    }
  },
});

export const changeWindowService = createItsmCrudService({
  resourceType: "change_window",
  label: "Change window",
  model: prisma.tenantChangeWindow,
  statusField: null,
  searchFields: ["name", "description"],
  allowedSortFields: [
    "name",
    "startAt",
    "endAt",
    "windowType",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["windowType"],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === "string" && input.name) {
      await assertUnique(
        prisma.tenantChangeWindow,
        tenantId,
        "name",
        input.name,
        "change window",
        existing?.id,
      );
    }
  },
});
