import { Router } from "express";
import * as mfaController from "../../controllers/auth/mfa.controller";
import { authenticate, mfaLimiter } from "../../api/middleware";
import { validateRequest } from "../../api/middleware/validate-request";
import {
  disableMfaSchema,
  enrollMfaSchema,
  regenerateRecoveryCodesSchema,
  verifyChallengeSchema,
  verifyEnrollmentSchema,
} from "../../validators/auth/mfa.validators";

export const mfaRouter = Router();

mfaRouter.post(
  "/verify",
  mfaLimiter,
  validateRequest({ body: verifyChallengeSchema }),
  mfaController.verifyChallenge,
);
mfaRouter.get("/status", authenticate, mfaController.status);
mfaRouter.post(
  "/enroll",
  authenticate,
  validateRequest({ body: enrollMfaSchema }),
  mfaController.enroll,
);
mfaRouter.post(
  "/verify-enrollment",
  authenticate,
  mfaLimiter,
  validateRequest({ body: verifyEnrollmentSchema }),
  mfaController.verifyEnrollmentHandler,
);
mfaRouter.delete(
  "/",
  authenticate,
  validateRequest({ body: disableMfaSchema }),
  mfaController.disable,
);
mfaRouter.post(
  "/recovery-codes/regenerate",
  authenticate,
  validateRequest({ body: regenerateRecoveryCodesSchema }),
  mfaController.regenerateRecoveryCodesHandler,
);
