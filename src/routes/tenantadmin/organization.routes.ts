import { Router } from 'express';
import * as organizationController from '../../controllers/tenantadmin/organization.controller';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import {
  updateOrganizationBrandingSchema,
  updateOrganizationBusinessHoursSchema,
  updateOrganizationLocalizationSchema,
  updateOrganizationSchema,
} from '../../validators/tenantadmin/organization.validators';

export const organizationTenantRouter = Router();

organizationTenantRouter.get(
  '/',
  requireTenantPermission('organization.read'),
  organizationController.getOrganizationHandler,
);
organizationTenantRouter.patch(
  '/',
  requireTenantPermission('organization.update'),
  validateRequest({ body: updateOrganizationSchema }),
  organizationController.updateOrganizationHandler,
);

organizationTenantRouter.get(
  '/branding',
  requireTenantPermission('organization.read'),
  organizationController.getBrandingHandler,
);
organizationTenantRouter.put(
  '/branding',
  requireTenantPermission('organization.branding.manage'),
  validateRequest({ body: updateOrganizationBrandingSchema }),
  organizationController.updateBrandingHandler,
);

organizationTenantRouter.get(
  '/localization',
  requireTenantPermission('organization.read'),
  organizationController.getLocalizationHandler,
);
organizationTenantRouter.put(
  '/localization',
  requireTenantPermission('organization.localization.manage'),
  validateRequest({ body: updateOrganizationLocalizationSchema }),
  organizationController.updateLocalizationHandler,
);

organizationTenantRouter.get(
  '/business-hours',
  requireTenantPermission('organization.read'),
  organizationController.getBusinessHoursHandler,
);
organizationTenantRouter.put(
  '/business-hours',
  requireTenantPermission('organization.business_hours.manage'),
  validateRequest({ body: updateOrganizationBusinessHoursSchema }),
  organizationController.updateBusinessHoursHandler,
);
