import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { registerItsmCrudRoutes } from './crud.routes';
import { delegationController } from '../../controllers/itsm/governance.controller';
import {
  createDelegationSchema,
  delegationIdParamSchema,
  updateDelegationSchema,
} from '../../validators/itsm/governance.validators';

export const delegationsItsmRouter = Router();

registerItsmCrudRoutes(delegationsItsmRouter, delegationController, {
  idParam: 'delegationId',
  read: 'delegations.read',
  manage: 'delegations.manage',
  idSchema: delegationIdParamSchema,
  createSchema: createDelegationSchema,
  updateSchema: updateDelegationSchema,
});

delegationsItsmRouter.post(
  '/:delegationId/revoke',
  requireTenantPermission('delegations.manage'),
  validateRequest({ params: delegationIdParamSchema }),
  delegationController.revoke,
);
