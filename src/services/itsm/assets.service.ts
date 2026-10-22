import type { Request } from "express";
import { prisma } from "../../config/database";
import { NotFoundError } from "../../shared/errors";
import {
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { createItsmCrudService, assertUnique } from "./crud";
import type { TenantActorContext } from "../tenantadmin/roles.service";

const base = createItsmCrudService({
  resourceType: "asset",
  label: "Asset",
  model: prisma.asset,
  searchFields: ["assetTag", "name", "serialNumber", "model", "manufacturer"],
  allowedSortFields: [
    "assetTag",
    "name",
    "status",
    "categoryKey",
    "purchaseDate",
    "warrantyExpiry",
    "createdAt",
    "updatedAt",
  ],
  filterFields: [
    "categoryKey",
    "status",
    "assignedToId",
    "locationId",
    "vendorId",
    "ciId",
  ],
  validate: async (tenantId, input, existing) => {
    if (typeof input.assetTag === "string" && input.assetTag) {
      await assertUnique(
        prisma.asset,
        tenantId,
        "assetTag",
        input.assetTag,
        "asset tag",
        existing?.id,
      );
    }
  },
});

export const assetService = {
  ...base,
  async assign(
    tenantId: string,
    id: string,
    input: { userId?: string | null; locationId?: string | null },
    actor: TenantActorContext,
  ) {
    const current = await base.get(tenantId, id);
    void current;
    return base.transition(tenantId, id, actor, "assigned", "ASSIGNED", {
      assignedToId: input.userId ?? null,
      ...(input.locationId !== undefined
        ? { locationId: input.locationId }
        : {}),
    });
  },
  async returnAsset(tenantId: string, id: string, actor: TenantActorContext) {
    return base.transition(tenantId, id, actor, "returned", "IN_STOCK", {
      assignedToId: null,
    });
  },
  async retire(tenantId: string, id: string, actor: TenantActorContext) {
    return base.transition(tenantId, id, actor, "retired", "RETIRED", {
      assignedToId: null,
    });
  },

  async listMaintenance(tenantId: string, assetId: string, req: Request) {
    await base.get(tenantId, assetId);
    const query = parseListQuery(req, { maxLimit: 100 });
    const where = { assetId, tenantId, deletedAt: null };
    const [rows, total] = await Promise.all([
      prisma.assetMaintenance.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paginationArgs(query),
      }),
      prisma.assetMaintenance.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
  },
};

export const assetMaintenanceService = createItsmCrudService({
  resourceType: "asset_maintenance",
  label: "Asset maintenance record",
  model: prisma.assetMaintenance,
  searchFields: ["summary", "description"],
  allowedSortFields: [
    "summary",
    "status",
    "scheduledAt",
    "completedAt",
    "createdAt",
    "updatedAt",
  ],
  filterFields: ["assetId", "status", "kind"],
  validate: async (tenantId, input, existing) => {
    const assetId = (input.assetId as string | undefined) ?? existing?.assetId;
    const asset = await prisma.asset.findFirst({
      where: { id: assetId as string, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!asset) throw new NotFoundError("Asset");
  },
});

export async function completeMaintenance(
  tenantId: string,
  id: string,
  actor: TenantActorContext,
) {
  const record = await prisma.assetMaintenance.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!record) throw new NotFoundError("Asset maintenance record");
  return assetMaintenanceService.transition(
    tenantId,
    id,
    actor,
    "completed",
    "COMPLETED",
    { completedAt: new Date() },
  );
}
