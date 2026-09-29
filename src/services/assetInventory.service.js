/**
 * Phase 15.4 Inventory and 15.5 Transfers.
 *
 * Inventory balances are per stockroom and per model/asset; exceptions record
 * discrepancies. Transfers move stock between stockrooms through a validated
 * lifecycle, and shipping or receiving a transfer also moves the matching
 * inventory balance so the two cannot drift apart.
 */

const { getDB } = require("../config/db");
const ApiError = require("../utils/ApiError");
const { crud, isUuid, recordEvent, requireTenant } = require("./assetCrud");
const { stockrooms } = require("./assetCatalog.service");
const { nextNumber } = require("./numbering.service");

// ── 15.4 Inventory ─────────────────────────────────────────────────────

const inventoryBalances = crud({
  required: ["stockroom_id"],
  table: "inventory_balances",
  entity: "inventory_balance",
  fields: [
    "stockroom_id", "model_id", "asset_id", "location", "barcode",
    "quantity_on_hand", "quantity_reserved", "quantity_in_transit",
    "reorder_point", "max_quantity", "last_counted_at",
  ],
  searchFields: ["barcode", "location"],
  sort: "created_at",
  map: (row) => ({
    ...row,
    _id: row.id,
    quantity_available: Number(row.quantity_on_hand) - Number(row.quantity_reserved),
  }),
});

const EXCEPTION_TRANSITIONS = {
  open: ["acknowledged", "resolved", "ignored"],
  acknowledged: ["resolved", "ignored"],
  resolved: [],
  ignored: [],
};

const inventoryExceptions = crud({
  required: ["exception_type"],
  table: "inventory_exceptions",
  entity: "inventory_exception",
  fields: [
    "balance_id", "exception_type", "severity", "description",
    "expected_quantity", "actual_quantity", "resolution_note", "resolved_by",
  ],
  searchFields: ["description", "exception_type"],
  sort: "created_at",
  map: (row) => ({ ...row, _id: row.id }),
});

const resolveException = async ({ tenantId, id, status, note, actorId }) => {
  requireTenant(tenantId);
  const isClosing = status === "resolved" || status === "ignored";
  return inventoryExceptions.transition({
    tenantId,
    id,
    transitions: EXCEPTION_TRANSITIONS,
    to: status,
    actorId,
    patch: {
      resolution_note: note,
      resolved_by: isClosing ? actorId || null : null,
      resolved_at: isClosing ? new Date() : null,
    },
    label: "status",
  });
};

// Aggregated inventory across every stockroom: the 15.4 "Inventory Home" and
// "Inventory by Location"/"by Model" screens all read this shape.
const inventoryOverview = async ({ tenantId, location, modelId, lowStockOnly }) => {
  requireTenant(tenantId);
  const db = getDB();
  const query = db("inventory_balances as b")
    .leftJoin("stockrooms as s", "b.stockroom_id", "s.id")
    .leftJoin("asset_models as m", "b.model_id", "m.id")
    .where("b.company_id", tenantId)
    .select(
      "b.id", "b.stockroom_id", "b.model_id", "b.location", "b.barcode",
      "b.quantity_on_hand", "b.quantity_reserved", "b.quantity_in_transit",
      "b.reorder_point", "b.max_quantity",
      db.raw("s.name as stockroom_name"),
      db.raw("m.name as model_name"),
    );
  if (location) query.andWhere("b.location", location);
  if (isUuid(modelId)) query.andWhere("b.model_id", modelId);
  if (lowStockOnly) {
    query.andWhereRaw("(b.reorder_point > 0 and (b.quantity_on_hand - b.quantity_reserved) <= b.reorder_point)");
  }
  const rows = await query;
  const items = rows.map((row) => ({
    ...row,
    _id: row.id,
    quantity_available: Number(row.quantity_on_hand) - Number(row.quantity_reserved),
  }));
  const totals = items.reduce((acc, row) => {
    acc.onHand += Number(row.quantity_on_hand);
    acc.reserved += Number(row.quantity_reserved);
    acc.inTransit += Number(row.quantity_in_transit);
    acc.available += row.quantity_available;
    if (row.reorder_point > 0 && row.quantity_available <= Number(row.reorder_point)) acc.lowStock += 1;
    return acc;
  }, { onHand: 0, reserved: 0, inTransit: 0, available: 0, lowStock: 0 });
  return { items, total: items.length, totals };
};

// ── 15.5 Transfers ─────────────────────────────────────────────────────

