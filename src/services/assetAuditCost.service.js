/**
 * Phase 15.8 Asset Audit and 15.9 Cost Management.
 *
 * Asset Audit runs a stockroom/location count: an audit holds tasks, each task
 * produces scanned results, and any mismatch becomes an exception. Cost
 * Management holds cost centers, individual cost records, the allocations that
 * spread a cost across departments, and the rollup the Cost Reports screen
 * reads.
 */

const { getDB } = require("../config/db");
const ApiError = require("../utils/ApiError");
const { crud, isUuid, recordEvent, requireTenant } = require("./assetCrud");
const { nextNumber } = require("./numbering.service");
const { stockrooms } = require("./assetCatalog.service");
const { getAsset } = require("./assetLifecycle.service");

// ── 15.8 Asset Audit ───────────────────────────────────────────────────

// `counting` is the explicit counting phase, but a completed audit must have
// every task closed regardless, so an audit started and then finished in one
// pass can go straight from in_progress to completed.
const AUDIT_TRANSITIONS = {
  planned: ["in_progress", "cancelled"],
  in_progress: ["counting", "completed", "cancelled"],
  counting: ["completed", "in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

const TASK_TRANSITIONS = {
  pending: ["in_progress", "completed", "skipped"],
  in_progress: ["completed", "skipped"],
  completed: [],
  skipped: [],
};

// The scan vocabulary. Anything outside it can be written to audit_results but
// would never surface in the exception list, so recordScan rejects it.
const SCAN_RESULTS = ["match", "missing", "unexpected", "duplicate", "damaged"];
const EXCEPTION_RESULTS = ["missing", "unexpected", "duplicate", "damaged"];
const isScanResult = (value) => SCAN_RESULTS.includes(value);

const assertScanResult = (value) => {
  if (!isScanResult(value)) {
    throw new ApiError(422, `Scan result must be one of ${SCAN_RESULTS.join(", ")}`);
  }
  return value;
};

const assetAudits = crud({
  required: ["name"],
  table: "asset_audits",
  entity: "asset_audit",
  fields: [
    "audit_number", "name", "stockroom_id", "scope_type", "scope_value", "status",
    "planned_date", "started_at", "completed_at", "created_by", "notes",
  ],
  searchFields: ["audit_number", "name", "scope_value", "notes"],
  sort: "created_at",
  map: (row) => ({ ...row, _id: row.id }),
});

const auditTasks = crud({
  required: ["audit_id", "task_name"],
  table: "audit_tasks",
  entity: "audit_task",
  fields: ["audit_id", "stockroom_id", "task_name", "assigned_to", "status", "expected_count", "counted_count", "started_at", "completed_at"],
  searchFields: ["task_name", "assigned_to"],
  sort: "created_at",
  map: (row) => ({ ...row, _id: row.id }),
});

const auditResults = crud({
  required: ["audit_id", "result"],
  table: "audit_results",
  entity: "audit_result",
  fields: ["audit_id", "task_id", "asset_id", "barcode", "serial_number", "result", "verified_by", "verified_at", "note"],
  searchFields: ["barcode", "serial_number", "note", "result"],
  sort: "created_at",
  map: (row) => ({ ...row, _id: row.id }),
});

const refreshAuditCounters = async (tenantId, auditId, trx) => {
  const runner = trx || getDB();
  const [taskStats] = await runner("audit_tasks")
    .where({ company_id: tenantId, audit_id: auditId })
    .count("* as task_count");
  const [done] = await runner("audit_tasks")
    .where({ company_id: tenantId, audit_id: auditId })
    .whereIn("status", ["completed", "skipped"])
    .count("* as total");
  const [exceptions] = await runner("audit_results")
    .where({ company_id: tenantId, audit_id: auditId })
    .whereIn("result", EXCEPTION_RESULTS)
    .count("* as total");
  const patch = {
    task_count: Number(taskStats.task_count),
    tasks_completed: Number(done.total),
    exception_count: Number(exceptions.total),
  };
  if (trx) {
    await trx("asset_audits").where({ id: auditId, company_id: tenantId }).update(patch);
  } else {
    await runner("asset_audits").where({ id: auditId, company_id: tenantId }).update(patch);
  }
  return patch;
};

// An audit is created with its tasks in one call, so an audit can never exist
// with no tasks (the Create Audit screen submits both).
const createAudit = async ({ tenantId, data, actorId, actorName }) => {
  requireTenant(tenantId);
  if (!data.name) throw new ApiError(422, "An audit name is required");
  const stockroomId = data.stockroomId || data.stockroom_id || null;
  if (stockroomId) await stockrooms.get({ tenantId, id: stockroomId });
  const auditNumber = data.auditNumber || data.audit_number || (await nextNumber(tenantId, "AAUD"));
  const db = getDB();
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  return db.transaction(async (trx) => {
    const [audit] = await trx("asset_audits").insert({
      company_id: tenantId,
      audit_number: auditNumber,
      name: data.name,
      stockroom_id: stockroomId,
      scope_type: data.scopeType || data.scope_type || (stockroomId ? "stockroom" : "global"),
      scope_value: data.scopeValue || data.scope_value || null,
      status: "planned",
      planned_date: data.plannedDate || data.planned_date || null,
      created_by: actorId || null,
      notes: data.notes || "",
    }).returning("*");

    const insertedTasks = [];
    if (tasks.length) {
      const rows = tasks.map((task) => ({
        company_id: tenantId,
        audit_id: audit.id,
        stockroom_id: task.stockroomId || task.stockroom_id || stockroomId,
        task_name: task.taskName || task.task_name || null,
        assigned_to: task.assignedTo || task.assigned_to || actorName || null,
        status: "pending",
        expected_count: task.expectedCount ?? task.expected_count ?? 0,
      }));
      insertedTasks.push(...await trx("audit_tasks").insert(rows).returning("*"));
    }
    await refreshAuditCounters(tenantId, audit.id, trx);
    await recordEvent({
      tenantId, actorId, entityType: "asset_audit", entityId: audit.id,
      action: "create", before: null, after: { ...audit, _id: audit.id, tasks: insertedTasks },
    });
    return { ...audit, _id: audit.id, tasks: insertedTasks };
  });
};

const startAudit = async ({ tenantId, id, actorId }) =>
  assetAudits.transition({
    tenantId, id, transitions: AUDIT_TRANSITIONS, to: "in_progress", actorId, label: "status",
    patch: { started_at: new Date() },
  });

const completeAudit = async ({ tenantId, id, actorId }) => {
  const counters = await refreshAuditCounters(tenantId, id);
  if (!counters.task_count) throw new ApiError(422, "An audit needs at least one task before completion");
  if (counters.tasks_completed < counters.task_count) {
    throw new ApiError(409, `${counters.task_count - counters.tasks_completed} task(s) are still open`);
  }
  return assetAudits.transition({
    tenantId, id, transitions: AUDIT_TRANSITIONS, to: "completed", actorId, label: "status",
    patch: { completed_at: new Date() },
  });
};

const cancelAudit = async ({ tenantId, id, actorId, reason }) => {
  const current = await assetAudits.get({ tenantId, id });
  if (current.status === "cancelled") return current;
  return assetAudits.transition({
    tenantId, id, transitions: AUDIT_TRANSITIONS, to: "cancelled", actorId, label: "status",
    patch: { notes: reason ? `${current.notes ? current.notes + "\n" : ""}Cancelled: ${reason}` : current.notes },
  });
};

const listAuditTasks = async ({ tenantId, auditId, status }) => {
  requireTenant(tenantId);
  if (!isUuid(auditId)) throw new ApiError(422, "A valid auditId is required");
  await assetAudits.get({ tenantId, id: auditId });
  const query = getDB()("audit_tasks").where({ company_id: tenantId, audit_id: auditId });
  if (status) query.andWhere("status", status);
  const items = await query.orderBy("created_at");
  return { items: items.map((row) => ({ ...row, _id: row.id })), total: items.length };
};

const setTaskStatus = async ({ tenantId, taskId, to, actorId, countedCount }) =>
  auditTasks.transition({
    tenantId, id: taskId, transitions: TASK_TRANSITIONS, to, actorId, label: "status",
    patch: {
      counted_count: countedCount,
      started_at: to === "in_progress" ? new Date() : undefined,
      completed_at: to === "completed" || to === "skipped" ? new Date() : undefined,
    },
  }).then(async (task) => {
    await refreshAuditCounters(tenantId, task.audit_id);
    return task;
  });

const listAuditResults = async ({ tenantId, auditId, result }) => {
  requireTenant(tenantId);
  if (!isUuid(auditId)) throw new ApiError(422, "A valid auditId is required");
  await assetAudits.get({ tenantId, id: auditId });
  const db = getDB();
  const query = db("audit_results as r")
    .leftJoin("assets as a", "r.asset_id", "a.id")
    .where("r.company_id", tenantId)
    .where("r.audit_id", auditId)
    .select("r.*", db.raw("a.name as asset_name"));
  if (result) query.andWhere("r.result", result);
  const items = await query.orderBy("r.created_at", "desc");
  return { items: items.map((row) => ({ ...row, _id: row.id })), total: items.length };
};

// Scan / Verify Asset: records one scan against the audit and keeps the
// exception counters current.
const recordScan = async ({ tenantId, auditId, data, actorId, actorName }) => {
  requireTenant(tenantId);
  const db = getDB();
  const audit = await assetAudits.get({ tenantId, id: auditId });
  if (audit.status === "completed" || audit.status === "cancelled") {
    throw new ApiError(409, `Audit ${audit.audit_number} is ${audit.status} and no longer accepts scans`);
  }

  let assetId = data.assetId || data.asset_id || null;
  const barcode = data.barcode || null;
  const serialNumber = data.serialNumber || data.serial_number || null;
  if (!assetId && (barcode || serialNumber)) {
    const query = db("assets").where({ company_id: tenantId });
    if (barcode) query.andWhere("serial", barcode);
    else query.andWhere("serial", serialNumber);
    const asset = await query.first();
    if (asset) assetId = asset.id;
  }
  if (!assetId) {
    // No matching asset: an unexpected scan is the exception itself, and the
    // audit cannot be completed until it is acknowledged.
    const outcome = assertScanResult(data.result || "unexpected");
    const [row] = await db("audit_results").insert({
      company_id: tenantId, audit_id: auditId, task_id: data.taskId || data.task_id || null,
      asset_id: null, barcode, serial_number: serialNumber, result: outcome,
      verified_by: actorName || actorId || null, verified_at: new Date(),
      note: data.note || "",
    }).returning("*");
    await refreshAuditCounters(tenantId, auditId);
    await recordEvent({
      tenantId, actorId, entityType: "audit_result", entityId: row.id,
      action: "scan:unexpected", before: null, after: row,
    });
    return { ...row, _id: row.id, matched: false };
  }

  const asset = await getAsset(tenantId, assetId);
  const result = assertScanResult(data.result || "match");
  const [row] = await db("audit_results").insert({
    company_id: tenantId, audit_id: auditId, task_id: data.taskId || data.task_id || null,
    asset_id: assetId, barcode: barcode || asset.serial || null,
    serial_number: serialNumber || asset.serial || null, result,
    verified_by: actorName || actorId || null, verified_at: new Date(), note: data.note || "",
  }).returning("*");
  const counters = await refreshAuditCounters(tenantId, auditId);
  await recordEvent({
    tenantId, actorId, entityType: "audit_result", entityId: row.id,
    action: `scan:${result}`, before: null, after: row,
  });
  return { ...row, _id: row.id, matched: true, assetName: asset.name, counters };
};

// The Asset Exceptions screen: every non-matching result across all audits.
const listAuditExceptions = async ({ tenantId, openOnly, auditId }) => {
  requireTenant(tenantId);
  const db = getDB();
  const query = db("audit_results as r")
    .leftJoin("assets as a", "r.asset_id", "a.id")
    .leftJoin("asset_audits as au", "r.audit_id", "au.id")
    .where("r.company_id", tenantId)
    .whereIn("r.result", EXCEPTION_RESULTS)
    .select(
      "r.*",
      db.raw("a.name as asset_name"),
      db.raw("a.serial as asset_serial"),
      db.raw("au.audit_number"),
      db.raw("au.name as audit_name"),
      // An exception is outstanding until its audit is completed.
      db.raw("case when au.status = 'completed' then 'resolved' else 'open' end as exception_status"),
    );
  if (openOnly) query.andWhere("au.status", "!=", "completed");
  if (isUuid(auditId)) query.andWhere("r.audit_id", auditId);
  const items = await query.orderBy("r.created_at", "desc");
  return { items: items.map((row) => ({ ...row, _id: row.id })), total: items.length };
};

const resolveAuditException = async ({ tenantId, resultId, note, actorId }) => {
  requireTenant(tenantId);
  const db = getDB();
  const before = await db("audit_results").where({ id: resultId, company_id: tenantId }).first();
  if (!before) throw new ApiError(404, "Audit result not found");
  if (before.result === "match") throw new ApiError(409, "A matching result is not an exception");
  const [after] = await db("audit_results").where({ id: resultId, company_id: tenantId }).update({
    note: note ? `${before.note ? before.note + "\n" : ""}${note}` : before.note,
  }).returning("*");
  await recordEvent({
    tenantId, actorId, entityType: "audit_exception", entityId: resultId,
    action: "resolve", before, after,
  });
  return { ...after, _id: after.id };
};

// ── 15.9 Cost Management ───────────────────────────────────────────────

const COST_TRANSITIONS = {
  pending: ["approved", "rejected"],
  approved: ["paid", "rejected"],
  rejected: [],
  paid: [],
};

const costCenters = crud({
  required: ["code", "name"],
  table: "cost_centers",
  entity: "cost_center",
  fields: ["code", "name", "description", "department", "manager", "budget_amount", "currency", "fiscal_year_start", "fiscal_year_end", "is_active"],
  searchFields: ["code", "name", "department", "description"],
  sort: "code",
  map: (row) => ({ ...row, _id: row.id }),
});

const assetCosts = crud({
  required: ["cost_type", "amount"],
  table: "asset_costs",
  entity: "cost",
  fields: [
    "cost_center_id", "asset_id", "model_id", "cost_type", "description", "amount",
    "currency", "cost_date", "vendor", "invoice_number", "status", "approved_by",
    "approved_at", "notes",
  ],
  searchFields: ["description", "vendor", "invoice_number", "cost_type"],
  sort: "cost_date",
  map: (row) => ({ ...row, _id: row.id }),
});

const costAllocations = crud({
  required: ["cost_id"],
  table: "cost_allocations",
  entity: "cost_allocation",
  fields: ["cost_id", "cost_center_id", "department", "project", "allocation_percent", "allocated_amount", "period_start", "period_end", "note"],
  searchFields: ["department", "project", "note"],
  sort: "created_at",
  map: (row) => ({ ...row, _id: row.id }),
});

// A cost with allocations must add up to its amount, or the Cost Allocation
// screen would show a partial rollup as if it were complete.
const createAllocation = async ({ tenantId, data, actorId }) => {
  requireTenant(tenantId);
  const db = getDB();
  const costId = data.costId || data.cost_id;
  if (!isUuid(costId)) throw new ApiError(422, "A valid costId is required");
  const cost = await assetCosts.get({ tenantId, id: costId });
  if (cost.status === "paid") throw new ApiError(409, "A paid cost cannot be re-allocated");
  const created = await costAllocations.create({ tenantId, data: { ...data, cost_id: costId }, actorId });
  const { items } = await costAllocations.list({ tenantId, filters: { cost_id: costId } });
  const allocated = items.reduce((sum, item) => sum + Number(item.allocated_amount || 0), 0);
  if (allocated > Number(cost.amount) + 0.01) {
    // Roll the offending line back so the ledger never over-allocates.
    await costAllocations.remove({ tenantId, id: created.id, actorId: null });
    throw new ApiError(422, `Allocations (${allocated}) exceed the cost amount (${cost.amount})`);
  }
  return { ...created, allocatedTotal: allocated, costAmount: Number(cost.amount) };
};

const listCostAllocations = async ({ tenantId, costId }) => {
  requireTenant(tenantId);
  if (!isUuid(costId)) throw new ApiError(422, "A valid costId is required");
  await assetCosts.get({ tenantId, id: costId });
  const { items } = await costAllocations.list({ tenantId, filters: { cost_id: costId }, orderBy: "created_at", direction: "asc" });
  return { items, total: items.length };
};

const approveCost = async ({ tenantId, id, actorId, decision }) => {
  const to = decision === "reject" || decision === "rejected" ? "rejected" : "approved";
  return assetCosts.transition({
    tenantId, id, transitions: COST_TRANSITIONS, to, actorId, label: "status",
    patch: { approved_by: actorId || null, approved_at: new Date() },
  });
};

const payCost = async ({ tenantId, id, actorId }) =>
  assetCosts.transition({
    tenantId, id, transitions: COST_TRANSITIONS, to: "paid", actorId, label: "status",
  });

// Cost Home / Cost Reports rollup: totals by cost type, by cost center and by
// month, plus budget usage for active cost centers.
const costReport = async ({ tenantId, costCenterId, from, to, costType }) => {
  requireTenant(tenantId);
  const db = getDB();
  const base = () => {
    const query = db("asset_costs as c")
      .leftJoin("cost_centers as cc", "c.cost_center_id", "cc.id")
      .where("c.company_id", tenantId);
    if (isUuid(costCenterId)) query.andWhere("c.cost_center_id", costCenterId);
    if (costType) query.andWhere("c.cost_type", costType);
    if (from) query.andWhere("c.cost_date", ">=", from);
    if (to) query.andWhere("c.cost_date", "<=", to);
    return query;
  };
  const [byType, byCenter, byMonth] = await Promise.all([
    base().select("c.cost_type").sum("c.amount as total").count("* as count").groupBy("c.cost_type").orderBy("total", "desc"),
    base().select(db.raw("coalesce(cc.name, 'Unassigned') as cost_center")).sum("c.amount as total").count("* as count").groupBy(db.raw("coalesce(cc.name, 'Unassigned')")).orderBy("total", "desc"),
    base().select(db.raw("to_char(c.cost_date, 'YYYY-MM') as month")).sum("c.amount as total").count("* as count").groupBy(db.raw("to_char(c.cost_date, 'YYYY-MM')")).orderBy("month"),
  ]);
  const centers = await db("cost_centers").where({ company_id: tenantId, is_active: true })
    .select("id", "code", "name", "budget_amount", "department").orderBy("code");
  const spendByCenter = await base().select("c.cost_center_id").sum("c.amount as total").groupBy("c.cost_center_id");
  const spend = new Map(spendByCenter.map((row) => [row.cost_center_id, Number(row.total)]));
  const budgetUsage = centers.map((center) => {
    const spent = spend.get(center.id) || 0;
    const budget = Number(center.budget_amount) || 0;
    return {
      ...center,
      _id: center.id,
      spent,
      budget,
      remaining: budget - spent,
      utilizationPercent: budget ? Math.round((spent / budget) * 10000) / 100 : 0,
    };
  });
  const total = byType.reduce((sum, row) => sum + Number(row.total), 0);
  return {
    totals: { total, records: byType.reduce((sum, row) => sum + Number(row.count), 0) },
    byType: byType.map((row) => ({ costType: row.cost_type, total: Number(row.total), count: Number(row.count) })),
    byCostCenter: byCenter.map((row) => ({ costCenter: row.cost_center, total: Number(row.total), count: Number(row.count) })),
    byMonth: byMonth.map((row) => ({ month: row.month, total: Number(row.total), count: Number(row.count) })),
    budgetUsage,
  };
};

module.exports = {
  SCAN_RESULTS,
  EXCEPTION_RESULTS,
  assetAudits,
  auditTasks,
  auditResults,
  createAudit,
  startAudit,
  completeAudit,
  cancelAudit,
  listAuditTasks,
  setTaskStatus,
  listAuditResults,
  recordScan,
  listAuditExceptions,
  resolveAuditException,
  refreshAuditCounters,
  AUDIT_TRANSITIONS,
  TASK_TRANSITIONS,
  costCenters,
  assetCosts,
  costAllocations,
  createAllocation,
  listCostAllocations,
  approveCost,
  payCost,
  costReport,
  COST_TRANSITIONS,
};
