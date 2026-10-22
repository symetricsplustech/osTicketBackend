import { Router } from "express";
import { z } from "zod";
import * as myAccountController from "../../controllers/saasadmin/my-account.controller";
import { validateRequest } from "../../api/middleware";
import {
  sessionParamSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from "../../validators/saasadmin/my-account.validators";

export const myAccountAdminRouter = Router();

myAccountAdminRouter.get("/profile", myAccountController.profile);
myAccountAdminRouter.patch(
  "/profile",
  validateRequest({ body: updateProfileSchema }),
  myAccountController.updateProfileHandler,
);
myAccountAdminRouter.get("/preferences", myAccountController.preferences);
myAccountAdminRouter.patch(
  "/preferences",
  validateRequest({ body: updatePreferencesSchema }),
  myAccountController.updatePreferencesHandler,
);
myAccountAdminRouter.get("/sessions", myAccountController.sessions);
myAccountAdminRouter.delete(
  "/sessions/:sessionId",
  validateRequest({ params: sessionParamSchema }),
  myAccountController.revokeSessionHandler,
);
myAccountAdminRouter.get("/security", myAccountController.security);
myAccountAdminRouter.post(
  "/email-change",
  validateRequest({ body: z.object({ newEmail: z.string().trim().email() }) }),
  myAccountController.emailChange,
);
myAccountAdminRouter.post(
  "/email-change/confirm",
  validateRequest({ body: z.object({ token: z.string().min(20) }) }),
  myAccountController.confirmEmailChangeHandler,
);
myAccountAdminRouter.post(
  "/mfa/recovery-codes/regenerate",
  validateRequest({ body: z.object({ password: z.string().min(1) }) }),
  myAccountController.regenerateRecoveryCodesHandler,
);
