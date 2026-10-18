import { Router } from 'express';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { registerItsmCrudRoutes } from './crud.routes';
import { customFieldController, settingController } from '../../controllers/itsm/settings.controller';
import {
  createCustomFieldSchema,
  customFieldIdParamSchema,
  settingKeyParamSchema,
  settingValueSchema,
  updateCustomFieldSchema,
} from '../../validators/itsm/settings.validators';

export const settingsItsmRouter = Router();

registerItsmCrudRoutes(settingsItsmRouter, customFieldController, {
  idParam: 'fieldId',
  basePath: '/custom-fields',
  read: 'settings.read',
  manage: 'organization.custom_fields.manage',
  idSchema: customFieldIdParamSchema,
  createSchema: createCustomFieldSchema,
  updateSchema: updateCustomFieldSchema,
});

settingsItsmRouter.get('/', requireTenantPermission('settings.read'), settingController.list);
settingsItsmRouter.get(
  '/:key',
  requireTenantPermission('settings.read'),
  validateRequest({ params: settingKeyParamSchema }),
  settingController.get,
);
settingsItsmRouter.put(
  '/:key',
  requireTenantPermission('settings.manage'),
  validateRequest({ params: settingKeyParamSchema, body: settingValueSchema }),
  settingController.upsert,
);
settingsItsmRouter.delete(
  '/:key',
  requireTenantPermission('settings.manage'),
  validateRequest({ params: settingKeyParamSchema }),
  settingController.remove,
);
