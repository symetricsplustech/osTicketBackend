/**
 * Request Management controller — HTTP layer for catalog, cart, REQ, RITM, SCTASK.
 */
const requestService = require('../../services/requestService');

// ─── Catalog ────────────────────────────────────────────────────────────

exports.listCatalogs = async (req, res, next) => {
  try {
    const result = await requestService.listCatalogs({ tenantId: req.tenantId }, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getCatalog = async (req, res, next) => {
  try {
    const result = await requestService.getCatalog({ tenantId: req.tenantId }, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.createCatalog = async (req, res, next) => {
  try {
    const result = await requestService.createCatalog({ tenantId: req.tenantId }, req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.updateCatalog = async (req, res, next) => {
  try {
    const result = await requestService.updateCatalog({ tenantId: req.tenantId }, req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.deleteCatalog = async (req, res, next) => {
  try {
    const result = await requestService.deleteCatalog({ tenantId: req.tenantId }, req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Categories ─────────────────────────────────────────────────────────

exports.listCategories = async (req, res, next) => {
  try {
    const result = await requestService.listCategories({ tenantId: req.tenantId }, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getCategory = async (req, res, next) => {
  try {
    const result = await requestService.getCategory({ tenantId: req.tenantId }, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.createCategory = async (req, res, next) => {
  try {
    const result = await requestService.createCategory({ tenantId: req.tenantId }, req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const result = await requestService.updateCategory({ tenantId: req.tenantId }, req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const result = await requestService.deleteCategory({ tenantId: req.tenantId }, req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Catalog Items ──────────────────────────────────────────────────────

exports.listCatalogItems = async (req, res, next) => {
  try {
    const result = await requestService.listCatalogItems({ tenantId: req.tenantId }, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getCatalogItem = async (req, res, next) => {
  try {
    const result = await requestService.getCatalogItem({ tenantId: req.tenantId }, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.createCatalogItem = async (req, res, next) => {
  try {
    const result = await requestService.createCatalogItem({ tenantId: req.tenantId }, req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.updateCatalogItem = async (req, res, next) => {
  try {
    const result = await requestService.updateCatalogItem({ tenantId: req.tenantId }, req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.deleteCatalogItem = async (req, res, next) => {
  try {
    const result = await requestService.deleteCatalogItem({ tenantId: req.tenantId }, req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.publishItem = async (req, res, next) => {
  try {
    const result = await requestService.publishItem({ tenantId: req.tenantId }, req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.retireItem = async (req, res, next) => {
  try {
    const result = await requestService.retireItem({ tenantId: req.tenantId }, req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Variables ──────────────────────────────────────────────────────────

exports.listItemVariables = async (req, res, next) => {
  try {
    const result = await requestService.listItemVariables({ tenantId: req.tenantId }, req.params.itemId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.createItemVariable = async (req, res, next) => {
  try {
    const result = await requestService.createItemVariable({ tenantId: req.tenantId }, req.params.itemId, req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.updateItemVariable = async (req, res, next) => {
  try {
    const result = await requestService.updateItemVariable({ tenantId: req.tenantId }, req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.deleteItemVariable = async (req, res, next) => {
  try {
    const result = await requestService.deleteItemVariable({ tenantId: req.tenantId }, req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Variable Sets ──────────────────────────────────────────────────────

exports.listVariableSets = async (req, res, next) => {
  try {
    const result = await requestService.listVariableSets({ tenantId: req.tenantId }, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.createVariableSet = async (req, res, next) => {
  try {
    const result = await requestService.createVariableSet({ tenantId: req.tenantId }, req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.deleteVariableSet = async (req, res, next) => {
  try {
    const result = await requestService.deleteVariableSet({ tenantId: req.tenantId }, req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── User Criteria ──────────────────────────────────────────────────────

exports.listUserCriteria = async (req, res, next) => {
  try {
    const result = await requestService.listUserCriteria({ tenantId: req.tenantId }, req.params.itemId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.createUserCriteria = async (req, res, next) => {
  try {
    const result = await requestService.createUserCriteria({ tenantId: req.tenantId }, req.params.itemId, req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.updateUserCriteria = async (req, res, next) => {
  try {
    const result = await requestService.updateUserCriteria({ tenantId: req.tenantId }, req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.deleteUserCriteria = async (req, res, next) => {
  try {
    const result = await requestService.deleteUserCriteria({ tenantId: req.tenantId }, req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.checkEligibility = async (req, res, next) => {
  try {
    const result = await requestService.checkEligibility({ tenantId: req.tenantId }, req.params.itemId, req.user.userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Cart ───────────────────────────────────────────────────────────────

exports.getMyCart = async (req, res, next) => {
  try {
    const result = await requestService.getOrCreateCart({ tenantId: req.tenantId }, req.user.userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getCart = async (req, res, next) => {
  try {
    const result = await requestService.getCart({ tenantId: req.tenantId }, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.addToCart = async (req, res, next) => {
  try {
    const result = await requestService.addToCart({ tenantId: req.tenantId }, req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.updateCartItem = async (req, res, next) => {
  try {
    const result = await requestService.updateCartItem({ tenantId: req.tenantId }, req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.removeFromCart = async (req, res, next) => {
  try {
    const result = await requestService.removeFromCart({ tenantId: req.tenantId }, req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.abandonCart = async (req, res, next) => {
  try {
    const result = await requestService.abandonCart({ tenantId: req.tenantId }, req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Checkout / Order ───────────────────────────────────────────────────

exports.checkout = async (req, res, next) => {
  try {
    const result = await requestService.checkout({ tenantId: req.tenantId }, req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.orderDirect = async (req, res, next) => {
  try {
    const result = await requestService.orderDirect({ tenantId: req.tenantId }, req.params.itemId, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Request ────────────────────────────────────────────────────────────

exports.listRequests = async (req, res, next) => {
  try {
    const result = await requestService.listRequests({ tenantId: req.tenantId }, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getRequest = async (req, res, next) => {
  try {
    const result = await requestService.getRequest({ tenantId: req.tenantId }, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.transitionRequest = async (req, res, next) => {
  try {
    const result = await requestService.transitionRequest({ tenantId: req.tenantId }, req.params.id, req.body.status, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.cancelRequest = async (req, res, next) => {
  try {
    const result = await requestService.cancelRequest({ tenantId: req.tenantId }, req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── RITM ───────────────────────────────────────────────────────────────

exports.listRITMs = async (req, res, next) => {
  try {
    const result = await requestService.listRITMs({ tenantId: req.tenantId }, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getRITM = async (req, res, next) => {
  try {
    const result = await requestService.getRITM({ tenantId: req.tenantId }, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.transitionRITM = async (req, res, next) => {
  try {
    const result = await requestService.transitionRITM({ tenantId: req.tenantId }, req.params.id, req.body.status, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Catalog Tasks ──────────────────────────────────────────────────────

exports.listCatalogTasks = async (req, res, next) => {
  try {
    const result = await requestService.listCatalogTasks({ tenantId: req.tenantId }, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getCatalogTask = async (req, res, next) => {
  try {
    const result = await requestService.getCatalogTask({ tenantId: req.tenantId }, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.transitionCatalogTask = async (req, res, next) => {
  try {
    const result = await requestService.transitionCatalogTask({ tenantId: req.tenantId }, req.params.id, req.body.status, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Approvals ──────────────────────────────────────────────────────────

exports.listRequestApprovals = async (req, res, next) => {
  try {
    const result = await requestService.listRequestApprovals({ tenantId: req.tenantId }, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.decideRequestApproval = async (req, res, next) => {
  try {
    const result = await requestService.decideRequestApproval({ tenantId: req.tenantId }, req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Fulfillment Plans ──────────────────────────────────────────────────

exports.listFulfillmentPlans = async (req, res, next) => {
  try {
    const result = await requestService.listFulfillmentPlans({ tenantId: req.tenantId }, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getFulfillmentPlan = async (req, res, next) => {
  try {
    const result = await requestService.getFulfillmentPlan({ tenantId: req.tenantId }, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.createFulfillmentPlan = async (req, res, next) => {
  try {
    const result = await requestService.createFulfillmentPlan({ tenantId: req.tenantId }, req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.addFulfillmentStep = async (req, res, next) => {
  try {
    const result = await requestService.addFulfillmentStep({ tenantId: req.tenantId }, req.params.planId, req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// ─── Entitlements ───────────────────────────────────────────────────────

exports.listEntitlements = async (req, res, next) => {
  try {
    const result = await requestService.listEntitlements({ tenantId: req.tenantId }, req.query);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.createEntitlement = async (req, res, next) => {
  try {
    const result = await requestService.createEntitlement({ tenantId: req.tenantId }, req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.checkEntitlement = async (req, res, next) => {
  try {
    const result = await requestService.checkEntitlement({ tenantId: req.tenantId }, req.params.catalogItemId, req.user.userId, req.query.scopeType, req.query.scopeId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
