import { Router } from 'express';
import * as authController from '../../controllers/auth/auth.controller';
import { authenticate, authLimiter } from '../../api/middleware';
import { validateRequest } from '../../api/middleware/validate-request';
import { invitationAcceptSchema, loginSchema, refreshSchema, switchTenantSchema } from '../../validators/auth/auth.validators';

export const authRouter = Router();

authRouter.post('/login', authLimiter, validateRequest({ body: loginSchema }), authController.login);
authRouter.post('/refresh', validateRequest({ body: refreshSchema }), authController.refresh);
authRouter.get('/me', authenticate, authController.me);
authRouter.post('/logout', authenticate, authController.logout);
authRouter.post(
  '/switch-tenant',
  authenticate,
  validateRequest({ body: switchTenantSchema }),
  authController.switchTenant,
);
authRouter.post(
  '/invitation/accept',
  authLimiter,
  validateRequest({ body: invitationAcceptSchema }),
  authController.acceptInvite,
);
