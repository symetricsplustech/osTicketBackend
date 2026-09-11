/**
 * Request Management service — business logic for catalog, cart, REQ, RITM, SCTASK.
 * Handles the full lifecycle from browsing to checkout to fulfillment.
 */
const mongoose = require("mongoose");
const { emitEvent } = require("../realtime/socketManager");
const auditEventService = require("./auditEventService");
const numberingService = require("./numbering.service");
const { assertTransition } = require("./stateMachine.service");

// ─── Helpers ────────────────────────────────────────────────────────────
// Register catalog models before retrieving them from Mongoose's registry.
require("../models/helpdesk/catalog/Catalog");
require("../models/helpdesk/catalog/CatalogCategory");
require("../models/helpdesk/catalog/CatalogItem");
require("../models/helpdesk/catalog/CatalogItemVariable");
require("../models/helpdesk/catalog/VariableSet");
require("../models/helpdesk/catalog/UserCriteria");
require("../models/helpdesk/catalog/Cart");
require("../models/helpdesk/catalog/CartItem");
require("../models/helpdesk/catalog/Request");
require("../models/helpdesk/catalog/RequestedItem");
require("../models/helpdesk/catalog/CatalogTask");
require("../models/helpdesk/catalog/RequestApproval");
require("../models/helpdesk/catalog/ItemApproval");
require("../models/helpdesk/catalog/FulfillmentPlan");
require("../models/helpdesk/catalog/FulfillmentStep");
require("../models/helpdesk/catalog/CatalogEntitlement");

const requireTenant = (ctx) => {
  if (!ctx.tenantId)
    throw Object.assign(new Error("Tenant context required"), {
      statusCode: 400,
    });
  return ctx.tenantId;
};

const pick = (obj, keys) =>
  Object.fromEntries(
    keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]),
  );

// ─── Catalog Management ─────────────────────────────────────────────────

const Catalog = mongoose.model("Catalog");
const CatalogCategory = mongoose.model("CatalogCategory");
const CatalogItem = mongoose.model("CatalogItem");
const CatalogItemVariable = mongoose.model("CatalogItemVariable");
const VariableSet = mongoose.model("VariableSet");
const UserCriteria = mongoose.model("UserCriteria");
const Cart = mongoose.model("Cart");
const CartItem = mongoose.model("CartItem");
const Request = mongoose.model("Request");
const RequestedItem = mongoose.model("RequestedItem");
const CatalogTask = mongoose.model("CatalogTask");
const RequestApproval = mongoose.model("RequestApproval");
const ItemApproval = mongoose.model("ItemApproval");
const FulfillmentPlan = mongoose.model("FulfillmentPlan");
const FulfillmentStep = mongoose.model("FulfillmentStep");
const CatalogEntitlement = mongoose.model("CatalogEntitlement");

// ─── Catalog CRUD ───────────────────────────────────────────────────────

exports.listCatalogs = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["isActive", "visibleInPortal"]),
  };
  if (query.search)
    filter.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { title: { $regex: query.search, $options: "i" } },
    ];
  return Catalog.find(filter).sort({ sortOrder: 1, name: 1 });
};

exports.getCatalog = async (ctx, catalogId) => {
  const tenantId = requireTenant(ctx);
  const catalog = await Catalog.findOne({
    _id: catalogId,
    tenantId,
    isDeleted: false,
  });
  if (!catalog)
    throw Object.assign(new Error("Catalog not found"), { statusCode: 404 });
  return catalog;
};

exports.createCatalog = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "CAT");
  const catalog = await Catalog.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "catalog.create",
    entityType: "Catalog",
    entityId: catalog._id,
    after: catalog,
  });
  return catalog;
};

exports.updateCatalog = async (ctx, catalogId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const before = await Catalog.findOne({
    _id: catalogId,
    tenantId,
    isDeleted: false,
  });
  if (!before)
    throw Object.assign(new Error("Catalog not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "title",
    "description",
    "icon",
    "isActive",
    "visibleInPortal",
    "sortOrder",
    "owner",
    "parentCatalog",
  ];
  const update = pick(data, allowed);
  Object.assign(before, update);
  await before.save();
  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "catalog.update",
    entityType: "Catalog",
    entityId: catalogId,
    before,
    after: before,
  });
  return before;
};

exports.deleteCatalog = async (ctx, catalogId, actor) => {
  const tenantId = requireTenant(ctx);
  const catalog = await Catalog.findOne({
    _id: catalogId,
    tenantId,
    isDeleted: false,
  });
  if (!catalog)
    throw Object.assign(new Error("Catalog not found"), { statusCode: 404 });
  catalog.isDeleted = true;
  catalog.deletedAt = new Date();
  catalog.deletedBy = actor.userId;
  await catalog.save();
  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "catalog.delete",
    entityType: "Catalog",
    entityId: catalogId,
  });
  return { success: true };
};

// ─── Category CRUD ──────────────────────────────────────────────────────

exports.listCategories = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["catalogId", "isActive", "visibleInPortal"]),
  };
  return CatalogCategory.find(filter).sort({ sortOrder: 1, name: 1 });
};

exports.getCategory = async (ctx, categoryId) => {
  const tenantId = requireTenant(ctx);
  const category = await CatalogCategory.findOne({
    _id: categoryId,
    tenantId,
    isDeleted: false,
  });
  if (!category)
    throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  return category;
};

