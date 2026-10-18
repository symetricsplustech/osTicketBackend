import { Router } from 'express';
import { registerItsmCrudRoutes } from './crud.routes';
import { releaseController } from '../../controllers/itsm/releases.controller';
import { createReleaseSchema, releaseIdParamSchema, updateReleaseSchema } from '../../validators/itsm/releases.validators';

export const releasesItsmRouter = Router();

registerItsmCrudRoutes(releasesItsmRouter, releaseController, {
  idParam: 'releaseId',
  read: 'releases.read',
  manage: 'releases.manage',
  idSchema: releaseIdParamSchema,
  createSchema: createReleaseSchema,
  updateSchema: updateReleaseSchema,
  transitions: [
    { path: '/deploy', action: 'deployed', status: 'IN_PROGRESS' },
    { path: '/complete', action: 'completed', status: 'DEPLOYED' },
    { path: '/cancel', action: 'cancelled', status: 'CANCELLED' },
  ],
});
