import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors';

export const requirePlatformAdmin: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw new UnauthorizedError();
    if (req.auth.userType !== 'PLATFORM_STAFF' || req.auth.apiKeyId) {
      throw new ForbiddenError('Only internal platform staff accounts can access this resource.');
    }
    next();
  } catch (error) {
    next(error);
  }
};