const TRANSFER_TRANSITIONS = {
  draft: ["requested", "cancelled"],
  requested: ["in_transit", "cancelled", "draft"],
  in_transit: ["received", "cancelled"],
  received: [],
  cancelled: [],
};

const transfers = crud({
  required: ["from_stockroom_id", "to_stockroom_id"],
  table: "transfers",
  entity: "transfer",
  fields: [
    "from_stockroom_id", "to_stockroom_id", "from_location", "to_location",
    "status", "requested_date", "ship_date", "receive_date",
    "request_reason", "notes", "shipped_by", "received_by",
  ],
  searchFields: ["transfer_number", "request_reason", "notes", "from_location", "to_location"],
  sort: "created_at",
  map: (row) => ({ ...row, _id: row.id }),
});

const transferLines = crud({
  required: ["transfer_id", "quantity"],
  table: "transfer_lines",
  entity: "transfer_line",
  fields: [
    "transfer_id", "asset_id", "model_id", "line_number", "quantity",
    "quantity_received", "quantity_shipped", "serial_number", "status", "notes",
  ],
  searchFields: ["serial_number", "notes"],
  sort: "line_number",
  map: (row) => ({ ...row, _id: row.id }),
});

// A transfer is created with its lines in one call so a transfer order can
// never exist with no lines (the Transfer Order screen requires both).
const createTransfer = async ({ tenantId, data, actorId }) => {
  requireTenant(tenantId);
  const db = getDB();
  const fromId = data.fromStockroomId || data.from_stockroom_id || null;
  const toId = data.toStockroomId || data.to_stockroom_id || null;
  if (fromId) await stockrooms.get({ tenantId, id: fromId });
  if (toId) await stockrooms.get({ tenantId, id: toId });
  if (fromId && toId && fromId === toId) {
    throw new ApiError(422, "Source and destination stockrooms must differ");
  }
  const lines = Array.isArray(data.lines) ? data.lines : [];
  if (!lines.length) throw new ApiError(422, "A transfer needs at least one line");

  const transferNumber = data.transferNumber || data.transfer_number || (await nextNumber(tenantId, "TRF"));
  return db.transaction(async (trx) => {
    const [header] = await trx("transfers").insert({
      company_id: tenantId,
      transfer_number: transferNumber,
      from_stockroom_id: fromId,
      to_stockroom_id: toId,
      from_location: data.fromLocation || data.from_location || null,
      to_location: data.toLocation || data.to_location || null,
      status: "draft",
      requested_date: data.requestedDate || data.requested_date || null,
      request_reason: data.requestReason || data.request_reason || "",
      notes: data.notes || "",
    }).returning("*");

    const rows = lines.map((line, index) => ({
      company_id: tenantId,
      transfer_id: header.id,
      asset_id: line.assetId || line.asset_id || null,
      model_id: line.modelId || line.model_id || null,
      line_number: line.lineNumber || line.line_number || index + 1,
      quantity: line.quantity === undefined ? 1 : line.quantity,
      serial_number: line.serialNumber || line.serial_number || null,
      status: "pending",
      notes: line.notes || "",
    }));
    const inserted = await trx("transfer_lines").insert(rows).returning("*");
    await recordEvent({
      tenantId, actorId, entityType: "transfer", entityId: header.id,
      action: "create", before: null,
      after: { ...header, _id: header.id, lines: inserted },
    });
    return { ...header, _id: header.id, lines: inserted };
  });
};

const listTransferLines = async ({ tenantId, transferId }) => {
  requireTenant(tenantId);
  if (!isUuid(transferId)) throw new ApiError(422, "A valid transferId is required");
  await transfers.get({ tenantId, id: transferId });
  const items = await getDB()("transfer_lines")
    .where({ company_id: tenantId, transfer_id: transferId })
    .orderBy("line_number");
  return { items: items.map((row) => ({ ...row, _id: row.id })), total: items.length };
};

