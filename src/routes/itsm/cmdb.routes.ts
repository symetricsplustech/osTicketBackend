import { Router } from 'express';
import { registerItsmCrudRoutes } from './crud.routes';
import { ciRelationshipController, configurationItemController } from '../../controllers/itsm/cmdb.controller';
import {
  ciIdParamSchema,
  ciRelationshipIdParamSchema,
  createCiRelationshipSchema,
  createCiSchema,
  updateCiRelationshipSchema,
  updateCiSchema,
} from '../../validators/itsm/cmdb.validators';

export const cmdbItsmRouter = Router();

registerItsmCrudRoutes(cmdbItsmRouter, configurationItemController, {
  idParam: 'ciId',
  basePath: '/items',
  read: 'cmdb.read',
  manage: 'cmdb.manage',
  idSchema: ciIdParamSchema,
  createSchema: createCiSchema,
  updateSchema: updateCiSchema,
});

registerItsmCrudRoutes(cmdbItsmRouter, ciRelationshipController, {
  idParam: 'relationshipId',
  basePath: '/relationships',
  read: 'cmdb.read',
  manage: 'cmdb.manage',
  idSchema: ciRelationshipIdParamSchema,
  createSchema: createCiRelationshipSchema,
  updateSchema: updateCiRelationshipSchema,
});
