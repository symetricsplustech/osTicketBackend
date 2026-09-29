/* eslint-disable no-console */
/**
 * Phase 15 Asset & Cost Management HTTP contract test (requires DB).
 *
 * Boots the real Express app on an ephemeral port and drives /api/v1/core/assets
 * over HTTP, so authentication, per-route permission gating, validation and the
 * cross-module flows the UI depends on are all exercised end to end.
 * Run: DB_MAX_POOL=4 node tests/asset-management-api.test.js
 */
const connectDB = require("../src/config/db");
const { getDB } = require("../src/config/db");
const app = require("../src/app");
const { model } = require("../src/models/compat");

const Company = model("companies", {
  instanceMethods: {
    isActive() {
      return this.status === "active" || this.status === "trial";
    },
  },
});
const User = model("users");

// The 19 tables the Phase 15 migrations own. Exceptions are a status on
// audit_results rather than a table of their own, and transfers live in
// `transfers`.
const PHASE15_TABLES = [
  "audit_results",
  "audit_tasks",
  "transfer_lines",
  "transfers",
  "asset_assignments",
  "asset_lifecycles",
  "inventory_exceptions",
  "inventory_balances",
  "asset_costs",
  "cost_allocations",
  "stockroom_configurations",
  "asset_audits",
  "cost_centers",
  "asset_properties",
  "asset_substates",
  "asset_states",
  "asset_models",
  "model_categories",
  "stockrooms",
];

let passed = 0;
const ok = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  passed += 1;
  console.log(`PASS ${message}`);
};
const section = (name) => console.log(`\n=== ${name} ===`);

// Every key the generated catalog exposes for the asset namespace, so this
// test does not have to be edited every time a Phase 15 key is added.
const ASSET_PERMISSIONS = (() => {
  const keys = [];
  const walk = (node) => {
    for (const value of Object.values(node || {})) {
      if (typeof value === "string" && value.startsWith("itsm.asset.")) keys.push(value);
      else if (value && typeof value === "object") walk(value);
    }
  };
  walk(require("../src/permissions/itsmCatalogData").asset);
  return keys;
})();

let adminToken;
let plainToken;
let tenantId;
const stamp = Date.now();

// A tiny fetch wrapper keeps the call sites shaped like the supertest ones the
// older tests use, without pulling in a test-only HTTP dependency.
let baseUrl = "";
const call = async (method, path, token, body) => {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_) {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed || {} };
};
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const api = (method, path, token) => ({
  // `.send()` mirrors the supertest call sites used elsewhere in tests/; the
  // payload is captured here and passed by send().
  send: (body) => call(method, `/core/assets${path}`, token, body),
  then: (...a) => call(method, `/core/assets${path}`, token, undefined).then(...a),
});

// Every table the Phase 15 services touch, oldest child first, so the deletes
// never trip a foreign key.
const CHILD_TABLES = PHASE15_TABLES;

async function setup() {
  const company = await Company.create({
    name: "Asset API Tenant",
    domain: `asset-api-${stamp}.example.invalid`,
    status: "active",
    is_instance: true,
    instance_code: `asset-api-${stamp}`,
  });
  tenantId = String(company.id ?? company._id);

  // Permissions are resolved from the selected instance membership, and
  // membership grants are filtered to fully-qualified keys (no wildcards), so
  // the asset manager is granted every generated itsm.asset.* key.
  const admin = await User.create({
    name: "Asset API Admin",
    email: `asset-api-admin-${stamp}@example.invalid`,
    password: "password123",
    company_id: tenantId,
    status: "active",
    instance_memberships: [
      {
        instance: tenantId,
        role: "instance_admin",
        status: "active",
        permissions: ASSET_PERMISSIONS,
      },
    ],
  });
  const plain = await User.create({
    name: "Asset API Agent",
    email: `asset-api-agent-${stamp}@example.invalid`,
    password: "password123",
    company_id: tenantId,
    status: "active",
    instance_memberships: [
      { instance: tenantId, role: "member", status: "active", permissions: [] },
    ],
  });

  // Membership permissions only reach the principal on an instance-scoped
  // token, so each user logs in and then selects the instance.
  const loginAndSelect = async (user) => {
    const login = await call("POST", "/auth/login", null, {
      email: user.email,
      password: "password123",
    });
    if (!login.body.token) return null;
    const selected = await call("POST", `/instances/${tenantId}/select`, login.body.token);
    return selected.body.token || null;
  };

  adminToken = await loginAndSelect(admin);
  plainToken = await loginAndSelect(plain);

  ok(Boolean(adminToken), "the asset admin can log in and select the instance");
  ok(Boolean(plainToken), "the asset agent can log in and select the instance");
}

