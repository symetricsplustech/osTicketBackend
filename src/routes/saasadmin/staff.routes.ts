import { Router } from "express";
import * as staffController from "../../controllers/saasadmin/staff.controller";
import { authorize, validateRequest } from "../../api/middleware";
import {
  createStaffSchema,
  replaceStaffRolesSchema,
  staffIdParamSchema,
  staffSessionParamSchema,
  updateStaffSchema,
} from "../../validators/saasadmin/staff.validators";

export const staffAdminRouter = Router();

staffAdminRouter.get(
  "/",
  authorize("admin.staff.read"),
  staffController.listStaffHandler,
);
staffAdminRouter.post(
  "/",
  authorize("admin.staff.manage"),
  validateRequest({ body: createStaffSchema }),
  staffController.createStaffHandler,
);

staffAdminRouter.get(
  "/:staffId",
  authorize("admin.staff.read"),
  validateRequest({ params: staffIdParamSchema }),
  staffController.getStaffHandler,
);
staffAdminRouter.patch(
  "/:staffId",
  authorize("admin.staff.manage"),
  validateRequest({ params: staffIdParamSchema, body: updateStaffSchema }),
  staffController.updateStaffHandler,
);
staffAdminRouter.post(
  "/:staffId/invite",
  authorize("admin.staff.manage"),
  validateRequest({ params: staffIdParamSchema }),
  staffController.resendStaffInvitation,
);
staffAdminRouter.post(
  "/:staffId/activate",
  authorize("admin.staff.manage"),
  validateRequest({ params: staffIdParamSchema }),
  staffController.activateStaffHandler,
);
staffAdminRouter.post(
  "/:staffId/suspend",
  authorize("admin.staff.manage"),
  validateRequest({ params: staffIdParamSchema }),
  staffController.suspendStaffHandler,
);
staffAdminRouter.post(
  "/:staffId/deactivate",
  authorize("admin.staff.manage"),
  validateRequest({ params: staffIdParamSchema }),
  staffController.deactivateStaffHandler,
);
staffAdminRouter.post(
  "/:staffId/reset-password",
  authorize("admin.staff.manage"),
  validateRequest({ params: staffIdParamSchema }),
  staffController.resetStaffPasswordHandler,
);
staffAdminRouter.post(
  "/:staffId/revoke-sessions",
  authorize("admin.staff.manage"),
  validateRequest({ params: staffIdParamSchema }),
  staffController.revokeStaffSessionsHandler,
);
staffAdminRouter.get(
  "/:staffId/sessions",
  authorize("admin.staff.read"),
  validateRequest({ params: staffIdParamSchema }),
  staffController.staffSessions,
);
staffAdminRouter.delete(
  "/:staffId/sessions/:sessionId",
  authorize("admin.staff.manage"),
  validateRequest({ params: staffSessionParamSchema }),
  staffController.revokeStaffSessionHandler,
);
staffAdminRouter.get(
  "/:staffId/effective-permissions",
  authorize("admin.staff.read"),
  validateRequest({ params: staffIdParamSchema }),
  staffController.staffEffectivePermissions,
);
staffAdminRouter.put(
  "/:staffId/roles",
  authorize("admin.staff.manage"),
  validateRequest({
    params: staffIdParamSchema,
    body: replaceStaffRolesSchema,
  }),
  staffController.replaceStaffRolesHandler,
);
staffAdminRouter.get(
  "/:staffId/roles",
  authorize("admin.staff.read"),
  validateRequest({ params: staffIdParamSchema }),
  staffController.staffRoles,
);
staffAdminRouter.get(
  "/:staffId/activity",
  authorize("admin.staff.read"),
  validateRequest({ params: staffIdParamSchema }),
  staffController.staffActivity,
);
