/* eslint-disable no-console */
// Phase 15 Asset & Cost Management contract tests.
//
// Covers 15.2 Asset Models, 15.3 Stockrooms, 15.4 Inventory, 15.5 Transfers,
// 15.6 Asset Assignment, 15.7 Asset Lifecycle, 15.8 Asset Audit and
// 15.9 Cost Management against the live PostgreSQL schema.
//
// These are the rules the frontend screens depend on: tenant isolation,
// referential guards, the state machines behind Ship/Receive/Return/Swap/
// Dispose, and inventory moving with each transfer step. The test creates and
// removes all of its own rows.
//
// Run: node tests/phase15-asset-cost.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const expectStatus = async (promise, statusCode, message) => {
  try {
    await promise;
  } catch (error) {
    assert(error.statusCode === statusCode, `${message} (got ${error.statusCode}: ${error.message})`);
    return error;
  }
  throw new Error(`FAIL ${message}: expected ${statusCode} but the call succeeded`);
};

const connectDB = require('../src/config/db');
const { getDB } = require('../src/config/db');
const catalog = require('../src/services/assetCatalog.service');
const inventory = require('../src/services/assetInventory.service');
const lifecycle = require('../src/services/assetLifecycle.service');
const auditCost = require('../src/services/assetAuditCost.service');

const PHASE15_TABLES = [
  'audit_results', 'audit_tasks', 'asset_audits', 'asset_costs', 'cost_allocations',
  'cost_centers', 'asset_substates', 'asset_properties', 'asset_states',
  'stockroom_configurations', 'inventory_exceptions', 'inventory_balances',
  'asset_lifecycles', 'asset_assignments', 'transfer_lines', 'transfers',
  'stockrooms', 'asset_models', 'model_categories', 'assets',
];

async function main() {
  await connectDB();
  const db = getDB();

  // A dedicated company per run, so the assertions never read rows that belong
  // to a real tenant and the cleanup can only ever remove what this run wrote.
  const stamp = Date.now();
  const [own] = await db('companies')
    .insert({
      name: `Phase 15 Test ${stamp}`,
      domain: `phase15-asset-${stamp}.example.invalid`,
      status: 'active',
      is_instance: true,
      instance_code: `phase15-asset-${stamp}`,
    })
    .returning('*');
  const tenantId = own.id;

  const [other] = await db('companies')
    .insert({
      name: `Phase 15 Other ${stamp}`,
      domain: `phase15-asset-other-${stamp}.example.invalid`,
      status: 'active',
      is_instance: true,
      instance_code: `phase15-asset-other-${stamp}`,
    })
    .returning('*');
  const otherTenant = other.id;

  // Cleanup runs even when an assertion throws, so one failure cannot leave
  // rows behind and cascade into the next run.
  let failure;
  try {
    await runAssertions({ db, tenantId, otherTenant });
  } catch (error) {
    failure = error;
  } finally {
    console.log('\n=== CLEANUP ===\n');
    for (const table of PHASE15_TABLES) {
      await db(table).where({ company_id: tenantId }).del();
    }
    // The other tenant only ever holds the rows the isolation checks insert.
    for (const table of PHASE15_TABLES) {
      await db(table).where({ company_id: otherTenant }).del();
    }
    const remaining = await Promise.all(
      PHASE15_TABLES.flatMap((table) =>
        [tenantId, otherTenant].map(async (id) => (await db(table).where({ company_id: id }).select('id')).length),
      ),
    );
    assert(remaining.every((count) => count === 0), 'every row the test created is removed');
    await db('companies').whereIn('id', [tenantId, otherTenant]).del();
  }
  // Report the assertion failure rather than a cleanup failure masking it.
  if (failure) throw failure;
  console.log('\nPHASE 15 ASSET AND COST TESTS PASSED\n');
}

// Release the pool so a long test run does not hold connections open against a
// shared instance that has a low connection limit.
const shutdown = () => {
  try {
    getDB().destroy();
  } catch {
    // The pool may already be closed.
  }
};

