import { prisma } from "../../config/database";
import { createTenantCrudService } from "./structure-crud";

export const costCenterService = createTenantCrudService({
  resourceType: "cost_center",
  label: "Cost center",
  model: prisma.costCenter,
  codeField: "code",
  searchFields: ["name", "code", "description"],
  allowedSortFields: ["name", "code", "status", "createdAt", "updatedAt"],
});