// Every movement of a balance goes through here so in-transit stock is added
// and removed symmetrically and can never go negative.
const adjustBalance = async (trx, { tenantId, stockroomId, modelId, assetId, location, delta, field }) => {
  // One balance row per stockroom + model + asset; a null model/asset line is
  // distinct from a modelled one, so the match is exact on all three.
  const matching = (query) => query
    .where({ company_id: tenantId, stockroom_id: stockroomId })
    .modify((b) => (modelId ? b.where({ model_id: modelId }) : b.whereNull("model_id")))
    .modify((b) => (assetId ? b.where({ asset_id: assetId }) : b.whereNull("asset_id")));

  let balance = await matching(trx("inventory_balances")).first();
  if (!balance) {
    const [created] = await trx("inventory_balances").insert({
      company_id: tenantId, stockroom_id: stockroomId, model_id: modelId || null,
      asset_id: assetId || null, location: location || null,
      quantity_on_hand: 0, quantity_reserved: 0, quantity_in_transit: 0,
      reorder_point: 0, max_quantity: 0,
    }).returning("*");
    balance = created;
  }
  const next = Number(balance[field]) + Number(delta);
  if (next < 0) {
    throw new ApiError(422, `Cannot decrement ${field} below zero for stockroom ${stockroomId}`);
  }
  const [after] = await trx("inventory_balances").where({ id: balance.id, company_id: tenantId })
    .update({ [field]: next }).returning("*");
  return after;
};

const shipTransfer = async ({ tenantId, id, actorId, actorName, carrier, notes }) => {
  requireTenant(tenantId);
  const db = getDB();
  const header = await transfers.get({ tenantId, id });
  if (header.status !== "requested") {
    throw new ApiError(409, `Transfer ${header.transfer_number} is ${header.status}; only a requested transfer can ship`);
  }
  const lines = await db("transfer_lines").where({ company_id: tenantId, transfer_id: id }).orderBy("line_number");
  if (!lines.length) throw new ApiError(422, "A transfer needs at least one line to ship");
  if (!header.from_stockroom_id) throw new ApiError(422, "Transfer has no source stockroom");

  const updated = await db.transaction(async (trx) => {
    for (const line of lines) {
      if (line.status === "cancelled" || line.status === "received") continue;
      if (line.quantity_shipped > 0) {
        throw new ApiError(409, `Line ${line.line_number} has already shipped`);
      }
      if (Number(line.quantity) <= 0) throw new ApiError(422, `Line ${line.line_number} has no quantity to ship`);
      // Leave the source: on-hand down, in-transit up.
      await adjustBalance(trx, {
        tenantId, stockroomId: header.from_stockroom_id, modelId: line.model_id, assetId: line.asset_id,
        location: header.from_location, delta: -Number(line.quantity), field: "quantity_on_hand",
      });
      await adjustBalance(trx, {
        tenantId, stockroomId: header.from_stockroom_id, modelId: line.model_id, assetId: line.asset_id,
        location: header.from_location, delta: Number(line.quantity), field: "quantity_in_transit",
      });
      await trx("transfer_lines").where({ id: line.id, company_id: tenantId })
        .update({ status: "shipped", quantity_shipped: line.quantity });
    }
    const [after] = await trx("transfers").where({ id, company_id: tenantId }).update({
      status: "in_transit", ship_date: new Date(), shipped_by: actorName || null,
      notes: notes === undefined ? header.notes : notes,
    }).returning("*");
    return after;
  });
  await recordEvent({
    tenantId, actorId, entityType: "transfer", entityId: id,
    action: "ship", before: header, after: { ...updated, _id: updated.id },
    extra: { carrier: carrier || null },
  });
  return { ...updated, _id: updated.id };
};