async function runAssertions({ db, tenantId, otherTenant }) {
  console.log('\n=== 15.2 / 15.3 MODELS, CATEGORIES AND STOCKROOMS ===\n');

  const category = await catalog.modelCategories.create({
    tenantId, actorId: null, data: { name: `Laptops ${Date.now()}`, code: 'LT' },
  });
  assert(!!category.id, 'creates a model category');

  const found = await catalog.modelCategories.list({ tenantId, search: 'Laptops' });
  assert(
    found.items.some((item) => item.id === category.id),
    'search finds the category by name',
  );
  assert((await catalog.modelCategories.list({ tenantId, search: 'zzz-nothing' })).total === 0, 'search misses cleanly');

  const model = await catalog.assetModels.create({
    tenantId, actorId: null, data: { name: `Latitude ${Date.now()}`, manufacturer: 'Dell', category_id: category.id, purchase_cost: 1200 },
  });
  assert(model._id === model.id, 'asset models expose both id and _id for the generic list UI');

  const storeA = await catalog.stockrooms.create({ tenantId, actorId: null, data: { name: `Store A ${Date.now()}`, code: 'A', capacity: 500 } });
  const storeB = await catalog.stockrooms.create({ tenantId, actorId: null, data: { name: `Store B ${Date.now()}`, code: 'B' } });
  assert(!!storeA.id && !!storeB.id, 'creates two stockrooms');

  const [asset1] = await db('assets').insert({ company_id: tenantId, name: 'Asset One', serial: 'SN-001', model_id: model.id, status: 'in_stock' }).returning('*');
  const [asset2] = await db('assets').insert({ company_id: tenantId, name: 'Asset Two', serial: 'SN-002', model_id: model.id, status: 'in_stock' }).returning('*');
  const [spare] = await db('assets').insert({ company_id: tenantId, name: 'Spare', serial: 'SN-SPARE', status: 'in_stock' }).returning('*');

  await expectStatus(catalog.removeModel({ tenantId, id: model.id, actorId: null }), 409, 'refuses to delete a model that assets still reference');
  if (otherTenant) {
    await expectStatus(catalog.assetModels.get({ tenantId: otherTenant, id: model.id }), 404, 'another tenant cannot read the model');
  }
  await expectStatus(catalog.assetModels.get({ tenantId, id: 'not-a-uuid' }), 422, 'rejects a malformed id');

  console.log('\n=== 15.4 INVENTORY ===\n');

  await inventory.inventoryBalances.create({
    tenantId, actorId: null,
    data: { stockroom_id: storeA.id, model_id: model.id, quantity_on_hand: 5, quantity_reserved: 1, reorder_point: 10 },
  });
  const overview = await inventory.inventoryOverview({ tenantId });
  assert(overview.totals.onHand === 5, 'overview totals on hand');
  assert(overview.totals.available === 4, 'overview totals available (on hand minus reserved)');
  assert((await inventory.inventoryOverview({ tenantId, lowStockOnly: true })).total === 1, 'low stock filter honours the reorder point');
  const storeView = await catalog.listStockroomInventory({ tenantId, stockroomId: storeA.id });
  assert(storeView.items[0].quantity_available === 4, 'stockroom inventory reports available quantity');

  console.log('\n=== 15.5 TRANSFERS ===\n');

  const transfer = await inventory.createTransfer({
    tenantId, actorId: null,
    data: { fromStockroomId: storeA.id, toStockroomId: storeB.id, requestReason: 'rebalance', lines: [{ modelId: model.id, quantity: 2 }] },
  });
  assert(transfer.lines.length === 1, 'creates a transfer with its lines in one call');
  await expectStatus(catalog.removeStockroom({ tenantId, id: storeA.id, actorId: null }), 409, 'refuses to delete a stockroom that holds inventory and transfers');
  assert(String(transfer.transfer_number).startsWith('TRF-'), 'allocates a transfer number');
  await expectStatus(
    inventory.createTransfer({ tenantId, actorId: null, data: { fromStockroomId: storeA.id, toStockroomId: storeA.id, lines: [{ quantity: 1 }] } }),
    422, 'rejects a transfer whose source and destination match',
  );
  await expectStatus(
    inventory.createTransfer({ tenantId, actorId: null, data: { fromStockroomId: storeA.id, toStockroomId: storeB.id, lines: [] } }),
    422, 'rejects a transfer with no lines',
  );

  await expectStatus(inventory.shipTransfer({ tenantId, id: transfer.id, actorId: null }), 409, 'a draft transfer cannot ship');
  await inventory.requestTransfer({ tenantId, id: transfer.id, actorId: null });
  assert((await inventory.getTransferOrder({ tenantId, id: transfer.id })).status === 'requested', 'transfer order reads back with its lines');

  const shipped = await inventory.shipTransfer({ tenantId, id: transfer.id, actorId: null, actorName: 'tester' });
  assert(shipped.status === 'in_transit', 'ships a requested transfer');
  let balances = await inventory.inventoryOverview({ tenantId });
  const source = balances.items.find((row) => row.stockroom_id === storeA.id);
  assert(Number(source.quantity_on_hand) === 3, 'shipping reduces source on hand');
  assert(Number(source.quantity_in_transit) === 2, 'shipping moves the quantity to in transit');

  await expectStatus(
    inventory.receiveTransfer({ tenantId, id: transfer.id, actorId: null, receivedLines: [{ lineId: transfer.lines[0].id, quantity: 5 }] }),
    422, 'rejects receiving more than was shipped',
  );
  const received = await inventory.receiveTransfer({ tenantId, id: transfer.id, actorId: null, actorName: 'tester' });
  assert(received.status === 'received', 'receives an in transit transfer');
  balances = await inventory.inventoryOverview({ tenantId });
  assert(Number(balances.items.find((row) => row.stockroom_id === storeB.id).quantity_on_hand) === 2, 'receiving adds stock to the destination');
  assert(Number(balances.items.find((row) => row.stockroom_id === storeA.id).quantity_in_transit) === 0, 'receiving clears in transit');
  await expectStatus(inventory.cancelTransfer({ tenantId, id: transfer.id, actorId: null }), 409, 'a received transfer cannot be cancelled');

  const doomed = await inventory.createTransfer({
    tenantId, actorId: null,
    data: { fromStockroomId: storeA.id, toStockroomId: storeB.id, lines: [{ modelId: model.id, quantity: 1 }] },
  });
  await inventory.requestTransfer({ tenantId, id: doomed.id, actorId: null });
  await inventory.shipTransfer({ tenantId, id: doomed.id, actorId: null, actorName: 'tester' });
  const beforeCancel = Number((await inventory.inventoryOverview({ tenantId })).items.find((row) => row.stockroom_id === storeA.id).quantity_on_hand);
  await inventory.cancelTransfer({ tenantId, id: doomed.id, actorId: null, reason: 'no longer needed' });
  const afterCancel = (await inventory.inventoryOverview({ tenantId })).items.find((row) => row.stockroom_id === storeA.id);
  assert(Number(afterCancel.quantity_on_hand) === beforeCancel + 1, 'cancelling an in transit transfer returns the stock to the source');
  assert(Number(afterCancel.quantity_in_transit) === 0, 'cancelling an in transit transfer clears in transit');

  console.log('\n=== 15.6 ASSIGNMENT AND 15.7 LIFECYCLE ===\n');

  // Each scenario uses its own asset so the assertions do not depend on the
  // order the previous scenario left the lifecycle in.
  const assignment = await lifecycle.assignAsset({ tenantId, assetId: asset1.id, actorId: null, assignee: { name: 'Jane Doe', dept: 'IT' } });
  assert(assignment.assetStatus === 'in_use', 'assigning an asset moves it to in use');
  assert((await db('assets').where({ id: asset1.id }).first()).status === 'in_use', 'assigning syncs the denormalised assets.status');
  await expectStatus(lifecycle.assignAsset({ tenantId, assetId: asset1.id, actorId: null, assignee: { name: 'Someone Else' } }), 409, 'an asset cannot be assigned twice');
  await expectStatus(lifecycle.moveAsset({ tenantId, assetId: asset1.id, to: 'disposed', actorId: null }), 409, 'an assigned asset cannot be disposed');
  await expectStatus(lifecycle.assignAsset({ tenantId, assetId: spare.id, actorId: null, assignee: {} }), 422, 'assignment requires an assignee name');
  await expectStatus(lifecycle.swapAsset({ tenantId, assignmentId: assignment.id, replacementAssetId: asset1.id, actorId: null }), 422, 'an asset cannot replace itself');

  // A retired asset is out of service and cannot be handed to a custodian.
  await lifecycle.assignAsset({ tenantId, assetId: spare.id, actorId: null, assignee: { name: 'Jane Doe' } });
  await lifecycle.returnAsset({ tenantId, assignmentId: (await db('asset_assignments').where({ company_id: tenantId, asset_id: spare.id, status: 'active' }).first()).id, actorId: null, condition: 'good' });
  await lifecycle.moveAsset({ tenantId, assetId: spare.id, to: 'retired', actorId: null });
  await expectStatus(lifecycle.assignAsset({ tenantId, assetId: spare.id, actorId: null, assignee: { name: 'Jane Doe' } }), 409, 'a retired asset cannot be assigned');

  const swap = await lifecycle.swapAsset({ tenantId, assignmentId: assignment.id, replacementAssetId: asset2.id, actorId: null, reason: 'upgrade' });
  assert(swap.closedAssignmentId === assignment.id && swap.assignment.assigned_to_name === 'Jane Doe', 'swapping closes the old assignment and opens a new one for the same custodian');
  assert((await db('assets').where({ id: asset1.id }).first()).status === 'in_stock', 'swapping returns the outgoing asset to stock');
  assert((await db('assets').where({ id: asset2.id }).first()).status === 'in_use', 'swapping puts the replacement in use');

  const [claimed] = await db('assets').insert({ company_id: tenantId, name: 'Claimed', serial: 'SN-CLAIMED', status: 'in_stock' }).returning('*');
  await lifecycle.assignAsset({ tenantId, assetId: claimed.id, actorId: null, assignee: { name: 'John Roe' } });
  await expectStatus(lifecycle.swapAsset({ tenantId, assignmentId: swap.assignment.id, replacementAssetId: claimed.id, actorId: null }), 409, 'a replacement that is already assigned to someone is rejected');

  const swappedBack = await lifecycle.swapAsset({ tenantId, assignmentId: swap.assignment.id, replacementAssetId: asset1.id, actorId: null, reason: 'swap back' });
  assert(swappedBack.assignment.assigned_to_name === 'Jane Doe', 'a swap back keeps the same custodian');

  const damagedReturn = await lifecycle.returnAsset({ tenantId, assignmentId: swappedBack.assignment.id, actorId: null, condition: 'damaged' });
  assert(damagedReturn.status === 'returned' && damagedReturn.assetStatus === 'in_maintenance', 'returning a damaged asset routes it to maintenance');
  const goodReturn = await lifecycle.returnAsset({ tenantId, assignmentId: (await db('asset_assignments').where({ company_id: tenantId, asset_id: claimed.id, status: 'active' }).first()).id, actorId: null, condition: 'good' });
  assert(goodReturn.assetStatus === 'in_stock', 'returning a good asset routes it back to stock');

  // The state machine walk uses its own asset so it is independent of where the
  // swap and return scenarios above left asset1 and asset2.
  const [walk] = await db('assets').insert({ company_id: tenantId, name: 'Walk', serial: 'SN-WALK', status: 'in_stock' }).returning('*');
  assert((await lifecycle.moveAsset({ tenantId, assetId: walk.id, to: 'in_maintenance', actorId: null, reason: 'disk failure' })).state === 'in_maintenance', 'an asset in stock can go to maintenance');
  const repaired = await lifecycle.moveAsset({ tenantId, assetId: walk.id, to: 'in_stock', actorId: null, reason: 'repaired' });
  assert(repaired.state === 'in_stock', 'an asset leaves maintenance for stock');
  assert(Array.isArray(repaired.history) && repaired.history.length >= 2, 'lifecycle history is a jsonb array of movements');
  assert(repaired.history[repaired.history.length - 1].reason === 'repaired', 'history records why the asset moved');
  assert(repaired.history[0].state === 'in_maintenance', 'history keeps the earlier movement in order');
  await expectStatus(lifecycle.moveAsset({ tenantId, assetId: walk.id, to: 'disposed', actorId: null }), 409, 'in stock cannot jump straight to disposed');
  await expectStatus(lifecycle.moveAsset({ tenantId, assetId: walk.id, to: 'in_stock', actorId: null }), 409, 'an asset cannot transition to the state it is already in');

  const retired = await lifecycle.moveAsset({ tenantId, assetId: walk.id, to: 'retired', actorId: null });
  assert(retired.retired_at !== null, 'retiring stamps the retired date');
  const disposed = await lifecycle.moveAsset({ tenantId, assetId: walk.id, to: 'disposed', actorId: null, disposal: { method: 'recycle', value: 25, note: 'recycled' } });
  assert(disposed.state === 'disposed' && Number(disposed.disposal_value) === 25, 'disposing records the disposal details');
  assert((await db('assets').where({ id: walk.id }).first()).status === 'disposed', 'disposing syncs the denormalised assets.status');
  await expectStatus(lifecycle.moveAsset({ tenantId, assetId: walk.id, to: 'in_stock', actorId: null }), 409, 'a disposed asset is terminal');
  const byState = await lifecycle.listByState({ tenantId, state: 'disposed' });
  assert(byState.total === 1 && byState.byState.disposed === 1, 'lifecycle list reports counts per state');

  const state = await catalog.assetStates.create({ tenantId, actorId: null, data: { name: 'in_maintenance', label: 'Maintenance', sequence: 4 } });
  const stockState = await catalog.assetStates.create({ tenantId, actorId: null, data: { name: 'in_stock', label: 'In stock', sequence: 2 } });
  await catalog.assetSubstates.create({ tenantId, actorId: null, data: { state_id: state.id, name: 'awaiting_parts' } });
  await catalog.assetSubstates.create({ tenantId, actorId: null, data: { state_id: stockState.id, name: 'shelf_a' } });
  await expectStatus(lifecycle.moveAsset({ tenantId, assetId: asset1.id, to: 'in_stock', actorId: null, substate: 'awaiting_parts' }), 422, 'a substate configured for another state is rejected');
  await expectStatus(lifecycle.moveAsset({ tenantId, assetId: asset1.id, to: 'in_stock', actorId: null, substate: 'not_configured' }), 422, 'an unknown substate is rejected');
  assert((await lifecycle.moveAsset({ tenantId, assetId: asset1.id, to: 'in_stock', actorId: null, substate: 'shelf_a' })).substate === 'shelf_a', 'a substate configured for the target state is accepted');
  const configured = await catalog.listConfiguredStates({ tenantId });
  assert(configured.items.some((item) => item.name === 'in_stock' && item.substates.length === 1), 'configuration lists states with their substates');

  const stockroomConfig = await catalog.saveStockroomConfiguration({ tenantId, stockroomId: storeA.id, actorId: null, data: { allowNegativeStock: true, defaultReorderPoint: 3 } });
  assert(stockroomConfig.allowNegativeStock === true, 'stockroom configuration is created on first save');
  const reread = await catalog.getStockroomConfiguration({ tenantId, stockroomId: storeA.id });
  assert(reread.allowNegativeStock === true && Number(reread.defaultReorderPoint) === 3, 'stockroom configuration is read back');
  assert((await catalog.getStockroomConfiguration({ tenantId, stockroomId: storeB.id })).allowNegativeStock === false, 'an unconfigured stockroom reports defaults');

  console.log('\n=== 15.8 ASSET AUDIT ===\n');

  const audit = await auditCost.createAudit({
    tenantId, actorId: null, actorName: 'tester',
    data: { name: 'Q3 audit', stockroomId: storeA.id, plannedDate: '2026-09-30', tasks: [{ taskName: 'Zone A', expectedCount: 2 }, { taskName: 'Zone B', expectedCount: 1 }] },
  });
  assert(audit.tasks.length === 2 && String(audit.audit_number).startsWith('AAUD-'), 'creates an audit with its tasks and a number');
  const tasks = await auditCost.listAuditTasks({ tenantId, auditId: audit.id });
  assert(tasks.total === 2, 'lists the audit tasks');
  await expectStatus(auditCost.completeAudit({ tenantId, id: audit.id, actorId: null }), 409, 'an audit with open tasks cannot complete');

  await auditCost.startAudit({ tenantId, id: audit.id, actorId: null });
  const [taskA, taskB] = tasks.items;
  const match = await auditCost.recordScan({ tenantId, auditId: audit.id, actorId: null, actorName: 'tester', data: { taskId: taskA.id, assetId: asset1.id } });
  assert(match.matched === true && match.result === 'match', 'scanning a known asset records a match');
  const unknown = await auditCost.recordScan({ tenantId, auditId: audit.id, actorId: null, actorName: 'tester', data: { taskId: taskA.id, barcode: 'SN-NOPE' } });
  assert(unknown.matched === false && unknown.result === 'unexpected', 'scanning an unknown barcode records an exception');
  const damaged = await auditCost.recordScan({ tenantId, auditId: audit.id, actorId: null, actorName: 'tester', data: { taskId: taskB.id, assetId: asset2.id, result: 'damaged' } });
  assert(damaged.result === 'damaged', 'a damaged scan is recorded as an exception');
  assert((await auditCost.listAuditResults({ tenantId, auditId: audit.id })).total === 3, 'lists every scan result');

  const openExceptions = await auditCost.listAuditExceptions({ tenantId, openOnly: true });
  assert(openExceptions.total === 2 && openExceptions.items.every((row) => row.exception_status === 'open'), 'non matching scans appear as open exceptions');

  await auditCost.setTaskStatus({ tenantId, taskId: taskA.id, to: 'completed', actorId: null, countedCount: 2 });
  await auditCost.setTaskStatus({ tenantId, taskId: taskB.id, to: 'completed', actorId: null, countedCount: 1 });
  await expectStatus(auditCost.setTaskStatus({ tenantId, taskId: taskA.id, to: 'in_progress', actorId: null }), 409, 'a completed task cannot be reopened');
  const completed = await auditCost.completeAudit({ tenantId, id: audit.id, actorId: null });
  assert(completed.status === 'completed' && completed.exception_count === 2, 'completing the audit records the exception count');
  await expectStatus(auditCost.cancelAudit({ tenantId, id: audit.id, actorId: null }), 409, 'a completed audit cannot be cancelled');
  await expectStatus(auditCost.recordScan({ tenantId, auditId: audit.id, actorId: null, data: { barcode: 'SN-001' } }), 409, 'a completed audit accepts no more scans');
  const settled = await auditCost.listAuditExceptions({ tenantId });
  assert(settled.items.every((row) => row.exception_status === 'resolved'), 'exceptions settle when the audit completes');
  assert(String((await auditCost.resolveAuditException({ tenantId, resultId: unknown.id, actorId: null, note: 'found in Zone C' })).note).includes('found in Zone C'), 'an exception can be annotated when resolved');
  await expectStatus(auditCost.resolveAuditException({ tenantId, resultId: match.id, actorId: null, note: 'x' }), 409, 'a matching result is not an exception and cannot be resolved');

  console.log('\n=== 15.9 COST MANAGEMENT ===\n');

  const costCenter = await auditCost.costCenters.create({ tenantId, actorId: null, data: { code: 'CC-1', name: 'IT Ops', budget_amount: 10000, department: 'IT' } });
  assert(!!costCenter.id, 'creates a cost center');
  const cost = await auditCost.assetCosts.create({
    tenantId, actorId: null,
    data: { cost_center_id: costCenter.id, asset_id: asset1.id, cost_type: 'acquisition', amount: 500, cost_date: '2026-01-15', vendor: 'Dell' },
  });
  assert(cost.status === 'pending', 'a new cost starts pending');
  await expectStatus(auditCost.payCost({ tenantId, id: cost.id, actorId: null }), 409, 'a pending cost cannot be paid');

  const allocation = await auditCost.createAllocation({ tenantId, actorId: null, data: { costId: cost.id, costCenterId: costCenter.id, department: 'IT', allocation_percent: 60, allocated_amount: 300 } });
  assert(allocation.allocatedTotal === 300, 'records an allocation against a cost');
  await expectStatus(auditCost.createAllocation({ tenantId, actorId: null, data: { costId: cost.id, allocated_amount: 900 } }), 422, 'allocations cannot exceed the cost amount');
  assert((await auditCost.listCostAllocations({ tenantId, costId: cost.id })).total === 1, 'an over allocating line is rolled back rather than left behind');

  await auditCost.approveCost({ tenantId, id: cost.id, actorId: null });
  assert((await auditCost.payCost({ tenantId, id: cost.id, actorId: null })).status === 'paid', 'an approved cost can be paid');
  await expectStatus(auditCost.approveCost({ tenantId, id: cost.id, actorId: null, decision: 'reject' }), 409, 'a paid cost cannot be rejected');
  await expectStatus(auditCost.createAllocation({ tenantId, actorId: null, data: { costId: cost.id, allocated_amount: 10 } }), 409, 'a paid cost cannot be re allocated');

  await auditCost.assetCosts.create({ tenantId, actorId: null, data: { cost_type: 'maintenance', amount: 250, cost_date: '2026-03-10' } });
  await auditCost.assetCosts.create({ tenantId, actorId: null, data: { cost_type: 'maintenance', amount: 150, cost_date: '2026-04-10' } });
  const report = await auditCost.costReport({ tenantId });
  assert(report.totals.total === 900, 'cost report totals every cost');
  assert(report.byType.find((row) => row.costType === 'acquisition').total === 500, 'cost report breaks down by type');
  assert(report.byMonth.length === 3, 'cost report breaks down by month');
  const budget = report.budgetUsage.find((row) => row.id === costCenter.id);
  assert(budget.spent === 500 && budget.remaining === 9500 && budget.utilizationPercent === 5, 'budget usage only counts costs assigned to the cost center');
  assert((await auditCost.costReport({ tenantId, from: '2026-04-01', to: '2026-04-30' })).totals.total === 150, 'cost report honours a date range');
  assert((await auditCost.costReport({ tenantId, costType: 'maintenance' })).totals.total === 400, 'cost report honours a cost type');

}

main()
  .then(() => {
    shutdown();
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n${error.message}\n`);
    shutdown();
    process.exit(1);
  });
