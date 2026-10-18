import type { Request } from 'express';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, UnauthorizedError } from '../../shared/errors';
import { recordAudit } from '../../shared/audit';
import { toPublicProfile } from '../auth/auth.service';
import { listUserSessions, revokeSession } from '../auth/session.service';
import { mfaStatus } from '../auth/mfa.service';
import type { UpdatePreferencesInput, UpdateProfileInput } from '../../validators/saasadmin/my-account.validators';

export async function getUser(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new UnauthorizedError('Account no longer exists.');
  return user;
}

export async function getProfile(userId: string) {
  const user = await getUser(userId);
  const [roles, loginEvents] = await Promise.all([
    prisma.staffRoleAssignment.findMany({
      where: { userId },
      include: { role: { select: { id: true, key: true, name: true } } },
    }),
    prisma.loginEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);
  return {
    profile: toPublicProfile(user),
    roles: roles.map((assignment) => assignment.role),
    recentLogins: loginEvents.map((event) => ({
      outcome: event.outcome,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      createdAt: event.createdAt,
    })),
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput, req: Request) {
  const before = await getUser(userId);
  const data: Prisma.UserUpdateInput = {};
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle;
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;

  const updated = await prisma.user.update({ where: { id: userId }, data });
  await recordAudit({
    action: 'my-account.profile.updated',
    resourceType: 'user',
    resourceId: userId,
    before: toPublicProfile(before),
    after: toPublicProfile(updated),
    req,
  });
  return toPublicProfile(updated);
}

interface Preferences {
  timezone?: string;
  locale?: string;
  theme?: string;
  emailNotifications?: boolean;
  density?: string;
  landingPage?: string;
}

function extractPreferences(user: User): Preferences {
  const metadata = (user.metadata ?? {}) as Record<string, unknown>;
  const preferences = (metadata['preferences'] ?? {}) as Preferences;
  return {
    timezone: user.timezone,
    locale: user.locale,
    theme: preferences.theme ?? 'system',
    emailNotifications: preferences.emailNotifications ?? true,
    density: preferences.density ?? 'comfortable',
    landingPage: preferences.landingPage ?? '/saas-admin/dashboard',
  };
}

export async function getPreferences(userId: string) {
  const user = await getUser(userId);
  return extractPreferences(user);
}

export async function updatePreferences(userId: string, input: UpdatePreferencesInput, req: Request) {
  const user = await getUser(userId);
  const metadata = (user.metadata ?? {}) as Record<string, unknown>;
  const currentPreferences = (metadata['preferences'] ?? {}) as Preferences;

  const nextPreferences: Preferences = {
    ...currentPreferences,
    ...(input.theme !== undefined ? { theme: input.theme } : {}),
    ...(input.emailNotifications !== undefined ? { emailNotifications: input.emailNotifications } : {}),
    ...(input.density !== undefined ? { density: input.density } : {}),
    ...(input.landingPage !== undefined ? { landingPage: input.landingPage } : {}),
  };

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      metadata: { ...metadata, preferences: nextPreferences } as unknown as Prisma.InputJsonValue,
    },
  });

  await recordAudit({
    action: 'my-account.preferences.updated',
    resourceType: 'user',
    resourceId: userId,
    after: nextPreferences,
    req,
  });
  return extractPreferences(updated);
}

export async function getSessions(userId: string, req: Request) {
  const sessions = await listUserSessions(userId, req);
  return sessions.map((session) => ({
    id: session.id,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    revokedReason: session.revokedReason,
    isCurrent: session.isCurrent,
    isActive: session.isActive,
  }));
}

export async function revokeOwnSession(userId: string, sessionId: string, req: Request) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) throw new NotFoundError('Session');
  await revokeSession(sessionId, { userId, reason: 'USER_REVOKED' });
  await recordAudit({ action: 'my-account.session.revoked', resourceType: 'session', resourceId: sessionId, req });
}

export async function getSecurity(userId: string) {
  const [mfa, activeSessions, loginEvents, securityEvents] = await Promise.all([
    mfaStatus(userId),
    prisma.session.count({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.loginEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.securityEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  return {
    mfa,
    activeSessions,
    recentLogins: loginEvents.map((event) => ({
      outcome: event.outcome,
      failureReason: event.failureReason,
      ipAddress: event.ipAddress,
      createdAt: event.createdAt,
    })),
    recentSecurityEvents: securityEvents.map((event) => ({
      eventType: event.eventType,
      severity: event.severity,
      details: event.details,
      createdAt: event.createdAt,
    })),
  };
}