exports.createCategory = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "CCAT");
  const category = await CatalogCategory.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "category.create",
    entityType: "CatalogCategory",
    entityId: category._id,
  });
  return category;
};

exports.updateCategory = async (ctx, categoryId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const category = await CatalogCategory.findOne({
    _id: categoryId,
    tenantId,
    isDeleted: false,
  });
  if (!category)
    throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "title",
    "description",
    "icon",
    "isActive",
    "visibleInPortal",
    "sortOrder",
    "parentCategory",
  ];
  Object.assign(category, pick(data, allowed));
  await category.save();
  return category;
};

exports.deleteCategory = async (ctx, categoryId, actor) => {
  const tenantId = requireTenant(ctx);
  const category = await CatalogCategory.findOne({
    _id: categoryId,
    tenantId,
    isDeleted: false,
  });
  if (!category)
    throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  category.isDeleted = true;
  category.deletedAt = new Date();
  category.deletedBy = actor.userId;
  await category.save();
  return { success: true };
};

// ─── Catalog Item CRUD ──────────────────────────────────────────────────

exports.listCatalogItems = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, [
      "isActive",
      "visibleInPortal",
      "categoryId",
      "catalogId",
      "isBundle",
    ]),
  };
  if (query.search)
    filter.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { title: { $regex: query.search, $options: "i" } },
      { description: { $regex: query.search, $options: "i" } },
    ];
  return CatalogItem.find(filter)
    .sort({ sortOrder: 1, name: 1 })
    .populate("categoryId", "name");
};

exports.getCatalogItem = async (ctx, itemId) => {
  const tenantId = requireTenant(ctx);
  const item = await CatalogItem.findOne({
    _id: itemId,
    tenantId,
    isDeleted: false,
  })
    .populate("categoryId", "name")
    .populate("helpTopic", "name");
  if (!item)
    throw Object.assign(new Error("Catalog item not found"), {
      statusCode: 404,
    });
  return item;
};

exports.createCatalogItem = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "CATITEM");
  const item = await CatalogItem.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "catalogItem.create",
    entityType: "CatalogItem",
    entityId: item._id,
  });
  return item;
};

exports.updateCatalogItem = async (ctx, itemId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const item = await CatalogItem.findOne({
    _id: itemId,
    tenantId,
    isDeleted: false,
  });
  if (!item)
    throw Object.assign(new Error("Catalog item not found"), {
      statusCode: 404,
    });
  const allowed = [
    "name",
    "title",
    "description",
    "shortDescription",
    "icon",
    "picture",
    "price",
    "currency",
    "needsPayment",
    "isBundle",
    "bundleItems",
    "estimatedDeliveryTime",
    "estimatedTime",
    "autoFulfill",
    "fulfillmentTemplate",
    "requiresApproval",
    "approvalPolicy",
    "approvalMode",
    "approvers",
    "approvalGroups",
    "visibleInPortal",
    "isActive",
    "sortOrder",
    "helpTopic",
    "department",
    "sla",
    "priority",
    "formId",
    "autoAssignAgent",
    "autoAssignTeam",
    "entitlementRequired",
    "meta",
  ];
  Object.assign(item, pick(data, allowed));
  await item.save();
  return item;
};

exports.deleteCatalogItem = async (ctx, itemId, actor) => {
  const tenantId = requireTenant(ctx);
  const item = await CatalogItem.findOne({
    _id: itemId,
    tenantId,
    isDeleted: false,
  });
  if (!item)
    throw Object.assign(new Error("Catalog item not found"), {
      statusCode: 404,
    });
  item.isDeleted = true;
  item.deletedAt = new Date();
  item.deletedBy = actor.userId;
  await item.save();
  return { success: true };
};

exports.publishItem = async (ctx, itemId, actor) => {
  const tenantId = requireTenant(ctx);
  const item = await CatalogItem.findOne({
    _id: itemId,
    tenantId,
    isDeleted: false,
  });
  if (!item)
    throw Object.assign(new Error("Catalog item not found"), {
      statusCode: 404,
    });
  item.publishedAt = new Date();
  item.publishedBy = actor.userId;
  item.isActive = true;
  await item.save();
  return item;
};

exports.retireItem = async (ctx, itemId, actor) => {
  const tenantId = requireTenant(ctx);
  const item = await CatalogItem.findOne({
    _id: itemId,
    tenantId,
    isDeleted: false,
  });
  if (!item)
    throw Object.assign(new Error("Catalog item not found"), {
      statusCode: 404,
    });
  item.retiredAt = new Date();
  item.retiredBy = actor.userId;
  item.isActive = false;
  await item.save();
  return item;
};

// ─── Variable Management ────────────────────────────────────────────────

exports.listItemVariables = async (ctx, itemId) => {
  const tenantId = requireTenant(ctx);
  return CatalogItemVariable.find({ tenantId, itemId, isDeleted: false }).sort({
    sortOrder: 1,
  });
};

exports.createItemVariable = async (ctx, itemId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const variable = await CatalogItemVariable.create({
    ...data,
    tenantId,
    itemId,
    createdBy: actor.userId,
  });
  return variable;
};

