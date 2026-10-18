import type { TenantStatus, UserType } from '@prisma/client';
import { prisma } from '../../config/database';
import { cache } from '../../config/redis';
import { ForbiddenError, NotFoundError, PreconditionFailedError } from '../../shared/errors';

export interface TenantMembershipSummary {
  membershipId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantStatus: TenantStatus;
  roleKeys: string[];
}

export interface TenantAuthorization {
  roles: string[];
  permissions: string[];
  activeTenantId: string | null;
  membershipId: string | null;
}

const PERMISSIONS_CACHE_TTL = 60;

interface MembershipRecord {
  id: string;
  tenantId: string;
  status: string;
  tenant: { id: string; slug: string; name: string; status: TenantStatus; deletedAt: Date | null };
  roleAssignments: {
    role: {
      key: string;
      status: string;
      deletedAt: Date | null;
      permissions: { permission: { code: string; scope: string } }[];
    };
  }[];
}

function isUsableMembership(membership: MembershipRecord): boolean {
  return (
    membership.status === 'ACTIVE' &&
    membership.tenant.deletedAt === null &&
    membership.tenant.status !== 'ARCHIVED' &&
    membership.tenant.status !== 'FAILED'
  );
}

export async function listTenantMemberships(userId: string): Promise<TenantMembershipSummary[]> {
  const memberships = (await prisma.tenantMembership.findMany({
    where: { userId, status: 'ACTIVE', tenant: { deletedAt: null } },
    include: {
      tenant: { select: { id: true, slug: true, name: true, status: true, deletedAt: true } },
      roleAssignments: {
        include: {
          role: {
            select: {
              key: true,
              status: true,
              deletedAt: true,
              permissions: { include: { permission: { select: { code: true, scope: true } } } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })) as unknown as MembershipRecord[];

  return memberships.map((membership) => ({
    membershipId: membership.id,
    tenantId: membership.tenantId,
    tenantSlug: membership.tenant.slug,
    tenantName: membership.tenant.name,
    tenantStatus: membership.tenant.status,
    roleKeys: membership.roleAssignments
      .filter((assignment) => assignment.role.status === 'ACTIVE' && assignment.role.deletedAt === null)
      .map((assignment) => assignment.role.key),
  }));
}

export interface ResolvedTenantAccess {
  activeTenantId: string;
  membershipId: string;
  tenantStatus: TenantStatus;
}

/**
 * Validates that the user has an active membership in the requested tenant.
 * Never trusts caller-supplied tenant identity on its own — the membership
 * relationship is the proof of access.
 */
export async function resolveTenantAccess(userId: string, tenantId: string): Promise<ResolvedTenantAccess> {
  const membership = (await prisma.tenantMembership.findFirst({
    where: { userId, tenantId },
    include: { tenant: { select: { status: true, deletedAt: true } } },
  })) as unknown as
    | { id: string; status: string; tenant: { status: TenantStatus; deletedAt: Date | null } }
    | null;

  if (!membership || membership.tenant.deletedAt) throw new NotFoundError('Organization');
  if (membership.status !== 'ACTIVE') throw new ForbiddenError('Your membership in this organization is not active.');
  if (membership.tenant.status === 'ARCHIVED') throw new PreconditionFailedError('This organization is archived.');
  if (membership.tenant.status === 'SUSPENDED') throw new ForbiddenError('This organization is suspended.');
  if (membership.tenant.status === 'FAILED') throw new PreconditionFailedError('This organization is not available.');

  return { activeTenantId: tenantId, membershipId: membership.id, tenantStatus: membership.tenant.status };
}

export async function loadTenantRolesAndPermissions(
  userId: string,
  tenantId: string,
): Promise<{ roles: string[]; permissions: string[]; membershipId: string | null }> {
  const cacheKey = `auth:tenant-perms:${userId}:${tenantId}`;
  const cached = await cache.getJson<{ roles: string[]; permissions: string[]; membershipId: string | null }>(cacheKey);
  if (cached) return cached;

  const memberships = (await prisma.tenantMembership.findMany({
    where: { userId, tenantId, status: 'ACTIVE' },
    include: {
      roleAssignments: {
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
        },
      },
    },
  })) as unknown as MembershipRecord[];

  const membership = memberships[0];
  const roles = new Set<string>();
  const permissions = new Set<string>();
  if (membership) {
    for (const assignment of membership.roleAssignments) {
      if (assignment.role.status !== 'ACTIVE' || assignment.role.deletedAt !== null) continue;
      roles.add(assignment.role.key);
      for (const rolePermission of assignment.role.permissions) {
        if (rolePermission.permission.scope === 'TENANT') permissions.add(rolePermission.permission.code);
      }
    }
  }

  const result = { roles: Array.from(roles), permissions: Array.from(permissions), membershipId: membership?.id ?? null };
  await cache.setJson(cacheKey, result, PERMISSIONS_CACHE_TTL);
  return result;
}

export async function invalidateTenantAuthorizationCache(userId: string, tenantId?: string): Promise<void> {
  if (tenantId) {
    await cache.del(`auth:tenant-perms:${userId}:${tenantId}`);
    return;
  }
  // Best-effort: callers that change membership globally should invalidate all
  // tenant-scoped caches for the user. Redis DEL by pattern is not guaranteed,
  // so we delete the platform cache and common tenant caches opportunistically.
  await cache.del(`auth:permissions:${userId}`);
}

/**
 * Selects the active tenant for a freshly authenticated user. Platform staff do
 * not use an active tenant. Tenant users must belong to at least one active
 * organization.
 */
export async function resolveLoginTenant(
  userId: string,
  userType: UserType,
): Promise<{ activeTenantId: string | null }> {
  if (userType !== 'TENANT_USER') return { activeTenantId: null };
  const memberships = await listTenantMemberships(userId);
  const usable = memberships.filter(
    (membership) => membership.tenantStatus !== 'ARCHIVED' && membership.tenantStatus !== 'FAILED',
  );
  if (usable.length === 0) {
    throw new ForbiddenError('Your account is not a member of any active organization.');
  }
  return { activeTenantId: usable[0]!.tenantId };
}