async function cleanup() {
  const db = getDB();
  for (const table of CHILD_TABLES) {
    await db(table).where({ company_id: tenantId }).del();
  }
  await db("assets").where({ company_id: tenantId }).del();
  await User.deleteMany({ email: { $regex: `asset-api-${stamp}` } });
  await Company.deleteMany({ domain: `asset-api-${stamp}.example.invalid` });
  await db("counters").where({ id: { $like: `${tenantId}:%` } }).del();
}

// ─── authentication and permissions ────────────────────────────────────

async function testAuth() {
  section("AUTHENTICATION AND PERMISSION GATING");

  const anon = await call("GET", "/core/assets/models", null);
  ok(anon.status === 401, `a model list without a token is rejected (got ${anon.status})`);

  const forbidden = await api("get", "/models", plainToken).send();
  ok(
    forbidden.status === 403,
    `an agent without asset permissions cannot read models (got ${forbidden.status})`,
  );

  const allowed = await api("get", "/models", adminToken).send();
  ok(allowed.status === 200 && allowed.body.success === true, "an admin can read models");
}

// ─── 15.2 models ──────────────────────────────────────────────────────

let modelId;

async function testModels() {
  section("15.2 ASSET MODELS");

  const category = await api("post", "/model-categories", adminToken).send({
    name: "Laptops",
    description: "Portable hardware",
  });
  ok(category.status === 201, `a model category is created (got ${category.status})`);
  ok(Boolean(category.body.item?.id), "the created category is returned");

  const created = await api("post", "/models", adminToken).send({
    name: "Acme Pro 14",
    manufacturer: "Acme",
    category_id: category.body.item.id,
    is_active: true,
  });
  ok(created.status === 201, `a model is created (got ${created.status})`);
  modelId = created.body.item?.id;

  const fetched = await api("get", `/models/${modelId}`, adminToken).send();
  ok(fetched.status === 200 && fetched.body.item.name === "Acme Pro 14", "a model reads back by id");

  const list = await api("get", "/models?search=Acme", adminToken).send();
  ok(list.body.items.length === 1, "the model list honours the search term");

  const byCategory = await api(
    "get",
    `/models?filters=${encodeURIComponent(JSON.stringify({ category_id: category.body.item.id }))}`,
    adminToken,
  ).send();
  ok(
    byCategory.body.items.length === 1 && byCategory.body.items[0].id === modelId,
    "the model list honours a column filter",
  );

  const badFilter = await api("get", "/models?filters=not-json", adminToken).send();
  ok(
    badFilter.status === 200 && badFilter.body.items.length === 1,
    "a malformed filter parameter is ignored rather than failing the list",
  );

  const updated = await api("put", `/models/${modelId}`, adminToken).send({ name: "Acme Pro 16" });
  ok(updated.body.item.name === "Acme Pro 16", "a model update is persisted");

  const bad = await api("put", `/models/${modelId}`, adminToken).send({ name: "" });
  ok(bad.status === 422, `a blank model name is rejected (got ${bad.status})`);

  const notFound = await api("get", "/models/00000000-0000-4000-8000-000000000000", adminToken).send();
  ok(notFound.status === 404, `an unknown model id is a 404 (got ${notFound.status})`);
}

// ─── 15.3 stockrooms ──────────────────────────────────────────────────

let stockroomId;
let spareStockroomId;

async function testStockrooms() {
  section("15.3 STOCKROOMS");

  const created = await api("post", "/stockrooms", adminToken).send({
    name: "Main Warehouse",
    code: "WH-MAIN",
    location: "Building A",
    is_active: true,
  });
  ok(created.status === 201, `a stockroom is created (got ${created.status})`);
  stockroomId = created.body.item?.id;

  const second = await api("post", "/stockrooms", adminToken).send({
    name: "Overflow",
    code: "WH-OVER",
    is_active: true,
  });
  spareStockroomId = second.body.item?.id;

  const list = await api("get", "/stockrooms", adminToken).send();
  ok(list.body.items.length === 2, "the stockroom list returns both rooms");

  const renamed = await api("put", `/stockrooms/${stockroomId}`, adminToken).send({ name: "Main Warehouse A" });
  ok(renamed.body.item.name === "Main Warehouse A", "a stockroom rename is persisted");
}