exports.updateItemVariable = async (ctx, variableId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const variable = await CatalogItemVariable.findOne({
    _id: variableId,
    tenantId,
    isDeleted: false,
  });
  if (!variable)
    throw Object.assign(new Error("Variable not found"), { statusCode: 404 });
  const allowed = [
    "name",
    "label",
    "type",
    "defaultValue",
    "helpText",
    "placeholder",
    "required",
    "readOnly",
    "visible",
    "maxLength",
    "minLength",
    "regex",
    "regexError",
    "choices",
    "referenceModel",
    "referenceQual",
    "lookupField",
    "dependentVariable",
    "sortOrder",
    "section",
    "meta",
  ];
  Object.assign(variable, pick(data, allowed));
  await variable.save();
  return variable;
};

exports.deleteItemVariable = async (ctx, variableId, actor) => {
  const tenantId = requireTenant(ctx);
  const variable = await CatalogItemVariable.findOne({
    _id: variableId,
    tenantId,
    isDeleted: false,
  });
  if (!variable)
    throw Object.assign(new Error("Variable not found"), { statusCode: 404 });
  variable.isDeleted = true;
  variable.deletedAt = new Date();
  variable.deletedBy = actor.userId;
  await variable.save();
  return { success: true };
};

// ─── Variable Sets ──────────────────────────────────────────────────────

exports.listVariableSets = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = { tenantId, isDeleted: false, ...pick(query, ["isActive"]) };
  return VariableSet.find(filter).sort({ name: 1 });
};

exports.createVariableSet = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "VS");
  const vs = await VariableSet.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
  return vs;
};

exports.deleteVariableSet = async (ctx, vsId, actor) => {
  const tenantId = requireTenant(ctx);
  const vs = await VariableSet.findOne({
    _id: vsId,
    tenantId,
    isDeleted: false,
  });
  if (!vs)
    throw Object.assign(new Error("Variable set not found"), {
      statusCode: 404,
    });
  vs.isDeleted = true;
  vs.deletedAt = new Date();
  vs.deletedBy = actor.userId;
  await vs.save();
  return { success: true };
};

// ─── User Criteria ──────────────────────────────────────────────────────

exports.listUserCriteria = async (ctx, itemId) => {
  const tenantId = requireTenant(ctx);
  return UserCriteria.find({ tenantId, itemId, isDeleted: false }).sort({
    priority: 1,
  });
};

exports.createUserCriteria = async (ctx, itemId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const criteria = await UserCriteria.create({
    ...data,
    tenantId,
    itemId,
    createdBy: actor.userId,
  });
  return criteria;
};

exports.updateUserCriteria = async (ctx, criteriaId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const criteria = await UserCriteria.findOne({
    _id: criteriaId,
    tenantId,
    isDeleted: false,
  });
  if (!criteria)
    throw Object.assign(new Error("User criteria not found"), {
      statusCode: 404,
    });
  const allowed = [
    "criteriaType",
    "roles",
    "groups",
    "departments",
    "organizations",
    "users",
    "companies",
    "matchAll",
    "priority",
    "isActive",
  ];
  Object.assign(criteria, pick(data, allowed));
  await criteria.save();
  return criteria;
};

exports.deleteUserCriteria = async (ctx, criteriaId, actor) => {
  const tenantId = requireTenant(ctx);
  const criteria = await UserCriteria.findOne({
    _id: criteriaId,
    tenantId,
    isDeleted: false,
  });
  if (!criteria)
    throw Object.assign(new Error("User criteria not found"), {
      statusCode: 404,
    });
  criteria.isDeleted = true;
  criteria.deletedAt = new Date();
  criteria.deletedBy = actor.userId;
  await criteria.save();
  return { success: true };
};

// Check if user can see/request a catalog item
exports.checkEligibility = async (ctx, itemId, userId) => {
  const tenantId = requireTenant(ctx);
  const criteria = await UserCriteria.find({
    tenantId,
    itemId,
    isActive: true,
    isDeleted: false,
  });
  if (!criteria.length) return true; // no criteria = visible to all
  const includes = criteria.filter((c) => c.criteriaType === "include");
  const excludes = criteria.filter((c) => c.criteriaType === "exclude");
  if (
    includes.length &&
    !includes.some((c) => c.matchAll || c.users.includes(userId))
  )
    return false;
  if (excludes.some((c) => c.users.includes(userId))) return false;
  return true;
};

// ─── Cart Operations ────────────────────────────────────────────────────

exports.getOrCreateCart = async (ctx, userId) => {
  const tenantId = requireTenant(ctx);
  let cart = await Cart.findOne({
    tenantId,
    userId,
    status: "active",
    isDeleted: false,
  });
  if (!cart) {
    const number = await numberingService.nextNumber(tenantId, "CART");
    cart = await Cart.create({ tenantId, userId, number, createdBy: userId });
  }
  return cart;
};

exports.getCart = async (ctx, cartId) => {
  const tenantId = requireTenant(ctx);
  const cart = await Cart.findOne({
    _id: cartId,
    tenantId,
    isDeleted: false,
  }).populate("items");
  if (!cart)
    throw Object.assign(new Error("Cart not found"), { statusCode: 404 });
  return cart;
};

