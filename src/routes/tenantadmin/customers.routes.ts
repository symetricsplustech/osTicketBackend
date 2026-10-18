import { Router } from 'express';
import { customerController } from '../../controllers/tenantadmin/customers.controller';
import { requireTenantPermission, validateRequest } from '../../api/middleware';
import {
  createContactSchema,
  createCustomerSchema,
  createSiteSchema,
  customerContactParamsSchema,
  customerIdParamSchema,
  customerSiteParamsSchema,
  updateContactSchema,
  updateCustomerSchema,
  updateSiteSchema,
} from '../../validators/tenantadmin/customers.validators';

export const customersTenantRouter = Router();

// Cross-customer listings must be declared before `/:customerId`.
customersTenantRouter.get('/contacts', requireTenantPermission('customers.read'), customerController.listContacts);
customersTenantRouter.get('/sites', requireTenantPermission('customers.read'), customerController.listSites);

// Customer directory
customersTenantRouter.get('/', requireTenantPermission('customers.read'), customerController.list);
customersTenantRouter.post(
  '/',
  requireTenantPermission('customers.manage'),
  validateRequest({ body: createCustomerSchema }),
  customerController.create,
);
customersTenantRouter.get(
  '/:customerId',
  requireTenantPermission('customers.read'),
  validateRequest({ params: customerIdParamSchema }),
  customerController.get,
);
customersTenantRouter.patch(
  '/:customerId',
  requireTenantPermission('customers.manage'),
  validateRequest({ params: customerIdParamSchema, body: updateCustomerSchema }),
  customerController.update,
);
customersTenantRouter.delete(
  '/:customerId',
  requireTenantPermission('customers.manage'),
  validateRequest({ params: customerIdParamSchema }),
  customerController.remove,
);

// Contacts & portal access
customersTenantRouter.post(
  '/:customerId/contacts',
  requireTenantPermission('customers.contacts.manage'),
  validateRequest({ params: customerIdParamSchema, body: createContactSchema }),
  customerController.createContact,
);
customersTenantRouter.patch(
  '/:customerId/contacts/:contactId',
  requireTenantPermission('customers.contacts.manage'),
  validateRequest({ params: customerContactParamsSchema, body: updateContactSchema }),
  customerController.updateContact,
);
customersTenantRouter.delete(
  '/:customerId/contacts/:contactId',
  requireTenantPermission('customers.contacts.manage'),
  validateRequest({ params: customerContactParamsSchema }),
  customerController.removeContact,
);
customersTenantRouter.post(
  '/:customerId/contacts/:contactId/portal/invite',
  requireTenantPermission('customers.portal.manage'),
  validateRequest({ params: customerContactParamsSchema }),
  customerController.inviteContactPortal,
);
customersTenantRouter.post(
  '/:customerId/contacts/:contactId/portal/revoke',
  requireTenantPermission('customers.portal.manage'),
  validateRequest({ params: customerContactParamsSchema }),
  customerController.revokeContactPortal,
);

// Sites & data center locations
customersTenantRouter.post(
  '/:customerId/sites',
  requireTenantPermission('customers.sites.manage'),
  validateRequest({ params: customerIdParamSchema, body: createSiteSchema }),
  customerController.createSite,
);
customersTenantRouter.patch(
  '/:customerId/sites/:siteId',
  requireTenantPermission('customers.sites.manage'),
  validateRequest({ params: customerSiteParamsSchema, body: updateSiteSchema }),
  customerController.updateSite,
);
customersTenantRouter.delete(
  '/:customerId/sites/:siteId',
  requireTenantPermission('customers.sites.manage'),
  validateRequest({ params: customerSiteParamsSchema }),
  customerController.removeSite,
);
