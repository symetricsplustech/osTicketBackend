import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { BadRequestError, UnauthorizedError } from '../../shared/errors';
import { hashPassword, validatePasswordStrength, verifyPassword } from '../../shared/utils/passwords';
import { randomToken, sha256 } from '../../shared/utils/crypto';
import { normaliseEmail } from '../../shared/utils/sanitize';
import { recordAudit, recordSecurityEvent } from '../../shared/audit';
import { emailTemplates } from '../../shared/email/templates';
import { sendEmail } from '../../shared/email';
import { revokeAllUserSessions } from './session.service';

export async function requestPasswordReset(email: string, req: Request): Promise<void> {
  const normalised = normaliseEmail(email);
  const user = await prisma.user.findFirst({
    where: { email: normalised, deletedAt: null },
  });

  if (!user || user.status === 'DEACTIVATED') {
    await recordSecurityEvent({
      eventType: 'auth.password_reset.unknown_account',
      severity: 'LOW',
      req,
      details: { email: normalised },
    });
    return;
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomToken(40);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
      ipAddress: req.ip ?? null,
    },
  });

  const resetUrl = `${env.ADMIN_APP_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    ...emailTemplates.passwordReset({
      name: user.firstName,
      resetUrl,
      expiresMinutes: env.PASSWORD_RESET_TTL_MINUTES,
    }),
  });

  await recordAudit({
    action: 'auth.password.reset_requested',
    resourceType: 'user',
    resourceId: user.id,
    actorId: user.id,
    actorEmail: user.email,
    req,
  });
}

export async function resetPassword(token: string, newPassword: string, req: Request): Promise<void> {
  validatePasswordStrength(newPassword);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new BadRequestError('The password reset link is invalid or has expired.');
  }
  if (record.user.deletedAt || record.user.status === 'DEACTIVATED') {
    throw new UnauthorizedError('Account is not active.');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  await revokeAllUserSessions(record.userId, { reason: 'PASSWORD_RESET' });
  await recordAudit({
    action: 'auth.password.reset_completed',
    resourceType: 'user',
    resourceId: record.userId,
    actorId: record.userId,
    actorEmail: record.user.email,
    req,
  });
}

export async function changePassword(user: User, currentPassword: string, newPassword: string): Promise<void> {
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Current password is incorrect.');
  if (currentPassword === newPassword) {
    throw new BadRequestError('The new password must be different from the current password.');
  }
  validatePasswordStrength(newPassword);

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await recordAudit({ action: 'auth.password.changed', resourceType: 'user', resourceId: user.id, actorId: user.id });
}

interface EmailChangePayload {
  sub: string;
  newEmail: string;
  typ: 'email-change';
  currentEmailHash: string;
}

export async function requestEmailChange(user: User, newEmail: string): Promise<void> {
  const normalised = normaliseEmail(newEmail);
  if (normalised === user.email) throw new BadRequestError('The new email address must be different from the current one.');

  const existing = await prisma.user.findUnique({ where: { email: normalised } });
  if (existing) throw new BadRequestError('That email address is already in use.');

  const token = jwt.sign(
    {
      sub: user.id,
      newEmail: normalised,
      typ: 'email-change',
      currentEmailHash: sha256(user.email),
    } satisfies EmailChangePayload,
    env.JWT_SECRET,
    { expiresIn: '30m', issuer: 'itsm-saas-platform', audience: 'itsm-saas-admin' },
  );

  const confirmUrl = `${env.ADMIN_APP_URL.replace(/\/$/, '')}/confirm-email-change?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: normalised,
    ...emailTemplates.emailChange({ name: user.firstName, newEmail: normalised, confirmUrl }),
  });

  await recordAudit({ action: 'auth.email.change_requested', resourceType: 'user', resourceId: user.id, metadata: { newEmail: normalised } });
}

export async function confirmEmailChange(token: string): Promise<{ email: string }> {
  let payload: EmailChangePayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'itsm-saas-platform',
      audience: 'itsm-saas-admin',
    }) as EmailChangePayload;
  } catch {
    throw new BadRequestError('The email change link is invalid or has expired.');
  }
  if (payload.typ !== 'email-change') throw new BadRequestError('The email change link is invalid or has expired.');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || sha256(user.email) !== payload.currentEmailHash) {
    throw new BadRequestError('The email change request is no longer valid.');
  }

  const existing = await prisma.user.findUnique({ where: { email: payload.newEmail } });
  if (existing && existing.id !== user.id) throw new BadRequestError('That email address is already in use.');

  await prisma.user.update({
    where: { id: user.id },
    data: { email: payload.newEmail, emailVerifiedAt: new Date() },
  });

  await recordAudit({
    action: 'auth.email.changed',
    resourceType: 'user',
    resourceId: user.id,
    before: { email: user.email },
    after: { email: payload.newEmail },
  });

  return { email: payload.newEmail };
}

export async function acceptInvitation(token: string, password: string, req: Request): Promise<{ userId: string; email: string }> {
  validatePasswordStrength(password);
  const tokenHash = sha256(token);

  const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });
  if (invitation) {
    if (invitation.status !== 'PENDING') {
      throw new BadRequestError('This invitation is no longer valid.');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestError('The invitation is invalid or has expired.');
    }

    const invitedUser = await prisma.user.findFirst({ where: { email: invitation.email } });
    if (!invitedUser) throw new BadRequestError('The invitation is invalid or has expired.');

    const passwordHash = await hashPassword(password);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: invitedUser.id },
        data: {
          passwordHash,
          status: 'ACTIVE',
          invitationTokenHash: null,
          invitationExpiresAt: null,
          emailVerifiedAt: invitedUser.emailVerifiedAt ?? now,
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: now },
      });
      await tx.tenantMembership.updateMany({
        where: { tenantId: invitation.tenantId, userId: invitedUser.id, status: 'INVITED' },
        data: { status: 'ACTIVE', joinedAt: now },
      });
    });

    await recordAudit({
      action: 'auth.invitation.accepted',
      resourceType: 'user',
      resourceId: invitedUser.id,
      tenantId: invitation.tenantId,
      actorId: invitedUser.id,
      actorEmail: invitedUser.email,
      req,
    });

    return { userId: invitedUser.id, email: invitedUser.email };
  }

  const user = await prisma.user.findFirst({ where: { invitationTokenHash: tokenHash } });
  if (!user || !user.invitationExpiresAt || user.invitationExpiresAt.getTime() < Date.now()) {
    throw new BadRequestError('The invitation is invalid or has expired.');
  }
  if (user.status !== 'INVITED') {
    throw new BadRequestError('This invitation has already been accepted.');
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: 'ACTIVE',
      invitationTokenHash: null,
      invitationExpiresAt: null,
      emailVerifiedAt: new Date(),
    },
  });

  await recordAudit({
    action: 'auth.invitation.accepted',
    resourceType: 'user',
    resourceId: user.id,
    actorId: user.id,
    actorEmail: user.email,
    req,
  });

  return { userId: user.id, email: user.email };
}
