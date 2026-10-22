import { Router } from "express";
import { locationController } from "../../controllers/tenantadmin/locations.controller";
import { requireTenantPermission, validateRequest } from "../../api/middleware";
import {
  createLocationSchema,
  locationIdParamSchema,
  updateLocationSchema,
} from "../../validators/tenantadmin/locations.validators";

export const locationsTenantRouter = Router();

locationsTenantRouter.get(
  "/",
  requireTenantPermission("locations.read"),
  locationController.list,
);
locationsTenantRouter.post(
  "/",
  requireTenantPermission("locations.manage"),
  validateRequest({ body: createLocationSchema }),
  locationController.create,
);
locationsTenantRouter.get(
  "/:locationId",
  requireTenantPermission("locations.read"),
  validateRequest({ params: locationIdParamSchema }),
  locationController.get,
);
locationsTenantRouter.patch(
  "/:locationId",
  requireTenantPermission("locations.manage"),
  validateRequest({
    params: locationIdParamSchema,
    body: updateLocationSchema,
  }),
  locationController.update,
);
locationsTenantRouter.delete(
  "/:locationId",
  requireTenantPermission("locations.manage"),
  validateRequest({ params: locationIdParamSchema }),
  locationController.remove,
);
