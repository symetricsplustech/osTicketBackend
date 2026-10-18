import type { Prisma, UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { ConflictError, ForbiddenError, NotFoundError, PreconditionFailedError } from '../../shared/errors';
import { buildOrderBy, buildPaginationMeta, paginationArgs, parseListQuery } from '../../shared/pagination';
import { recordAudit } from '../../shared/audit';
import { publishEvent } from '../../shared/events';
import { hashPassword } from '../../shared/utils/passwords';
import { randomToken, sha256 } from '../../shared/utils/crypto';
import { normaliseEmail } from '../../shared/utils/sanitize';
import { emailTemplates } from '../../shared/email/templates';
import { sendEmail } from '../../shared/email';
import { assertPermission } from '../../shared/permissions/guard';
import { invalidatePermissionCache, loadPermissions } from '../../api/middleware/authenticate';
import { listUserSessions, revokeAllUserSessions, revokeSession } from '../auth/session.service';
import { requestPasswordReset } from '../auth/password.service';
import type {
  CreateStaffInput,
  ReplaceStaffRolesInput,
  UpdateStaffInput,
} from '../../validators/saasadmin/staff.validators';

const OWNER_ROLE_KEY = 'platform-owner';
const INVITATION_TTL_HOURS = 72;
const STAFF_STATUSES: UserStatus[] = ['INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

export interface ActorContext {
  actorId?: string | null;
  req?: Request;
}

const STAFF_SELECT = {
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
  lockedUntil: true,
  createdAt: true,
  updatedAt: true,
  staffRoleAssignments: {
    where: { role: { deletedAt: null } },
    select: {
      id: true,
      roleId: true,
      assignedAt: true,
      role: { select: { id: true, key: true, name: true, description: true, isSystem: true } },
    },
    orderBy: { assignedAt: 'asc' },
  },
} satisfies Prisma.UserSelect;

type StaffRecord = Prisma.UserGetPayload<{ select: typeof STAFF_SELECT }>;

function serializeStaff(staff: StaffRecord) {
  const { staffRoleAssignments, ...rest } = staff;
  return {
    ...rest,
    roles: staffRoleAssignments.map((assignment) => assignment.role),
    roleIds: staffRoleAssignments.map((assignment) => assignment.roleId),
    roleAssignments: staffRoleAssignments.map((assignment) => ({
      id: assignment.id,
      roleId: assignment.roleId,
      assignedAt: assignment.assignedAt,
      role: assignment.role,
    })),
  };
}

async function findStaffOrThrow(staffId: string): Promise<StaffRecord> {
  const staff = await prisma.user.findFirst({
    where: { id: staffId, userType: 'PLATFORM_STAFF', deletedAt: null },
    select: STAFF_SELECT,
  });
  if (!staff) throw new NotFoundError('Staff member');
  return staff;
}

function buildAcceptUrl(token: string): string {
  return `${env.ADMIN_APP_URL.replace(/\/$/, '')}/accept-invitation?token=${encodeURIComponent(token)}`;
}

async function assertRolesExist(roleIds: string[]): Promise<{ id: string; key: string }[]> {
  if (roleIds.length === 0) return [];
  const roles = await prisma.platformRole.findMany({
    where: { id: { in: roleIds }, deletedAt: null },
    select: { id: true, key: true },
  });
  if (roles.length !== roleIds.length) {
    throw new ConflictError('One or more of the selected roles could not be found.');
  }
  return roles;
}

export async function assertNotLastPlatformOwner(userId: string): Promise<void> {
  const ownerRole = await prisma.platformRole.findFirst({
    where: { key: OWNER_ROLE_KEY, deletedAt: null },
    select: { id: true },
  });
  if (!ownerRole) return;

  const assignment = await prisma.staffRoleAssignment.findFirst({
    where: { userId, roleId: ownerRole.id },
    select: { id: true },
  });
  if (!assignment) return;

  const otherOwners = await prisma.staffRoleAssignment.count({
    where: {
      roleId: ownerRole.id,
      userId: { not: userId },
      user: { deletedAt: null, status: 'ACTIVE' },
    },
  });
  if (otherOwners === 0) {
    throw new PreconditionFailedError('The last platform owner cannot be removed, suspended or deactivated.');
  }
}

export async function listStaff(req: Request) {
  const query = parseListQuery(req, { maxLimit: 100 });
  const status = typeof query.status === 'string' ? (query.status.toUpperCase() as UserStatus) : undefined;

  const where: Prisma.UserWhereInput = {
    userType: 'PLATFORM_STAFF',
    deletedAt: null,
    ...(status && STAFF_STATUSES.includes(status) ? { status } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const orderBy = buildOrderBy<Prisma.UserOrderByWithRelationInput>(
    query,
    ['firstName', 'lastName', 'email', 'status', 'createdAt', 'lastLoginAt'],
    { createdAt: 'desc' },
  );

  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy, ...paginationArgs(query), select: STAFF_SELECT }),
    prisma.user.count({ where }),
  ]);

  return { rows: rows.map(serializeStaff), meta: buildPaginationMeta(query.page, query.limit, total) };
}

