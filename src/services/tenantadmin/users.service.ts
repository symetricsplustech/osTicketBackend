import type { Prisma, UserStatus } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import {
  ConflictError,
  ForbiddenError,
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
import { hashPassword } from "../../shared/utils/passwords";
import { randomToken, sha256 } from "../../shared/utils/crypto";
import { normaliseEmail } from "../../shared/utils/sanitize";
import { emailTemplates } from "../../shared/email/templates";
import { sendEmail } from "../../shared/email";
import { revokeAllUserSessions } from "../auth/session.service";
import { requestPasswordReset } from "../auth/password.service";
import { invalidateTenantAuthorizationCache } from "../auth/tenant-access.service";
import type { TenantActorContext } from "./roles.service";
import type {
  ImportTenantUsersInput,
  InviteTenantUserInput,
  SetTenantUserRolesInput,
  UpdateTenantUserInput,
} from "../../validators/tenantadmin/users.validators";

const ORG_ADMIN_ROLE_KEY = "org-admin";
const INVITATION_TTL_HOURS = 72;
const MEMBER_STATUSES: string[] = [
  "INVITED",
  "ACTIVE",
  "SUSPENDED",
  "DEACTIVATED",
];

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  phone: true,
  avatarUrl: true,
  jobTitle: true,
  timezone: true,
  locale: true,
  userType: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  mfaEnabled: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const MEMBERSHIP_INCLUDE = {
  user: { select: USER_SELECT },
  roleAssignments: {
    where: { role: { deletedAt: null } },
    select: {
      id: true,
      assignedAt: true,
      role: {
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          isSystem: true,
          status: true,
        },
      },
    },
    orderBy: { assignedAt: "asc" },
  },
} satisfies Prisma.TenantMembershipInclude;

type MembershipWithRelations = Prisma.TenantMembershipGetPayload<{
  include: typeof MEMBERSHIP_INCLUDE;
}>;

function serializeMembership(membership: MembershipWithRelations) {
  return {
    ...membership.user,
    membershipId: membership.id,
    membershipStatus: membership.status,
    status: membership.status,
    joinedAt: membership.joinedAt,
    invitedAt: membership.createdAt,
    roles: membership.roleAssignments.map((assignment) => assignment.role),
    roleIds: membership.roleAssignments.map((assignment) => assignment.role.id),
  };
}

function buildAcceptUrl(token: string): string {
  return `${env.ADMIN_APP_URL.replace(/\/$/, "")}/accept-invitation?token=${encodeURIComponent(token)}`;
}

async function findMembershipOrThrow(
  tenantId: string,
  userId: string,
): Promise<MembershipWithRelations> {
  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId, userId, user: { deletedAt: null } },
    include: MEMBERSHIP_INCLUDE,
  });
  if (!membership) throw new NotFoundError("User");
  return membership;
}

async function assertTenantRoles(tenantId: string, roleIds: string[]) {
  const unique = Array.from(new Set(roleIds));
  if (unique.length === 0) return [];
  const roles = await prisma.tenantRole.findMany({
    where: { id: { in: unique }, tenantId, deletedAt: null },
    select: { id: true, key: true },
  });
  if (roles.length !== unique.length) {
    throw new ConflictError(
      "One or more of the selected roles could not be found in this organization.",
    );
  }
  return roles;
}

async function assertNotLastOrgAdmin(
  tenantId: string,
  userId: string,
): Promise<void> {
  const orgAdminRole = await prisma.tenantRole.findFirst({
    where: { tenantId, key: ORG_ADMIN_ROLE_KEY, deletedAt: null },
    select: { id: true },
  });
  if (!orgAdminRole) return;

  const assignment = await prisma.tenantUserRole.findFirst({
    where: { tenantRoleId: orgAdminRole.id, membership: { userId } },
    select: { id: true },
  });
  if (!assignment) return;

  const otherAdmins = await prisma.tenantUserRole.count({
    where: {
      tenantRoleId: orgAdminRole.id,
      membership: { userId: { not: userId }, status: "ACTIVE" },
    },
  });
  if (otherAdmins === 0) {
    throw new PreconditionFailedError(
      "The last organization administrator cannot be suspended or deactivated.",
    );
  }
}