// ─── 15.4 inventory ───────────────────────────────────────────────────

let assetId;
let spareAssetId;

async function testInventory() {
  section("15.4 INVENTORY");

  // Individual assets are created through the platform asset API, so seed the
  // rows that the inventory, assignment and cost modules then track.
  const db = getDB();
  const [created] = await db("assets")
    .insert({
      company_id: tenantId,
      name: "Acme Pro 14 #001",
      serial: `API-SN-001-${stamp}`,
      model_id: modelId,
      status: "in_stock",
    })
    .returning("*");
  assetId = created.id;
  const [spare] = await db("assets")
    .insert({
      company_id: tenantId,
      name: "Acme Pro 14 #002",
      serial: `API-SN-002-${stamp}`,
      model_id: modelId,
      status: "in_stock",
    })
    .returning("*");
  spareAssetId = spare.id;
  ok(Boolean(assetId && spareAssetId), "two assets are seeded for the inventory flow");

  const balance = await api("post", "/inventory", adminToken).send({
    stockroom_id: stockroomId,
    model_id: modelId,
    quantity_on_hand: 10,
    quantity_reserved: 2,
    reorder_point: 4,
  });
  ok(balance.status === 201, `an inventory balance is created (got ${balance.status})`);
  ok(
    Number(balance.body.item.quantity_available) === 8,
    "quantity_available is on hand minus reserved",
  );

  const moved = await api("put", `/stockrooms/${stockroomId}/inventory/${balance.body.item.id}`, adminToken).send({
    quantity_on_hand: 3,
  });
  ok(moved.status === 200, `a stockroom balance can be adjusted (got ${moved.status})`);

  const room = await api("get", `/stockrooms/${stockroomId}/inventory`, adminToken).send();
  ok(
    room.body.items.length === 1 && Number(room.body.items[0].quantity_on_hand) === 3,
    "the stockroom inventory reads the adjusted quantity",
  );

  const overview = await api("get", "/inventory/overview", adminToken).send();
  ok(
    overview.status === 200 && Number(overview.body.totals.onHand) === 3,
    "the inventory overview totals on hand",
  );
  ok(
    Number(overview.body.totals.reserved) === 2 &&
      Number(overview.body.totals.available) === 1,
    "the overview reports available as on hand minus reserved",
  );

  const low = await api("get", "/inventory/overview?lowStockOnly=true", adminToken).send();
  ok(low.body.items.length === 1, "the low stock filter honours the reorder point");

  const exception = await api("post", "/inventory/exceptions", adminToken).send({
    balance_id: balance.body.item.id,
    exception_type: "count_variance",
    severity: "medium",
    expected_quantity: 10,
    actual_quantity: 3,
    description: "cycle count",
  });
  ok(exception.status === 201, `an inventory exception is raised (got ${exception.status})`);

  const resolved = await api("put", `/inventory/exceptions/${exception.body.item.id}`, adminToken).send({
    status: "resolved",
    note: "adjusted",
  });
  ok(resolved.body.item.status === "resolved", "an inventory exception can be resolved");

  const guarded = await api("delete", `/stockrooms/${stockroomId}`, adminToken).send();
  ok(guarded.status === 409, `a stockroom holding inventory cannot be deleted (got ${guarded.status})`);
}

// ─── 15.5 transfers ───────────────────────────────────────────────────

let transferId;