const receiveTransfer = async ({ tenantId, id, actorId, actorName, receivedLines, notes }) => {
  requireTenant(tenantId);
  const db = getDB();
  const header = await transfers.get({ tenantId, id });
  if (header.status !== "in_transit") {
    throw new ApiError(409, `Transfer ${header.transfer_number} is ${header.status}; only an in-transit transfer can be received`);
  }
  if (!header.to_stockroom_id) throw new ApiError(422, "Transfer has no destination stockroom");
  const lines = await db("transfer_lines").where({ company_id: tenantId, transfer_id: id }).orderBy("line_number");
  const known = new Set(lines.map((line) => line.id));
  // The UI sends `receivedQuantity`; older callers send `quantity`.
  const perLine = new Map();
  for (const entry of receivedLines || []) {
    const lineId = entry.lineId || entry.line_id;
    if (!lineId) throw new ApiError(422, "Each received line needs a lineId");
    if (!known.has(lineId)) {
      throw new ApiError(422, `Line ${lineId} is not part of transfer ${header.transfer_number}`);
    }
    const quantity = entry.quantity ?? entry.receivedQuantity ?? entry.received_quantity;
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed)) {
      throw new ApiError(422, `Line ${lineId} needs a numeric received quantity`);
    }
    perLine.set(lineId, parsed);
  }

  const updated = await db.transaction(async (trx) => {
    for (const line of lines) {
      if (line.status === "cancelled") continue;
      if (line.status === "received") continue;
      const shipped = Number(line.quantity_shipped) || Number(line.quantity);
      const requested = perLine.has(line.id) ? Number(perLine.get(line.id)) : shipped;
      if (requested < 0) throw new ApiError(422, `Line ${line.line_number} received quantity cannot be negative`);
      if (requested > shipped) {
        throw new ApiError(422, `Line ${line.line_number} received ${requested} but only ${shipped} shipped`);
      }
      // Leave transit at the source, arrive at the destination.
      await adjustBalance(trx, {
        tenantId, stockroomId: header.from_stockroom_id, modelId: line.model_id, assetId: line.asset_id,
        location: header.from_location, delta: -requested, field: "quantity_in_transit",
      });
      await adjustBalance(trx, {
        tenantId, stockroomId: header.to_stockroom_id, modelId: line.model_id, assetId: line.asset_id,
        location: header.to_location, delta: requested, field: "quantity_on_hand",
      });
      const fullyReceived = requested >= shipped;
      await trx("transfer_lines").where({ id: line.id, company_id: tenantId }).update({
        status: fullyReceived ? "received" : "shipped", quantity_received: requested,
      });
    }
    const [after] = await trx("transfers").where({ id, company_id: tenantId }).update({
      status: "received", receive_date: new Date(), received_by: actorName || null,
      notes: notes === undefined ? header.notes : notes,
    }).returning("*");
    return after;
  });
  await recordEvent({
    tenantId, actorId, entityType: "transfer", entityId: id,
    action: "receive", before: header, after: { ...updated, _id: updated.id },
  });
  return { ...updated, _id: updated.id };
};

const cancelTransfer = async ({ tenantId, id, actorId, reason }) => {
  requireTenant(tenantId);
  const db = getDB();
  const header = await transfers.get({ tenantId, id });
  const after = await transfers.transition({
    tenantId, id, transitions: TRANSFER_TRANSITIONS, to: "cancelled", actorId, label: "status",
    patch: { notes: reason ? `${header.notes ? header.notes + "\n" : ""}Cancelled: ${reason}` : header.notes },
  });
  // In-transit stock must go back to the source rather than vanish.
  if (header.status === "in_transit" && header.from_stockroom_id) {
    const lines = await db("transfer_lines").where({ company_id: tenantId, transfer_id: id });
    await db.transaction(async (trx) => {
      for (const line of lines) {
        const inTransit = Number(line.quantity_shipped) - Number(line.quantity_received);
        if (inTransit <= 0) continue;
        await adjustBalance(trx, {
          tenantId, stockroomId: header.from_stockroom_id, modelId: line.model_id, assetId: line.asset_id,
          location: header.from_location, delta: -inTransit, field: "quantity_in_transit",
        });
        await adjustBalance(trx, {
          tenantId, stockroomId: header.from_stockroom_id, modelId: line.model_id, assetId: line.asset_id,
          location: header.from_location, delta: inTransit, field: "quantity_on_hand",
        });
        await trx("transfer_lines").where({ id: line.id, company_id: tenantId }).update({ status: "cancelled" });
      }
    });
  }
  return after;
};

const requestTransfer = async ({ tenantId, id, actorId }) => {
  // Requesting from draft moves it on; re-requesting a requested transfer is
  // a no-op rather than an illegal transition.
  const current = await transfers.get({ tenantId, id });
  if (current.status === "requested") return current;
  return transfers.transition({
    tenantId, id, transitions: TRANSFER_TRANSITIONS, to: "requested", actorId, label: "status",
    patch: { requested_date: new Date() },
  });
};

// The 15.5 Transfer Order screen needs the header plus its lines.
const getTransferOrder = async ({ tenantId, id }) => {
  const header = await transfers.get({ tenantId, id });
  const { items } = await listTransferLines({ tenantId, transferId: id });
  return { ...header, lines: items };
};

module.exports = {
  inventoryBalances,
  inventoryExceptions,
  resolveException,
  inventoryOverview,
  transfers,
  transferLines,
  createTransfer,
  listTransferLines,
  getTransferOrder,
  requestTransfer,
  shipTransfer,
  receiveTransfer,
  cancelTransfer,
  TRANSFER_TRANSITIONS,
  EXCEPTION_TRANSITIONS,
};