export async function listUsers(tenantId: string, req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const status =
    typeof query.status === "string" ? query.status.toUpperCase() : undefined;
  const roleId =
    typeof query.roleId === "string" && query.roleId ? query.roleId : undefined;

  const userWhere: Prisma.UserWhereInput = { deletedAt: null };
  if (query.search) {
    userWhere.OR = [
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const where: Prisma.TenantMembershipWhereInput = {
    tenantId,
    user: userWhere,
    ...(status && MEMBER_STATUSES.includes(status) ? { status } : {}),
    ...(roleId ? { roleAssignments: { some: { tenantRoleId: roleId } } } : {}),
  };

  const orderBy = buildOrderBy<Prisma.TenantMembershipOrderByWithRelationInput>(
    query,
    ["status", "createdAt", "joinedAt"],
    { createdAt: "desc" },
  );

  const [rows, total] = await Promise.all([
    prisma.tenantMembership.findMany({
      where,
      orderBy,
      ...paginationArgs(query),
      include: MEMBERSHIP_INCLUDE,
    }),
    prisma.tenantMembership.count({ where }),
  ]);

  return {
    rows: rows.map(serializeMembership),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getUser(tenantId: string, userId: string) {
  const membership = await findMembershipOrThrow(tenantId, userId);
  const [recentLogins, activeSessions] = await Promise.all([
    prisma.loginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        outcome: true,
        failureReason: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    }),
    prisma.session.count({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);

  return { ...serializeMembership(membership), recentLogins, activeSessions };
}

/**
 * Platform staff accounts live in a separate identity tier and are never
 * loaded with tenant roles at request time — granting them a membership
 * would be silently ignored. Reject early with a clear error instead.
 */
export function assertNotPlatformStaff(
  existingUser: { userType: string } | null,
): void {
  if (existingUser?.userType === "PLATFORM_STAFF") {
    throw new ValidationError(
      "This email belongs to a platform staff account. Platform staff accounts cannot join organizations.",
      [
        {
          field: "email",
          message: "Use a different email address for organization members.",
          code: "INVALID_USER_TYPE",
        },
      ],
    );
  }
}

export async function inviteUser(
  tenantId: string,
  input: InviteTenantUserInput,
  actor: TenantActorContext,
) {
  const email = normaliseEmail(input.email);
  const roles = await assertTenantRoles(tenantId, input.roleIds);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser?.deletedAt)
    throw new ConflictError("A user with this email address already exists.");
  assertNotPlatformStaff(existingUser);

  const existingMembership = existingUser
    ? await prisma.tenantMembership.findFirst({
        where: { tenantId, userId: existingUser.id },
        select: { id: true },
      })
    : null;
  if (existingMembership)
    throw new ConflictError(
      "This user is already a member of the organization.",
    );

  const invitationToken = randomToken(32);
  const tokenHash = sha256(invitationToken);
  const invitationExpiresAt = new Date(
    Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000,
  );
  const placeholderPasswordHash = await hashPassword(randomToken(32));

  const { user, membership } = await prisma.$transaction(
    async (tx) => {
      const createdUser = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              firstName: existingUser.firstName || input.firstName,
              lastName: existingUser.lastName || input.lastName,
              displayName:
                existingUser.displayName ||
                `${input.firstName} ${input.lastName}`.trim(),
              ...(input.jobTitle !== undefined && !existingUser.jobTitle
                ? { jobTitle: input.jobTitle }
                : {}),
              ...(input.phone !== undefined && !existingUser.phone
                ? { phone: input.phone }
                : {}),
            },
            select: USER_SELECT,
          })
        : await tx.user.create({
            data: {
              email,
              passwordHash: placeholderPasswordHash,
              firstName: input.firstName,
              lastName: input.lastName,
              displayName: `${input.firstName} ${input.lastName}`.trim(),
              phone: input.phone ?? null,
              jobTitle: input.jobTitle ?? null,
              userType: "TENANT_USER",
              status: "INVITED",
              invitationTokenHash: tokenHash,
              invitationExpiresAt,
              createdById: actor.actorId ?? null,
            },
            select: USER_SELECT,
          });

      const createdMembership = await tx.tenantMembership.create({
        data: {
          tenantId,
          userId: createdUser.id,
          status: "INVITED",
          invitedById: actor.actorId ?? null,
        },
        include: MEMBERSHIP_INCLUDE,
      });

      if (roles.length > 0) {
        await tx.tenantUserRole.createMany({
          data: roles.map((role) => ({
            tenantId,
            membershipId: createdMembership.id,
            tenantRoleId: role.id,
            assignedById: actor.actorId ?? null,
          })),
          skipDuplicates: true,
        });
      }

      await tx.invitation.create({
        data: {
          tenantId,
          email,
          roleKey: roles[0]?.key ?? null,
          tokenHash,
          invitedById: actor.actorId ?? null,
          expiresAt: invitationExpiresAt,
        },
      });

      return { user: createdUser, membership: createdMembership };
    },
    { timeout: 15_000, maxWait: 10_000 },
  );

  const invitedBy = actor.actorEmail ?? "Your organization administrator";
  const delivery = await sendEmail({
    to: user.email,
    ...emailTemplates.invitation({
      name: user.firstName,
      invitedBy,
      acceptUrl: buildAcceptUrl(invitationToken),
    }),
    tenantId,
    metadata: { userId: user.id, tenantId },
  });

  await recordAudit({
    action: "tenant.user.invited",
    resourceType: "tenant-membership",
    resourceId: membership.id,
    tenantId,
    after: {
      ...serializeMembership(membership),
      invitationExpiresAt: invitationExpiresAt.toISOString(),
    },
    metadata: { emailStatus: delivery.status },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "tenant.user.invited",
    tenantId,
    payload: { userId: user.id, email: user.email },
  });

  return {
    membershipId: membership.id,
    userId: user.id,
    email: user.email,
    invitationEmailStatus: delivery.status,
  };
}

export async function updateUser(
  tenantId: string,
  userId: string,
  input: UpdateTenantUserInput,
  actor: TenantActorContext,
) {
  const existing = await findMembershipOrThrow(tenantId, userId);

  const data: Prisma.UserUpdateInput = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.firstName !== undefined || input.lastName !== undefined) {
    data.displayName =
      `${input.firstName ?? existing.user.firstName} ${input.lastName ?? existing.user.lastName}`.trim();
  }
  if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.locale !== undefined) data.locale = input.locale;

  await prisma.user.update({ where: { id: userId }, data });
  const updated = await findMembershipOrThrow(tenantId, userId);

  await recordAudit({
    action: "tenant.user.updated",
    resourceType: "tenant-membership",
    resourceId: existing.id,
    tenantId,
    before: serializeMembership(existing),
    after: serializeMembership(updated),
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });

  return serializeMembership(updated);
}

