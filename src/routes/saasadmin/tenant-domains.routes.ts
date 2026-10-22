import { Router } from "express";
import * as domainsController from "../../controllers/saasadmin/tenant-domains.controller";
import { authorize, validateRequest } from "../../api/middleware";
import {
  addDomainSchema,
  domainIdsParamSchema,
} from "../../validators/saasadmin/tenant-domains.validators";

export const tenantDomainsRouter = Router({ mergeParams: true });

tenantDomainsRouter.get(
  "/",
  authorize("admin.tenants.domains.read"),
  domainsController.listDomainsHandler,
);
tenantDomainsRouter.post(
  "/",
  authorize("admin.tenants.domains.manage"),
  validateRequest({ body: addDomainSchema }),
  domainsController.addDomainHandler,
);
tenantDomainsRouter.get(
  "/:domainId",
  authorize("admin.tenants.domains.read"),
  validateRequest({ params: domainIdsParamSchema }),
  domainsController.getDomainHandler,
);
tenantDomainsRouter.post(
  "/:domainId/verify",
  authorize("admin.tenants.domains.manage"),
  validateRequest({ params: domainIdsParamSchema }),
  domainsController.verifyDomainHandler,
);
tenantDomainsRouter.post(
  "/:domainId/activate",
  authorize("admin.tenants.domains.manage"),
  validateRequest({ params: domainIdsParamSchema }),
  domainsController.activateDomainHandler,
);
tenantDomainsRouter.post(
  "/:domainId/disable",
  authorize("admin.tenants.domains.manage"),
  validateRequest({ params: domainIdsParamSchema }),
  domainsController.disableDomainHandler,
);
tenantDomainsRouter.delete(
  "/:domainId",
  authorize("admin.tenants.domains.manage"),
  validateRequest({ params: domainIdsParamSchema }),
  domainsController.removeDomainHandler,
);
tenantDomainsRouter.get(
  "/:domainId/verification-status",
  authorize("admin.tenants.domains.read"),
  validateRequest({ params: domainIdsParamSchema }),
  domainsController.verificationStatusHandler,
);
