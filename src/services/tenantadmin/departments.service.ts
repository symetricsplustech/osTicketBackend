import { prisma } from "../../config/database";
import { PreconditionFailedError, ValidationError } from "../../shared/errors";
import { createTenantCrudService } from "./structure-crud";

export const departmentService = createTenantCrudService({
  resourceType: "department",
  label: "Department",
  model: prisma.department,
  codeField: "code",
  searchFields: ["name", "code", "description"],
  allowedSortFields: ["name", "code", "status", "createdAt", "updatedAt"],
  include: {
    manager: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        jobTitle: true,
      },
    },
    parent: { select: { id: true, name: true, code: true } },
    _count: { select: { children: true, teams: true } },
  },
  async validate(tenantId, input, existing) {
    const parentId = input.parentId;
    if (typeof parentId === "string" && parentId) {
      if (existing && parentId === existing.id) {
        throw new ValidationError("A department cannot be its own parent.");
      }
      const parent = await prisma.department.findFirst({
        where: { id: parentId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!parent)
        throw new ValidationError(
          "The selected parent department could not be found.",
        );
    }

    const managerId = input.managerId;
    if (typeof managerId === "string" && managerId) {
      const member = await prisma.tenantMembership.findFirst({
        where: { tenantId, userId: managerId },
        select: { id: true },
      });
      if (!member)
        throw new ValidationError(
          "The selected manager is not a member of this organization.",
        );
    }
  },
  async beforeDelete(tenantId, record) {
    const [children, teams] = await Promise.all([
      prisma.department.count({
        where: { tenantId, parentId: record.id, deletedAt: null },
      }),
      prisma.team.count({
        where: { tenantId, departmentId: record.id, deletedAt: null },
      }),
    ]);
    if (children > 0)
      throw new PreconditionFailedError(
        "Reassign or remove sub-departments before deleting this department.",
      );
    if (teams > 0)
      throw new PreconditionFailedError(
        "Reassign teams before deleting this department.",
      );
  },
});
