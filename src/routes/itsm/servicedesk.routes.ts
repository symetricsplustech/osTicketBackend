import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { registerItsmCrudRoutes } from './crud.routes';
import {
  operatingHoursController,
  routingRuleController,
  serviceDeskQueueController,
} from '../../controllers/itsm/servicedesk.controller';
import {
  createOperatingHoursSchema,
  createQueueSchema,
  createRoutingRuleSchema,
  operatingHoursIdParamSchema,
  queueIdParamSchema,
  routingRuleIdParamSchema,
  updateOperatingHoursSchema,
  updateQueueSchema,
  updateRoutingRuleSchema,
} from '../../validators/itsm/servicedesk.validators';

export const serviceDeskItsmRouter = Router();

registerItsmCrudRoutes(serviceDeskItsmRouter, serviceDeskQueueController, {
  idParam: 'queueId',
  basePath: '/queues',
  read: 'service_desk.read',
  manage: 'service_desk.manage',
  idSchema: queueIdParamSchema,
  createSchema: createQueueSchema,
  updateSchema: updateQueueSchema,
});
serviceDeskItsmRouter.post(
  '/queues/:queueId/set-default',
  requireTenantPermission('service_desk.manage'),
  validateRequest({ params: queueIdParamSchema }),
  serviceDeskQueueController.setDefault,
);

registerItsmCrudRoutes(serviceDeskItsmRouter, operatingHoursController, {
  idParam: 'operatingHoursId',
  basePath: '/operating-hours',
  read: 'service_desk.read',
  manage: 'service_desk.manage',
  idSchema: operatingHoursIdParamSchema,
  createSchema: createOperatingHoursSchema,
  updateSchema: updateOperatingHoursSchema,
});
serviceDeskItsmRouter.post(
  '/operating-hours/:operatingHoursId/set-default',
  requireTenantPermission('service_desk.manage'),
  validateRequest({ params: operatingHoursIdParamSchema }),
  operatingHoursController.setDefault,
);

registerItsmCrudRoutes(serviceDeskItsmRouter, routingRuleController, {
  idParam: 'routingRuleId',
  basePath: '/routing-rules',
  read: 'service_desk.read',
  manage: 'service_desk.routing.manage',
  idSchema: routingRuleIdParamSchema,
  createSchema: createRoutingRuleSchema,
  updateSchema: updateRoutingRuleSchema,
});
