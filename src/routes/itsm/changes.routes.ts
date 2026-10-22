import { Router } from "express";
import { changeController } from "../../controllers/itsm/changes.controller";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import {
  assignChangeSchema,
  changeIdParamSchema,
  completeChangeSchema,
  createChangeCommentSchema,
  createChangeSchema,
  decideChangeSchema,
  implementChangeSchema,
  rollbackChangeSchema,
  updateChangeSchema,
} from "../../validators/itsm/changes.validators";

export const changesItsmRouter = Router();

changesItsmRouter.get(
  "/",
  requireTenantPermission("changes.read"),
  changeController.list,
);
changesItsmRouter.post(
  "/",
  requireTenantPermission("changes.create"),
  validateRequest({ body: createChangeSchema }),
  changeController.create,
);
changesItsmRouter.get(
  "/:changeId",
  requireTenantPermission("changes.read"),
  validateRequest({ params: changeIdParamSchema }),
  changeController.get,
);
changesItsmRouter.patch(
  "/:changeId",
  requireTenantPermission("changes.update"),
  validateRequest({ params: changeIdParamSchema, body: updateChangeSchema }),
  changeController.update,
);
changesItsmRouter.delete(
  "/:changeId",
  requireTenantPermission("changes.update"),
  validateRequest({ params: changeIdParamSchema }),
  changeController.remove,
);
changesItsmRouter.post(
  "/:changeId/assign",
  requireTenantPermission("changes.update"),
  validateRequest({ params: changeIdParamSchema, body: assignChangeSchema }),
  changeController.assign,
);
changesItsmRouter.post(
  "/:changeId/decision",
  requireTenantPermission("changes.approve"),
  validateRequest({ params: changeIdParamSchema, body: decideChangeSchema }),
  changeController.decide,
);
changesItsmRouter.post(
  "/:changeId/implement",
  requireTenantPermission("changes.implement"),
  validateRequest({ params: changeIdParamSchema, body: implementChangeSchema }),
  changeController.implement,
);
changesItsmRouter.post(
  "/:changeId/complete",
  requireTenantPermission("changes.implement"),
  validateRequest({ params: changeIdParamSchema, body: completeChangeSchema }),
  changeController.complete,
);
changesItsmRouter.post(
  "/:changeId/rollback",
  requireTenantPermission("changes.implement"),
  validateRequest({ params: changeIdParamSchema, body: rollbackChangeSchema }),
  changeController.rollback,
);
changesItsmRouter.get(
  "/:changeId/comments",
  requireTenantPermission("changes.read"),
  validateRequest({ params: changeIdParamSchema }),
  changeController.listComments,
);
changesItsmRouter.post(
  "/:changeId/comments",
  requireTenantPermission("changes.update"),
  validateRequest({
    params: changeIdParamSchema,
    body: createChangeCommentSchema,
  }),
  changeController.addComment,
);
