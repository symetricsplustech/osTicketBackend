import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../config/database";
import { NotFoundError } from "../../shared/errors";
import {
  buildPaginationMeta,
  paginationArgs,
  parseListQuery,
} from "../../shared/pagination";
import {
  PERMISSION_CATALOG,
  type PermissionDefinition,
} from "../../shared/permissions/catalog";

export interface PermissionView {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface PermissionRow {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function fromCatalog(permission: PermissionDefinition): PermissionView {
  return {
    id: permission.code,
    code: permission.code,
    name: permission.name,
    module: permission.module,
    description: permission.description,
    isSystem: true,
    createdAt: null,
    updatedAt: null,
  };
}

function fromDatabase(permission: PermissionRow): PermissionView {
  return {
    id: permission.id,
    code: permission.code,
    name: permission.name,
    module: permission.module,
    description: permission.description,
    isSystem: permission.isSystem,
    createdAt: permission.createdAt,
    updatedAt: permission.updatedAt,
  };
}

function matchesSearch(
  permission: PermissionDefinition,
  search: string,
): boolean {
  const haystack =
    `${permission.code} ${permission.name} ${permission.module} ${permission.description}`.toLowerCase();
  return haystack.includes(search.toLowerCase());
}

export async function listPermissions(req: Request) {
  const query = parseListQuery(req, { maxLimit: 200 });
  const module =
    typeof query.module === "string" && query.module ? query.module : undefined;

  const total = await prisma.permission.count();
  if (total === 0) {
    const filtered = PERMISSION_CATALOG.filter(
      (permission) =>
        (!module || permission.module === module) &&
        (!query.search || matchesSearch(permission, query.search)),
    ).map(fromCatalog);
    const start = (query.page - 1) * query.limit;
    const rows = filtered.slice(start, start + query.limit);
    return {
      rows,
      meta: buildPaginationMeta(query.page, query.limit, filtered.length),
    };
  }

  const where: Prisma.PermissionWhereInput = {
    ...(module ? { module } : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search, mode: "insensitive" } },
            { name: { contains: query.search, mode: "insensitive" } },
            { module: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, filteredTotal] = await Promise.all([
    prisma.permission.findMany({
      where,
      orderBy: [{ module: "asc" }, { code: "asc" }],
      ...paginationArgs(query),
    }),
    prisma.permission.count({ where }),
  ]);

  return {
    rows: rows.map(fromDatabase),
    meta: buildPaginationMeta(query.page, query.limit, filteredTotal),
  };
}

export async function getPermissionGroups() {
  const total = await prisma.permission.count();
  let permissions: PermissionView[];
  if (total === 0) {
    permissions = PERMISSION_CATALOG.map(fromCatalog);
  } else {
    const rows = await prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { code: "asc" }],
    });
    permissions = rows.map(fromDatabase);
  }

  const groups = new Map<string, PermissionView[]>();
  for (const permission of permissions) {
    const bucket = groups.get(permission.module) ?? [];
    bucket.push(permission);
    groups.set(permission.module, bucket);
  }

  return Array.from(groups.entries()).map(([module, items]) => ({
    module,
    count: items.length,
    items,
  }));
}

export async function getPermission(permissionIdOrCode: string) {
  const permission = await prisma.permission.findFirst({
    where: { OR: [{ id: permissionIdOrCode }, { code: permissionIdOrCode }] },
  });
  if (permission) return fromDatabase(permission);

  const catalogEntry = PERMISSION_CATALOG.find(
    (entry) => entry.code === permissionIdOrCode,
  );
  if (catalogEntry) return fromCatalog(catalogEntry);

  throw new NotFoundError("Permission");
}
