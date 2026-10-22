import type { Prisma, UserStatus } from "@prisma/client";
import type { Request } from "express";
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
import { invalidateTenantAuthorizationCache } from "../auth/tenant-access.service";
import {
  isProtectedTenantRole,
  tenantPermissionsByModule,
} from "../../shared/permissions/tenant-catalog";
import type {
  AddRoleMembersInput,
  CreateTenantRoleInput,
  SetTenantRolePermissionsInput,
  UpdateTenantRoleInput,
} from "../../validators/tenantadmin/roles.validators";

const MEMBER_STATUSES: UserStatus[] = [
  "INVITED",
  "ACTIVE",
  "SUSPENDED",
  "DEACTIVATED",
];

export interface TenantActorContext {
  tenantId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorType?: string;
  req?: Request;
}

const ROLE_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  isSystem: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  permissions: {
    select: {
      id: true,
      permission: {
        select: {
          id: true,
          code: true,
          name: true,
          module: true,
          description: true,
        },
      },
    },
    orderBy: { permission: { module: "asc" } },
  },
  _count: { select: { userAssignments: true } },
} satisfies Prisma.TenantRoleSelect;

type TenantRoleRecord = Prisma.TenantRoleGetPayload<{
  select: typeof ROLE_SELECT;
}>;

function serializeRole(role: TenantRoleRecord) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    status: role.status,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    permissionCodes: role.permissions.map((entry) => entry.permission.code),
    permissions: role.permissions.map((entry) => entry.permission),
    memberCount: role._count.userAssignments,
  };
}

function parseBoolean(value: string): boolean | undefined {
  const normalised = value.toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalised)) return true;
  if (["false", "0", "no", "off"].includes(normalised)) return false;
  return undefined;
}

async function findRoleOrThrow(
  tenantId: string,
  roleId: string,
): Promise<TenantRoleRecord> {
  const role = await prisma.tenantRole.findFirst({
    where: { id: roleId, tenantId, deletedAt: null },
    select: ROLE_SELECT,
  });
  if (!role) throw new NotFoundError("Role");
  return role;
}

async function resolveTenantPermissions(
  codes: string[],
): Promise<{ id: string; code: string }[]> {
  const uniqueCodes = Array.from(new Set(codes));
  if (uniqueCodes.length === 0) return [];

  const permissions = await prisma.permission.findMany({
    where: { code: { in: uniqueCodes }, scope: "TENANT" },
    select: { id: true, code: true },
  });
  if (permissions.length !== uniqueCodes.length) {
    const known = new Set(permissions.map((permission) => permission.code));
    const unknown = uniqueCodes.filter((code) => !known.has(code));
    throw new ValidationError(
      "One or more permission codes are not recognised by the platform.",
      unknown.map((code) => ({
        field: "permissionCodes",
        message: `Unknown permission code: ${code}.`,
      })),
    );
  }
  return permissions;
}