exports.addToCart = async (ctx, cartId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const cart = await Cart.findOne({
    _id: cartId,
    tenantId,
    status: "active",
    isDeleted: false,
  });
  if (!cart)
    throw Object.assign(new Error("Active cart not found"), {
      statusCode: 404,
    });
  const item = await CatalogItem.findOne({
    _id: data.catalogItemId,
    tenantId,
    isActive: true,
    isDeleted: false,
  });
  if (!item)
    throw Object.assign(new Error("Catalog item not found or inactive"), {
      statusCode: 404,
    });
  const quantity = data.quantity || 1;
  const cartItem = await CartItem.create({
    tenantId,
    cartId,
    catalogItemId: item._id,
    quantity,
    unitPrice: item.price,
    totalPrice: item.price * quantity,
    currency: item.currency,
    variableAnswers: data.variableAnswers || {},
    specialInstructions: data.specialInstructions,
    createdBy: actor.userId,
  });
  cart.items.push(cartItem._id);
  cart.totalItems += quantity;
  cart.totalPrice += cartItem.totalPrice;
  await cart.save();
  return cart;
};

exports.updateCartItem = async (ctx, cartItemId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const cartItem = await CartItem.findOne({
    _id: cartItemId,
    tenantId,
    isDeleted: false,
  });
  if (!cartItem)
    throw Object.assign(new Error("Cart item not found"), { statusCode: 404 });
  const cart = await Cart.findOne({
    _id: cartItem.cartId,
    status: "active",
    isDeleted: false,
  });
  if (!cart)
    throw Object.assign(new Error("Cart is no longer active"), {
      statusCode: 422,
    });
  const oldQty = cartItem.quantity;
  const oldPrice = cartItem.totalPrice;
  if (data.quantity !== undefined) cartItem.quantity = data.quantity;
  if (data.variableAnswers !== undefined)
    cartItem.variableAnswers = data.variableAnswers;
  if (data.specialInstructions !== undefined)
    cartItem.specialInstructions = data.specialInstructions;
  cartItem.totalPrice = cartItem.unitPrice * cartItem.quantity;
  await cartItem.save();
  cart.totalItems = cart.totalItems - oldQty + cartItem.quantity;
  cart.totalPrice = cart.totalPrice - oldPrice + cartItem.totalPrice;
  await cart.save();
  return cartItem;
};

exports.removeFromCart = async (ctx, cartItemId, actor) => {
  const tenantId = requireTenant(ctx);
  const cartItem = await CartItem.findOne({
    _id: cartItemId,
    tenantId,
    isDeleted: false,
  });
  if (!cartItem)
    throw Object.assign(new Error("Cart item not found"), { statusCode: 404 });
  const cart = await Cart.findOne({ _id: cartItem.cartId, isDeleted: false });
  if (!cart)
    throw Object.assign(new Error("Cart not found"), { statusCode: 404 });
  cartItem.isDeleted = true;
  cartItem.deletedAt = new Date();
  cartItem.deletedBy = actor.userId;
  await cartItem.save();
  cart.items = cart.items.filter((i) => !i.equals(cartItem._id));
  cart.totalItems -= cartItem.quantity;
  cart.totalPrice -= cartItem.totalPrice;
  if (cart.totalItems < 0) cart.totalItems = 0;
  if (cart.totalPrice < 0) cart.totalPrice = 0;
  await cart.save();
  return cart;
};

exports.abandonCart = async (ctx, cartId, actor) => {
  const tenantId = requireTenant(ctx);
  const cart = await Cart.findOne({
    _id: cartId,
    tenantId,
    status: "active",
    isDeleted: false,
  });
  if (!cart)
    throw Object.assign(new Error("Active cart not found"), {
      statusCode: 404,
    });
  assertTransition("cart", cart.status, "abandoned");
  cart.status = "abandoned";
  cart.abandonedAt = new Date();
  await cart.save();
  return cart;
};

// ─── Checkout / Order ───────────────────────────────────────────────────

