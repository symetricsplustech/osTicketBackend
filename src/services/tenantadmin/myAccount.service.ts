import { prisma } from "../../config/database";
import { UnauthorizedError } from "../../shared/errors";
import {
  listTenantMemberships,
  loadTenantRolesAndPermissions,
} from "../auth/tenant-access.service";
import {
  getPreferences as getUserPreferences,
  getProfile as getUserProfile,
  getSecurity as getUserSecurity,
  updatePreferences as updateUserPreferences,
  updateProfile as updateUserProfile,
} from "../saasadmin/my-account.service";
import type { TenantActor } from "../../controllers/tenantadmin/actor";
import type {
  UpdatePreferencesInput,
  UpdateProfileInput,
} from "../../validators/tenantadmin/myAccount.validators";

/**
 * Self-service account surface for a signed-in member of the active
 * organization. Profile and preferences live on the shared `User` record;
 * organization context (roles, memberships) is layered on top.
 */
export async function getMyAccount(actor: TenantActor) {
  const [profile, preferences, access, memberships] = await Promise.all([
    getUserProfile(actor.actorId),
    getUserPreferences(actor.actorId),
    loadTenantRolesAndPermissions(actor.actorId, actor.tenantId),
    listTenantMemberships(actor.actorId),
  ]);
  return {
    profile: profile.profile,
    tenantRoles: access.roles,
    permissions: access.permissions,
    preferences,
    memberships: memberships.filter(
      (membership) => membership.tenantId === actor.tenantId,
    ),
  };
}

export async function updateMyProfile(
  actor: TenantActor,
  input: UpdateProfileInput,
) {
  return updateUserProfile(actor.actorId, input, actor.req);
}

export async function getMyPreferences(actor: TenantActor) {
  return getUserPreferences(actor.actorId);
}

export async function updateMyPreferences(
  actor: TenantActor,
  input: UpdatePreferencesInput,
) {
  return updateUserPreferences(actor.actorId, input, actor.req);
}

export async function getMySecurity(actor: TenantActor) {
  return getUserSecurity(actor.actorId);
}

export async function getMyRecentActivity(actor: TenantActor, limit = 20) {
  const take = Math.min(Math.max(limit, 1), 100);
  const [auditEvents, loginEvents] = await Promise.all([
    prisma.auditEvent.findMany({
      where: { tenantId: actor.tenantId, actorId: actor.actorId },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.loginEvent.findMany({
      where: { userId: actor.actorId },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);
  return {
    auditEvents: auditEvents.map((event) => ({
      id: event.id,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      outcome: event.outcome,
      createdAt: event.createdAt,
    })),
    logins: loginEvents.map((event) => ({
      outcome: event.outcome,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      createdAt: event.createdAt,
    })),
  };
}

/** Ensures the acting user still belongs to the active organization. */
export async function assertActiveMembership(
  actor: TenantActor,
): Promise<void> {
  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId: actor.tenantId, userId: actor.actorId },
  });
  if (!membership)
    throw new UnauthorizedError(
      "No active organization membership for this account.",
    );
}