async function setMembershipStatus(
  tenantId: string,
  userId: string,
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED",
  action: string,
  actor: TenantActorContext,
  reason?: string,
) {
  if (actor.actorId && actor.actorId === userId) {
    throw new ForbiddenError(
      `You cannot ${action.replace("tenant.user.", "")} your own account.`,
    );
  }

  const existing = await findMembershipOrThrow(tenantId, userId);
  if (existing.status === status) {
    throw new PreconditionFailedError(
      `This member is already ${status.toLowerCase()}.`,
    );
  }

  if (status !== "ACTIVE") {
    await assertNotLastOrgAdmin(tenantId, userId);
  }

  await prisma.tenantMembership.update({
    where: { id: existing.id },
    data: {
      status,
      ...(status === "ACTIVE" && !existing.joinedAt
        ? { joinedAt: new Date() }
        : {}),
    },
  });

  let revokedSessions = 0;
  if (status !== "ACTIVE") {
    revokedSessions = await revokeAllUserSessions(userId, {
      reason: `TENANT_MEMBER_${status}`,
    });
  }

  await invalidateTenantAuthorizationCache(userId, tenantId);

  const updated = await findMembershipOrThrow(tenantId, userId);
  await recordAudit({
    action,
    resourceType: "tenant-membership",
    resourceId: existing.id,
    tenantId,
    before: { status: existing.status },
    after: { status },
    metadata: { reason: reason ?? null, revokedSessions },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: action,
    tenantId,
    payload: { userId, status },
  });

  return serializeMembership(updated);
}