async function testTransfers() {
  section("15.5 TRANSFERS");

  const db = getDB();
  const balance = await db("inventory_balances")
    .where({ company_id: tenantId, stockroom_id: stockroomId })
    .first();
  await db("inventory_balances")
    .where({ id: balance.id })
    .update({ quantity_on_hand: 20 });
  await db("stockrooms").where({ id: spareStockroomId }).update({ is_active: true });

  const transfer = await api("post", "/transfers", adminToken).send({
    from_stockroom_id: stockroomId,
    to_stockroom_id: spareStockroomId,
    from_location: "Building A",
    to_location: "Building B",
    request_reason: "rebalance",
    lines: [{ model_id: modelId, quantity: 5 }],
  });
  ok(transfer.status === 201, `a transfer is created with its lines (got ${transfer.status})`);
  ok(transfer.body.item.status === "draft", "a new transfer starts as a draft");
  ok(/^TRF-/.test(transfer.body.item.transfer_number || ""), "the transfer is numbered");
  transferId = transfer.body.item?.id;

  const detail = await api("get", `/transfers/${transferId}`, adminToken).send();
  ok(detail.body.item.lines.length === 1, "the transfer reads back with its line");

  const sameRoom = await api("post", "/transfers", adminToken).send({
    from_stockroom_id: stockroomId,
    to_stockroom_id: stockroomId,
    lines: [{ model_id: modelId, quantity: 1 }],
  });
  ok(sameRoom.status === 422, `a transfer to the same stockroom is rejected (got ${sameRoom.status})`);

  const noLines = await api("post", "/transfers", adminToken).send({
    from_stockroom_id: stockroomId,
    to_stockroom_id: spareStockroomId,
    lines: [],
  });
  ok(noLines.status === 422, `a transfer with no lines is rejected (got ${noLines.status})`);

  const earlyShip = await api("post", `/transfers/${transferId}/ship`, adminToken).send({});
  ok(earlyShip.status === 409, `a draft transfer cannot ship (got ${earlyShip.status})`);

  await api("post", `/transfers/${transferId}/request`, adminToken).send({});
  const shipped = await api("post", `/transfers/${transferId}/ship`, adminToken).send({ carrier: "Acme Freight" });
  ok(shipped.status === 200 && shipped.body.item.status === "in_transit", `a requested transfer ships (got ${shipped.status})`);

  const afterShip = await getDB()("inventory_balances").where({ id: balance.id }).first();
  ok(Number(afterShip.quantity_on_hand) === 15, "shipping reduces the source on hand");

  const foreignLine = await api("post", `/transfers/${transferId}/receive`, adminToken).send({
    receivedLines: [
      { lineId: "00000000-0000-4000-8000-000000000000", receivedQuantity: 1 },
    ],
  });
  ok(
    foreignLine.status === 422,
    `receiving a line from another transfer is rejected (got ${foreignLine.status})`,
  );

  const lines = await api("get", `/transfers/${transferId}/lines`, adminToken).send();
  const lineId = lines.body.items[0].id;

  const overReceive = await api("post", `/transfers/${transferId}/receive`, adminToken).send({
    receivedLines: [{ lineId, receivedQuantity: 99 }],
  });
  ok(
    overReceive.status === 422,
    `receiving more than was shipped is rejected (got ${overReceive.status})`,
  );

  const received = await api("post", `/transfers/${transferId}/receive`, adminToken).send({
    receivedLines: [{ lineId, receivedQuantity: 5 }],
  });
  ok(received.status === 200 && received.body.item.status === "received", `a transfer receives (got ${received.status})`);

  const destBalance = await getDB()("inventory_balances")
    .where({ company_id: tenantId, stockroom_id: spareStockroomId, model_id: modelId })
    .first();
  ok(
    Number(destBalance?.quantity_on_hand) === 5,
    "receiving adds the quantity to the destination",
  );
}

// ─── 15.6 assignment and 15.7 lifecycle ───────────────────────────────

let assignmentId;

