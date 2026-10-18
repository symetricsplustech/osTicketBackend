import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { securityController } from '../../controllers/itsm/security.controller';
import { sessionIdParamSchema } from '../../validators/itsm/security.validators';

export const securityItsmRouter = Router();

securityItsmRouter.get('/overview', requireTenantPermission('security.read'), securityController.overview);
securityItsmRouter.get('/events', requireTenantPermission('security.read'), securityController.listEvents);
securityItsmRouter.get('/sessions', requireTenantPermission('security.read'), securityController.listSessions);
securityItsmRouter.post(
  '/sessions/:sessionId/revoke',
  requireTenantPermission('security.sessions.revoke'),
  validateRequest({ params: sessionIdParamSchema }),
  securityController.revokeSession,
);