export function activateUser(
  tenantId: string,
  userId: string,
  actor: TenantActorContext,
) {
  return setMembershipStatus(
    tenantId,
    userId,
    "ACTIVE",
    "tenant.user.activated",
    actor,
  );
}

export function suspendUser(
  tenantId: string,
  userId: string,
  actor: TenantActorContext,
  reason?: string,
) {
  return setMembershipStatus(
    tenantId,
    userId,
    "SUSPENDED",
    "tenant.user.suspended",
    actor,
    reason,
  );
}

export function deactivateUser(
  tenantId: string,
  userId: string,
  actor: TenantActorContext,
  reason?: string,
) {
  return setMembershipStatus(
    tenantId,
    userId,
    "DEACTIVATED",
    "tenant.user.deactivated",
    actor,
    reason,
  );
}

export async function resetUserPassword(
  tenantId: string,
  userId: string,
  actor: TenantActorContext,
) {
  const existing = await findMembershipOrThrow(tenantId, userId);
  if (existing.status === "DEACTIVATED") {
    throw new PreconditionFailedError(
      "Deactivated members cannot receive password reset emails.",
    );
  }

  await requestPasswordReset(existing.user.email, actor.req!);
  await recordAudit({
    action: "tenant.user.password_reset.requested",
    resourceType: "tenant-membership",
    resourceId: existing.id,
    tenantId,
    metadata: { email: existing.user.email },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });

  return { userId, email: existing.user.email };
}

export async function revokeUserSessions(
  tenantId: string,
  userId: string,
  actor: TenantActorContext,
) {
  const existing = await findMembershipOrThrow(tenantId, userId);
  const revokedSessions = await revokeAllUserSessions(userId, {
    reason: "TENANT_ADMIN_REVOKED",
  });

  await recordAudit({
    action: "tenant.user.sessions.revoked",
    resourceType: "tenant-membership",
    resourceId: existing.id,
    tenantId,
    metadata: { revokedSessions },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });

  return { userId, email: existing.user.email, revokedSessions };
}

export async function getUserRoles(tenantId: string, userId: string) {
  const membership = await findMembershipOrThrow(tenantId, userId);
  return membership.roleAssignments.map((assignment) => ({
    assignmentId: assignment.id,
    assignedAt: assignment.assignedAt,
    ...assignment.role,
  }));
}

