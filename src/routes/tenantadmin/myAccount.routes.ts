import { Router } from "express";
import * as myAccountController from "../../controllers/tenantadmin/myAccount.controller";
import { validateRequest } from "../../api/middleware";
import {
  updatePreferencesSchema,
  updateProfileSchema,
} from "../../validators/tenantadmin/myAccount.validators";

export const myAccountTenantRouter = Router();

myAccountTenantRouter.get("/", myAccountController.getMyAccountHandler);
myAccountTenantRouter.patch(
  "/profile",
  validateRequest({ body: updateProfileSchema }),
  myAccountController.updateMyProfileHandler,
);
myAccountTenantRouter.get(
  "/preferences",
  myAccountController.getMyPreferencesHandler,
);
myAccountTenantRouter.put(
  "/preferences",
  validateRequest({ body: updatePreferencesSchema }),
  myAccountController.updateMyPreferencesHandler,
);
myAccountTenantRouter.get(
  "/security",
  myAccountController.getMySecurityHandler,
);
myAccountTenantRouter.get(
  "/activity",
  myAccountController.getMyRecentActivityHandler,
);