exports.checkout = async (ctx, cartId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const cart = await Cart.findOne({
    _id: cartId,
    tenantId,
    status: "active",
    isDeleted: false,
  }).populate("items");
  if (!cart)
    throw Object.assign(new Error("Active cart not found"), {
      statusCode: 404,
    });
  if (!cart.items.length)
    throw Object.assign(new Error("Cart is empty"), { statusCode: 422 });

  // Mark cart as submitted
  assertTransition("cart", cart.status, "submitted");
  cart.status = "submitted";
  cart.submittedAt = new Date();
  cart.submittedBy = actor.userId;
  cart.requestedFor = data.requestedFor || actor.userId;
  if (data.specialInstructions)
    cart.specialInstructions = data.specialInstructions;
  await cart.save();

  // Create REQ
  const reqNumber = await numberingService.nextNumber(tenantId, "REQ");
  const req = await Request.create({
    tenantId,
    number: reqNumber,
    title: `Request from cart ${cart.number}`,
    description: data.specialInstructions || "",
    requester: actor.userId,
    requestedFor: data.requestedFor || actor.userId,
    openedBy: actor.userId,
    source: "catalog",
    totalCost: cart.totalPrice,
    currency: cart.currency,
    priority: data.priority || "medium",
    status: "open",
    createdBy: actor.userId,
  });

  // Create one RITM per cart item
  const ritmNumbers = await numberingService.nextNumbers(
    tenantId,
    "RITM",
    cart.items.length,
  );
  const ritms = [];
  for (let i = 0; i < cart.items.length; i++) {
    const ci = cart.items[i];
    const catalogItem = await CatalogItem.findById(ci.catalogItemId);
    const ritmNumber = ritmNumbers[i];

    let approvalStatus = "not_required";
    if (catalogItem && catalogItem.requiresApproval) approvalStatus = "pending";

    const ritm = await RequestedItem.create({
      tenantId,
      requestId: req._id,
      number: ritmNumber,
      catalogItemId: ci.catalogItemId,
      catalogItemName: catalogItem ? catalogItem.name : "Unknown",
      quantity: ci.quantity,
      unitPrice: ci.unitPrice,
      totalPrice: ci.totalPrice,
      currency: ci.currency,
      variableAnswers: ci.variableAnswers,
      requestedFor: data.requestedFor || actor.userId,
      status: approvalStatus === "pending" ? "pending_approval" : "open",
      approvalStatus,
      priority: data.priority || "medium",
      createdBy: actor.userId,
    });
    ritms.push(ritm);

    // Create approval if required
    if (catalogItem && catalogItem.requiresApproval) {
      const approvers = (catalogItem.approvers || []).map((userId, idx) => ({
        userId,
        order: idx + 1,
        status: "pending",
        role: "approver",
      }));
      if (approvers.length) {
        await RequestApproval.create({
          tenantId,
          requestedItemId: ritm._id,
          requestId: req._id,
          mode: catalogItem.approvalMode || "sequential",
          status: "pending",
          type: catalogItem.approvalMode || "individual",
          approvers,
          requiredApprovals: 1,
          initiatedBy: actor.userId,
        });
      }
    }

    // Generate fulfillment tasks if no approval needed
    if (approvalStatus !== "pending") {
      await exports.generateFulfillmentTasks(ctx, ritm, actor);
    }
  }

  req.requestedItems = ritms.map((r) => r._id);
  req.itemCount = ritms.length;
  await req.save();

  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "request.checkout",
    entityType: "Request",
    entityId: req._id,
    after: req,
  });
  emitEvent(tenantId, "request:created", {
    requestId: req._id,
    number: req.number,
  });

  return { request: req, requestedItems: ritms, cart };
};

exports.orderDirect = async (ctx, itemId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const item = await CatalogItem.findOne({
    _id: itemId,
    tenantId,
    isActive: true,
    isDeleted: false,
  });
  if (!item)
    throw Object.assign(new Error("Catalog item not found or inactive"), {
      statusCode: 404,
    });
  const quantity = data.quantity || 1;

  const reqNumber = await numberingService.nextNumber(tenantId, "REQ");
  const req = await Request.create({
    tenantId,
    number: reqNumber,
    title: `Request for ${item.name}`,
    description: data.specialInstructions || "",
    requester: actor.userId,
    requestedFor: data.requestedFor || actor.userId,
    openedBy: actor.userId,
    source: "catalog",
    totalCost: item.price * quantity,
    currency: item.currency,
    priority: data.priority || "medium",
    status: "open",
    createdBy: actor.userId,
  });

  const ritmNumber = await numberingService.nextNumber(tenantId, "RITM");
  let approvalStatus = "not_required";
  if (item.requiresApproval) approvalStatus = "pending";
  const ritm = await RequestedItem.create({
    tenantId,
    requestId: req._id,
    number: ritmNumber,
    catalogItemId: item._id,
    catalogItemName: item.name,
    quantity,
    unitPrice: item.price,
    totalPrice: item.price * quantity,
    currency: item.currency,
    variableAnswers: data.variableAnswers || {},
    requestedFor: data.requestedFor || actor.userId,
    status: approvalStatus === "pending" ? "pending_approval" : "open",
    approvalStatus,
    priority: data.priority || "medium",
    createdBy: actor.userId,
  });

  if (item.requiresApproval) {
    const approvers = (item.approvers || []).map((userId, idx) => ({
      userId,
      order: idx + 1,
      status: "pending",
      role: "approver",
    }));
    if (approvers.length) {
      await RequestApproval.create({
        tenantId,
        requestedItemId: ritm._id,
        requestId: req._id,
        mode: item.approvalMode || "sequential",
        status: "pending",
        type: item.approvalMode || "individual",
        approvers,
        requiredApprovals: 1,
        initiatedBy: actor.userId,
      });
    }
  }

  if (approvalStatus !== "pending") {
    await exports.generateFulfillmentTasks(ctx, ritm, actor);
  }

  req.requestedItems = [ritm._id];
  req.itemCount = 1;
  await req.save();

  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "request.orderDirect",
    entityType: "Request",
    entityId: req._id,
  });
  return { request: req, requestedItem: ritm };
};

// ─── Fulfillment Task Generation ────────────────────────────────────────