export async function createStaff(input: CreateStaffInput, actor: ActorContext) {
  const email = normaliseEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError('A user with this email address already exists.');

  const roleIds = Array.from(new Set(input.roleIds));
  const roles = await assertRolesExist(roleIds);

  const invitationToken = randomToken(32);
  const passwordHash = await hashPassword(randomToken(32));
  const invitationExpiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);

  const staff = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: `${input.firstName} ${input.lastName}`.trim(),
        phone: input.phone ?? null,
        jobTitle: input.jobTitle ?? null,
        timezone: input.timezone ?? 'UTC',
        locale: input.locale ?? 'en-US',
        userType: 'PLATFORM_STAFF',
        status: 'INVITED',
        invitationTokenHash: sha256(invitationToken),
        invitationExpiresAt,
        createdById: actor.actorId ?? null,
      },
      select: { id: true },
    });

    if (roles.length > 0) {
      await tx.staffRoleAssignment.createMany({
        data: roles.map((role) => ({ userId: created.id, roleId: role.id, assignedById: actor.actorId ?? null })),
        skipDuplicates: true,
      });
    }

    return tx.user.findUniqueOrThrow({ where: { id: created.id }, select: STAFF_SELECT });
  });

  const invitedBy = actor.req?.auth?.email ?? 'The platform team';
  const delivery = await sendEmail({
    to: staff.email,
    ...emailTemplates.invitation({ name: staff.firstName, invitedBy, acceptUrl: buildAcceptUrl(invitationToken) }),
    metadata: { staffId: staff.id },
  });

  await recordAudit({
    action: 'staff.created',
    resourceType: 'user',
    resourceId: staff.id,
    after: {
      ...serializeStaff(staff),
      invitationExpiresAt: invitationExpiresAt.toISOString(),
      invitationEmailStatus: delivery.status,
    },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({
    eventKey: 'staff.created',
    payload: { staffId: staff.id, email: staff.email, roleKeys: roles.map((role) => role.key) },
  });

  return { staff: serializeStaff(staff), invitationEmailStatus: delivery.status };
}

export async function getStaff(staffId: string) {
  const staff = await findStaffOrThrow(staffId);
  const [recentLogins, activeSessions] = await Promise.all([
    prisma.loginEvent.findMany({
      where: { userId: staffId },
      orderBy: { createdAt: 'desc' },
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
      where: { userId: staffId, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);

  return { ...serializeStaff(staff), recentLogins, activeSessions };
}

export async function updateStaff(staffId: string, input: UpdateStaffInput, actor: ActorContext) {
  const existing = await findStaffOrThrow(staffId);

  const data: Prisma.UserUpdateInput = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.displayName !== undefined) {
    data.displayName = input.displayName && input.displayName.length > 0 ? input.displayName : null;
  } else if (input.firstName !== undefined || input.lastName !== undefined) {
    data.displayName = `${input.firstName ?? existing.firstName} ${input.lastName ?? existing.lastName}`.trim();
  }
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle;
  if (input.timezone !== undefined) data.timezone = input.timezone;
  if (input.locale !== undefined) data.locale = input.locale;

  const updated = await prisma.user.update({ where: { id: staffId }, data, select: STAFF_SELECT });

  await recordAudit({
    action: 'staff.updated',
    resourceType: 'user',
    resourceId: staffId,
    before: serializeStaff(existing),
    after: serializeStaff(updated),
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return serializeStaff(updated);
}

export async function resendInvitation(staffId: string, actor: ActorContext) {
  const existing = await findStaffOrThrow(staffId);
  if (existing.status !== 'INVITED') {
    throw new PreconditionFailedError('Only staff members with a pending invitation can be re-invited.');
  }

  const invitationToken = randomToken(32);
  const invitationExpiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: staffId },
    data: { invitationTokenHash: sha256(invitationToken), invitationExpiresAt },
  });

  const invitedBy = actor.req?.auth?.email ?? 'The platform team';
  const delivery = await sendEmail({
    to: existing.email,
    ...emailTemplates.invitation({ name: existing.firstName, invitedBy, acceptUrl: buildAcceptUrl(invitationToken) }),
    metadata: { staffId },
  });

  await recordAudit({
    action: 'staff.invitation.resent',
    resourceType: 'user',
    resourceId: staffId,
    metadata: { emailStatus: delivery.status, invitationExpiresAt: invitationExpiresAt.toISOString() },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return {
    staffId,
    email: existing.email,
    invitationExpiresAt,
    invitationEmailStatus: delivery.status,
  };
}

export async function activateStaff(staffId: string, actor: ActorContext) {
  const existing = await findStaffOrThrow(staffId);
  if (existing.status === 'ACTIVE') throw new PreconditionFailedError('This staff member is already active.');
  if (existing.status === 'DEACTIVATED') {
    throw new PreconditionFailedError('Deactivated staff members cannot be activated.');
  }

  const updated = await prisma.user.update({
    where: { id: staffId },
    data: {
      status: 'ACTIVE',
      lockedUntil: null,
      failedLoginAttempts: 0,
      ...(existing.status === 'INVITED' ? { invitationTokenHash: null, invitationExpiresAt: null } : {}),
    },
    select: STAFF_SELECT,
  });

  await recordAudit({
    action: 'staff.activated',
    resourceType: 'user',
    resourceId: staffId,
    before: { status: existing.status },
    after: { status: 'ACTIVE' },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({ eventKey: 'staff.activated', payload: { staffId, email: updated.email } });

  return serializeStaff(updated);
}

export async function suspendStaff(staffId: string, actor: ActorContext) {
  if (actor.actorId && actor.actorId === staffId) {
    throw new ForbiddenError('You cannot suspend your own account.');
  }

  const existing = await findStaffOrThrow(staffId);
  if (existing.status === 'SUSPENDED') throw new PreconditionFailedError('This staff member is already suspended.');
  if (existing.status === 'DEACTIVATED') {
    throw new PreconditionFailedError('Deactivated staff members cannot be suspended.');
  }

  await assertNotLastPlatformOwner(staffId);

  const updated = await prisma.user.update({
    where: { id: staffId },
    data: { status: 'SUSPENDED' },
    select: STAFF_SELECT,
  });
  const revokedSessions = await revokeAllUserSessions(staffId, { reason: 'STAFF_SUSPENDED' });

  await recordAudit({
    action: 'staff.suspended',
    resourceType: 'user',
    resourceId: staffId,
    before: { status: existing.status },
    after: { status: 'SUSPENDED' },
    metadata: { revokedSessions },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({ eventKey: 'staff.suspended', payload: { staffId, email: updated.email } });

  return serializeStaff(updated);
}

export async function deactivateStaff(staffId: string, actor: ActorContext) {
  if (actor.actorId && actor.actorId === staffId) {
    throw new ForbiddenError('You cannot deactivate your own account.');
  }

  const existing = await findStaffOrThrow(staffId);
  if (existing.status === 'DEACTIVATED') {
    throw new PreconditionFailedError('This staff member is already deactivated.');
  }

  await assertNotLastPlatformOwner(staffId);

  const updated = await prisma.user.update({
    where: { id: staffId },
    data: { status: 'DEACTIVATED' },
    select: STAFF_SELECT,
  });
  const revokedSessions = await revokeAllUserSessions(staffId, { reason: 'STAFF_DEACTIVATED' });

  await recordAudit({
    action: 'staff.deactivated',
    resourceType: 'user',
    resourceId: staffId,
    before: { status: existing.status },
    after: { status: 'DEACTIVATED' },
    metadata: { revokedSessions },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({ eventKey: 'staff.deactivated', payload: { staffId, email: updated.email } });

  return serializeStaff(updated);
}

export async function resetStaffPassword(staffId: string, req: Request) {
  const staff = await findStaffOrThrow(staffId);
  if (staff.status === 'DEACTIVATED') {
    throw new PreconditionFailedError('Deactivated staff members cannot receive password reset emails.');
  }

  await requestPasswordReset(staff.email, req);
  await recordAudit({
    action: 'staff.password_reset.requested',
    resourceType: 'user',
    resourceId: staffId,
    metadata: { email: staff.email },
    actorId: req.auth?.userId ?? null,
    req,
  });

  return { staffId, email: staff.email };
}

export async function revokeStaffSessions(staffId: string, actor: ActorContext) {
  const staff = await findStaffOrThrow(staffId);
  const revokedSessions = await revokeAllUserSessions(staffId, { reason: 'ADMIN_REVOKED' });

  await recordAudit({
    action: 'staff.sessions.revoked',
    resourceType: 'user',
    resourceId: staffId,
    metadata: { revokedSessions },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return { staffId, email: staff.email, revokedSessions };
}

const SESSION_FIELDS = ['id', 'userAgent', 'ipAddress', 'activeTenantId', 'mfaVerifiedAt', 'lastUsedAt', 'expiresAt', 'revokedAt', 'revokedReason', 'createdAt', 'isCurrent', 'isActive'] as const;

function serializeSession(session: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const field of SESSION_FIELDS) safe[field] = session[field];
  return safe;
}

export async function listStaffSessions(staffId: string, req: Request) {
  await findStaffOrThrow(staffId);
  const sessions = await listUserSessions(staffId, req);
  return sessions.map((session) => serializeSession(session as unknown as Record<string, unknown>));
}

export async function revokeStaffSession(staffId: string, sessionId: string, actor: ActorContext) {
  const staff = await findStaffOrThrow(staffId);
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId: staffId }, select: { id: true, revokedAt: true } });
  if (!session) throw new NotFoundError('Session');

  await revokeSession(sessionId, { userId: staffId, reason: 'ADMIN_REVOKED' });

  await recordAudit({
    action: 'staff.session.revoked',
    resourceType: 'user',
    resourceId: staffId,
    metadata: { sessionId, alreadyRevoked: Boolean(session.revokedAt) },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });

  return { staffId, email: staff.email, sessionId, revoked: true };
}

export async function getStaffEffectivePermissions(staffId: string) {
  await findStaffOrThrow(staffId);
  const { roles, permissions } = await loadPermissions(staffId);
  const catalog = permissions.length
    ? await prisma.permission.findMany({
        where: { code: { in: permissions } },
        select: { id: true, code: true, name: true, module: true, resource: true, action: true, scope: true, description: true },
        orderBy: { code: 'asc' },
      })
    : [];
  return { staffId, roles, permissions, catalog };
}

export async function replaceStaffRoles(staffId: string, input: ReplaceStaffRolesInput, actor: ActorContext) {
  const existing = await findStaffOrThrow(staffId);

  const roleIds = Array.from(new Set(input.roleIds));
  const roles = await assertRolesExist(roleIds);

  const currentKeys = existing.staffRoleAssignments.map((assignment) => assignment.role.key);
  const nextKeys = roles.map((role) => role.key);

  const ownerAdded = nextKeys.includes(OWNER_ROLE_KEY) && !currentKeys.includes(OWNER_ROLE_KEY);
  const ownerRemoved = !nextKeys.includes(OWNER_ROLE_KEY) && currentKeys.includes(OWNER_ROLE_KEY);

  if (ownerAdded || ownerRemoved) {
    assertPermission(actor.req?.auth, 'admin.staff.privileged');
  }
  if (ownerRemoved) {
    await assertNotLastPlatformOwner(staffId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.staffRoleAssignment.deleteMany({ where: { userId: staffId } });
    if (roles.length > 0) {
      await tx.staffRoleAssignment.createMany({
        data: roles.map((role) => ({ userId: staffId, roleId: role.id, assignedById: actor.actorId ?? null })),
        skipDuplicates: true,
      });
    }
  });

  await invalidatePermissionCache(staffId);

  const updated = await findStaffOrThrow(staffId);
  await recordAudit({
    action: 'staff.roles.changed',
    resourceType: 'user',
    resourceId: staffId,
    before: { roles: currentKeys },
    after: { roles: nextKeys },
    actorId: actor.actorId ?? null,
    req: actor.req,
  });
  void publishEvent({ eventKey: 'staff.roles.changed', payload: { staffId, roleKeys: nextKeys } });

  return serializeStaff(updated);
}

export async function getStaffRoles(staffId: string) {
  await findStaffOrThrow(staffId);
  const assignments = await prisma.staffRoleAssignment.findMany({
    where: { userId: staffId, role: { deletedAt: null } },
    select: {
      id: true,
      assignedAt: true,
      role: { select: { id: true, key: true, name: true, description: true, isSystem: true } },
    },
    orderBy: { assignedAt: 'asc' },
  });
  return assignments.map((assignment) => ({
    ...assignment.role,
    assignedAt: assignment.assignedAt,
    assignmentId: assignment.id,
  }));
}

export async function listStaffActivity(staffId: string, req: Request) {
  await findStaffOrThrow(staffId);
  const query = parseListQuery(req, { maxLimit: 100 });
  const where: Prisma.AuditEventWhereInput = { actorId: staffId };

  const [rows, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...paginationArgs(query),
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        tenantId: true,
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