export async function setUserRoles(
  tenantId: string,
  userId: string,
  input: SetTenantUserRolesInput,
  actor: TenantActorContext,
) {
  const existing = await findMembershipOrThrow(tenantId, userId);
  const roles = await assertTenantRoles(tenantId, input.roleIds);

  const currentKeys = existing.roleAssignments.map(
    (assignment) => assignment.role.key,
  );
  const nextKeys = roles.map((role) => role.key);

  const adminRemoved =
    currentKeys.includes(ORG_ADMIN_ROLE_KEY) &&
    !nextKeys.includes(ORG_ADMIN_ROLE_KEY);
  if (adminRemoved) {
    await assertNotLastOrgAdmin(tenantId, userId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenantUserRole.deleteMany({
      where: { membershipId: existing.id },
    });
    if (roles.length > 0) {
      await tx.tenantUserRole.createMany({
        data: roles.map((role) => ({
          tenantId,
          membershipId: existing.id,
          tenantRoleId: role.id,
          assignedById: actor.actorId ?? null,
        })),
        skipDuplicates: true,
      });
    }
  });

  await invalidateTenantAuthorizationCache(userId, tenantId);

  const updated = await findMembershipOrThrow(tenantId, userId);
  await recordAudit({
    action: "tenant.user.roles.changed",
    resourceType: "tenant-membership",
    resourceId: existing.id,
    tenantId,
    before: { roles: currentKeys },
    after: { roles: nextKeys },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "tenant.user.roles.changed",
    tenantId,
    payload: { userId, roleKeys: nextKeys },
  });

  return getUserRoles(tenantId, userId);
}

export async function listUserActivity(
  tenantId: string,
  userId: string,
  req: Request,
) {
  await findMembershipOrThrow(tenantId, userId);
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.AuditEventWhereInput = { actorId: userId, tenantId };

  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginationArgs(query),
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        outcome: true,
        before: true,
        after: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        requestId: true,
        createdAt: true,
      },
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function listInvitations(tenantId: string, req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const status =
    typeof query.status === "string" ? query.status.toUpperCase() : undefined;

  const where: Prisma.InvitationWhereInput = {
    tenantId,
    ...(status
      ? { status: status as "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED" }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.invitation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginationArgs(query),
      select: {
        id: true,
        email: true,
        roleKey: true,
        status: true,
        invitedById: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    }),
    prisma.invitation.count({ where }),
  ]);

  return { rows, meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function revokeInvitation(
  tenantId: string,
  invitationId: string,
  actor: TenantActorContext,
) {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, tenantId },
  });
  if (!invitation) throw new NotFoundError("Invitation");
  if (invitation.status !== "PENDING") {
    throw new PreconditionFailedError(
      "Only pending invitations can be revoked.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.invitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    const user = await tx.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });
    if (user) {
      await tx.tenantMembership.updateMany({
        where: { tenantId, userId: user.id, status: "INVITED" },
        data: { status: "DEACTIVATED" },
      });
    }
  });

  await recordAudit({
    action: "tenant.invitation.revoked",
    resourceType: "invitation",
    resourceId: invitationId,
    tenantId,
    before: { status: invitation.status },
    after: { status: "REVOKED" },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });

  return { invitationId, status: "REVOKED" as const };
}

export interface ImportUserFailure {
  email: string;
  reason: string;
}

export interface ImportUsersResult {
  created: number;
  skipped: number;
  failed: ImportUserFailure[];
  userIds: string[];
}

