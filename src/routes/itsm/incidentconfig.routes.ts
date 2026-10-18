import { Router } from 'express';
import { registerItsmCrudRoutes } from './crud.routes';
import {
  incidentCategoryController,
  incidentPriorityController,
  resolutionCodeController,
} from '../../controllers/itsm/incidentconfig.controller';
import {
  createIncidentCategorySchema,
  createIncidentPrioritySchema,
  createResolutionCodeSchema,
  incidentCategoryIdParamSchema,
  incidentPriorityIdParamSchema,
  resolutionCodeIdParamSchema,
  updateIncidentCategorySchema,
  updateIncidentPrioritySchema,
  updateResolutionCodeSchema,
} from '../../validators/itsm/incidentconfig.validators';

export const incidentConfigItsmRouter = Router();

registerItsmCrudRoutes(incidentConfigItsmRouter, incidentCategoryController, {
  idParam: 'categoryId',
  basePath: '/categories',
  read: 'incident_configuration.read',
  manage: 'incident_configuration.manage',
  idSchema: incidentCategoryIdParamSchema,
  createSchema: createIncidentCategorySchema,
  updateSchema: updateIncidentCategorySchema,
});

registerItsmCrudRoutes(incidentConfigItsmRouter, incidentPriorityController, {
  idParam: 'priorityId',
  basePath: '/priorities',
  read: 'incident_configuration.read',
  manage: 'incident_configuration.manage',
  idSchema: incidentPriorityIdParamSchema,
  createSchema: createIncidentPrioritySchema,
  updateSchema: updateIncidentPrioritySchema,
});

registerItsmCrudRoutes(incidentConfigItsmRouter, resolutionCodeController, {
  idParam: 'resolutionCodeId',
  basePath: '/resolution-codes',
  read: 'incident_configuration.read',
  manage: 'incident_configuration.manage',
  idSchema: resolutionCodeIdParamSchema,
  createSchema: createResolutionCodeSchema,
  updateSchema: updateResolutionCodeSchema,
});
