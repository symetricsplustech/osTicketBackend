import { Router } from 'express';
import * as rolesController from '../../controllers/tenantadmin/roles.controller';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import {
  addRoleMembersSchema,
  createTenantRoleSchema,
  roleMemberParamSchema,
  setTenantRolePermissionsSchema,
  tenantRoleIdParamSchema,
  updateTenantRoleSchema,
} from '../../validators/tenantadmin/roles.validators';

export const rolesTenantRouter = Router();

rolesTenantRouter.get('/', requireTenantPermission('roles.read'), rolesController.listRolesHandler);
rolesTenantRouter.post(
  '/',
  requireTenantPermission('roles.create'),
  validateRequest({ body: createTenantRoleSchema }),
  rolesController.createRoleHandler,
);
rolesTenantRouter.get(
  '/permission-catalog',
  requireTenantPermission('roles.read'),
  rolesController.permissionCatalog,
);
rolesTenantRouter.get(
  '/:roleId',
  requireTenantPermission('roles.read'),
  validateRequest({ params: tenantRoleIdParamSchema }),
  rolesController.getRoleHandler,
);
rolesTenantRouter.patch(
  '/:roleId',
  requireTenantPermission('roles.update'),
  validateRequest({ params: tenantRoleIdParamSchema, body: updateTenantRoleSchema }),
  rolesController.updateRoleHandler,
);
rolesTenantRouter.delete(
  '/:roleId',
  requireTenantPermission('roles.delete'),
  validateRequest({ params: tenantRoleIdParamSchema }),
  rolesController.deleteRoleHandler,
);
rolesTenantRouter.get(
  '/:roleId/permissions',
  requireTenantPermission('roles.read'),
  validateRequest({ params: tenantRoleIdParamSchema }),
  rolesController.rolePermissions,
);
rolesTenantRouter.put(
  '/:roleId/permissions',
  requireTenantPermission('roles.permissions.manage'),
  validateRequest({ params: tenantRoleIdParamSchema, body: setTenantRolePermissionsSchema }),
  rolesController.setRolePermissionsHandler,
);
rolesTenantRouter.get(
  '/:roleId/members',
  requireTenantPermission('roles.read'),
  validateRequest({ params: tenantRoleIdParamSchema }),
  rolesController.roleMembers,
);
rolesTenantRouter.post(
  '/:roleId/members',
  requireTenantPermission('roles.members.manage'),
  validateRequest({ params: tenantRoleIdParamSchema, body: addRoleMembersSchema }),
  rolesController.addRoleMembersHandler,
);
rolesTenantRouter.delete(
  '/:roleId/members/:membershipId',
  requireTenantPermission('roles.members.manage'),
  validateRequest({ params: roleMemberParamSchema }),
  rolesController.removeRoleMemberHandler,
);
