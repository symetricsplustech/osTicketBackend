import { Router } from 'express';
import * as organizationStructureController from '../../controllers/tenantadmin/organizationStructure.controller';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import { updateOrganizationStructureSchema } from '../../validators/tenantadmin/organizationStructure.validators';

export const organizationStructureTenantRouter = Router();

organizationStructureTenantRouter.get(
  '/',
  requireTenantPermission('organization_structure.read'),
  organizationStructureController.getOrganizationStructureHandler,
);
organizationStructureTenantRouter.put(
  '/',
  requireTenantPermission('organization_structure.manage'),
  validateRequest({ body: updateOrganizationStructureSchema }),
  organizationStructureController.updateOrganizationStructureHandler,
);
