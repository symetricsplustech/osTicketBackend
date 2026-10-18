import type { Prisma, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError, PreconditionFailedError, ValidationError } from '../../shared/errors';
import { buildOrderBy, buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import { invalidatePermissionCache } from '../../api/middleware/authenticate';
import { permissionsByModule } from '../../shared/permissions/catalog';
import type {
  CreateRoleInput,
  SetRolePermissionsInput,
  UpdateRoleInput,
} from '../../validators/saasadmin/roles.validators';

const STAFF_STATUSES: UserStatus[] = ['INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

export interface ActorContext {
  actorId?: string | null;
  req?: Request;
}

const ROLE_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
  permissions: {
    select: {
      id: true,
      permission: { select: { id: true, code: true, name: true, module: true, description: true } },
    },
    orderBy: { permission: { module: 'asc' } },
  },
  _count: { select: { staffAssignments: true } },
} satisfies Prisma.PlatformRoleSelect;

type RoleRecord = Prisma.PlatformRoleGetPayload<{ select: typeof ROLE_SELECT }>;

function serializeRole(role: RoleRecord) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    permissionCodes: role.permissions.map((entry) => entry.permission.code),
    permissions: role.permissions.map((entry) => entry.permission),
    memberCount: role._count.staffAssignments,
  };
}

function parseBoolean(value: string): boolean | undefined {
  const normalised = value.toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalised)) return true;
  if (['false', '0', 'no', 'off'].includes(normalised)) return false;
  return undefined;
}

async function findRoleOrThrow(roleId: string) {
  const role = await prisma.platformRole.findFirst({ where: { id: roleId, deletedAt: null }, select: ROLE_SELECT });
  if (!role) throw new NotFoundError('Platform role');
  return role;
}

async function resolvePermissions(codes: string[]): Promise<{ id: string; code: string }[]> {
  const uniqueCodes = Array.from(new Set(codes));
  if (uniqueCodes.length === 0) return [];

  const permissions = await prisma.permission.findMany({
    where: { code: { in: uniqueCodes } },
    select: { id: true, code: true },
  });
  if (permissions.length !== uniqueCodes.length) {
    const known = new Set(permissions.map((permission) => permission.code));
    const unknown = uniqueCodes.filter((code) => !known.has(code));
    throw new ValidationError(
      'One or more permission codes are not recognised by the platform.',
      unknown.map((code) => ({ field: 'permissionCodes', message: `Unknown permission code: ${code}.` })),
    );
  }
  return permissions;
}