async function testAssignmentAndLifecycle() {
  section("15.6 ASSIGNMENT AND 15.7 LIFECYCLE");

  const assigned = await api("post", "/assignments", adminToken).send({
    assetId,
    assignee: { name: "Dana Ops", email: "dana@example.invalid", department: "IT" },
    notes: "laptop refresh",
  });
  ok(assigned.status === 201, `an asset is assigned (got ${assigned.status})`);
  assignmentId = assigned.body.item?.id;

  const assetRow = await getDB()("assets").where({ id: assetId }).first();
  ok(assetRow.status === "in_use", "assigning syncs the denormalised asset status");

  const twice = await api("post", "/assignments", adminToken).send({
    assetId,
    assignee: { name: "Someone Else" },
  });
  ok(twice.status === 409, `an asset cannot be assigned twice (got ${twice.status})`);

  const anonymousAssignee = await api("post", "/assignments", adminToken).send({ assetId: spareAssetId, assignee: {} });
  ok(anonymousAssignee.status === 422, `an assignment needs an assignee name (got ${anonymousAssignee.status})`);

  const swapped = await api("post", `/assignments/${assignmentId}/swap`, adminToken).send({
    replacementAssetId: spareAssetId,
    reason: "hardware failure",
  });
  ok(swapped.status === 200, `an assignment swaps for a replacement (got ${swapped.status})`);
  ok(swapped.body.item.outgoing.status === "in_stock", "the outgoing asset returns to stock");
  ok(
    Boolean(swapped.body.item.assignment?.id) &&
      swapped.body.item.assignment.id !== assignmentId,
    "the swap opens a new assignment for the replacement",
  );

  const returned = await api("post", `/assignments/${swapped.body.item.assignment.id}/return`, adminToken).send({ condition: "damaged" });
  ok(returned.status === 200, `an assignment is returned (got ${returned.status})`);

  const returnedAsset = await getDB()("assets").where({ id: spareAssetId }).first();
  ok(
    returnedAsset.status === "in_maintenance",
    "returning a damaged asset routes it to maintenance",
  );

  const moved = await api("post", `/lifecycle/${spareAssetId}/move`, adminToken).send({
    to: "in_stock",
    reason: "repaired",
  });
  ok(moved.status === 200 && moved.body.item.state === "in_stock", `a lifecycle move is applied (got ${moved.status})`);

  const illegal = await api("post", `/lifecycle/${spareAssetId}/move`, adminToken).send({ to: "disposed" });
  ok(illegal.status === 409, `an illegal lifecycle transition is rejected (got ${illegal.status})`);

  const byState = await api("get", "/lifecycle?state=in_stock", adminToken).send();
  ok(byState.status === 200 && byState.body.items.length >= 1, "the lifecycle list filters by state");
}

// ─── 15.8 audits ──────────────────────────────────────────────────────

let auditId;

async function testAudits() {
  section("15.8 ASSET AUDIT");

  const created = await api("post", "/audits", adminToken).send({
    name: "Q1 Cycle Count",
    stockroom_id: stockroomId,
    scope_type: "stockroom",
    planned_date: "2026-01-01",
  });
  ok(created.status === 201, `an audit is created (got ${created.status})`);
  ok(/^AAUD-/.test(created.body.item.audit_number || ""), "the audit is numbered");
  auditId = created.body.item?.id;

  const task = await api("post", `/audits/${auditId}/tasks`, adminToken).send({
    task_name: "Count Main Warehouse",
    assigned_to: "Dana Ops",
  });
  ok(task.status === 201, `an audit task is created (got ${task.status})`);

  const earlyComplete = await api("post", `/audits/${auditId}/complete`, adminToken).send({});
  ok(earlyComplete.status === 409, `an audit with open tasks cannot complete (got ${earlyComplete.status})`);

  await api("post", `/audits/${auditId}/start`, adminToken).send({});

  const scan = await api("post", `/audits/${auditId}/scan`, adminToken).send({
    task_id: task.body.item.id,
    asset_id: assetId,
    result: "match",
  });
  ok(scan.status === 201, `a scan result is recorded (got ${scan.status})`);

  const unknownResult = await api("post", `/audits/${auditId}/scan`, adminToken).send({
    task_id: task.body.item.id,
    asset_id: assetId,
    result: "mismatch",
  });
  ok(
    unknownResult.status === 422,
    `an unknown scan result is rejected (got ${unknownResult.status})`,
  );

  const mismatch = await api("post", `/audits/${auditId}/scan`, adminToken).send({
    task_id: task.body.item.id,
    asset_id: assetId,
    result: "missing",
    note: "wrong location",
  });
  ok(mismatch.status === 201, `a missing scan is recorded as an exception (got ${mismatch.status})`);

  const exceptions = await api("get", "/audit-exceptions?openOnly=true", adminToken).send();
  ok(exceptions.body.items.length === 1, "the open exception list finds the mismatch");

  const resolved = await api("put", `/audit-exceptions/${exceptions.body.items[0].id}`, adminToken).send({
    note: "relocated",
  });
  ok(resolved.status === 200, `an exception can be resolved (got ${resolved.status})`);

  await api("put", `/audits/${auditId}/tasks/${task.body.item.id}`, adminToken).send({ status: "completed" });
  const completed = await api("post", `/audits/${auditId}/complete`, adminToken).send({});
  ok(completed.status === 200 && completed.body.item.status === "completed", `the audit completes (got ${completed.status})`);

  const cancelDone = await api("post", `/audits/${auditId}/cancel`, adminToken).send({ reason: "late" });
  ok(cancelDone.status === 409, `a completed audit cannot be cancelled (got ${cancelDone.status})`);
}

