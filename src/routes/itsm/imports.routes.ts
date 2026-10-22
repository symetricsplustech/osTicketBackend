import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { importController } from "../../controllers/itsm/imports.controller";
import {
  createImportJobSchema,
  importJobIdParamSchema,
} from "../../validators/itsm/imports.validators";

export const importsItsmRouter = Router();

importsItsmRouter.get(
  "/",
  requireTenantPermission("imports.read"),
  importController.list,
);
importsItsmRouter.get(
  "/:jobId",
  requireTenantPermission("imports.read"),
  validateRequest({ params: importJobIdParamSchema }),
  importController.get,
);
importsItsmRouter.post(
  "/",
  requireTenantPermission("imports.manage"),
  validateRequest({ body: createImportJobSchema }),
  importController.create,
);
importsItsmRouter.post(
  "/:jobId/run",
  requireTenantPermission("imports.manage"),
  validateRequest({ params: importJobIdParamSchema }),
  importController.run,
);
importsItsmRouter.post(
  "/:jobId/cancel",
  requireTenantPermission("imports.manage"),
  validateRequest({ params: importJobIdParamSchema }),
  importController.cancel,
);
importsItsmRouter.post(
  "/:jobId/retry",
  requireTenantPermission("imports.manage"),
  validateRequest({ params: importJobIdParamSchema }),
  importController.retry,
);
importsItsmRouter.delete(
  "/:jobId",
  requireTenantPermission("imports.manage"),
  validateRequest({ params: importJobIdParamSchema }),
  importController.remove,
);
