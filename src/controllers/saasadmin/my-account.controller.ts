import type { Request, Response } from 'express';
import { ok, noContent, created } from '../../shared/response';
import { asyncHandler } from '../../shared/utils/async-handler';
import { BadRequestError, UnauthorizedError } from '../../shared/errors';
import {
  getPreferences,
  getProfile,
  getSecurity,
  getSessions,
  revokeOwnSession,
  updatePreferences,
  updateProfile,
} from '../../services/saasadmin/my-account.service';
import { confirmEmailChange, requestEmailChange } from '../../services/auth/password.service';
import { regenerateRecoveryCodes } from '../../services/auth/mfa.service';
import type { UpdatePreferencesInput, UpdateProfileInput } from '../../validators/saasadmin/my-account.validators';
import { prisma } from '../../config/database';

const userId = (req: Request): string => {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth.userId;
};

export const profile = asyncHandler(async (req: Request, res: Response) => ok(res, await getProfile(userId(req))));

export const updateProfileHandler = asyncHandler(async (req: Request, res: Response) =>
  ok(res, await updateProfile(userId(req), req.body as UpdateProfileInput, req)),
);

export const preferences = asyncHandler(async (req: Request, res: Response) => ok(res, await getPreferences(userId(req))));

export const updatePreferencesHandler = asyncHandler(async (req: Request, res: Response) =>
  ok(res, await updatePreferences(userId(req), req.body as UpdatePreferencesInput, req)),
);

export const sessions = asyncHandler(async (req: Request, res: Response) => ok(res, await getSessions(userId(req), req)));

export const revokeSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  await revokeOwnSession(userId(req), req.params.sessionId!, req);
  return noContent(res);
});

export const security = asyncHandler(async (req: Request, res: Response) => ok(res, await getSecurity(userId(req))));

export const emailChange = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: userId(req) } });
  if (!user) throw new UnauthorizedError('Account no longer exists.');
  await requestEmailChange(user, String(req.body?.newEmail ?? ''));
  return ok(res, { message: 'A confirmation email has been sent to the new address.' });
});

export const confirmEmailChangeHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.body?.token ?? '');
  if (!token) throw new BadRequestError('Confirmation token is required.');
  const result = await confirmEmailChange(token);
  return created(res, { email: result.email, message: 'Email address updated.' });
});

export const regenerateRecoveryCodesHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: userId(req) } });
  if (!user) throw new UnauthorizedError('Account no longer exists.');
  const password = String(req.body?.password ?? '');
  if (!password) throw new BadRequestError('Password is required.');
  const result = await regenerateRecoveryCodes(user, password);
  return created(res, { recoveryCodes: result.recoveryCodes, message: 'Recovery codes regenerated. Previous codes are no longer valid.' });
});