// ─── 15.9 costs ───────────────────────────────────────────────────────

async function testCosts() {
  section("15.9 COST MANAGEMENT");

  const center = await api("post", "/cost-centers", adminToken).send({
    name: "IT Operations",
    code: "IT-OPS",
    budget_amount: 50000,
  });
  ok(center.status === 201, `a cost center is created (got ${center.status})`);

  const cost = await api("post", "/costs", adminToken).send({
    asset_id: assetId,
    cost_type: "maintenance",
    amount: 500,
    currency: "USD",
    cost_center_id: center.body.item.id,
    cost_date: "2026-01-15",
    description: "screen replacement",
  });
  ok(cost.status === 201, `a cost is created (got ${cost.status})`);
  ok(cost.body.item.status === "pending", "a new cost starts pending");
  const costId = cost.body.item?.id;

  const earlyPay = await api("post", `/costs/${costId}/pay`, adminToken).send({});
  ok(earlyPay.status === 409, `a pending cost cannot be paid (got ${earlyPay.status})`);

  const allocation = await api("post", `/costs/${costId}/allocations`, adminToken).send({
    cost_center_id: center.body.item.id,
    department: "IT",
    allocated_amount: 200,
  });
  ok(allocation.status === 201, `an allocation is recorded (got ${allocation.status})`);

  const over = await api("post", `/costs/${costId}/allocations`, adminToken).send({
    cost_center_id: center.body.item.id,
    department: "IT",
    allocated_amount: 99999,
  });
  ok(over.status === 422, `allocations cannot exceed the cost (got ${over.status})`);

  await api("post", `/costs/${costId}/approve`, adminToken).send({ decision: "approved" });
  const paid = await api("post", `/costs/${costId}/pay`, adminToken).send({});
  ok(paid.status === 200 && paid.body.item.status === "paid", `an approved cost is paid (got ${paid.status})`);

  const allocations = await api("get", `/costs/${costId}/allocations`, adminToken).send();
  ok(allocations.body.items.length === 1, "the cost allocation list reads back");

  const report = await api("get", "/costs/report", adminToken).send();
  ok(
    report.status === 200 && Number(report.body.totals.total) === 500,
    "the cost report totals the spend",
  );
  ok(report.body.byType.length === 1 && report.body.byType[0].costType === "maintenance", "the cost report breaks down by type");
  ok(
    report.body.budgetUsage.some((row) => Number(row.spent) === 500 && Number(row.remaining) === 49500),
    "budget usage reports spend against the cost centre budget",
  );

  const ranged = await api("get", "/costs/report?from=2020-01-01&to=2020-12-31", adminToken).send();
  ok(Number(ranged.body.totals.total) === 0, "the cost report honours a date range");

  const filtered = await api("get", "/costs/report?costType=acquisition", adminToken).send();
  ok(Number(filtered.body.totals.total) === 0, "the cost report honours a cost type");
}

// ─── 15.10 configuration ──────────────────────────────────────────────

