import { Router } from "express";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import { registerItsmCrudRoutes } from "./crud.routes";
import {
  discoveryResultController,
  discoveryRunController,
} from "../../controllers/itsm/discovery.controller";
import {
  createDiscoveryRunSchema,
  discoveryResultIdParamSchema,
  discoveryRunIdParamSchema,
  updateDiscoveryResultSchema,
} from "../../validators/itsm/discovery.validators";

export const discoveryItsmRouter = Router();

registerItsmCrudRoutes(discoveryItsmRouter, discoveryRunController, {
  idParam: "runId",
  basePath: "/runs",
  read: "discovery.read",
  manage: "discovery.manage",
  idSchema: discoveryRunIdParamSchema,
  createSchema: createDiscoveryRunSchema,
});
for (const action of ["start", "complete", "fail"] as const) {
  discoveryItsmRouter.post(
    `/runs/:runId/${action}`,
    requireTenantPermission("discovery.manage"),
    validateRequest({ params: discoveryRunIdParamSchema }),
    discoveryRunController[action],
  );
}
discoveryItsmRouter.get(
  "/runs/:runId/results",
  requireTenantPermission("discovery.read"),
  validateRequest({ params: discoveryRunIdParamSchema }),
  discoveryRunController.listResults,
);

discoveryItsmRouter.get(
  "/results/:resultId",
  requireTenantPermission("discovery.read"),
  validateRequest({ params: discoveryResultIdParamSchema }),
  discoveryResultController.get,
);
discoveryItsmRouter.patch(
  "/results/:resultId",
  requireTenantPermission("discovery.manage"),
  validateRequest({
    params: discoveryResultIdParamSchema,
    body: updateDiscoveryResultSchema,
  }),
  discoveryResultController.update,
);
discoveryItsmRouter.delete(
  "/results/:resultId",
  requireTenantPermission("discovery.manage"),
  validateRequest({ params: discoveryResultIdParamSchema }),
  discoveryResultController.remove,
);
