import type { Request } from 'express';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import { buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { TENANT_PERMISSION_CATALOG, tenantPermissionsByModule } from '../../shared/permissions/tenant-catalog';

export interface TenantPermissionView {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string;
  isSystem: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

function fromCatalog(permission: { code: string; name: string; module: string; description: string }): TenantPermissionView {
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

function fromDatabase(permission: {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TenantPermissionView {
  return {
    id: permission.id,
    code: permission.code,
    name: permission.name,
    module: permission.module,
    description: permission.description ?? '',
    isSystem: permission.isSystem,
    createdAt: permission.createdAt,
    updatedAt: permission.updatedAt,
  };
}

export async function listPermissions(req: Request) {
  const query = parseListQuery(req, { maxLimit: 200 });
  const module = typeof query.module === 'string' && query.module ? query.module : undefined;

  const total = await prisma.permission.count({ where: { scope: 'TENANT' } });
  if (total === 0) {
    const filtered = TENANT_PERMISSION_CATALOG.filter(
      (permission) =>
        (!module || permission.module === module) &&
        (!query.search ||
          `${permission.code} ${permission.name} ${permission.module} ${permission.description}`
            .toLowerCase()
            .includes(query.search.toLowerCase())),
    ).map(fromCatalog);
    const start = (query.page - 1) * query.limit;
    const rows = filtered.slice(start, start + query.limit);
    return { rows, meta: buildPaginationMeta(query.page, query.limit, filtered.length) };
  }

  const where = {
    scope: 'TENANT' as const,
    ...(module ? { module } : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search, mode: 'insensitive' as const } },
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { module: { contains: query.search, mode: 'insensitive' as const } },
            { description: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [rows, filteredTotal] = await Promise.all([
    prisma.permission.findMany({ where, orderBy: [{ module: 'asc' }, { code: 'asc' }], ...paginationArgs(query) }),
    prisma.permission.count({ where }),
  ]);

  return { rows: rows.map(fromDatabase), meta: buildPaginationMeta(query.page, query.limit, filteredTotal) };
}

export async function getPermissionGroups() {
  const total = await prisma.permission.count({ where: { scope: 'TENANT' } });
  if (total === 0) {
    const grouped = tenantPermissionsByModule();
    return Object.entries(grouped).map(([module, items]) => ({
      module,
      count: items.length,
      items: items.map(fromCatalog),
    }));
  }
  const rows = await prisma.permission.findMany({
    where: { scope: 'TENANT' },
    orderBy: [{ module: 'asc' }, { code: 'asc' }],
  });
  const groups = new Map<string, TenantPermissionView[]>();
  for (const permission of rows.map(fromDatabase)) {
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
    where: { scope: 'TENANT', OR: [{ id: permissionIdOrCode }, { code: permissionIdOrCode }] },
  });
  if (permission) return fromDatabase(permission);

  const catalogEntry = TENANT_PERMISSION_CATALOG.find((entry) => entry.code === permissionIdOrCode);
  if (catalogEntry) return fromCatalog(catalogEntry);

  throw new NotFoundError('Permission');
}
