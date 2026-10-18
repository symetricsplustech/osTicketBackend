import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { BadRequestError, PreconditionFailedError, UnauthorizedError } from '../../shared/errors';
import { decryptSecret, encryptSecret } from '../../shared/encryption';
import { randomToken, sha256 } from '../../shared/utils/crypto';
import { verifyPassword } from '../../shared/utils/passwords';
import { recordAudit, recordLoginEvent, recordSecurityEvent } from '../../shared/audit';
import { emailTemplates } from '../../shared/email/templates';
import { sendEmail } from '../../shared/email';
import { buildLoginSuccess, verifyMfaChallengeToken, type LoginSuccess } from './auth.service';
import { resolveLoginTenant } from './tenant-access.service';

authenticator.options = { window: 1 };

const RECOVERY_CODE_COUNT = 10;

function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
    const raw = randomToken(9).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

function normaliseCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

export async function beginEnrollment(user: User, label?: string): Promise<{ factorId: string; secret: string; otpauthUrl: string; qrDataUrl: string }> {
  if (user.mfaEnabled) {
    throw new PreconditionFailedError('Multi-factor authentication is already enabled. Disable it before enrolling a new factor.');
  }

  await prisma.mfaFactor.deleteMany({ where: { userId: user.id, verifiedAt: null } });

  const secret = authenticator.generateSecret();
  const factor = await prisma.mfaFactor.create({
    data: {
      userId: user.id,
      type: 'TOTP',
      label: label ?? 'Authenticator app',
      secretEnc: encryptSecret(secret),
    },
  });

  const issuer = env.APP_NAME;
  const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1, width: 240 });

  return { factorId: factor.id, secret, otpauthUrl, qrDataUrl };
}

export async function verifyEnrollment(user: User, code: string): Promise<{ recoveryCodes: string[] }> {
  const factor = await prisma.mfaFactor.findFirst({
    where: { userId: user.id, verifiedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!factor) throw new BadRequestError('No pending MFA enrollment was found. Start enrollment first.');

  const secret = decryptSecret(factor.secretEnc);
  const valid = authenticator.verify({ token: normaliseCode(code), secret });
  if (!valid) {
    await recordSecurityEvent({
      eventType: 'mfa.enrollment.failed',
      severity: 'LOW',
      userId: user.id,
      details: { factorId: factor.id },
    });
    throw new BadRequestError('The verification code is incorrect. Check the authenticator app and try again.');
  }

  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.mfaFactor.update({ where: { id: factor.id }, data: { verifiedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } }),
    prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.mfaRecoveryCode.createMany({
      data: recoveryCodes.map((recoveryCode) => ({ userId: user.id, codeHash: sha256(normaliseCode(recoveryCode)) })),
    }),
  ]);

  await recordAudit({ action: 'auth.mfa.enrolled', resourceType: 'user', resourceId: user.id, after: { type: factor.type } });
  void sendEmail({
    to: user.email,
    ...emailTemplates.mfaChanged({ name: user.firstName, enabled: true }),
  });

  return { recoveryCodes };
}

async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const hash = sha256(normaliseCode(code));
  const record = await prisma.mfaRecoveryCode.findFirst({ where: { userId, codeHash: hash, usedAt: null } });
  if (!record) return false;
  await prisma.mfaRecoveryCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return true;
}

