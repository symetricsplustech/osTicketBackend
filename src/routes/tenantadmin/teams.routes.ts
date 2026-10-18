import { Router } from 'express';
import { teamController } from '../../controllers/tenantadmin/teams.controller';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import {
  addTeamMemberSchema,
  assignTeamQueueSchema,
  createTeamSchema,
  teamIdParamSchema,
  teamMemberParamSchema,
  teamQueueParamSchema,
  updateTeamSchema,
} from '../../validators/tenantadmin/teams.validators';

export const teamsTenantRouter = Router();

teamsTenantRouter.get('/', requireTenantPermission('teams.read'), teamController.list);
teamsTenantRouter.post(
  '/',
  requireTenantPermission('teams.manage'),
  validateRequest({ body: createTeamSchema }),
  teamController.create,
);
teamsTenantRouter.get(
  '/:teamId',
  requireTenantPermission('teams.read'),
  validateRequest({ params: teamIdParamSchema }),
  teamController.get,
);
teamsTenantRouter.patch(
  '/:teamId',
  requireTenantPermission('teams.manage'),
  validateRequest({ params: teamIdParamSchema, body: updateTeamSchema }),
  teamController.update,
);
teamsTenantRouter.delete(
  '/:teamId',
  requireTenantPermission('teams.manage'),
  validateRequest({ params: teamIdParamSchema }),
  teamController.remove,
);
teamsTenantRouter.get(
  '/:teamId/members',
  requireTenantPermission('teams.read'),
  validateRequest({ params: teamIdParamSchema }),
  teamController.listMembers,
);
teamsTenantRouter.post(
  '/:teamId/members',
  requireTenantPermission('teams.members.manage'),
  validateRequest({ params: teamIdParamSchema, body: addTeamMemberSchema }),
  teamController.addMember,
);
teamsTenantRouter.delete(
  '/:teamId/members/:userId',
  requireTenantPermission('teams.members.manage'),
  validateRequest({ params: teamMemberParamSchema }),
  teamController.removeMember,
);
teamsTenantRouter.get(
  '/:teamId/queues',
  requireTenantPermission('teams.read'),
  validateRequest({ params: teamIdParamSchema }),
  teamController.listQueues,
);
teamsTenantRouter.post(
  '/:teamId/queues',
  requireTenantPermission('teams.queues.manage'),
  validateRequest({ params: teamIdParamSchema, body: assignTeamQueueSchema }),
  teamController.assignQueue,
);
teamsTenantRouter.delete(
  '/:teamId/queues/:queueId',
  requireTenantPermission('teams.queues.manage'),
  validateRequest({ params: teamQueueParamSchema }),
  teamController.unassignQueue,
);
