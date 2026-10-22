import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { supportController } from "../../controllers/itsm/support.controller";
import {
  createSupportTicketSchema,
  replySupportTicketSchema,
  supportTicketIdParamSchema,
  updateSupportTicketSchema,
} from "../../validators/itsm/support.validators";

export const supportItsmRouter = Router();

supportItsmRouter.get(
  "/",
  requireTenantPermission("support.read"),
  supportController.list,
);
supportItsmRouter.get(
  "/:ticketId",
  requireTenantPermission("support.read"),
  validateRequest({ params: supportTicketIdParamSchema }),
  supportController.get,
);
supportItsmRouter.post(
  "/",
  requireTenantPermission("support.manage"),
  validateRequest({ body: createSupportTicketSchema }),
  supportController.create,
);
supportItsmRouter.patch(
  "/:ticketId",
  requireTenantPermission("support.manage"),
  validateRequest({
    params: supportTicketIdParamSchema,
    body: updateSupportTicketSchema,
  }),
  supportController.update,
);
supportItsmRouter.post(
  "/:ticketId/reply",
  requireTenantPermission("support.manage"),
  validateRequest({
    params: supportTicketIdParamSchema,
    body: replySupportTicketSchema,
  }),
  supportController.reply,
);
supportItsmRouter.post(
  "/:ticketId/resolve",
  requireTenantPermission("support.manage"),
  validateRequest({ params: supportTicketIdParamSchema }),
  supportController.resolve,
);
supportItsmRouter.post(
  "/:ticketId/close",
  requireTenantPermission("support.manage"),
  validateRequest({ params: supportTicketIdParamSchema }),
  supportController.close,
);
supportItsmRouter.post(
  "/:ticketId/reopen",
  requireTenantPermission("support.manage"),
  validateRequest({ params: supportTicketIdParamSchema }),
  supportController.reopen,
);