export async function verifyMfaChallenge(mfaToken: string, code: string, req: Request): Promise<LoginSuccess> {
  const userId = verifyMfaChallengeToken(mfaToken);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt || user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
    throw new UnauthorizedError('Account is not active.');
  }

  const factor = await prisma.mfaFactor.findFirst({
    where: { userId: user.id, verifiedAt: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  if (!factor) throw new UnauthorizedError('No verified MFA factor exists for this account.');

  const secret = decryptSecret(factor.secretEnc);
  const normalised = normaliseCode(code);
  const totpValid = /^\d{6,8}$/.test(normalised) && authenticator.verify({ token: normalised, secret });
  const recoveryValid = !totpValid && /^[A-Z0-9]{8}$/.test(normalised) && (await consumeRecoveryCode(user.id, normalised));

  if (!totpValid && !recoveryValid) {
    await recordLoginEvent({ email: user.email, outcome: 'MFA_FAILED', userId: user.id, failureReason: 'INVALID_MFA_CODE', req });
    await recordSecurityEvent({
      eventType: 'mfa.challenge.failed',
      severity: 'MEDIUM',
      userId: user.id,
      req,
      details: { method: /^\d+$/.test(normalised) ? 'TOTP' : 'RECOVERY' },
    });
    throw new UnauthorizedError('The verification code is incorrect.');
  }

  await prisma.mfaFactor.update({ where: { id: factor.id }, data: { lastUsedAt: new Date() } });
  if (recoveryValid) {
    await recordSecurityEvent({ eventType: 'mfa.recovery_code.used', severity: 'HIGH', userId: user.id, req });
  }

  const { activeTenantId } = await resolveLoginTenant(user.id, user.userType);
  return buildLoginSuccess(user, req, ['pwd', 'mfa', recoveryValid ? 'recovery-code' : 'totp'], activeTenantId);
}

export async function disableMfa(user: User, password: string, code: string, req: Request): Promise<void> {
  if (!user.mfaEnabled) throw new PreconditionFailedError('Multi-factor authentication is not enabled on this account.');
  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) throw new UnauthorizedError('Password is incorrect.');

  const factor = await prisma.mfaFactor.findFirst({
    where: { userId: user.id, verifiedAt: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  const secret = factor ? decryptSecret(factor.secretEnc) : '';
  const normalised = normaliseCode(code);
  const totpValid = factor ? authenticator.verify({ token: normalised, secret }) : false;
  const recoveryValid = !totpValid && (await consumeRecoveryCode(user.id, normalised));
  if (!totpValid && !recoveryValid) {
    throw new UnauthorizedError('The verification code is incorrect.');
  }

  await prisma.$transaction([
    prisma.mfaFactor.deleteMany({ where: { userId: user.id } }),
    prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false } }),
  ]);

  await recordAudit({ action: 'auth.mfa.disabled', resourceType: 'user', resourceId: user.id, req });
  await recordSecurityEvent({ eventType: 'mfa.disabled', severity: 'HIGH', userId: user.id, req });
  void sendEmail({ to: user.email, ...emailTemplates.mfaChanged({ name: user.firstName, enabled: false }) });
}

export async function regenerateRecoveryCodes(user: User, password: string): Promise<{ recoveryCodes: string[] }> {
  if (!user.mfaEnabled) throw new PreconditionFailedError('Multi-factor authentication is not enabled on this account.');
  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) throw new UnauthorizedError('Password is incorrect.');

  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.mfaRecoveryCode.createMany({
      data: recoveryCodes.map((recoveryCode) => ({ userId: user.id, codeHash: sha256(normaliseCode(recoveryCode)) })),
    }),
  ]);

  await recordAudit({ action: 'auth.mfa.recovery_codes.regenerated', resourceType: 'user', resourceId: user.id });
  return { recoveryCodes };
}

export async function mfaStatus(userId: string): Promise<{ enabled: boolean; factors: { id: string; type: string; label: string | null; verifiedAt: Date | null; lastUsedAt: Date | null }[]; recoveryCodesRemaining: number }> {
  const [user, factors, recoveryCodesRemaining] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { mfaEnabled: true } }),
    prisma.mfaFactor.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.mfaRecoveryCode.count({ where: { userId, usedAt: null } }),
  ]);
  return {
    enabled: Boolean(user?.mfaEnabled),
    factors: factors.map((factor) => ({
      id: factor.id,
      type: factor.type,
      label: factor.label,
      verifiedAt: factor.verifiedAt,
      lastUsedAt: factor.lastUsedAt,
    })),
    recoveryCodesRemaining,
  };
}
