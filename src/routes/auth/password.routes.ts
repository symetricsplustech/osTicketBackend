import { Router } from "express";
import * as passwordController from "../../controllers/auth/password.controller";
import { authenticate, passwordResetLimiter } from "../../api/middleware";
import { validateRequest } from "../../api/middleware/validate-request";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../../validators/auth/password.validators";

export const passwordRouter = Router();

passwordRouter.post(
  "/forgot-password",
  passwordResetLimiter,
  validateRequest({ body: forgotPasswordSchema }),
  passwordController.forgotPassword,
);
passwordRouter.post(
  "/reset-password",
  passwordResetLimiter,
  validateRequest({ body: resetPasswordSchema }),
  passwordController.resetPasswordHandler,
);
passwordRouter.post(
  "/change-password",
  authenticate,
  validateRequest({ body: changePasswordSchema }),
  passwordController.changePasswordHandler,
);
