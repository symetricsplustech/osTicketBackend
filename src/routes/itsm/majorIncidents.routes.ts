import { Router } from 'express';
import { registerItsmCrudRoutes } from './crud.routes';
import { majorIncidentController } from '../../controllers/itsm/majorIncidents.controller';
import {
  createMajorIncidentSchema,
  majorIncidentIdParamSchema,
  updateMajorIncidentSchema,
} from '../../validators/itsm/majorIncidents.validators';

export const majorIncidentsItsmRouter = Router();

registerItsmCrudRoutes(majorIncidentsItsmRouter, majorIncidentController, {
  idParam: 'majorIncidentId',
  read: 'major_incidents.read',
  manage: 'major_incidents.manage',
  idSchema: majorIncidentIdParamSchema,
  createSchema: createMajorIncidentSchema,
  updateSchema: updateMajorIncidentSchema,
  transitions: [
    { path: '/investigate', action: 'investigating', status: 'INVESTIGATING' },
    { path: '/monitor', action: 'monitoring', status: 'MONITORING' },
    { path: '/resolve', action: 'resolved', status: 'RESOLVED' },
    { path: '/close', action: 'closed', status: 'CLOSED' },
  ],
});
