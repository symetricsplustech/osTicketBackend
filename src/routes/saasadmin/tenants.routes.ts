import { Router } from 'express';
import * as tenantsController from '../../controllers/saasadmin/tenants.controller';
import * as domainsController from '../../controllers/saasadmin/tenant-domains.controller';
import { authenticate, authorize, validateRequest } from '../../api/middleware';
import { tenantContext } from '../../api/middleware/tenant-context';
import {
  archiveTenantSchema,
  createTenantSchema,
  createTenantUserSchema,
  impersonationSchema,
  suspendTenantSchema,
  tenantIdParamSchema,
  updateTenantSchema,
} from '../../validators/saasadmin/tenants.validators';
import { tenantDomainsRouter } from './tenant-domains.routes';

export const tenantsAdminRouter = Router();
tenantsAdminRouter.use(authenticate);

tenantsAdminRouter.get('/', authorize('admin.tenants.read'), tenantsController.listTenants);
tenantsAdminRouter.post(
  '/',
  authorize('admin.tenants.create'),
  validateRequest({ body: createTenantSchema }),
  tenantsController.createTenantHandler,
);

// Platform-wide domain directory (must be registered before the `/:tenantId`
// parameter middleware so "domains" is not interpreted as a tenant id).
tenantsAdminRouter.get('/domains', authorize('admin.tenants.domains.read'), domainsController.listAllDomainsHandler);

tenantsAdminRouter.use('/:tenantId', validateRequest({ params: tenantIdParamSchema }), tenantContext());

tenantsAdminRouter.get('/:tenantId', authorize('admin.tenants.read'), tenantsController.getTenant);
tenantsAdminRouter.patch(
  '/:tenantId',
  authorize('admin.tenants.update'),
  validateRequest({ body: updateTenantSchema }),
  tenantsController.updateTenantHandler,
);
tenantsAdminRouter.post('/:tenantId/activate', authorize('admin.tenants.update'), tenantsController.activateTenant);
tenantsAdminRouter.post(
  '/:tenantId/suspend',
  authorize('admin.tenants.suspend'),
  validateRequest({ body: suspendTenantSchema }),
  tenantsController.suspendTenant,
);
tenantsAdminRouter.post('/:tenantId/reactivate', authorize('admin.tenants.suspend'), tenantsController.reactivateTenant);
tenantsAdminRouter.post(
  '/:tenantId/archive',
  authorize('admin.tenants.suspend'),
  validateRequest({ body: archiveTenantSchema }),
  tenantsController.archiveTenant,
);
tenantsAdminRouter.get('/:tenantId/overview', authorize('admin.tenants.read'), tenantsController.tenantOverview);
tenantsAdminRouter.get('/:tenantId/users', authorize('admin.tenants.read'), tenantsController.tenantUsers);
tenantsAdminRouter.post(
  '/:tenantId/users',
  authorize('admin.tenants.update'),
  validateRequest({ body: createTenantUserSchema }),
  tenantsController.createTenantOrgUserHandler,
);
tenantsAdminRouter.get('/:tenantId/activity', authorize('admin.tenants.read'), tenantsController.tenantActivity);
tenantsAdminRouter.get('/:tenantId/health', authorize('admin.tenants.read'), tenantsController.tenantHealth);
tenantsAdminRouter.post('/:tenantId/provision', authorize('admin.tenants.provision'), tenantsController.provisionTenantHandler);
tenantsAdminRouter.get('/:tenantId/provisioning-status', authorize('admin.tenants.read'), tenantsController.provisioningStatus);
tenantsAdminRouter.post(
  '/:tenantId/impersonation-sessions',
  authorize('admin.tenants.impersonate'),
  validateRequest({ body: impersonationSchema }),
  tenantsController.createImpersonationSession,
);

tenantsAdminRouter.use('/:tenantId/domains', tenantDomainsRouter);
