/**
 * Phase 15.6 Asset Assignment and 15.7 Asset Lifecycle.
 *
 * Assignment hands an asset to a custodian (assign / return / swap). Lifecycle
 * tracks where the asset sits in its life (on order, in stock, in use, in
 * maintenance, retired, disposed). Every asset keeps one lifecycle row, and
 * each movement appends to a jsonb history so the 15.7 screens can show both
 * the current position and how it got there.
 *
 * Assignment and lifecycle are kept consistent: an asset that is assigned must
 * be in_use, returning it returns the asset to in_stock, and an asset cannot
 * be disposed while it is still assigned to someone.
 */

const { getDB } = require("../config/db");
const ApiError = require("../utils/ApiError");
const { crud, isUuid, recordEvent, requireTenant } = require("./assetCrud");

// ── 15.6 Asset Assignment ──────────────────────────────────────────────

const ASSIGNMENT_TRANSITIONS = {
  active: ["returned", "swapped"],
  returned: [],
  swapped: [],
};

const assetAssignments = crud({
  required: ["asset_id", "assigned_to_name"],
  table: "asset_assignments",
  entity: "asset_assignment",
  fields: [
    "asset_id", "assigned_to_user_id", "assigned_to_name", "assigned_to_dept",
    "assigned_to_location", "assignment_type", "status", "assigned_at",
    "due_back_at", "returned_at", "return_condition", "notes",
  ],
  searchFields: ["assigned_to_name", "assigned_to_dept", "notes", "return_condition"],
  sort: "created_at",
  map: (row) => ({ ...row, _id: row.id }),
});

// node-postgres turns a JS array into a Postgres array literal, so writing
// `history: []` into a jsonb column stores `{}` rather than `[]`. Every history
// append therefore goes through here and sends a JSON string.
const appendHistory = (lifecycle, entry) => {
  const current = Array.isArray(lifecycle.history) ? lifecycle.history : [];
  return JSON.stringify([...current, { ...entry, at: entry.at || new Date().toISOString() }]);
};

const getAsset = async (tenantId, assetId) => {
  if (!isUuid(assetId)) throw new ApiError(422, "A valid assetId is required");
  const db = getDB();
  const asset = await db("assets").where({ id: assetId, company_id: tenantId }).first();
  if (!asset) throw new ApiError(404, "Asset not found");
  return asset;
};

const getLifecycleRow = async (tenantId, assetId, { create = false, trx } = {}) => {
  const runner = trx || getDB();
  let row = await runner("asset_lifecycles").where({ company_id: tenantId, asset_id: assetId }).first();
  if (!row && create) {
    const [created] = await runner("asset_lifecycles").insert({
      company_id: tenantId, asset_id: assetId, state: "in_stock", history: JSON.stringify([]),
    }).returning("*");
    row = created;
  }
  return row;
};

// Keep the denormalised assets.status column aligned with the lifecycle state
// so the 15.1 asset lists and the lifecycle screens never disagree.
const syncAssetStatus = async (tenantId, assetId, state, trx) => {
  const runner = trx || getDB();
  await runner("assets").where({ id: assetId, company_id: tenantId }).update({ status: state });
};

const assignAsset = async ({ tenantId, assetId, assignee, actorId, notes, dueBackAt, assignmentType }) => {
  requireTenant(tenantId);
  const db = getDB();
  const asset = await getAsset(tenantId, assetId);
  const open = await db("asset_assignments")
    .where({ company_id: tenantId, asset_id: assetId, status: "active" })
    .first();
  if (open) throw new ApiError(409, "Asset already has an active assignment; return or swap it first");
  if (asset.status === "retired" || asset.status === "disposed") {
    throw new ApiError(409, `A ${asset.status} asset cannot be assigned`);
  }

  const name = assignee.name || assignee.assignedToName || null;
  if (!name) throw new ApiError(422, "An assignee name is required");

  return db.transaction(async (trx) => {
    const lifecycle = await getLifecycleRow(tenantId, assetId, { create: true, trx });
    if (lifecycle.state === "retired" || lifecycle.state === "disposed") {
      throw new ApiError(409, `A ${lifecycle.state} asset cannot be assigned`);
    }
    const [assignment] = await trx("asset_assignments").insert({
      company_id: tenantId,
      asset_id: assetId,
      assigned_to_user_id: assignee.userId || assignee.assignedToUserId || null,
      assigned_to_name: name,
      assigned_to_dept: assignee.dept || assignee.department || null,
      assigned_to_location: assignee.location || null,
      assignment_type: assignmentType || "direct",
      status: "active",
      assigned_at: new Date(),
      due_back_at: dueBackAt || null,
      notes: notes || "",
    }).returning("*");

    const history = appendHistory(lifecycle, {
      state: "in_use", by: actorId || null, reason: `Assigned to ${name}`,
    });
    await trx("asset_lifecycles").where({ id: lifecycle.id, company_id: tenantId })
      .update({ state: "in_use", state_since: new Date(), state_changed_by: actorId || null, history });
    await syncAssetStatus(tenantId, assetId, "in_use", trx);

    await recordEvent({
      tenantId, actorId, entityType: "asset_assignment", entityId: assignment.id,
      action: "assign", before: null, after: { ...assignment, _id: assignment.id },
    });
    return { ...assignment, _id: assignment.id, assetStatus: "in_use" };
  });
};

