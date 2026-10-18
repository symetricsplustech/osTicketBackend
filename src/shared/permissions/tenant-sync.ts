import type { PrismaClient } from '@prisma/client';
import { PermissionScope } from '@prisma/client';
import {
  ALL_TENANT_PERMISSION_CODES,
  TENANT_PERMISSION_CATALOG,
  TENANT_SYSTEM_ROLE_TEMPLATES,
} from './tenant-catalog';

type Db = Pick<PrismaClient, 'permission' | 'tenantRole' | 'tenantRolePermission'>;

function splitCode(code: string): { resource: string; action: string } {
  const index = code.indexOf('.');
  if (index === -1) return { resource: code, action: 'manage' };
  return { resource: code.slice(0, index), action: code.slice(index + 1) };
}

/**
 * Upserts the tenant permission catalog into the database with scope = TENANT.
 * The database remains the authoritative runtime catalog.
 */
export async function syncTenantPermissions(prisma: Db): Promise<void> {
  for (const permission of TENANT_PERMISSION_CATALOG) {
    const { resource, action } = splitCode(permission.code);
    await prisma.permission.upsert({
      where: { code: permission.code },
      create: {
        code: permission.code,
        name: permission.name,
        module: permission.module,
        description: permission.description,
        scope: PermissionScope.TENANT,
        resource,
        action,
        isSystem: true,
      },
      update: {
        name: permission.name,
        module: permission.module,
        description: permission.description,
        scope: PermissionScope.TENANT,
        resource,
        action,
        isSystem: true,
      },
    });
  }
}

/**
 * Ensures the protected system roles exist for a tenant and are in sync with the
 * tenant system-role templates. Custom (non-system) roles are never modified.
 */
export async function ensureTenantSystemRoles(prisma: Db, tenantId: string): Promise<void> {
  const permissions = await prisma.permission.findMany({
    where: { scope: PermissionScope.TENANT },
    select: { id: true, code: true },
  });
  const permissionIndex = new Map(permissions.map((permission) => [permission.code, permission.id]));

  for (const template of TENANT_SYSTEM_ROLE_TEMPLATES) {
    const role = await prisma.tenantRole.upsert({
      where: { tenantId_key: { tenantId, key: template.key } },
      create: {
        tenantId,
        key: template.key,
        name: template.name,
        description: template.description,
        isSystem: true,
      },
      update: { name: template.name, description: template.description, isSystem: true, deletedAt: null },
    });

    const codes = template.permissions === '*' ? ALL_TENANT_PERMISSION_CODES : template.permissions;
    const permissionIds = codes
      .filter((code) => permissionIndex.has(code))
      .map((code) => permissionIndex.get(code)!);

    await prisma.tenantRolePermission.deleteMany({ where: { tenantRoleId: role.id } });
    if (permissionIds.length > 0) {
      await prisma.tenantRolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ tenantRoleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
  }
}