exports.generateFulfillmentTasks = async (ctx, ritm, actor) => {
  const tenantId = requireTenant(ctx);
  const item = await CatalogItem.findById(ritm.catalogItemId);
  if (!item) return;

  let plan = null;
  if (item.fulfillmentTemplate) {
    plan = await FulfillmentPlan.findById(item.fulfillmentTemplate);
  }
  if (!plan) {
    plan = await FulfillmentPlan.findOne({
      tenantId,
      catalogItems: item._id,
      isActive: true,
      isDeleted: false,
    });
  }

  if (plan && plan.steps.length) {
    const steps = await FulfillmentStep.find({
      _id: { $in: plan.steps },
      isDeleted: false,
    }).sort({ order: 1 });
    const taskNumbers = await numberingService.nextNumbers(
      tenantId,
      "SCTASK",
      steps.length,
    );
    const tasks = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.generateTask) continue;
      const task = await CatalogTask.create({
        tenantId,
        requestedItemId: ritm._id,
        requestId: ritm.requestId,
        number: taskNumbers[i],
        title: step.taskTitle || step.name,
        description: step.taskDescription || step.description,
        order: step.order,
        parallelGroup: step.parallelGroup,
        executionType: step.executionType,
        assignedTo: step.assignedTo,
        assignmentGroup: step.assignmentGroup || plan.defaultAssignmentGroup,
        fulfillmentTeam: step.team || plan.defaultTeam,
        estimatedDuration: step.estimatedDuration,
        createdBy: actor.userId,
      });
      tasks.push(task);
    }
    ritm.fulfillmentPlan = plan._id;
    ritm.fulfillmentStepsTotal = tasks.length;
    await ritm.save();
    return tasks;
  }

  // Default: single fulfillment task
  const taskNumber = await numberingService.nextNumber(tenantId, "SCTASK");
  const task = await CatalogTask.create({
    tenantId,
    requestedItemId: ritm._id,
    requestId: ritm.requestId,
    number: taskNumber,
    title: `Fulfill ${ritm.catalogItemName}`,
    order: 1,
    assignmentGroup: item.autoAssignTeam,
    createdBy: actor.userId,
  });
  ritm.fulfillmentStepsTotal = 1;
  await ritm.save();
  return [task];
};

// ─── Request Operations ─────────────────────────────────────────────────

exports.listRequests = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, [
      "status",
      "requester",
      "requestedFor",
      "priority",
      "source",
    ]),
  };
  if (query.search)
    filter.$or = [
      { number: { $regex: query.search, $options: "i" } },
      { title: { $regex: query.search, $options: "i" } },
    ];
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 25));
  const [items, total] = await Promise.all([
    Request.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("requester", "name email")
      .populate("requestedFor", "name email"),
    Request.countDocuments(filter),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
};

exports.getRequest = async (ctx, requestId) => {
  const tenantId = requireTenant(ctx);
  const req = await Request.findOne({
    _id: requestId,
    tenantId,
    isDeleted: false,
  })
    .populate("requester", "name email")
    .populate("requestedFor", "name email")
    .populate("requestedItems");
  if (!req)
    throw Object.assign(new Error("Request not found"), { statusCode: 404 });
  return req;
};

exports.transitionRequest = async (ctx, requestId, toStatus, data, actor) => {
  const tenantId = requireTenant(ctx);
  const req = await Request.findOne({
    _id: requestId,
    tenantId,
    isDeleted: false,
  });
  if (!req)
    throw Object.assign(new Error("Request not found"), { statusCode: 404 });
  assertTransition("request", req.status, toStatus);
  const before = { status: req.status };
  req.status = toStatus;
  if (toStatus === "closed_complete") {
    req.closedAt = new Date();
    req.closedBy = actor.userId;
    req.closeCode = data?.closeCode || "fulfilled";
    req.closeNotes = data?.closeNotes;
  } else if (toStatus === "closed_incomplete") {
    req.closedAt = new Date();
    req.closedBy = actor.userId;
    req.closeCode = "incomplete";
    req.closeNotes = data?.closeNotes;
  } else if (toStatus === "closed_canceled") {
    req.closedAt = new Date();
    req.closedBy = actor.userId;
    req.closeCode = "canceled";
    req.closeNotes = data?.closeNotes;
  } else if (toStatus === "work_in_progress") {
    req.assignedTo = data?.assignedTo || actor.userId;
    req.assignmentGroup = data?.assignmentGroup;
  }
  await req.save();
  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "request.transition",
    entityType: "Request",
    entityId: requestId,
    before,
    after: { status: req.status },
  });
  emitEvent(tenantId, "request:updated", {
    requestId: req._id,
    status: req.status,
  });
  return req;
};

exports.cancelRequest = async (ctx, requestId, data, actor) => {
  return exports.transitionRequest(
    ctx,
    requestId,
    "closed_canceled",
    data,
    actor,
  );
};

// ─── RITM Operations ────────────────────────────────────────────────────