const returnAsset = async ({ tenantId, assignmentId, actorId, condition, notes }) => {
  requireTenant(tenantId);
  const db = getDB();
  const assignment = await assetAssignments.get({ tenantId, id: assignmentId });
  const asset = await getAsset(tenantId, assignment.asset_id);
  if (asset.status === "disposed") throw new ApiError(409, "A disposed asset cannot be returned");

  return db.transaction(async (trx) => {
    const [closed] = await trx("asset_assignments")
      .where({ id: assignmentId, company_id: tenantId })
      .update({
        status: "returned", returned_at: new Date(),
        return_condition: condition || null,
        notes: notes ? `${assignment.notes ? assignment.notes + "\n" : ""}${notes}` : assignment.notes,
      })
      .returning("*");

    const lifecycle = await getLifecycleRow(tenantId, assignment.asset_id, { create: true, trx });
    // A returned asset that needs work goes to maintenance, not straight back
    // into stock, which is what the Return Asset screen offers.
    const nextState = condition === "damaged" || condition === "needs_repair" ? "in_maintenance" : "in_stock";
    const history = appendHistory(lifecycle, {
      state: nextState, by: actorId || null,
      reason: `Returned by ${assignment.assigned_to_name}${condition ? ` (${condition})` : ""}`,
    });
    await trx("asset_lifecycles").where({ id: lifecycle.id, company_id: tenantId })
      .update({ state: nextState, state_since: new Date(), state_changed_by: actorId || null, history });
    await syncAssetStatus(tenantId, assignment.asset_id, nextState, trx);

    await recordEvent({
      tenantId, actorId, entityType: "asset_assignment", entityId: assignmentId,
      action: "return", before: assignment, after: { ...closed, _id: closed.id },
    });
    return { ...closed, _id: closed.id, assetStatus: nextState };
  });
};

const swapAsset = async ({ tenantId, assignmentId, replacementAssetId, actorId, reason }) => {
  requireTenant(tenantId);
  const db = getDB();
  const assignment = await assetAssignments.get({ tenantId, id: assignmentId });
  const outgoing = await getAsset(tenantId, assignment.asset_id);
  const incoming = await getAsset(tenantId, replacementAssetId);
  if (outgoing.id === incoming.id) throw new ApiError(422, "Replacement must be a different asset");
  const incomingOpen = await db("asset_assignments")
    .where({ company_id: tenantId, asset_id: replacementAssetId, status: "active" })
    .first();
  if (incomingOpen) throw new ApiError(409, "The replacement asset is already assigned");

  return db.transaction(async (trx) => {
    await trx("asset_assignments").where({ id: assignmentId, company_id: tenantId }).update({
      status: "swapped", returned_at: new Date(),
      notes: reason
        ? `${assignment.notes ? assignment.notes + "\n" : ""}Swapped to ${incoming.name}: ${reason}`
        : assignment.notes,
    });
    const [replacement] = await trx("asset_assignments").insert({
      company_id: tenantId,
      asset_id: replacementAssetId,
      assigned_to_user_id: assignment.assigned_to_user_id,
      assigned_to_name: assignment.assigned_to_name,
      assigned_to_dept: assignment.assigned_to_dept,
      assigned_to_location: assignment.assigned_to_location,
      assignment_type: assignment.assignment_type,
      status: "active",
      assigned_at: new Date(),
      due_back_at: assignment.due_back_at,
      notes: `Swap replacement for ${outgoing.name}`,
    }).returning("*");

    for (const [assetId, nextState, note] of [
      [outgoing.id, "in_stock", `Swapped out to ${incoming.name}`],
      [incoming.id, "in_use", `Swap replacement for ${outgoing.name}`],
    ]) {
      const lifecycle = await getLifecycleRow(tenantId, assetId, { create: true, trx });
      const history = appendHistory(lifecycle, {
        state: nextState, by: actorId || null, reason: note,
      });
      await trx("asset_lifecycles").where({ id: lifecycle.id, company_id: tenantId })
        .update({ state: nextState, state_since: new Date(), state_changed_by: actorId || null, history });
      await syncAssetStatus(tenantId, assetId, nextState, trx);
    }

    await recordEvent({
      tenantId, actorId, entityType: "asset_assignment", entityId: assignmentId,
      action: "swap", before: assignment,
      after: { closed: "swapped", replacement: { ...replacement, _id: replacement.id } },
    });
    return {
      closedAssignmentId: assignmentId,
      outgoing: { ...outgoing, _id: outgoing.id, status: "in_stock" },
      assignment: { ...replacement, _id: replacement.id },
    };
  });
};

