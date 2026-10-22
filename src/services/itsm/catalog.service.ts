import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  ConflictError,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from "../../shared/errors";
import {
  buildOrderBy,
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import { recordAudit } from "../../shared/audit";
import { publishEvent } from "../../shared/events";
import { createTenantCrudService } from "../tenantadmin/structure-crud";
import type { TenantActorContext } from "../tenantadmin/roles.service";
import type {
  CreateCatalogItemInput,
  UpdateCatalogItemInput,
} from "../../validators/itsm/catalog.validators";

export const catalogCategoryService = createTenantCrudService({
  resourceType: "catalog_category",
  label: "Catalog category",
  model: prisma.catalogCategory,
  searchFields: ["name", "description"],
  allowedSortFields: ["name", "sortOrder", "status", "createdAt", "updatedAt"],
  include: {
    parent: { select: { id: true, name: true } },
    _count: { select: { items: true, children: true } },
  },
  async validate(tenantId, input, existing) {
    const name = input.name;
    if (typeof name === "string" && name) {
      const where: Prisma.CatalogCategoryWhereInput = {
        tenantId,
        name,
        deletedAt: null,
        ...(existing ? { id: { not: existing.id as string } } : {}),
      };
      const dup = await prisma.catalogCategory.findFirst({
        where,
        select: { id: true },
      });
      if (dup)
        throw new ConflictError(
          "A catalog category with this name already exists in the organization.",
        );
    }
    const parentId = input.parentId;
    if (typeof parentId === "string" && parentId) {
      const parent = await prisma.catalogCategory.findFirst({
        where: { id: parentId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!parent)
        throw new ValidationError(
          "The selected parent category could not be found.",
        );
    }
  },
  async beforeDelete(tenantId, record) {
    const items = await prisma.catalogItem.count({
      where: { categoryId: record.id as string, tenantId, deletedAt: null },
    });
    if (items > 0)
      throw new PreconditionFailedError(
        "Remove or reassign catalog items before deleting this category.",
      );
    const children = await prisma.catalogCategory.count({
      where: { parentId: record.id as string, tenantId, deletedAt: null },
    });
    if (children > 0)
      throw new PreconditionFailedError(
        "Remove or reassign sub-categories before deleting this category.",
      );
  },
});

const ITEM_INCLUDE = {
  category: { select: { id: true, name: true } },
  fulfillmentTeam: { select: { id: true, name: true, code: true } },
} satisfies Prisma.CatalogItemInclude;

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "item"
  );
}

async function findItemOrThrow(tenantId: string, itemId: string) {
  const item = await prisma.catalogItem.findFirst({
    where: { id: itemId, tenantId, deletedAt: null },
    include: ITEM_INCLUDE,
  });
  if (!item) throw new NotFoundError("Catalog item");
  return item;
}

async function uniqueSlug(
  tenantId: string,
  base: string,
  exceptId?: string,
): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 200; i += 1) {
    const existing = await prisma.catalogItem.findFirst({
      where: {
        tenantId,
        slug: candidate,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${i + 2}`.slice(0, 120);
  }
  throw new ConflictError("Unable to generate a unique catalog item slug.");
}

async function validateItemReferences(
  tenantId: string,
  input: { categoryId?: string | null; fulfillmentTeamId?: string | null },
) {
  if (input.categoryId) {
    const category = await prisma.catalogCategory.findFirst({
      where: { id: input.categoryId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!category)
      throw new ValidationError("The selected category could not be found.");
  }
  if (input.fulfillmentTeamId) {
    const team = await prisma.team.findFirst({
      where: { id: input.fulfillmentTeamId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!team)
      throw new ValidationError(
        "The selected fulfilment team could not be found.",
      );
  }
}

export async function listCatalogItems(tenantId: string, req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.CatalogItemWhereInput = { tenantId, deletedAt: null };

  const status =
    typeof query.status === "string" && query.status
      ? query.status.toUpperCase()
      : undefined;
  const categoryId =
    typeof query.categoryId === "string" && query.categoryId
      ? query.categoryId
      : undefined;
  const itemType =
    typeof query.itemType === "string" && query.itemType
      ? query.itemType.toUpperCase()
      : undefined;
  if (status) where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (itemType) where.itemType = itemType;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { slug: { contains: query.search, mode: "insensitive" } },
      { shortDescription: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const orderBy = buildOrderBy(
    query,
    ["name", "slug", "status", "itemType", "createdAt", "updatedAt"],
    { createdAt: "desc" } as Prisma.CatalogItemOrderByWithRelationInput,
  );
  const [rows, total] = await Promise.all([
    prisma.catalogItem.findMany({
      where,
      orderBy,
      ...paginationArgs(query),
      include: ITEM_INCLUDE,
    }),
    prisma.catalogItem.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function getCatalogItem(tenantId: string, itemId: string) {
  return findItemOrThrow(tenantId, itemId);
}

export async function createCatalogItem(
  tenantId: string,
  input: CreateCatalogItemInput,
  actor: TenantActorContext,
) {
  await validateItemReferences(tenantId, input);
  const slug = await uniqueSlug(tenantId, input.slug ?? slugify(input.name));

  const item = await prisma.catalogItem.create({
    data: {
      tenantId,
      categoryId: input.categoryId ?? null,
      name: input.name,
      slug,
      shortDescription: input.shortDescription ?? null,
      description: input.description ?? null,
      itemType: input.itemType ?? "SERVICE",
      status: "DRAFT",
      price: input.price ?? null,
      currency: input.currency ?? "USD",
      fulfillmentTeamId: input.fulfillmentTeamId ?? null,
      approvalRequired: input.approvalRequired ?? false,
      formSchema: (input.formSchema ?? undefined) as
        Prisma.InputJsonValue | undefined,
      tags: input.tags ?? [],
      createdById: actor.actorId ?? null,
    },
    include: ITEM_INCLUDE,
  });

  await recordAudit({
    action: "catalog_item.created",
    resourceType: "catalog_item",
    resourceId: item.id,
    tenantId,
    after: item,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "catalog_item.created",
    tenantId,
    payload: { itemId: item.id, slug },
  });

  return item;
}

export async function updateCatalogItem(
  tenantId: string,
  itemId: string,
  input: UpdateCatalogItemInput,
  actor: TenantActorContext,
) {
  const before = await findItemOrThrow(tenantId, itemId);
  await validateItemReferences(tenantId, input);

  const data: Prisma.CatalogItemUpdateInput = {};
  for (const key of [
    "categoryId",
    "name",
    "shortDescription",
    "description",
    "itemType",
    "price",
    "currency",
    "fulfillmentTeamId",
    "approvalRequired",
    "tags",
  ] as const) {
    if (input[key] !== undefined)
      (data as Record<string, unknown>)[key] = input[key];
  }
  if (input.slug !== undefined)
    data.slug = await uniqueSlug(tenantId, input.slug, itemId);
  if (input.formSchema !== undefined)
    data.formSchema = input.formSchema as Prisma.InputJsonValue;

  const item = await prisma.catalogItem.update({
    where: { id: itemId },
    data,
    include: ITEM_INCLUDE,
  });

  await recordAudit({
    action: "catalog_item.updated",
    resourceType: "catalog_item",
    resourceId: itemId,
    tenantId,
    before,
    after: item,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "catalog_item.updated",
    tenantId,
    payload: { itemId },
  });

  return item;
}

export async function deleteCatalogItem(
  tenantId: string,
  itemId: string,
  actor: TenantActorContext,
) {
  const before = await findItemOrThrow(tenantId, itemId);
  await prisma.catalogItem.update({
    where: { id: itemId },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    action: "catalog_item.deleted",
    resourceType: "catalog_item",
    resourceId: itemId,
    tenantId,
    before,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "catalog_item.deleted",
    tenantId,
    payload: { itemId },
  });
}

export async function publishCatalogItem(
  tenantId: string,
  itemId: string,
  actor: TenantActorContext,
) {
  const before = await findItemOrThrow(tenantId, itemId);
  const version = before.currentVersion + 1;

  const snapshot = {
    name: before.name,
    slug: before.slug,
    categoryId: before.categoryId,
    shortDescription: before.shortDescription,
    description: before.description,
    itemType: before.itemType,
    price: before.price,
    currency: before.currency,
    fulfillmentTeamId: before.fulfillmentTeamId,
    approvalRequired: before.approvalRequired,
    formSchema: before.formSchema,
    tags: before.tags,
  };

  const [item] = await prisma.$transaction([
    prisma.catalogItem.update({
      where: { id: itemId },
      data: { status: "PUBLISHED", currentVersion: version },
      include: ITEM_INCLUDE,
    }),
    prisma.catalogItemVersion.create({
      data: {
        tenantId,
        itemId,
        version,
        snapshot: snapshot as Prisma.InputJsonValue,
        status: "PUBLISHED",
        publishedById: actor.actorId ?? null,
      },
    }),
  ]);

  await recordAudit({
    action: "catalog_item.published",
    resourceType: "catalog_item",
    resourceId: itemId,
    tenantId,
    before: { status: before.status, currentVersion: before.currentVersion },
    after: {
      status: item.status,
      currentVersion: item.currentVersion,
      version,
    },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "catalog_item.published",
    tenantId,
    payload: { itemId, version },
  });

  return item;
}

export async function retireCatalogItem(
  tenantId: string,
  itemId: string,
  actor: TenantActorContext,
) {
  const before = await findItemOrThrow(tenantId, itemId);

  const item = await prisma.catalogItem.update({
    where: { id: itemId },
    data: { status: "RETIRED" },
    include: ITEM_INCLUDE,
  });
  await prisma.catalogItemVersion.updateMany({
    where: { itemId, tenantId, status: "PUBLISHED" },
    data: { status: "RETIRED", retiredAt: new Date() },
  });

  await recordAudit({
    action: "catalog_item.retired",
    resourceType: "catalog_item",
    resourceId: itemId,
    tenantId,
    before: { status: before.status },
    after: { status: item.status },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "catalog_item.retired",
    tenantId,
    payload: { itemId },
  });

  return item;
}

export async function listCatalogItemVersions(
  tenantId: string,
  itemId: string,
  req: Request,
) {
  await findItemOrThrow(tenantId, itemId);
  const query = parseListQuery(req, { maxLimit: 100 });
  const where = { itemId, tenantId };
  const [rows, total] = await Promise.all([
    prisma.catalogItemVersion.findMany({
      where,
      include: {
        publishedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { version: "desc" },
      ...paginationArgs(query),
    }),
    prisma.catalogItemVersion.count({ where }),
  ]);
  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}