exports.listRITMs = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, [
      "status",
      "requestId",
      "catalogItemId",
      "requestedFor",
      "approvalStatus",
    ]),
  };
  if (query.search)
    filter.$or = [
      { number: { $regex: query.search, $options: "i" } },
      { catalogItemName: { $regex: query.search, $options: "i" } },
    ];
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 25));
  const [items, total] = await Promise.all([
    RequestedItem.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("requestedFor", "name email")
      .populate("catalogItemId", "name"),
    RequestedItem.countDocuments(filter),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
};

exports.getRITM = async (ctx, ritmId) => {
  const tenantId = requireTenant(ctx);
  const ritm = await RequestedItem.findOne({
    _id: ritmId,
    tenantId,
    isDeleted: false,
  })
    .populate("requestedFor", "name email")
    .populate("catalogItemId", "name title description")
    .populate("assignedTo", "name email")
    .populate("fulfillmentPlan");
  if (!ritm)
    throw Object.assign(new Error("Requested item not found"), {
      statusCode: 404,
    });
  return ritm;
};

exports.transitionRITM = async (ctx, ritmId, toStatus, data, actor) => {
  const tenantId = requireTenant(ctx);
  const ritm = await RequestedItem.findOne({
    _id: ritmId,
    tenantId,
    isDeleted: false,
  });
  if (!ritm)
    throw Object.assign(new Error("Requested item not found"), {
      statusCode: 404,
    });
  assertTransition("ritm", ritm.status, toStatus);
  const before = { status: ritm.status };
  ritm.status = toStatus;
  if (toStatus === "closed_complete") {
    ritm.closedAt = new Date();
    ritm.closedBy = actor.userId;
    ritm.closeCode = data?.closeCode || "fulfilled";
    ritm.closeNotes = data?.closeNotes;
  } else if (toStatus === "closed_incomplete") {
    ritm.closedAt = new Date();
    ritm.closedBy = actor.userId;
    ritm.closeCode = "incomplete";
  } else if (toStatus === "closed_canceled") {
    ritm.closedAt = new Date();
    ritm.closedBy = actor.userId;
    ritm.closeCode = "canceled";
  } else if (toStatus === "open") {
    ritm.assignedTo = data?.assignedTo;
    ritm.assignmentGroup = data?.assignmentGroup;
  }
  await ritm.save();
  await auditEventService.log({
    tenantId,
    actorId: actor.userId,
    action: "ritm.transition",
    entityType: "RequestedItem",
    entityId: ritmId,
    before,
    after: { status: ritm.status },
  });
  emitEvent(tenantId, "ritm:updated", {
    ritmId: ritm._id,
    status: ritm.status,
  });
  // Check if parent REQ should close
  await exports.checkRequestCompletion(ctx, ritm.requestId, actor);
  return ritm;
};

exports.checkRequestCompletion = async (ctx, requestId, actor) => {
  const tenantId = requireTenant(ctx);
  const siblings = await RequestedItem.find({ requestId, isDeleted: false });
  const allDone = siblings.every((r) =>
    ["closed_complete", "closed_incomplete", "closed_canceled"].includes(
      r.status,
    ),
  );
  if (allDone) {
    const req = await Request.findById(requestId);
    if (
      req &&
      req.status !== "closed_complete" &&
      req.status !== "closed_incomplete" &&
      req.status !== "closed_canceled"
    ) {
      const allComplete = siblings.every((r) => r.status === "closed_complete");
      await exports.transitionRequest(
        ctx,
        requestId,
        allComplete ? "closed_complete" : "closed_incomplete",
        {},
        actor,
      );
    }
  }
};

// ─── Catalog Task Operations ────────────────────────────────────────────

exports.listCatalogTasks = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, [
      "status",
      "requestedItemId",
      "requestId",
      "assignedTo",
      "assignmentGroup",
    ]),
  };
  return CatalogTask.find(filter)
    .sort({ order: 1 })
    .populate("assignedTo", "name email");
};

exports.getCatalogTask = async (ctx, taskId) => {
  const tenantId = requireTenant(ctx);
  const task = await CatalogTask.findOne({
    _id: taskId,
    tenantId,
    isDeleted: false,
  })
    .populate("assignedTo", "name email")
    .populate("assignmentGroup", "name");
  if (!task)
    throw Object.assign(new Error("Catalog task not found"), {
      statusCode: 404,
    });
  return task;
};

exports.transitionCatalogTask = async (ctx, taskId, toStatus, data, actor) => {
  const tenantId = requireTenant(ctx);
  const task = await CatalogTask.findOne({
    _id: taskId,
    tenantId,
    isDeleted: false,
  });
  if (!task)
    throw Object.assign(new Error("Catalog task not found"), {
      statusCode: 404,
    });
  assertTransition("catalogTask", task.status, toStatus);
  const before = { status: task.status };
  task.status = toStatus;
  if (toStatus === "work_in_progress") task.startedAt = new Date();
  if (toStatus === "closed_complete") {
    task.completedAt = new Date();
    task.closeCode = "complete";
    task.closeNotes = data?.closeNotes;
    task.closedBy = actor.userId;
  } else if (toStatus === "closed_incomplete") {
    task.completedAt = new Date();
    task.closeCode = "incomplete";
    task.closeNotes = data?.closeNotes;
    task.closedBy = actor.userId;
  } else if (toStatus === "closed_skipped") {
    task.closeCode = "skipped";
    task.closeNotes = data?.closeNotes;
    task.closedBy = actor.userId;
  }
  await task.save();
  // Update RITM fulfillment progress
  await exports.updateRITMFulfillmentProgress(ctx, task.requestedItemId, actor);
  return task;
};

exports.updateRITMFulfillmentProgress = async (ctx, requestedItemId, actor) => {
  const tenantId = requireTenant(ctx);
  const tasks = await CatalogTask.find({ requestedItemId, isDeleted: false });
  const total = tasks.length;
  const complete = tasks.filter((t) => t.status === "closed_complete").length;
  const ritm = await RequestedItem.findById(requestedItemId);
  if (!ritm) return;
  ritm.fulfillmentStepsTotal = total;
  ritm.fulfillmentStepsComplete = complete;
  if (total > 0 && complete === total) {
    ritm.fulfillmentStatus = "complete";
    await exports.transitionRITM(
      ctx,
      requestedItemId,
      "closed_complete",
      { closeCode: "fulfilled" },
      actor,
    );
  } else if (total > 0 && complete > 0) {
    ritm.fulfillmentStatus = "partial";
  } else {
    ritm.fulfillmentStatus = "not_started";
  }
  await ritm.save();
};

// ─── Approval Operations ────────────────────────────────────────────────

