/**
 * Phase 15.2 Asset Models, 15.3 Stockrooms and 15.10 Configuration.
 *
 * These are the catalog and configuration records the rest of Phase 15 hangs
 * off: transfers and inventory point at stockrooms, assets and costs point at
 * models, and the lifecycle transitions offered by the UI are driven by the
 * configured asset states and substates rather than a hardcoded list.
 */

const { getDB } = require("../config/db");
const ApiError = require("../utils/ApiError");
const { crud, isUuid, requireTenant } = require("./assetCrud");

// ── 15.2 Asset Models ──────────────────────────────────────────────────

const modelCategories = crud({
  required: ["name"],
  table: "model_categories",
  entity: "model_category",
  fields: ["name", "code", "description", "is_active"],
  searchFields: ["name", "code", "description"],
  sort: "name",
});

const assetModels = crud({
  required: ["name"],
  table: "asset_models",
  entity: "asset_model",
  fields: [
    "category_id", "name", "manufacturer", "model_number", "category",
    "default_life_months", "purchase_cost", "retirement_value", "description", "is_active",
  ],
  searchFields: ["name", "manufacturer", "model_number", "category"],
  sort: "name",
  map: (row) => ({ ...row, _id: row.id }),
});

// A model cannot be deleted while assets or balances still reference it,
// otherwise those rows would be left pointing at nothing.
const removeModel = async ({ tenantId, id, actorId }) => {
  requireTenant(tenantId);
  const db = getDB();
  await assetModels.get({ tenantId, id });
  const [used, balances] = await Promise.all([
    db("assets").where({ company_id: tenantId, model_id: id }).count("* as count").first(),
    db("inventory_balances").where({ company_id: tenantId, model_id: id }).count("* as count").first(),
  ]);
  if (Number(used.count) || Number(balances.count)) {
    throw new ApiError(
      409,
      `Model is referenced by ${used.count} asset(s) and ${balances.count} inventory balance(s); retire it instead of deleting`,
    );
  }
  return assetModels.remove({ tenantId, id, actorId });
};

// ── 15.3 Stockrooms ────────────────────────────────────────────────────

const stockrooms = crud({
  required: ["name", "code"],
  table: "stockrooms",
  entity: "stockroom",
  fields: ["name", "code", "location", "manager_user_id", "capacity", "is_active", "description"],
  searchFields: ["name", "code", "location"],
  sort: "name",
  map: (row) => ({ ...row, _id: row.id }),
});

const removeStockroom = async ({ tenantId, id, actorId }) => {
  requireTenant(tenantId);
  const db = getDB();
  await stockrooms.get({ tenantId, id });
  const [balances, transfers] = await Promise.all([
    db("inventory_balances").where({ company_id: tenantId, stockroom_id: id }).count("* as count").first(),
    db("transfers").where({ company_id: tenantId })
      .where((b) => b.where({ from_stockroom_id: id }).orWhere({ to_stockroom_id: id }))
      .count("* as count").first(),
  ]);
  if (Number(balances.count) || Number(transfers.count)) {
    throw new ApiError(
      409,
      `Stockroom is referenced by ${balances.count} balance(s) and ${transfers.count} transfer(s); deactivate it instead of deleting`,
    );
  }
  return stockrooms.remove({ tenantId, id, actorId });
};

// ── 15.4 Stockroom Inventory (balances inside a stockroom) ─────────────