// ── 15.7 Asset Lifecycle ───────────────────────────────────────────────

// An asset can always be sent to maintenance and can come back; the rest of
// the graph keeps stock, in-use and terminal states apart.
const LIFECYCLE_TRANSITIONS = {
  on_order: ["in_stock", "in_maintenance", "retired"],
  in_stock: ["in_use", "in_maintenance", "on_order", "retired"],
  in_use: ["in_maintenance", "in_stock", "retired"],
  in_maintenance: ["in_stock", "in_use", "retired"],
  retired: ["in_stock", "disposed"],
  disposed: [],
};

const assetLifecycles = crud({
  required: ["asset_id", "state"],
  table: "asset_lifecycles",
  entity: "asset_lifecycle",
  fields: ["asset_id", "state", "substate", "state_since", "state_changed_by", "retired_at", "disposed_at", "disposal_method", "disposal_value", "disposal_note", "history"],
  searchFields: ["state", "substate", "disposal_method", "disposal_note"],
  sort: "state_since",
  map: (row) => ({ ...row, _id: row.id }),
});

const listByState = async ({ tenantId, state }) => {
  requireTenant(tenantId);
  const db = getDB();
  const query = db("asset_lifecycles as l")
    .leftJoin("assets as a", "l.asset_id", "a.id")
    .where("l.company_id", tenantId)
    .select("l.*", db.raw("a.name as asset_name"), db.raw("a.serial as serial"), db.raw("a.type as asset_type"), db.raw("a.location as asset_location"));
  if (state) query.andWhere("l.state", state);
  const items = await query.orderBy("l.state_since", "desc");
  const counts = await db("asset_lifecycles").where({ company_id: tenantId })
    .select("state").count("* as count").groupBy("state");
  const byState = Object.fromEntries(counts.map((row) => [row.state, Number(row.count)]));
  for (const key of Object.keys(LIFECYCLE_TRANSITIONS)) {
    if (byState[key] === undefined) byState[key] = 0;
  }
  return { items: items.map((row) => ({ ...row, _id: row.id })), total: items.length, byState };
};

const moveAsset = async ({ tenantId, assetId, to, substate, actorId, reason, disposal, actorName }) => {
  requireTenant(tenantId);
  const db = getDB();
  await getAsset(tenantId, assetId);

  if (to === "disposed") {
    const open = await db("asset_assignments")
      .where({ company_id: tenantId, asset_id: assetId, status: "active" })
      .first();
    if (open) throw new ApiError(409, "Return the asset from its custodian before disposing it");
  }

  return db.transaction(async (trx) => {
    const lifecycle = await getLifecycleRow(tenantId, assetId, { create: true, trx });
    const legal = LIFECYCLE_TRANSITIONS[lifecycle.state] || [];
    if (!legal.includes(to)) {
      throw new ApiError(409, `Illegal lifecycle transition: ${lifecycle.state} -> ${to}`);
    }
    if (substate) {
      const valid = await trx("asset_substates")
        .where({ company_id: tenantId, name: substate, is_active: true })
        .first();
      const owner = valid && valid.state_id
        ? (await trx("asset_states").where({ id: valid.state_id, company_id: tenantId }).first())
        : null;
      if (!owner || owner.name !== to) {
        throw new ApiError(422, `Substate ${substate} is not configured for state ${to}`);
      }
    }

    const patch = {
      state: to,
      state_since: new Date(),
      state_changed_by: actorId || null,
      history: appendHistory(lifecycle, {
        state: to, substate: substate || null,
        by: actorId || null, byName: actorName || null, reason: reason || null,
      }),
    };
    if (substate !== undefined) patch.substate = substate || null;
    if (to === "retired") patch.retired_at = new Date();
    if (to === "disposed") {
      patch.disposed_at = new Date();
      patch.disposal_method = disposal?.method || disposal?.disposalMethod || null;
      patch.disposal_value = disposal?.value ?? disposal?.disposalValue ?? 0;
      patch.disposal_note = disposal?.note || disposal?.disposalNote || "";
    }

    const [after] = await trx("asset_lifecycles").where({ id: lifecycle.id, company_id: tenantId })
      .update(patch).returning("*");
    await syncAssetStatus(tenantId, assetId, to, trx);

    await recordEvent({
      tenantId, actorId, entityType: "asset_lifecycle", entityId: lifecycle.id,
      action: `move:${lifecycle.state}->${to}`, before: lifecycle, after,
    });
    return { ...after, _id: after.id, legalNextStates: legal };
  });
};

module.exports = {
  assetAssignments,
  ASSIGNMENT_TRANSITIONS,
  assignAsset,
  returnAsset,
  swapAsset,
  assetLifecycles,
  LIFECYCLE_TRANSITIONS,
  listByState,
  moveAsset,
  getLifecycleRow,
  getAsset,
  syncAssetStatus,
};
