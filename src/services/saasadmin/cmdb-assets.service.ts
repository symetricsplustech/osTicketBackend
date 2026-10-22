import type { Request } from "express";
import {
  Prisma,
  type AssetCategory,
  type CiRelationshipType,
  type CiType,
  type DiscoveryProfile,
} from "@prisma/client";
import { prisma } from "../../config/database";
import {
  ConflictError,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from "../../shared/errors";
import { createCrudService } from "../../shared/crud";
import { parseListQuery } from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import type { CiFieldInput } from "../../validators/saasadmin/cmdb-assets.validators";
import type {
  CreateAssetCategoryInput,
  CreateCiRelationshipTypeInput,
  CreateCiTypeInput,
  CreateDiscoveryProfileInput,
  UpdateAssetCategoryInput,
  UpdateCiRelationshipTypeInput,
  UpdateCiTypeInput,
  UpdateDiscoveryProfileInput,
} from "../../validators/saasadmin/cmdb-assets.validators";

export interface ActorContext {
  actorId?: string | null;
  req?: Request;
}

const DEFAULT_TENANT_CMDB_SETTINGS = {
  discoveryEnabled: false,
  assetLifecycleEnabled: true,
};

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function jsonValueOrNull(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

function parseBooleanFilter(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalised = String(value).toLowerCase();
  if (["true", "1", "yes"].includes(normalised)) return true;
  if (["false", "0", "no"].includes(normalised)) return false;
  return undefined;
}

function parseCiFields(value: unknown): CiFieldInput[] {
  return Array.isArray(value) ? (value as CiFieldInput[]) : [];
}

export const ciTypeCrud = createCrudService<CiType>({
  model: prisma.ciType as never,
  resourceType: "ci-type",
  searchFields: ["key", "name"],
  allowedSortFields: ["key", "name", "isActive", "createdAt", "updatedAt"],
  defaultOrderBy: { name: "asc" },
});

export const ciRelationshipTypeCrud = createCrudService<CiRelationshipType>({
  model: prisma.ciRelationshipType as never,
  resourceType: "ci-relationship-type",
  searchFields: ["key", "name"],
  filterableFields: ["sourceTypeKey", "targetTypeKey"],
  allowedSortFields: ["key", "name", "isActive", "createdAt", "updatedAt"],
  defaultOrderBy: { name: "asc" },
});

export const assetCategoryCrud = createCrudService<AssetCategory>({
  model: prisma.assetCategory as never,
  resourceType: "asset-category",
  searchFields: ["key", "name"],
  allowedSortFields: ["key", "name", "createdAt", "updatedAt"],
  defaultOrderBy: { name: "asc" },
  include: {
    parent: { select: { id: true, key: true, name: true } },
    _count: { select: { children: true } },
  },
});

export const discoveryProfileCrud = createCrudService<DiscoveryProfile>({
  model: prisma.discoveryProfile as never,
  resourceType: "discovery-profile",
  searchFields: ["key", "name"],
  filterableFields: ["mode"],
  allowedSortFields: [
    "key",
    "name",
    "mode",
    "isEnabled",
    "createdAt",
    "updatedAt",
  ],
  defaultOrderBy: { name: "asc" },
});

export async function listCiTypes(req: Request) {
  const result = await ciTypeCrud.list(req);
  return {
    ...result,
    rows: result.rows.map((row) => ({
      ...row,
      fieldCount: parseCiFields(row.fields).length,
    })),
  };
}

export async function createCiType(
  input: CreateCiTypeInput,
  actor: ActorContext,
): Promise<CiType> {
  const duplicate = await prisma.ciType.findUnique({
    where: { key: input.key },
    select: { id: true },
  });
  if (duplicate)
    throw new ConflictError(
      `A CI type with the key "${input.key}" already exists.`,
    );

  const ciType = await prisma.ciType.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      fields: json(input.fields),
    },
  });

  await recordAudit({
    action: "ci-type.created",
    resourceType: "ci-type",
    resourceId: ciType.id,
    after: ciType,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return ciType;
}

export async function getCiType(typeId: string) {
  const ciType = await prisma.ciType.findUnique({ where: { id: typeId } });
  if (!ciType) throw new NotFoundError("CI type");
  return { ...ciType, fields: parseCiFields(ciType.fields) };
}

export async function updateCiType(
  typeId: string,
  input: UpdateCiTypeInput,
  actor: ActorContext,
): Promise<CiType> {
  const existing = await prisma.ciType.findUnique({ where: { id: typeId } });
  if (!existing) throw new NotFoundError("CI type");

  const data: Prisma.CiTypeUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.fields !== undefined) data.fields = json(input.fields);
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const updated = await prisma.ciType.update({ where: { id: typeId }, data });

  await recordAudit({
    action: "ci-type.updated",
    resourceType: "ci-type",
    resourceId: typeId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

async function assertCiTypeKeysExist(
  sourceTypeKey?: string | null,
  targetTypeKey?: string | null,
): Promise<void> {
  const candidates: { field: string; key: string | null | undefined }[] = [
    { field: "sourceTypeKey", key: sourceTypeKey },
    { field: "targetTypeKey", key: targetTypeKey },
  ];
  const requested = Array.from(
    new Set(
      candidates
        .filter(
          (entry) => typeof entry.key === "string" && entry.key.length > 0,
        )
        .map((entry) => entry.key as string),
    ),
  );
  if (requested.length === 0) return;

  const types = await prisma.ciType.findMany({
    where: { key: { in: requested } },
    select: { key: true },
  });
  const foundKeys = new Set(types.map((type) => type.key));
  const missing = candidates.filter(
    (entry) =>
      typeof entry.key === "string" &&
      entry.key.length > 0 &&
      !foundKeys.has(entry.key),
  );
  if (missing.length > 0) {
    throw new ValidationError(
      "One or more referenced CI types could not be found.",
      missing.map((entry) => ({
        field: entry.field,
        message: `CI type "${entry.key}" was not found.`,
      })),
    );
  }
}

export async function listRelationshipTypes(req: Request) {
  return ciRelationshipTypeCrud.list(req);
}

export async function createRelationshipType(
  input: CreateCiRelationshipTypeInput,
  actor: ActorContext,
): Promise<CiRelationshipType> {
  const duplicate = await prisma.ciRelationshipType.findUnique({
    where: { key: input.key },
    select: { id: true },
  });
  if (duplicate)
    throw new ConflictError(
      `A relationship type with the key "${input.key}" already exists.`,
    );
  await assertCiTypeKeysExist(input.sourceTypeKey, input.targetTypeKey);

  const relationshipType = await prisma.ciRelationshipType.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      sourceTypeKey: input.sourceTypeKey ?? null,
      targetTypeKey: input.targetTypeKey ?? null,
      isDirectional: input.isDirectional,
    },
  });

  await recordAudit({
    action: "ci-relationship-type.created",
    resourceType: "ci-relationship-type",
    resourceId: relationshipType.id,
    after: relationshipType,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return relationshipType;
}

export async function updateRelationshipType(
  relationshipTypeId: string,
  input: UpdateCiRelationshipTypeInput,
  actor: ActorContext,
): Promise<CiRelationshipType> {
  const existing = await prisma.ciRelationshipType.findUnique({
    where: { id: relationshipTypeId },
  });
  if (!existing) throw new NotFoundError("CI relationship type");
  await assertCiTypeKeysExist(input.sourceTypeKey, input.targetTypeKey);

  const data: Prisma.CiRelationshipTypeUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.sourceTypeKey !== undefined)
    data.sourceTypeKey = input.sourceTypeKey;
  if (input.targetTypeKey !== undefined)
    data.targetTypeKey = input.targetTypeKey;
  if (input.isDirectional !== undefined)
    data.isDirectional = input.isDirectional;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const updated = await prisma.ciRelationshipType.update({
    where: { id: relationshipTypeId },
    data,
  });

  await recordAudit({
    action: "ci-relationship-type.updated",
    resourceType: "ci-relationship-type",
    resourceId: relationshipTypeId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

async function assertAssetCategoryExists(
  categoryId: string | null | undefined,
): Promise<void> {
  if (categoryId === undefined || categoryId === null) return;
  const category = await prisma.assetCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) throw new NotFoundError("Parent asset category");
}

async function assertAssetCategoryHierarchy(
  categoryId: string,
  parentId: string,
): Promise<void> {
  if (parentId === categoryId) {
    throw new PreconditionFailedError(
      "An asset category cannot be its own parent.",
    );
  }

  let currentId: string | null = parentId;
  const visited = new Set<string>();
  while (currentId) {
    if (currentId === categoryId) {
      throw new PreconditionFailedError(
        "The selected parent would create a circular category hierarchy.",
      );
    }
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const node: { parentId: string | null } | null =
      await prisma.assetCategory.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
    currentId = node?.parentId ?? null;
  }
}

export async function listAssetCategories(req: Request) {
  return assetCategoryCrud.list(req);
}

export async function createAssetCategory(
  input: CreateAssetCategoryInput,
  actor: ActorContext,
): Promise<AssetCategory> {
  const duplicate = await prisma.assetCategory.findUnique({
    where: { key: input.key },
    select: { id: true },
  });
  if (duplicate)
    throw new ConflictError(
      `An asset category with the key "${input.key}" already exists.`,
    );
  await assertAssetCategoryExists(input.parentId);

  const category = await prisma.assetCategory.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      depreciation: input.depreciation ?? null,
    },
  });

  await recordAudit({
    action: "asset-category.created",
    resourceType: "asset-category",
    resourceId: category.id,
    after: category,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return category;
}

export async function updateAssetCategory(
  categoryId: string,
  input: UpdateAssetCategoryInput,
  actor: ActorContext,
): Promise<AssetCategory> {
  const existing = await prisma.assetCategory.findUnique({
    where: { id: categoryId },
  });
  if (!existing) throw new NotFoundError("Asset category");

  if (input.parentId !== undefined && input.parentId !== null) {
    await assertAssetCategoryHierarchy(categoryId, input.parentId);
  }

  const data: Prisma.AssetCategoryUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.parentId !== undefined) data.parentId = input.parentId;
  if (input.depreciation !== undefined) data.depreciation = input.depreciation;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const updated = await prisma.assetCategory.update({
    where: { id: categoryId },
    data,
  });

  await recordAudit({
    action: "asset-category.updated",
    resourceType: "asset-category",
    resourceId: categoryId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function listDiscoveryProfiles(req: Request) {
  const query = parseListQuery(req);
  const isEnabled = parseBooleanFilter(query["isEnabled"]);
  return discoveryProfileCrud.list(
    req,
    isEnabled === undefined ? undefined : { isEnabled },
  );
}

export async function createDiscoveryProfile(
  input: CreateDiscoveryProfileInput,
  actor: ActorContext,
): Promise<DiscoveryProfile> {
  const duplicate = await prisma.discoveryProfile.findUnique({
    where: { key: input.key },
    select: { id: true },
  });
  if (duplicate)
    throw new ConflictError(
      `A discovery profile with the key "${input.key}" already exists.`,
    );

  const profile = await prisma.discoveryProfile.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      mode: input.mode,
      schedule: input.schedule ?? null,
      credentialsRef: input.credentialsRef ?? null,
      settings: jsonValue(input.settings),
      isEnabled: input.isEnabled,
    },
  });

  await recordAudit({
    action: "discovery-profile.created",
    resourceType: "discovery-profile",
    resourceId: profile.id,
    after: profile,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return profile;
}

export async function updateDiscoveryProfile(
  profileId: string,
  input: UpdateDiscoveryProfileInput,
  actor: ActorContext,
): Promise<DiscoveryProfile> {
  const existing = await prisma.discoveryProfile.findUnique({
    where: { id: profileId },
  });
  if (!existing) throw new NotFoundError("Discovery profile");

  const data: Prisma.DiscoveryProfileUncheckedUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.mode !== undefined) data.mode = input.mode;
  if (input.schedule !== undefined) data.schedule = input.schedule;
  if (input.credentialsRef !== undefined)
    data.credentialsRef = input.credentialsRef;
  if (input.settings !== undefined)
    data.settings = jsonValueOrNull(input.settings);
  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;

  const updated = await prisma.discoveryProfile.update({
    where: { id: profileId },
    data,
  });

  await recordAudit({
    action: "discovery-profile.updated",
    resourceType: "discovery-profile",
    resourceId: profileId,
    before: existing,
    after: updated,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return updated;
}

export async function getTenantCmdbConfiguration(tenantId: string) {
  const record = await prisma.tenantCmdbConfiguration.findUnique({
    where: { tenantId },
  });
  return {
    tenantId,
    settings: record?.settings ?? DEFAULT_TENANT_CMDB_SETTINGS,
    isDefault: !record,
    updatedAt: record?.updatedAt ?? null,
  };
}

export async function updateTenantCmdbConfiguration(
  tenantId: string,
  settings: Record<string, unknown>,
  actor: ActorContext,
) {
  const record = await prisma.tenantCmdbConfiguration.upsert({
    where: { tenantId },
    create: {
      tenantId,
      settings: json(settings),
      updatedById: actor.actorId ?? null,
    },
    update: { settings: json(settings), updatedById: actor.actorId ?? null },
  });

  await recordAudit({
    action: "tenant.cmdb-configuration.updated",
    resourceType: "tenant-cmdb-configuration",
    resourceId: record.id,
    tenantId,
    metadata: { settings },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return record;
}