const listStockroomInventory = async ({ tenantId, stockroomId, search, lowStockOnly }) => {
  requireTenant(tenantId);
  if (!isUuid(stockroomId)) throw new ApiError(422, "A valid stockroomId is required");
  const db = getDB();
  await stockrooms.get({ tenantId, id: stockroomId });
  const query = db("inventory_balances as b")
    .leftJoin("asset_models as m", "b.model_id", "m.id")
    .leftJoin("assets as a", "b.asset_id", "a.id")
    .where("b.company_id", tenantId)
    .where("b.stockroom_id", stockroomId)
    .select(
      "b.*",
      db.raw("m.name as model_name"),
      db.raw("m.manufacturer"),
      db.raw("a.name as asset_name"),
      db.raw("a.serial as asset_serial"),
    )
    .orderBy("b.created_at", "desc");
  if (search) {
    const pattern = `%${String(search).replace(/[%_]/g, (c) => `\\${c}`)}%`;
    query.andWhere((b) => b
      .whereILike("b.barcode", pattern)
      .orWhereILike("b.location", pattern)
      .orWhereILike("m.name", pattern)
      .orWhereILike("a.name", pattern)
      .orWhereILike("a.serial", pattern));
  }
  if (lowStockOnly) {
    // "Low" means at or below the reorder point, with a point of 0 meaning
    // the stockroom does not track a reorder threshold for that line.
    query.andWhereRaw("(b.reorder_point > 0 and (b.quantity_on_hand - b.quantity_reserved) <= b.reorder_point)");
  }
  const items = await query;
  return {
    items: items.map((row) => ({
      ...row,
      _id: row.id,
      quantity_available: Number(row.quantity_on_hand) - Number(row.quantity_reserved),
    })),
    total: items.length,
  };
};

const setBalance = async ({ tenantId, stockroomId, balanceId, data, actorId }) => {
  requireTenant(tenantId);
  const db = getDB();
  await stockrooms.get({ tenantId, id: stockroomId });
  if (!isUuid(balanceId)) throw new ApiError(422, "A valid balanceId is required");
  const before = await db("inventory_balances").where({ id: balanceId, company_id: tenantId, stockroom_id: stockroomId }).first();
  if (!before) throw new ApiError(404, "Inventory balance not found in this stockroom");
  const patch = {};
  for (const field of ["quantity_on_hand", "quantity_reserved", "quantity_in_transit", "reorder_point", "max_quantity", "barcode", "location", "last_counted_at"]) {
    if (data[field] !== undefined) patch[field] = data[field];
  }
  if (!Object.keys(patch).length) throw new ApiError(422, "No inventory fields supplied");
  if (Number(patch.quantity_reserved ?? before.quantity_reserved) > Number(patch.quantity_on_hand ?? before.quantity_on_hand)) {
    throw new ApiError(422, "Reserved quantity cannot exceed quantity on hand");
  }
  const [after] = await db("inventory_balances").where({ id: balanceId, company_id: tenantId }).update(patch).returning("*");
  const { recordEvent } = require("./assetCrud");
  await recordEvent({
    tenantId, actorId, entityType: "inventory_balance", entityId: balanceId,
    action: "update", before, after,
  });
  return { ...after, _id: after.id, quantity_available: Number(after.quantity_on_hand) - Number(after.quantity_reserved) };
};

// ── 15.10 Configuration ────────────────────────────────────────────────

const assetStates = crud({
  required: ["name"],
  table: "asset_states",
  entity: "asset_state",
  fields: ["name", "label", "color", "sequence", "is_default", "is_active"],
  searchFields: ["name", "label"],
  sort: "sequence",
  map: (row) => ({ ...row, _id: row.id }),
});

const assetSubstates = crud({
  required: ["state_id", "name"],
  table: "asset_substates",
  entity: "asset_substate",
  fields: ["state_id", "name", "label", "sequence", "is_active"],
  searchFields: ["name", "label"],
  sort: "sequence",
  map: (row) => ({ ...row, _id: row.id }),
});

const assetProperties = crud({
  required: ["name", "data_type"],
  table: "asset_properties",
  entity: "asset_property",
  fields: ["model_id", "name", "data_type", "default_value", "is_required", "is_searchable", "description"],
  searchFields: ["name", "description"],
  sort: "name",
  map: (row) => ({ ...row, _id: row.id }),
});

const stockroomConfigurations = crud({
  required: ["stockroom_id"],
  table: "stockroom_configurations",
  entity: "stockroom_configuration",
  fields: [
    "stockroom_id", "allow_negative_stock", "require_scan_on_receipt",
    "require_approval_on_transfer", "default_reorder_point", "notes",
  ],
  searchFields: ["notes"],
  sort: "created_at",
  map: (row) => ({ ...row, _id: row.id }),
});

