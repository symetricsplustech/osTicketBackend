/**
 * Request Management API routes — catalog, cart, REQ, RITM, SCTASK.
 * Base: /core/requests/*
 */
const router = require('express').Router();
const ctrl = require('../../controllers/core/request.controller');
const { protectTenantPrincipal, requirePermission, requireResolvedPermission } = require('../../middleware/auth');
const { validateBody, validateParams } = require('../../middleware/validation');
const { z } = require('zod');

// ─── Catalog CRUD ───────────────────────────────────────────────────────
router.get('/catalogs', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog.read'), ctrl.listCatalogs);
router.get('/catalogs/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog.read'), ctrl.getCatalog);
router.post('/catalogs', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog.create'), ctrl.createCatalog);
router.put('/catalogs/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog.update'), ctrl.updateCatalog);
router.delete('/catalogs/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog.delete'), ctrl.deleteCatalog);

// ─── Categories ─────────────────────────────────────────────────────────
router.get('/categories', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_category.read'), ctrl.listCategories);
router.get('/categories/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_category.read'), ctrl.getCategory);
router.post('/categories', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_category.create'), ctrl.createCategory);
router.put('/categories/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_category.update'), ctrl.updateCategory);
router.delete('/categories/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_category.delete'), ctrl.deleteCategory);

// ─── Catalog Items ──────────────────────────────────────────────────────
router.get('/items', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item.read'), ctrl.listCatalogItems);
router.get('/items/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item.read'), ctrl.getCatalogItem);
router.post('/items', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item.create'), ctrl.createCatalogItem);
router.put('/items/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item.update'), ctrl.updateCatalogItem);
router.delete('/items/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item.delete'), ctrl.deleteCatalogItem);
router.post('/items/:id/publish', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item_publish'), ctrl.publishItem);
router.post('/items/:id/retire', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item_retire'), ctrl.retireItem);

// ─── Variables ──────────────────────────────────────────────────────────
router.get('/items/:itemId/variables', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item.read'), ctrl.listItemVariables);
router.post('/items/:itemId/variables', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item_variable.create'), ctrl.createItemVariable);
router.put('/variables/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item_variable.update'), ctrl.updateItemVariable);
router.delete('/variables/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item_variable.delete'), ctrl.deleteItemVariable);

// ─── Variable Sets ──────────────────────────────────────────────────────
router.get('/variable-sets', protectTenantPrincipal, requirePermission('itsm.request_catalog.variable_set.read'), ctrl.listVariableSets);
router.post('/variable-sets', protectTenantPrincipal, requirePermission('itsm.request_catalog.variable_set.create'), ctrl.createVariableSet);
router.delete('/variable-sets/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.variable_set.delete'), ctrl.deleteVariableSet);

// ─── User Criteria ──────────────────────────────────────────────────────
router.get('/items/:itemId/criteria', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item.read'), ctrl.listUserCriteria);
router.post('/items/:itemId/criteria', protectTenantPrincipal, requirePermission('itsm.request_catalog.user_criteria.create'), ctrl.createUserCriteria);
router.put('/criteria/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.user_criteria.update'), ctrl.updateUserCriteria);
router.delete('/criteria/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.user_criteria.delete'), ctrl.deleteUserCriteria);
router.get('/items/:itemId/eligibility', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_manage_eligibility'), ctrl.checkEligibility);

// ─── Cart ───────────────────────────────────────────────────────────────
router.get('/cart', protectTenantPrincipal, requirePermission('itsm.request_catalog.cart.read'), ctrl.getMyCart);
router.get('/cart/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.cart.read'), ctrl.getCart);
router.post('/cart/:id/items', protectTenantPrincipal, requirePermission('itsm.request_catalog.cart_add'), ctrl.addToCart);
router.put('/cart/items/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.cart_update'), ctrl.updateCartItem);
router.delete('/cart/items/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.cart_remove'), ctrl.removeFromCart);
router.post('/cart/:id/abandon', protectTenantPrincipal, requirePermission('itsm.request_catalog.cart.update'), ctrl.abandonCart);

// ─── Checkout / Order ───────────────────────────────────────────────────
router.post('/cart/:id/checkout', protectTenantPrincipal, requirePermission('itsm.request_catalog.cart_checkout'), ctrl.checkout);
router.post('/items/:itemId/order', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_item_request'), ctrl.orderDirect);

// ─── Requests (REQ) ─────────────────────────────────────────────────────
router.get('/reqs', protectTenantPrincipal, requirePermission('itsm.request_catalog.request.read'), ctrl.listRequests);
router.get('/reqs/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.request.read'), ctrl.getRequest);
router.post('/reqs/:id/transition', protectTenantPrincipal, requirePermission('itsm.request_catalog.request.update'), ctrl.transitionRequest);
router.post('/reqs/:id/cancel', protectTenantPrincipal, requirePermission('itsm.request_catalog.request_cancel'), ctrl.cancelRequest);

// ─── Requested Items (RITM) ─────────────────────────────────────────────
router.get('/ritms', protectTenantPrincipal, requirePermission('itsm.request_catalog.requested_item.read'), ctrl.listRITMs);
router.get('/ritms/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.requested_item.read'), ctrl.getRITM);
router.post('/ritms/:id/transition', protectTenantPrincipal, requirePermission('itsm.request_catalog.ritm_update'), ctrl.transitionRITM);

// ─── Catalog Tasks (SCTASK) ─────────────────────────────────────────────
router.get('/tasks', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_task.read'), ctrl.listCatalogTasks);
router.get('/tasks/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_task.read'), ctrl.getCatalogTask);
router.post('/tasks/:id/transition', protectTenantPrincipal, requirePermission('itsm.request_catalog.sctask_update'), ctrl.transitionCatalogTask);

// ─── Approvals ──────────────────────────────────────────────────────────
router.get('/approvals', protectTenantPrincipal, requirePermission('itsm.request_catalog.request_approval.read'), ctrl.listRequestApprovals);
router.post('/approvals/:id/decide', protectTenantPrincipal, requireResolvedPermission((req) =>
  req.body.decision === 'rejected' ? 'itsm.request_catalog.ritm_reject' :
    req.body.decision === 'approved' ? 'itsm.request_catalog.ritm_approve' : null
), ctrl.decideRequestApproval);

// ─── Fulfillment Plans ──────────────────────────────────────────────────
router.get('/fulfillment-plans', protectTenantPrincipal, requirePermission('itsm.request_catalog.fulfillment_plan.read'), ctrl.listFulfillmentPlans);
router.get('/fulfillment-plans/:id', protectTenantPrincipal, requirePermission('itsm.request_catalog.fulfillment_plan.read'), ctrl.getFulfillmentPlan);
router.post('/fulfillment-plans', protectTenantPrincipal, requirePermission('itsm.request_catalog.fulfillment_plan.create'), ctrl.createFulfillmentPlan);
router.post('/fulfillment-plans/:planId/steps', protectTenantPrincipal, requirePermission('itsm.request_catalog.fulfillment_step.create'), ctrl.addFulfillmentStep);

// ─── Entitlements ───────────────────────────────────────────────────────
router.get('/entitlements', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_entitlement.read'), ctrl.listEntitlements);
router.post('/entitlements', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_entitlement.create'), ctrl.createEntitlement);
router.get('/entitlements/check/:catalogItemId', protectTenantPrincipal, requirePermission('itsm.request_catalog.catalog_entitlement.read'), ctrl.checkEntitlement);

module.exports = router;