export async function listRoles(tenantId: string, req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const isSystem =
    typeof query.isSystem === "string"
      ? parseBoolean(query.isSystem)
      : undefined;
  const status =
    typeof query.status === "string" ? query.status.toUpperCase() : undefined;

  const where: Prisma.TenantRoleWhereInput = {
    tenantId,
    deletedAt: null,
    ...(isSystem !== undefined ? { isSystem } : {}),
    ...(status === "ACTIVE" || status === "ARCHIVED"
      ? { status: status as "ACTIVE" | "ARCHIVED" }
      : {}),
    ...(query.search
      ? {
          OR: [
            { key: { contains: query.search, mode: "insensitive" } },
            { name: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy = buildOrderBy<Prisma.TenantRoleOrderByWithRelationInput>(
    query,
    ["key", "name", "createdAt", "updatedAt"],
    { createdAt: "desc" },
  );

  const [rows, total] = await Promise.all([
    prisma.tenantRole.findMany({
      where,
      orderBy,
      ...paginationArgs(query),
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { permissions: true, userAssignments: true } },
      },
    }),
    prisma.tenantRole.count({ where }),
  ]);

  return {
    rows: rows.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      status: role.status,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      permissionCount: role._count.permissions,
      memberCount: role._count.userAssignments,
    })),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function createRole(
  tenantId: string,
  input: CreateTenantRoleInput,
  actor: TenantActorContext,
) {
  const existing = await prisma.tenantRole.findFirst({
    where: { tenantId, key: input.key },
    select: { id: true },
  });
  if (existing)
    throw new ConflictError(
      `A role with the key "${input.key}" already exists in this organization.`,
    );

  const permissions = await resolveTenantPermissions(input.permissionCodes);

  const role = await prisma.tenantRole.create({
    data: {
      tenantId,
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      isSystem: false,
      createdById: actor.actorId ?? null,
      permissions:
        permissions.length > 0
          ? {
              create: permissions.map((permission) => ({
                permissionId: permission.id,
              })),
            }
          : undefined,
    },
    select: ROLE_SELECT,
  });

  const serialized = serializeRole(role);
  await recordAudit({
    action: "role.created",
    resourceType: "tenant-role",
    resourceId: role.id,
    tenantId,
    after: serialized,
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "role.created",
    tenantId,
    payload: { roleId: role.id, key: role.key },
  });

  return serialized;
}

export async function getRole(tenantId: string, roleId: string) {
  const role = await findRoleOrThrow(tenantId, roleId);
  return serializeRole(role);
}

export async function updateRole(
  tenantId: string,
  roleId: string,
  input: UpdateTenantRoleInput,
  actor: TenantActorContext,
) {
  const existing = await findRoleOrThrow(tenantId, roleId);

  const data: Prisma.TenantRoleUpdateInput = {};
  let keyChanged = false;
  if (input.key !== undefined && input.key !== existing.key) {
    if (existing.isSystem)
      throw new PreconditionFailedError("System role keys cannot be changed.");
    const duplicate = await prisma.tenantRole.findFirst({
      where: { tenantId, key: input.key, id: { not: roleId } },
      select: { id: true },
    });
    if (duplicate)
      throw new ConflictError(
        `A role with the key "${input.key}" already exists in this organization.`,
      );
    data.key = input.key;
    keyChanged = true;
  }
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;

  const updated = await prisma.tenantRole.update({
    where: { id: roleId },
    data,
    select: ROLE_SELECT,
  });

  if (keyChanged) {
    await invalidateRoleMemberCaches(roleId, tenantId);
  }

  await recordAudit({
    action: "role.updated",
    resourceType: "tenant-role",
    resourceId: roleId,
    tenantId,
    before: serializeRole(existing),
    after: serializeRole(updated),
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "role.updated",
    tenantId,
    payload: { roleId, key: updated.key },
  });

  return serializeRole(updated);
}

export async function deleteRole(
  tenantId: string,
  roleId: string,
  actor: TenantActorContext,
) {
  const existing = await prisma.tenantRole.findFirst({
    where: { id: roleId, tenantId, deletedAt: null },
    select: {
      id: true,
      key: true,
      name: true,
      isSystem: true,
      _count: { select: { userAssignments: true } },
    },
  });
  if (!existing) throw new NotFoundError("Role");
  if (existing.isSystem)
    throw new ConflictError("System roles cannot be deleted.");
  if (existing._count.userAssignments > 0) {
    throw new PreconditionFailedError(
      "Remove all members from this role before deleting it.",
    );
  }

  await prisma.tenantRole.update({
    where: { id: roleId },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    action: "role.deleted",
    resourceType: "tenant-role",
    resourceId: roleId,
    tenantId,
    before: {
      key: existing.key,
      name: existing.name,
      isSystem: existing.isSystem,
    },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "role.deleted",
    tenantId,
    payload: { roleId, key: existing.key },
  });
}

export async function getRolePermissions(tenantId: string, roleId: string) {
  const role = await prisma.tenantRole.findFirst({
    where: { id: roleId, tenantId, deletedAt: null },
    select: {
      id: true,
      key: true,
      name: true,
      permissions: {
        select: {
          id: true,
          permission: {
            select: {
              id: true,
              code: true,
              name: true,
              module: true,
              description: true,
            },
          },
        },
        orderBy: { permission: { module: "asc" } },
      },
    },
  });
  if (!role) throw new NotFoundError("Role");

  const permissions = role.permissions.map((entry) => entry.permission);
  return {
    roleId: role.id,
    roleKey: role.key,
    roleName: role.name,
    permissionCodes: permissions.map((permission) => permission.code),
    permissions,
  };
}

export async function setRolePermissions(
  tenantId: string,
  roleId: string,
  input: SetTenantRolePermissionsInput,
  actor: TenantActorContext,
) {
  const role = await findRoleOrThrow(tenantId, roleId);
  const permissions = await resolveTenantPermissions(input.permissionCodes);

  const beforeCodes = serializeRole(role).permissionCodes.sort();
  const nextCodes = permissions.map((permission) => permission.code).sort();

  await prisma.$transaction(async (tx) => {
    await tx.tenantRolePermission.deleteMany({
      where: { tenantRoleId: roleId },
    });
    if (permissions.length > 0) {
      await tx.tenantRolePermission.createMany({
        data: permissions.map((permission) => ({
          tenantRoleId: roleId,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
    }
  });

  await invalidateRoleMemberCaches(roleId, tenantId);

  await recordAudit({
    action: "role.permissions.changed",
    resourceType: "tenant-role",
    resourceId: roleId,
    tenantId,
    before: { permissionCodes: beforeCodes },
    after: { permissionCodes: nextCodes },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });

  return getRolePermissions(tenantId, roleId);
}

async function invalidateRoleMemberCaches(
  roleId: string,
  tenantId: string,
): Promise<void> {
  const members = await prisma.tenantUserRole.findMany({
    where: { tenantRoleId: roleId },
    select: { membership: { select: { userId: true } } },
  });
  await Promise.all(
    members.map((member) =>
      invalidateTenantAuthorizationCache(member.membership.userId, tenantId),
    ),
  );
}

export async function listRoleMembers(
  tenantId: string,
  roleId: string,
  req: Request,
) {
  await findRoleOrThrow(tenantId, roleId);
  const query = parseListQuery(req, { maxLimit: 100 });
  const status =
    typeof query.status === "string"
      ? (query.status.toUpperCase() as UserStatus)
      : undefined;

  const userWhere: Prisma.UserWhereInput = { deletedAt: null };
  if (status && MEMBER_STATUSES.includes(status)) userWhere.status = status;
  if (query.search) {
    userWhere.OR = [
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const where: Prisma.TenantUserRoleWhereInput = {
    tenantRoleId: roleId,
    tenantId,
    membership: { user: userWhere },
  };

  const [rows, total] = await Promise.all([
    prisma.tenantUserRole.findMany({
      where,
      include: {
        membership: {
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
        },
      },
      orderBy: { assignedAt: "desc" },
      ...paginationArgs(query),
    }),
    prisma.tenantUserRole.count({ where }),
  ]);

  return {
    rows: rows.map((assignment) => ({
      assignmentId: assignment.id,
      assignedAt: assignment.assignedAt,
      membershipId: assignment.membership.id,
      ...assignment.membership.user,
    })),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

async function resolveMemberships(
  tenantId: string,
  input: { membershipIds?: string[]; userIds?: string[] },
): Promise<{ id: string; userId: string }[]> {
  const membershipIds = Array.from(new Set(input.membershipIds ?? []));
  const userIds = Array.from(new Set(input.userIds ?? []));
  if (membershipIds.length === 0 && userIds.length === 0) return [];

  const memberships = await prisma.tenantMembership.findMany({
    where: {
      tenantId,
      user: { deletedAt: null },
      OR: [
        ...(membershipIds.length > 0 ? [{ id: { in: membershipIds } }] : []),
        ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
      ],
    },
    select: { id: true, userId: true },
  });

  const resolvedIds = new Set(memberships.map((membership) => membership.id));
  const resolvedUserIds = new Set(
    memberships.map((membership) => membership.userId),
  );
  const missing = [
    ...membershipIds.filter((id) => !resolvedIds.has(id)),
    ...userIds.filter((id) => !resolvedUserIds.has(id)),
  ];
  if (missing.length > 0) {
    throw new ValidationError(
      "One or more selected members could not be found in this organization.",
    );
  }
  return memberships;
}

export async function addRoleMembers(
  tenantId: string,
  roleId: string,
  input: AddRoleMembersInput,
  actor: TenantActorContext,
) {
  await findRoleOrThrow(tenantId, roleId);
  const memberships = await resolveMemberships(tenantId, input);
  if (memberships.length === 0) return { added: 0, members: [] as string[] };

  await prisma.tenantUserRole.createMany({
    data: memberships.map((membership) => ({
      tenantId,
      membershipId: membership.id,
      tenantRoleId: roleId,
      assignedById: actor.actorId ?? null,
    })),
    skipDuplicates: true,
  });

  await Promise.all(
    memberships.map((membership) =>
      invalidateTenantAuthorizationCache(membership.userId, tenantId),
    ),
  );

  await recordAudit({
    action: "role.members.added",
    resourceType: "tenant-role",
    resourceId: roleId,
    tenantId,
    after: { membershipIds: memberships.map((membership) => membership.id) },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "role.members.added",
    tenantId,
    payload: { roleId },
  });

  return {
    added: memberships.length,
    members: memberships.map((membership) => membership.userId),
  };
}

export async function removeRoleMember(
  tenantId: string,
  roleId: string,
  membershipId: string,
  actor: TenantActorContext,
) {
  await findRoleOrThrow(tenantId, roleId);
  const assignment = await prisma.tenantUserRole.findFirst({
    where: { tenantRoleId: roleId, membershipId, tenantId },
    select: { id: true, membership: { select: { userId: true } } },
  });
  if (!assignment) throw new NotFoundError("Role member");

  await prisma.tenantUserRole.delete({ where: { id: assignment.id } });
  await invalidateTenantAuthorizationCache(
    assignment.membership.userId,
    tenantId,
  );

  await recordAudit({
    action: "role.members.removed",
    resourceType: "tenant-role",
    resourceId: roleId,
    tenantId,
    before: { membershipId },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "role.members.removed",
    tenantId,
    payload: { roleId, membershipId },
  });

  return { membershipId, removed: true as const };
}

export function getPermissionCatalog() {
  const grouped = tenantPermissionsByModule();
  return Object.entries(grouped).map(([module, items]) => ({
    module,
    count: items.length,
    items,
  }));
}

export { isProtectedTenantRole };