// Configuration is a single row per stockroom, so upsert on read/update.
const getStockroomConfiguration = async ({ tenantId, stockroomId }) => {
  requireTenant(tenantId);
  if (!isUuid(stockroomId)) throw new ApiError(422, "A valid stockroomId is required");
  await stockrooms.get({ tenantId, id: stockroomId });
  const db = getDB();
  const existing = await db("stockroom_configurations").where({ company_id: tenantId, stockroom_id: stockroomId }).first();
  return {
    stockroomId,
    allowNegativeStock: existing ? existing.allow_negative_stock : false,
    requireScanOnReceipt: existing ? existing.require_scan_on_receipt : true,
    requireApprovalOnTransfer: existing ? existing.require_approval_on_transfer : false,
    // numeric columns arrive as strings from pg; the API should not.
    defaultReorderPoint: existing ? Number(existing.default_reorder_point) || 0 : 0,
    notes: existing ? existing.notes : "",
    ...(existing ? { id: existing.id, _id: existing.id } : {}),
  };
};

const saveStockroomConfiguration = async ({ tenantId, stockroomId, data, actorId }) => {
  requireTenant(tenantId);
  if (!isUuid(stockroomId)) throw new ApiError(422, "A valid stockroomId is required");
  await stockrooms.get({ tenantId, id: stockroomId });
  const db = getDB();
  const existing = await db("stockroom_configurations").where({ company_id: tenantId, stockroom_id: stockroomId }).first();
  const patch = {};
  const map = {
    allow_negative_stock: "allowNegativeStock",
    require_scan_on_receipt: "requireScanOnReceipt",
    require_approval_on_transfer: "requireApprovalOnTransfer",
    default_reorder_point: "defaultReorderPoint",
    notes: "notes",
  };
  for (const [column, key] of Object.entries(map)) {
    if (data[key] !== undefined || data[column] !== undefined) {
      const value = data[key] !== undefined ? data[key] : data[column];
      patch[column] = value === null ? null : value;
    }
  }
  if (!Object.keys(patch).length) throw new ApiError(422, "No configuration fields supplied");
  const { recordEvent } = require("./assetCrud");
  if (existing) {
    const [after] = await db("stockroom_configurations").where({ id: existing.id, company_id: tenantId }).update(patch).returning("*");
    await recordEvent({ tenantId, actorId, entityType: "stockroom_configuration", entityId: existing.id, action: "update", before: existing, after });
  } else {
    const [created] = await db("stockroom_configurations")
      .insert({ company_id: tenantId, stockroom_id: stockroomId, ...patch })
      .returning("*");
    await recordEvent({ tenantId, actorId, entityType: "stockroom_configuration", entityId: created.id, action: "create", before: null, after: created });
  }
  // Read the row back through the reader so save and get return one shape.
  return getStockroomConfiguration({ tenantId, stockroomId });
};

// The lifecycle transition targets the UI offers come from configuration, so
// adding a state makes a new lifecycle movement available.
const listConfiguredStates = async ({ tenantId }) => {
  requireTenant(tenantId);
  const db = getDB();
  const rows = await db("asset_states as s")
    .leftJoin("asset_substates as ss", "ss.state_id", "s.id")
    .where("s.company_id", tenantId)
    .where("s.is_active", true)
    .select("s.id", "s.name", "s.label", "s.color", "s.sequence", "s.is_default")
    .orderBy("s.sequence")
    .orderBy("s.name");
  const states = [];
  for (const row of rows) {
    const substates = await db("asset_substates")
      .where({ company_id: tenantId, state_id: row.id, is_active: true })
      .select("id", "name", "label", "sequence")
      .orderBy("sequence");
    states.push({ ...row, _id: row.id, substates });
  }
  return { items: states, total: states.length };
};

module.exports = {
  modelCategories,
  assetModels,
  removeModel,
  stockrooms,
  removeStockroom,
  listStockroomInventory,
  setBalance,
  assetStates,
  assetSubstates,
  assetProperties,
  stockroomConfigurations,
  getStockroomConfiguration,
  saveStockroomConfiguration,
  listConfiguredStates,
};
