import { prisma } from "../../config/database";
import { createItsmCrudService, assertUnique } from "./crud";

export const incidentCategoryService = createItsmCrudService({
  resourceType: "incident_category",
  label: "Incident category",
  model: prisma.tenantIncidentCategory,
  statusField: null,
  searchFields: ["name", "code", "description"],
  allowedSortFields: ["name", "code", "sortOrder", "createdAt", "updatedAt"],
  defaultOrderBy: { sortOrder: "asc" },
  validate: async (tenantId, input, existing) => {
    if (typeof input.code === "string" && input.code) {
      await assertUnique(
        prisma.tenantIncidentCategory,
        tenantId,
        "code",
        input.code,
        "incident category",
        existing?.id,
      );
    }
  },
});

export const incidentPriorityService = createItsmCrudService({
  resourceType: "incident_priority",
  label: "Incident priority",
  model: prisma.tenantIncidentPriority,
  statusField: null,
  searchFields: ["name", "key", "description"],
  allowedSortFields: ["name", "key", "level", "createdAt", "updatedAt"],
  defaultOrderBy: { level: "asc" },
  validate: async (tenantId, input, existing) => {
    if (typeof input.key === "string" && input.key) {
      await assertUnique(
        prisma.tenantIncidentPriority,
        tenantId,
        "key",
        input.key,
        "incident priority",
        existing?.id,
      );
    }
  },
});

export const resolutionCodeService = createItsmCrudService({
  resourceType: "resolution_code",
  label: "Resolution code",
  model: prisma.tenantResolutionCode,
  statusField: null,
  searchFields: ["code", "label", "description"],
  allowedSortFields: ["code", "label", "createdAt", "updatedAt"],
  validate: async (tenantId, input, existing) => {
    if (typeof input.code === "string" && input.code) {
      await assertUnique(
        prisma.tenantResolutionCode,
        tenantId,
        "code",
        input.code,
        "resolution code",
        existing?.id,
      );
    }
  },
});
