import { prisma } from "../../config/database";
import { ConflictError, ValidationError } from "../../shared/errors";
import { createItsmCrudService, assertUnique } from "./crud";

async function assertCiInTenant(
  tenantId: string,
  ciId: string | null | undefined,
  label: string,
) {
  if (!ciId) return;
  const ci = await prisma.configurationItem.findFirst({
    where: { id: ciId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!ci)
    throw new ValidationError(`The selected ${label} could not be found.`);
}

export const configurationItemService = createItsmCrudService({
  resourceType: "configuration_item",
  label: "Configuration item",
  model: prisma.configurationItem,
  searchFields: ["name", "hostname", "ipAddress", "serialNumber", "assetTag"],
  allowedSortFields: [
    "name",
    "ciTypeKey",
    "status",
    "criticality",
    "createdAt",
    "updatedAt",
  ],
  filterFields: [
    "ciTypeKey",
    "criticality",
    "environment",
    "ownerId",
    "supportTeamId",
  ],
  validate: async (tenantId, input, existing) => {
    if (typeof input.name === "string" && input.name) {
      await assertUnique(
        prisma.configurationItem,
        tenantId,
        "name",
        input.name,
        "configuration item",
        existing?.id,
      );
    }
  },
});

export const ciRelationshipService = createItsmCrudService({
  resourceType: "ci_relationship",
  label: "CI relationship",
  model: prisma.ciRelationship,
  searchFields: ["typeKey", "description"],
  allowedSortFields: ["typeKey", "createdAt", "updatedAt"],
  filterFields: ["sourceCiId", "targetCiId", "typeKey"],
  validate: async (tenantId, input, existing) => {
    if (
      input.sourceCiId &&
      input.targetCiId &&
      input.sourceCiId === input.targetCiId
    ) {
      throw new ValidationError(
        "A configuration item cannot be related to itself.",
      );
    }
    await assertCiInTenant(
      tenantId,
      input.sourceCiId as string | undefined,
      "source configuration item",
    );
    await assertCiInTenant(
      tenantId,
      input.targetCiId as string | undefined,
      "target configuration item",
    );
    const sourceCiId =
      (input.sourceCiId as string | undefined) ?? existing?.sourceCiId;
    const targetCiId =
      (input.targetCiId as string | undefined) ?? existing?.targetCiId;
    const typeKey =
      (input.typeKey as string | undefined) ??
      existing?.typeKey ??
      "depends_on";
    if (sourceCiId && targetCiId) {
      const duplicate = await prisma.ciRelationship.findFirst({
        where: {
          tenantId,
          sourceCiId,
          targetCiId,
          typeKey,
          deletedAt: null,
          ...(existing?.id ? { id: { not: existing.id } } : {}),
        },
        select: { id: true },
      });
      if (duplicate)
        throw new ConflictError(
          "This relationship already exists between the selected configuration items.",
        );
    }
  },
});