export async function listRoles(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const isSystem = typeof query.isSystem === 'string' ? parseBoolean(query.isSystem) : undefined;

  const where: Prisma.PlatformRoleWhereInput = {
    deletedAt: null,
    ...(isSystem !== undefined ? { isSystem } : {}),
    ...(query.search
      ? {
          OR: [
            { key: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const orderBy = buildOrderBy<Prisma.PlatformRoleOrderByWithRelationInput>(
    query,
    ['key', 'name', 'createdAt', 'updatedAt'],
    { createdAt: 'desc' },
  );

  const [rows, total] = await Promise.all([
    prisma.platformRole.findMany({
      where,
      orderBy,
      ...paginationArgs(query),
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { permissions: true, staffAssignments: true } },
      },
    }),
    prisma.platformRole.count({ where }),
  ]);

  return {
    rows: rows.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      permissionCount: role._count.permissions,
      memberCount: role._count.staffAssignments,
    })),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function createRole(input: CreateRoleInput, actor: ActorContext) {
  const existing = await prisma.platformRole.findFirst({ where: { key: input.key }, select: { id: true } });
  if (existing) throw new ConflictError(`A platform role with the key "${input.key}" already exists.`);

  const permissions = await resolvePermissions(input.permissionCodes);

  const role = await prisma.platformRole.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      isSystem: false,
      permissions:
        permissions.length > 0
          ? { create: permissions.map((permission) => ({ permissionId: permission.id })) }
          : undefined,
    },
    select: ROLE_SELECT,
  });

  const serialized = serializeRole(role);
  await recordAudit({
    action: 'role.created',
    resourceType: 'platform-role',
    resourceId: role.id,
    after: serialized,
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({ eventKey: 'role.created', payload: { roleId: role.id, key: role.key } });

  return serialized;
}

export async function getRole(roleId: string) {
  const role = await findRoleOrThrow(roleId);
  return serializeRole(role);
}

export async function updateRole(roleId: string, input: UpdateRoleInput, actor: ActorContext) {
  const existing = await findRoleOrThrow(roleId);

  const data: Prisma.PlatformRoleUpdateInput = {};
  let keyChanged = false;
  if (input.key !== undefined && input.key !== existing.key) {
    if (existing.isSystem) throw new PreconditionFailedError('System role keys cannot be changed.');
    const duplicate = await prisma.platformRole.findFirst({ where: { key: input.key, id: { not: roleId } } });
    if (duplicate) throw new ConflictError(`A platform role with the key "${input.key}" already exists.`);
    data.key = input.key;
    keyChanged = true;
  }
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;

  const updated = await prisma.platformRole.update({ where: { id: roleId }, data, select: ROLE_SELECT });

  if (keyChanged) {
    const members = await prisma.staffRoleAssignment.findMany({ where: { roleId }, select: { userId: true } });
    await Promise.all(members.map((member) => invalidatePermissionCache(member.userId)));
  }

  await recordAudit({
    action: 'role.updated',
    resourceType: 'platform-role',
    resourceId: roleId,
    before: serializeRole(existing),
    after: serializeRole(updated),
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({ eventKey: 'role.updated', payload: { roleId, key: updated.key } });

  return serializeRole(updated);
}

export async function deleteRole(roleId: string, actor: ActorContext) {
  const existing = await prisma.platformRole.findFirst({
    where: { id: roleId, deletedAt: null },
    select: { id: true, key: true, name: true, isSystem: true, _count: { select: { staffAssignments: true } } },
  });
  if (!existing) throw new NotFoundError('Platform role');
  if (existing.isSystem) throw new ConflictError('System roles cannot be deleted.');
  if (existing._count.staffAssignments > 0) {
    throw new PreconditionFailedError('Remove all staff members from this role before deleting it.');
  }

  await prisma.platformRole.update({ where: { id: roleId }, data: { deletedAt: new Date() } });

  await recordAudit({
    action: 'role.deleted',
    resourceType: 'platform-role',
    resourceId: roleId,
    before: { key: existing.key, name: existing.name, isSystem: existing.isSystem },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({ eventKey: 'role.deleted', payload: { roleId, key: existing.key } });
}

export async function getRolePermissions(roleId: string) {
  const role = await prisma.platformRole.findFirst({
    where: { id: roleId, deletedAt: null },
    select: {
      id: true,
      key: true,
      name: true,
      permissions: {
        select: {
          id: true,
          permission: { select: { id: true, code: true, name: true, module: true, description: true } },
        },
        orderBy: { permission: { module: 'asc' } },
      },
    },
  });
  if (!role) throw new NotFoundError('Platform role');

  const permissions = role.permissions.map((entry) => entry.permission);
  return {
    roleId: role.id,
    roleKey: role.key,
    roleName: role.name,
    permissionCodes: permissions.map((permission) => permission.code),
    permissions,
  };
}

export async function setRolePermissions(roleId: string, input: SetRolePermissionsInput, actor: ActorContext) {
  const role = await findRoleOrThrow(roleId);
  const permissions = await resolvePermissions(input.permissionCodes);

  const beforeCodes = serializeRole(role).permissionCodes.sort();
  const nextCodes = permissions.map((permission) => permission.code).sort();

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (permissions.length > 0) {
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
        skipDuplicates: true,
      });
    }
  });

  const members = await prisma.staffRoleAssignment.findMany({ where: { roleId }, select: { userId: true } });
  await Promise.all(members.map((member) => invalidatePermissionCache(member.userId)));

  await recordAudit({
    action: 'role.permissions.changed',
    resourceType: 'platform-role',
    resourceId: roleId,
    before: { permissionCodes: beforeCodes },
    after: { permissionCodes: nextCodes },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return getRolePermissions(roleId);
}

export async function listRoleMembers(roleId: string, req: Request) {
  await findRoleOrThrow(roleId);
  const query = parseListQuery(req, { maxLimit: 100 });
  const status = typeof query.status === 'string' ? (query.status.toUpperCase() as UserStatus) : undefined;

  const userWhere: Prisma.UserWhereInput = { userType: 'PLATFORM_STAFF', deletedAt: null };
  if (status && STAFF_STATUSES.includes(status)) userWhere.status = status;
  if (query.search) {
    userWhere.OR = [
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const where: Prisma.StaffRoleAssignmentWhereInput = { roleId, user: userWhere };

  const [rows, total] = await Promise.all([
    prisma.staffRoleAssignment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            jobTitle: true,
            status: true,
            lastLoginAt: true,
            mfaEnabled: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
      ...paginationArgs(query),
    }),
    prisma.staffRoleAssignment.count({ where }),
  ]);

  return {
    rows: rows.map((assignment) => ({
      assignmentId: assignment.id,
      assignedAt: assignment.assignedAt,
      ...assignment.user,
    })),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export function getPermissionCatalog() {
  const grouped = permissionsByModule();
  return Object.entries(grouped).map(([module, items]) => ({
    module,
    count: items.length,
    items,
  }));
}