async function testConfiguration() {
  section("15.10 CONFIGURATION");

  const state = await api("post", "/config/states", adminToken).send({
    name: "in_stock",
    label: "In Stock",
    color: "#22c55e",
    sequence: 1,
    is_default: true,
  });
  ok(state.status === 201, `an asset state is created (got ${state.status})`);

  const substate = await api("post", "/config/substates", adminToken).send({
    state_id: state.body.item.id,
    name: "awaiting_parts",
    label: "Awaiting Parts",
    sequence: 1,
  });
  ok(substate.status === 201, `an asset substate is created (got ${substate.status})`);

  const property = await api("post", "/config/properties", adminToken).send({
    name: "warranty_end",
    label: "Warranty End",
    data_type: "date",
    model_id: modelId,
  });
  ok(property.status === 201, `an asset property is created (got ${property.status})`);

  const configured = await api("get", "/config/lifecycle-states", adminToken).send();
  ok(
    configured.body.items.some((s) => s.name === "in_stock" && s.substates.some((x) => x.name === "awaiting_parts")),
    "the lifecycle configuration lists states with their substates",
  );

  const defaults = await api("get", `/config/stockrooms/${spareStockroomId}`, adminToken).send();
  ok(defaults.status === 200, `an unconfigured stockroom reports defaults (got ${defaults.status})`);

  const saved = await api("put", `/config/stockrooms/${spareStockroomId}`, adminToken).send({
    allowNegativeStock: true,
    defaultReorderPoint: 3,
  });
  ok(saved.status === 200 && saved.body.item.allowNegativeStock === true, "a stockroom configuration is saved");
  ok(saved.body.item.defaultReorderPoint === 3, "the saved stockroom configuration round-trips");

  const reread = await api("get", `/config/stockrooms/${spareStockroomId}`, adminToken).send();
  ok(reread.body.item.allowNegativeStock === true, "the saved stockroom configuration reads back");
}

// ─── cross-tenant isolation ───────────────────────────────────────────

async function testCrossTenant() {
  section("CROSS-TENANT ISOLATION");

  const db = getDB();
  const other = await db("companies")
    .insert({
      name: "Other Tenant",
      domain: `asset-api-other-${stamp}.example.invalid`,
      status: "active",
      is_instance: true,
      instance_code: `asset-api-other-${stamp}`,
    })
    .returning("*");
  const otherId = other[0].id;

  const [foreignModel] = await db("asset_models")
    .insert({ company_id: otherId, name: "Foreign Model", is_active: true })
    .returning("*");

  const listed = await api("get", "/models", adminToken).send();
  ok(
    !listed.body.items.some((m) => m.id === foreignModel.id),
    "another tenant's model is not visible in the list",
  );

  const fetched = await api("get", `/models/${foreignModel.id}`, adminToken).send();
  ok(fetched.status === 404, `another tenant's model cannot be read by id (got ${fetched.status})`);

  const updated = await api("put", `/models/${foreignModel.id}`, adminToken).send({ name: "Hijacked" });
  ok(updated.status === 404, `another tenant's model cannot be updated (got ${updated.status})`);

  const [foreignAsset] = await db("assets")
    .insert({ company_id: otherId, name: "Foreign Asset", status: "in_stock" })
    .returning("*");
  const moved = await api("post", `/lifecycle/${foreignAsset.id}/move`, adminToken).send({ to: "in_use" });
  ok(moved.status === 404, `another tenant's asset cannot be moved (got ${moved.status})`);

  await db("asset_models").where({ id: foreignModel.id }).del();
  await db("assets").where({ id: foreignAsset.id }).del();
  await db("companies").where({ id: otherId }).del();
}

// ─── runner ───────────────────────────────────────────────────────────

(async () => {
  await connectDB();
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await setup();
  try {
    await testAuth();
    await testModels();
    await testStockrooms();
    await testInventory();
    await testTransfers();
    await testAssignmentAndLifecycle();
    await testAudits();
    await testCosts();
    await testConfiguration();
    await testCrossTenant();
    section("CLEANUP");
    await cleanup();
    const leftovers = {};
    for (const table of [...CHILD_TABLES, "assets"]) {
      const rows = await getDB()(table).where({ company_id: tenantId }).select("*");
      if (rows.length) leftovers[table] = rows.length;
    }
    ok(
      Object.keys(leftovers).length === 0,
      `cleanup removed every row this test created (${passed} checks passed)` +
        (Object.keys(leftovers).length ? `; left behind: ${JSON.stringify(leftovers)}` : ""),
    );
    console.log(`\nPHASE 15 ASSET MANAGEMENT API TESTS PASSED (${passed} checks)`);
  } catch (error) {
    console.error(`\n${error.message}`);
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error(`cleanup also failed: ${cleanupError.message}`);
    }
    process.exitCode = 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await getDB().destroy();
  }
})();