exports.listRequestApprovals = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["requestedItemId", "requestId", "status"]),
  };
  return RequestApproval.find(filter).sort({ createdAt: -1 });
};

exports.decideRequestApproval = async (ctx, approvalId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const approval = await RequestApproval.findOne({
    _id: approvalId,
    tenantId,
    isDeleted: false,
  });
  if (!approval)
    throw Object.assign(new Error("Approval not found"), { statusCode: 404 });
  const decision = data.decision; // 'approved' or 'rejected'
  const approverEntry = approval.approvers.find(
    (a) =>
      (a.userId && a.userId.equals(actor.userId)) ||
      (a.groupId && data.groupId && a.groupId.equals(data.groupId)),
  );
  if (!approverEntry)
    throw Object.assign(new Error("You are not an approver for this request"), {
      statusCode: 403,
    });
  if (approverEntry.status !== "pending")
    throw Object.assign(new Error("Already decided"), { statusCode: 422 });
  approverEntry.status = decision === "approved" ? "approved" : "rejected";
  approverEntry.decidedBy = actor.userId;
  approverEntry.decidedAt = new Date();
  approverEntry.comment = data.comment;

  if (decision === "approved") approval.approvalCount += 1;
  else approval.rejectionCount += 1;

  // Check if approval is complete
  if (approval.approvalCount >= approval.requiredApprovals) {
    approval.status = "approved";
    approval.completedAt = new Date();
    approval.result = "approved";
    await approval.save();
    // Transition RITM from pending_approval to open
    await exports.transitionRITM(
      ctx,
      approval.requestedItemId,
      "open",
      {},
      actor,
    );
    await exports.generateFulfillmentTasks(
      ctx,
      await RequestedItem.findById(approval.requestedItemId),
      actor,
    );
  } else if (approval.rejectionCount > 0 && approval.mode === "sequential") {
    approval.status = "rejected";
    approval.completedAt = new Date();
    approval.result = "rejected";
    await approval.save();
    await exports.transitionRITM(
      ctx,
      approval.requestedItemId,
      "closed_canceled",
      { closeCode: "canceled", closeNotes: data.comment },
      actor,
    );
  } else {
    await approval.save();
  }
  return approval;
};

// ─── Fulfillment Plan CRUD ──────────────────────────────────────────────

exports.listFulfillmentPlans = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["isActive", "isDefault"]),
  };
  return FulfillmentPlan.find(filter).sort({ name: 1 });
};

exports.getFulfillmentPlan = async (ctx, planId) => {
  const tenantId = requireTenant(ctx);
  const plan = await FulfillmentPlan.findOne({
    _id: planId,
    tenantId,
    isDeleted: false,
  }).populate("steps");
  if (!plan)
    throw Object.assign(new Error("Fulfillment plan not found"), {
      statusCode: 404,
    });
  return plan;
};

exports.createFulfillmentPlan = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const number = await numberingService.nextNumber(tenantId, "FP");
  const plan = await FulfillmentPlan.create({
    ...data,
    tenantId,
    number,
    createdBy: actor.userId,
  });
  return plan;
};

exports.addFulfillmentStep = async (ctx, planId, data, actor) => {
  const tenantId = requireTenant(ctx);
  const plan = await FulfillmentPlan.findOne({
    _id: planId,
    tenantId,
    isDeleted: false,
  });
  if (!plan)
    throw Object.assign(new Error("Fulfillment plan not found"), {
      statusCode: 404,
    });
  const stepCount = await FulfillmentStep.countDocuments({
    planId,
    isDeleted: false,
  });
  const step = await FulfillmentStep.create({
    ...data,
    tenantId,
    planId,
    order: data.order || stepCount + 1,
    createdBy: actor.userId,
  });
  plan.steps.push(step._id);
  plan.stepCount = plan.steps.length;
  await plan.save();
  return step;
};

// ─── Entitlement Operations ─────────────────────────────────────────────

exports.listEntitlements = async (ctx, query = {}) => {
  const tenantId = requireTenant(ctx);
  const filter = {
    tenantId,
    isDeleted: false,
    ...pick(query, ["catalogItemId", "entitlementId", "scopeType", "isActive"]),
  };
  return CatalogEntitlement.find(filter);
};

exports.createEntitlement = async (ctx, data, actor) => {
  const tenantId = requireTenant(ctx);
  const entitlement = await CatalogEntitlement.create({
    ...data,
    tenantId,
    createdBy: actor.userId,
  });
  return entitlement;
};

exports.checkEntitlement = async (
  ctx,
  catalogItemId,
  userId,
  scopeType,
  scopeId,
) => {
  const tenantId = requireTenant(ctx);
  const entitlement = await CatalogEntitlement.findOne({
    tenantId,
    catalogItemId,
    scopeType,
    scopeId,
    isActive: true,
    isDeleted: false,
    $and: [
      {
        $or: [
          { validFrom: { $exists: false } },
          { validFrom: { $lte: new Date() } },
        ],
      },
      {
        $or: [
          { validTo: { $exists: false } },
          { validTo: { $gte: new Date() } },
        ],
      },
    ],
  });
  if (!entitlement) return { entitled: false };
  if (
    entitlement.maxRequests &&
    entitlement.requestCount >= entitlement.maxRequests
  ) {
    return { entitled: false, reason: "Request limit exceeded" };
  }
  return { entitled: true, entitlement };
};
