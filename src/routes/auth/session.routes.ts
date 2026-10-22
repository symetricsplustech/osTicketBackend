import { Router } from "express";
import * as sessionController from "../../controllers/auth/session.controller";
import { authenticate } from "../../api/middleware";
import { validateRequest } from "../../api/middleware/validate-request";
import { sessionIdParamSchema } from "../../validators/auth/session.validators";

export const sessionRouter = Router();

sessionRouter.use(authenticate);
sessionRouter.get("/", sessionController.listSessions);
sessionRouter.delete(
  "/:sessionId",
  validateRequest({ params: sessionIdParamSchema }),
  sessionController.revokeSessionHandler,
);