export async function importUsers(
  tenantId: string,
  input: ImportTenantUsersInput,
  actor: TenantActorContext,
): Promise<ImportUsersResult> {
  const defaultRoles = await assertTenantRoles(
    tenantId,
    input.defaultRoleIds ?? [],
  );
  const sendInvitations = input.sendInvitations ?? false;
  const result: ImportUsersResult = {
    created: 0,
    skipped: 0,
    failed: [],
    userIds: [],
  };

  for (const row of input.users) {
    const email = normaliseEmail(row.email);
    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser?.deletedAt) {
        result.failed.push({
          email,
          reason: "A user with this email address already exists.",
        });
        continue;
      }
      if (existingUser?.userType === "PLATFORM_STAFF") {
        result.failed.push({
          email,
          reason:
            "This email belongs to a platform staff account and cannot be imported.",
        });
        continue;
      }

      const existingMembership = existingUser
        ? await prisma.tenantMembership.findFirst({
            where: { tenantId, userId: existingUser.id },
            select: { id: true },
          })
        : null;
      if (existingMembership) {
        result.skipped += 1;
        continue;
      }

      const roles =
        row.roleIds && row.roleIds.length > 0
          ? await assertTenantRoles(tenantId, row.roleIds)
          : defaultRoles;

      const invitationToken = sendInvitations ? randomToken(32) : null;
      const tokenHash = invitationToken ? sha256(invitationToken) : null;
      const invitationExpiresAt = new Date(
        Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000,
      );
      const placeholderPasswordHash = await hashPassword(randomToken(32));

      const { userId, membershipId } = await prisma.$transaction(
        async (tx) => {
          const createdUser = existingUser
            ? await tx.user.update({
                where: { id: existingUser.id },
                data: {
                  firstName: existingUser.firstName || row.firstName,
                  lastName: existingUser.lastName || row.lastName,
                  displayName:
                    existingUser.displayName ||
                    `${row.firstName} ${row.lastName}`.trim(),
                  ...(row.jobTitle !== undefined && !existingUser.jobTitle
                    ? { jobTitle: row.jobTitle }
                    : {}),
                  ...(row.phone !== undefined && !existingUser.phone
                    ? { phone: row.phone }
                    : {}),
                },
                select: { id: true },
              })
            : await tx.user.create({
                data: {
                  email,
                  passwordHash: placeholderPasswordHash,
                  firstName: row.firstName,
                  lastName: row.lastName,
                  displayName: `${row.firstName} ${row.lastName}`.trim(),
                  phone: row.phone ?? null,
                  jobTitle: row.jobTitle ?? null,
                  userType: "TENANT_USER",
                  status: "INVITED",
                  invitationTokenHash: tokenHash,
                  invitationExpiresAt: tokenHash ? invitationExpiresAt : null,
                  createdById: actor.actorId ?? null,
                },
                select: { id: true },
              });

          const membership = await tx.tenantMembership.create({
            data: {
              tenantId,
              userId: createdUser.id,
              status: "INVITED",
              invitedById: actor.actorId ?? null,
            },
            select: { id: true },
          });

          if (roles.length > 0) {
            await tx.tenantUserRole.createMany({
              data: roles.map((role) => ({
                tenantId,
                membershipId: membership.id,
                tenantRoleId: role.id,
                assignedById: actor.actorId ?? null,
              })),
              skipDuplicates: true,
            });
          }

          if (tokenHash) {
            await tx.invitation.create({
              data: {
                tenantId,
                email,
                roleKey: roles[0]?.key ?? null,
                tokenHash,
                invitedById: actor.actorId ?? null,
                expiresAt: invitationExpiresAt,
              },
            });
          }

          return { userId: createdUser.id, membershipId: membership.id };
        },
        { timeout: 15_000, maxWait: 10_000 },
      );

      if (sendInvitations && invitationToken) {
        await sendEmail({
          to: email,
          ...emailTemplates.invitation({
            name: row.firstName,
            invitedBy: actor.actorEmail ?? "Your organization administrator",
            acceptUrl: buildAcceptUrl(invitationToken),
          }),
          metadata: { userId, tenantId },
        });
      }

      result.created += 1;
      result.userIds.push(userId);
    } catch (error) {
      result.failed.push({
        email,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  await recordAudit({
    action: "tenant.users.imported",
    resourceType: "tenant-membership",
    resourceId: null,
    tenantId,
    after: {
      created: result.created,
      skipped: result.skipped,
      failed: result.failed.length,
      sendInvitations,
    },
    metadata: { failed: result.failed.slice(0, 25) },
    actorId: actor.actorId ?? null,
    actorEmail: actor.actorEmail ?? null,
    actorType: actor.actorType ?? "TENANT_USER",
    req: actor.req,
  });
  void publishEvent({
    eventKey: "tenant.users.imported",
    tenantId,
    payload: {
      created: result.created,
      skipped: result.skipped,
      failed: result.failed.length,
    },
  });

  return result;
}

export type { UserStatus };
