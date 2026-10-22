import { Router } from "express";
import * as usersController from "../../controllers/tenantadmin/users.controller";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import {
  importTenantUsersSchema,
  inviteTenantUserSchema,
  setTenantUserRolesSchema,
  tenantInvitationIdParamSchema,
  tenantUserIdParamSchema,
  tenantUserStatusReasonSchema,
  updateTenantUserSchema,
} from "../../validators/tenantadmin/users.validators";

export const usersTenantRouter = Router();

usersTenantRouter.get(
  "/",
  requireTenantPermission("users.read"),
  usersController.listUsersHandler,
);
usersTenantRouter.post(
  "/invite",
  requireTenantPermission("users.invite"),
  validateRequest({ body: inviteTenantUserSchema }),
  usersController.inviteUserHandler,
);
usersTenantRouter.post(
  "/import",
  requireTenantPermission("users.import"),
  validateRequest({ body: importTenantUsersSchema }),
  usersController.importUsersHandler,
);

usersTenantRouter.get(
  "/invitations",
  requireTenantPermission("users.read"),
  usersController.listInvitationsHandler,
);
usersTenantRouter.post(
  "/invitations/:invitationId/revoke",
  requireTenantPermission("users.invite"),
  validateRequest({ params: tenantInvitationIdParamSchema }),
  usersController.revokeInvitationHandler,
);

usersTenantRouter.get(
  "/:userId",
  requireTenantPermission("users.read"),
  validateRequest({ params: tenantUserIdParamSchema }),
  usersController.getUserHandler,
);
usersTenantRouter.patch(
  "/:userId",
  requireTenantPermission("users.update"),
  validateRequest({
    params: tenantUserIdParamSchema,
    body: updateTenantUserSchema,
  }),
  usersController.updateUserHandler,
);
usersTenantRouter.post(
  "/:userId/activate",
  requireTenantPermission("users.activate"),
  validateRequest({ params: tenantUserIdParamSchema }),
  usersController.activateUserHandler,
);
usersTenantRouter.post(
  "/:userId/suspend",
  requireTenantPermission("users.suspend"),
  validateRequest({
    params: tenantUserIdParamSchema,
    body: tenantUserStatusReasonSchema,
  }),
  usersController.suspendUserHandler,
);
usersTenantRouter.post(
  "/:userId/deactivate",
  requireTenantPermission("users.deactivate"),
  validateRequest({
    params: tenantUserIdParamSchema,
    body: tenantUserStatusReasonSchema,
  }),
  usersController.deactivateUserHandler,
);
usersTenantRouter.post(
  "/:userId/reset-password",
  requireTenantPermission("users.reset_password"),
  validateRequest({ params: tenantUserIdParamSchema }),
  usersController.resetUserPasswordHandler,
);
usersTenantRouter.post(
  "/:userId/revoke-sessions",
  requireTenantPermission("users.revoke_sessions"),
  validateRequest({ params: tenantUserIdParamSchema }),
  usersController.revokeUserSessionsHandler,
);
usersTenantRouter.get(
  "/:userId/roles",
  requireTenantPermission("users.read"),
  validateRequest({ params: tenantUserIdParamSchema }),
  usersController.getUserRolesHandler,
);
usersTenantRouter.put(
  "/:userId/roles",
  requireTenantPermission("users.roles.manage"),
  validateRequest({
    params: tenantUserIdParamSchema,
    body: setTenantUserRolesSchema,
  }),
  usersController.setUserRolesHandler,
);
usersTenantRouter.get(
  "/:userId/activity",
  requireTenantPermission("users.read"),
  validateRequest({ params: tenantUserIdParamSchema }),
  usersController.listUserActivityHandler,
);
