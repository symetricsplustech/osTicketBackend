import { Router } from 'express';
import * as rolesController from '../../controllers/saasadmin/roles.controller';
import { authorize, validateRequest } from '../../api/middleware';
import {
  createRoleSchema,
  roleIdParamSchema,
  setRolePermissionsSchema,
  updateRoleSchema,
} from '../../validators/saasadmin/roles.validators';

export const rolesAdminRouter = Router();

rolesAdminRouter.get('/', authorize('admin.roles.read'), rolesController.listRolesHandler);
rolesAdminRouter.post(
  '/',
  authorize('admin.roles.manage'),
  validateRequest({ body: createRoleSchema }),
  rolesController.createRoleHandler,
);
rolesAdminRouter.get('/permission-catalog', authorize('admin.roles.read'), rolesController.permissionCatalog);
rolesAdminRouter.get(
  '/:roleId',
  authorize('admin.roles.read'),
  validateRequest({ params: roleIdParamSchema }),
  rolesController.getRoleHandler,
);
rolesAdminRouter.patch(
  '/:roleId',
  authorize('admin.roles.manage'),
  validateRequest({ params: roleIdParamSchema, body: updateRoleSchema }),
  rolesController.updateRoleHandler,
);
rolesAdminRouter.delete(
  '/:roleId',
  authorize('admin.roles.manage'),
  validateRequest({ params: roleIdParamSchema }),
  rolesController.deleteRoleHandler,
);
rolesAdminRouter.get(
  '/:roleId/permissions',
  authorize('admin.roles.read'),
  validateRequest({ params: roleIdParamSchema }),
  rolesController.rolePermissions,
);
rolesAdminRouter.put(
  '/:roleId/permissions',
  authorize('admin.roles.manage'),
  validateRequest({ params: roleIdParamSchema, body: setRolePermissionsSchema }),
  rolesController.setRolePermissionsHandler,
);
rolesAdminRouter.get(
  '/:roleId/members',
  authorize('admin.roles.read'),
  validateRequest({ params: roleIdParamSchema }),
  rolesController.roleMembers,
);
