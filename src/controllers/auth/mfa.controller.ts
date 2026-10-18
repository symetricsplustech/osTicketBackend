import type { Request, Response } from 'express';
import { ok, noContent } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { UnauthorizedError } from '../../shared/errors';
import { prisma } from '../../config/database';
import {
  beginEnrollment,
  disableMfa,
  mfaStatus,
  regenerateRecoveryCodes,
  verifyEnrollment,
  verifyMfaChallenge,
} from '../../services/auth/mfa.service';
import type {
  DisableMfaInput,
  EnrollMfaInput,
  VerifyChallengeInput,
  VerifyEnrollmentInput,
} from '../../validators/auth/mfa.validators';

async function currentUser(req: Request) {
  if (!req.auth) throw new UnauthorizedError();
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user) throw new UnauthorizedError('Account no longer exists.');
  return user;
}

export const enroll = asyncHandler(async (req: Request, res: Response) => {
  const user = await currentUser(req);
  const { label } = req.body as EnrollMfaInput;
  const result = await beginEnrollment(user, label);
  return ok(res, result);
});

export const verifyEnrollmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await currentUser(req);
  const { code } = req.body as VerifyEnrollmentInput;
  const result = await verifyEnrollment(user, code);
  return ok(res, { recoveryCodes: result.recoveryCodes, message: 'Multi-factor authentication is now enabled.' });
});

export const verifyChallenge = asyncHandler(async (req: Request, res: Response) => {
  const { mfaToken, code } = req.body as VerifyChallengeInput;
  const result = await verifyMfaChallenge(mfaToken, code, req);
  return ok(res, {
    mfaRequired: false,
    user: result.user,
    accessToken: result.session.accessToken,
    refreshToken: result.session.refreshToken,
    expiresIn: result.session.expiresInSeconds,
    roles: result.roles,
    permissions: result.permissions,
    accessibleAreas: result.accessibleAreas,
  });
});

export const disable = asyncHandler(async (req: Request, res: Response) => {
  const user = await currentUser(req);
  const { password, code } = req.body as DisableMfaInput;
  await disableMfa(user, password, code, req);
  return noContent(res);
});

export const status = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new UnauthorizedError();
  const result = await mfaStatus(req.auth.userId);
  return ok(res, result);
});

export const regenerateRecoveryCodesHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await currentUser(req);
  const { password } = req.body as { password: string };
  const result = await regenerateRecoveryCodes(user, password);
  return ok(res, { recoveryCodes: result.recoveryCodes, message: 'Recovery codes regenerated. Previous codes are no longer valid.' });
});
