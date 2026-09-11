/**
 * Request Management API routes — catalog, cart, REQ, RITM, SCTASK.
 * Base: /core/requests/*
 */
const router = require('express').Router();
const ctrl = require('../../controllers/core/request.controller');
const { protectTenantPrincipal } = require('../../middleware/auth');
const { validateBody, validateParams } = require('../../middleware/validation');
const { z } = require('zod');

// ─── Catalog CRUD ───────────────────────────────────────────────────────
router.get('/catalogs', protectTenantPrincipal, ctrl.listCatalogs);
router.get('/catalogs/:id', protectTenantPrincipal, ctrl.getCatalog);
router.post('/catalogs', protectTenantPrincipal, ctrl.createCatalog);
router.put('/catalogs/:id', protectTenantPrincipal, ctrl.updateCatalog);
router.delete('/catalogs/:id', protectTenantPrincipal, ctrl.deleteCatalog);

// ─── Categories ─────────────────────────────────────────────────────────
router.get('/categories', protectTenantPrincipal, ctrl.listCategories);
router.get('/categories/:id', protectTenantPrincipal, ctrl.getCategory);
router.post('/categories', protectTenantPrincipal, ctrl.createCategory);
router.put('/categories/:id', protectTenantPrincipal, ctrl.updateCategory);
router.delete('/categories/:id', protectTenantPrincipal, ctrl.deleteCategory);

// ─── Catalog Items ──────────────────────────────────────────────────────
router.get('/items', protectTenantPrincipal, ctrl.listCatalogItems);
router.get('/items/:id', protectTenantPrincipal, ctrl.getCatalogItem);
router.post('/items', protectTenantPrincipal, ctrl.createCatalogItem);
router.put('/items/:id', protectTenantPrincipal, ctrl.updateCatalogItem);
router.delete('/items/:id', protectTenantPrincipal, ctrl.deleteCatalogItem);
router.post('/items/:id/publish', protectTenantPrincipal, ctrl.publishItem);
router.post('/items/:id/retire', protectTenantPrincipal, ctrl.retireItem);

// ─── Variables ──────────────────────────────────────────────────────────
router.get('/items/:itemId/variables', protectTenantPrincipal, ctrl.listItemVariables);
router.post('/items/:itemId/variables', protectTenantPrincipal, ctrl.createItemVariable);
router.put('/variables/:id', protectTenantPrincipal, ctrl.updateItemVariable);
router.delete('/variables/:id', protectTenantPrincipal, ctrl.deleteItemVariable);

// ─── Variable Sets ──────────────────────────────────────────────────────
router.get('/variable-sets', protectTenantPrincipal, ctrl.listVariableSets);
router.post('/variable-sets', protectTenantPrincipal, ctrl.createVariableSet);
router.delete('/variable-sets/:id', protectTenantPrincipal, ctrl.deleteVariableSet);

// ─── User Criteria ──────────────────────────────────────────────────────
router.get('/items/:itemId/criteria', protectTenantPrincipal, ctrl.listUserCriteria);
router.post('/items/:itemId/criteria', protectTenantPrincipal, ctrl.createUserCriteria);
router.put('/criteria/:id', protectTenantPrincipal, ctrl.updateUserCriteria);
router.delete('/criteria/:id', protectTenantPrincipal, ctrl.deleteUserCriteria);
router.get('/items/:itemId/eligibility', protectTenantPrincipal, ctrl.checkEligibility);

// ─── Cart ───────────────────────────────────────────────────────────────
router.get('/cart', protectTenantPrincipal, ctrl.getMyCart);
router.get('/cart/:id', protectTenantPrincipal, ctrl.getCart);
router.post('/cart/:id/items', protectTenantPrincipal, ctrl.addToCart);
router.put('/cart/items/:id', protectTenantPrincipal, ctrl.updateCartItem);
router.delete('/cart/items/:id', protectTenantPrincipal, ctrl.removeFromCart);
router.post('/cart/:id/abandon', protectTenantPrincipal, ctrl.abandonCart);

// ─── Checkout / Order ───────────────────────────────────────────────────
router.post('/cart/:id/checkout', protectTenantPrincipal, ctrl.checkout);
router.post('/items/:itemId/order', protectTenantPrincipal, ctrl.orderDirect);

// ─── Requests (REQ) ─────────────────────────────────────────────────────
router.get('/reqs', protectTenantPrincipal, ctrl.listRequests);
router.get('/reqs/:id', protectTenantPrincipal, ctrl.getRequest);
router.post('/reqs/:id/transition', protectTenantPrincipal, ctrl.transitionRequest);
router.post('/reqs/:id/cancel', protectTenantPrincipal, ctrl.cancelRequest);

// ─── Requested Items (RITM) ─────────────────────────────────────────────
router.get('/ritms', protectTenantPrincipal, ctrl.listRITMs);
router.get('/ritms/:id', protectTenantPrincipal, ctrl.getRITM);
router.post('/ritms/:id/transition', protectTenantPrincipal, ctrl.transitionRITM);

// ─── Catalog Tasks (SCTASK) ─────────────────────────────────────────────
router.get('/tasks', protectTenantPrincipal, ctrl.listCatalogTasks);
router.get('/tasks/:id', protectTenantPrincipal, ctrl.getCatalogTask);
router.post('/tasks/:id/transition', protectTenantPrincipal, ctrl.transitionCatalogTask);

// ─── Approvals ──────────────────────────────────────────────────────────
router.get('/approvals', protectTenantPrincipal, ctrl.listRequestApprovals);
router.post('/approvals/:id/decide', protectTenantPrincipal, ctrl.decideRequestApproval);

// ─── Fulfillment Plans ──────────────────────────────────────────────────
router.get('/fulfillment-plans', protectTenantPrincipal, ctrl.listFulfillmentPlans);
router.get('/fulfillment-plans/:id', protectTenantPrincipal, ctrl.getFulfillmentPlan);
router.post('/fulfillment-plans', protectTenantPrincipal, ctrl.createFulfillmentPlan);
router.post('/fulfillment-plans/:planId/steps', protectTenantPrincipal, ctrl.addFulfillmentStep);

// ─── Entitlements ───────────────────────────────────────────────────────
router.get('/entitlements', protectTenantPrincipal, ctrl.listEntitlements);
router.post('/entitlements', protectTenantPrincipal, ctrl.createEntitlement);
router.get('/entitlements/check/:catalogItemId', protectTenantPrincipal, ctrl.checkEntitlement);

module.exports = router;
