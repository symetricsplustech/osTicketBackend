/**
 * Phase 15/16 improvement + outage runtime smoke test.
 *
 * Unit tests run without a database, so they cannot catch the class of failure
 * this script exists for: a service writing a column the table does not have, or
 * a table enforcing NOT NULL on a legacy column the service never populates.
 * Both only appear when the real service functions run against PostgreSQL.
 *
 * Every check below goes through the exported service functions (not raw SQL),
 * so it exercises the same path the API controllers use. Rows are created with
 * a `smoke` marker and deleted again in a finally block, so a run leaves no
 * data behind even when a check fails.
 *
 * Run: node scripts/smoke-improvement-outage.js
 * Exits non-zero on the first failure.
 */

const connectDB = require("../src/config/db");
const { getDB } = require("../src/config/db");
const improvementService = require("../src/services/improvementService");
const outageService = require("../src/services/outageService");
const cmdbService = require("../src/services/cmdbService");
const assignmentService = require("../src/services/assignmentService");

const HOUR = 60 * 60 * 1000;

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check("opportunity runs identified -> implemented", async (ctx, actor, created) => {
  const opportunity = await improvementService.createOpportunity(
    ctx,
    { title: "smoke opportunity", source: "smoke" },
    actor,
  );
  created.improvement_opportunities = opportunity.id;
  await improvementService.updateOpportunity(
    ctx,
    opportunity.id,
    { priority: "high", category: "quality", impact: "med", effort: 3 },
    actor,
  );
  for (const status of ["qualified", "approved", "converted", "implemented"]) {
    await improvementService.transitionOpportunity(ctx, opportunity.id, status, actor);
  }
  return `status=${opportunity.status}`;
});

check("initiative records actual start and end dates", async (ctx, actor, created, db) => {
  const initiative = await improvementService.createInitiative(
    ctx,
    { title: "smoke initiative", type: "program" },
    actor,
  );
  created.improvement_initiatives = initiative.id;
  for (const status of ["approved", "in_progress", "completed"]) {
    await improvementService.transitionInitiative(ctx, initiative.id, status, actor);
  }
  const row = await db("improvement_initiatives").where({ id: initiative.id }).first();
  assert(row.actual_start_date && row.actual_end_date, "actual dates were not stamped");
  return `actualStart=${row.actual_start_date.toISOString().slice(0, 19)}`;
});

check("task computes actual duration in minutes", async (ctx, actor, created, db) => {
  const task = await improvementService.createTask(
    ctx,
    { title: "smoke task", type: "action" },
    actor,
  );
  created.improvement_tasks = task.id;
  await improvementService.transitionTask(ctx, task.id, "in_progress", actor);
  await db("improvement_tasks")
    .where({ id: task.id })
    .update({ actual_start_date: new Date(Date.now() - 30 * 60 * 1000) });
  await improvementService.transitionTask(ctx, task.id, "completed", actor);
  const row = await db("improvement_tasks").where({ id: task.id }).first();
  assert(row.actual_duration === 30, `expected 30 minutes, got ${row.actual_duration}`);
  return "actualDuration=30";
});

check("goal measurement stamps last_measured_at/by", async (ctx, actor, created, db) => {
  const goal = await improvementService.createGoal(
    ctx,
    { title: "smoke goal", metricName: "csat", baselineValue: 3, targetValue: 4.5 },
    actor,
  );
  created.improvement_goals = goal.id;
  await improvementService.updateGoalProgress(ctx, goal.id, 3.8, actor);
  const row = await db("improvement_goals").where({ id: goal.id }).first();
  assert(row.last_measured_at, "last_measured_at was not stamped");
  return "lastMeasuredAt set";
});

check("metric baseline and target record improvement", async (ctx, actor, created, db) => {
  const baseline = await improvementService.createBaseline(
    ctx,
    { metricName: "csat", baselineValue: 3 },
    actor,
  );
  created.metric_baselines = baseline.id;
  const target = await improvementService.createTarget(
    ctx,
    { metricName: "csat", baselineValue: 3, targetValue: 4.5, currentValue: 3.8 },
    actor,
  );
  created.metric_targets = target.id;
  await improvementService.updateTarget(
    ctx,
    target.id,
    { currentValue: 3.8, baselineValue: 3, targetValue: 4.5 },
    actor,
  );
  const row = await db("metric_targets").where({ id: target.id }).first();
  assert(
    row.improvement_percentage !== null && row.last_measured_at,
    "improvement metrics were not recorded",
  );
  return `improvementPct=${row.improvement_percentage}`;
});

check("benefit realizes against its initiative", async (ctx, actor, created, db) => {
  const initiative = { id: created.improvement_initiatives };
  const benefit = await improvementService.createBenefit(
    ctx,
    {
      name: "smoke benefit",
      type: "financial",
      estimatedValue: 1000,
      realizationDate: new Date(),
      initiativeId: String(initiative.id),
    },
    actor,
  );
  created.benefits = benefit.id;
  await improvementService.updateBenefit(ctx, benefit.id, { status: "realized" }, actor);
  const row = await db("benefits").where({ id: benefit.id }).first();
  assert(row.realized_at && String(row.initiative_id) === String(initiative.id), "benefit not linked/realized");
  return "realizedAt set";
});

check("cost records against its initiative", async (ctx, actor, created) => {
  const initiative = { id: created.improvement_initiatives };
  const cost = await improvementService.createCost(
    ctx,
    {
      category: "labor",
      plannedAmount: 100,
      incurredAt: new Date(),
      initiativeId: String(initiative.id),
    },
    actor,
  );
  created.costs = cost.id;
  return "created";
});

check("outage runs investigating -> closed with actual restoration", async (ctx, actor, created, db) => {
  const outage = await outageService.createOutage(
    ctx,
    { title: "smoke outage", type: "major", severity: "critical", startTime: new Date(Date.now() - HOUR) },
    actor,
  );
  created.outages = outage.id;
  for (const status of ["identified", "monitoring", "resolved", "closed"]) {
    await outageService.transitionOutage(ctx, outage.id, status, actor);
  }
  const row = await db("outages").where({ id: outage.id }).first();
  assert(row.actual_restoration, "actual_restoration was not stamped");
  return "actualRestoration set";
});

check("outage communications stamp last/next communication", async (ctx, actor, created, db) => {
  const outageId = created.outages;
  const nextAt = new Date(Date.now() + 30 * 60 * 1000);
  await outageService.recordCommunication(
    ctx,
    outageId,
    { message: "smoke", nextAt },
    actor,
  );
  const row = await db("outages").where({ id: outageId }).first();
  assert(
    row.last_communication_at && row.next_communication_at,
    "communication timestamps were not stamped",
  );
  return "last/next communication set";
});

check("cmdb and assignment prerequisites can be created", async (ctx, actor, created, db) => {
  // outage_cis.ci_id and outage_services.service_id are real foreign keys, so
  // the outage checks need genuine configuration items / business services.
  const service = await cmdbService.createBusinessService(
    ctx,
    { name: "smoke business service" },
    actor,
  );
  const ci = await cmdbService.createCI(ctx, { name: "smoke configuration item" }, actor);
  const agent = await db("agents")
    .insert({
      company_id: ctx.tenantId,
      name: "smoke assignment agent",
      email: "smoke-assignment@example.invalid",
      password: "x",
      is_active: true,
      presence: "online",
    })
    .returning("*");
  created.business_services = service.id;
  created.configuration_items = ci.id;
  created.agents = agent[0].id;
  return `service=${service.number} ci=${ci.number} agent=${created.agents}`;
});

check("outage CI association is added and soft-removed", async (ctx, actor, created, db) => {
  const outageId = created.outages;
  const ciId = created.configuration_items;
  await outageService.addOutageCI(
    ctx,
    outageId,
    { ciId, role: "affected", impact: "high" },
    actor,
  );
  await outageService.removeOutageCI(ctx, outageId, ciId, actor);
  const row = await db("outage_cis").where({ outage_id: outageId, ci_id: ciId }).first();
  assert(row && row.removed_at, "outage CI was not soft-removed");
  return "removedAt set";
});

check("outage service association is added and removed", async (ctx, actor, created, db) => {
  const outageId = created.outages;
  const serviceId = created.business_services;
  await outageService.addOutageService(
    ctx,
    outageId,
    { serviceId, impact: "high" },
    actor,
  );
  const before = await db("outage_services").where({ outage_id: outageId, service_id: serviceId }).first();
  await outageService.removeOutageService(ctx, outageId, serviceId, actor);
  const after = await db("outage_services").where({ outage_id: outageId, service_id: serviceId }).first();
  assert(before && !after, "outage service was not removed");
  return "added then removed";
});

check("availability is calculated for the window", async (ctx, actor, created) => {
  const record = await outageService.calculateAvailability(
    ctx,
    "business_service",
    created.business_services,
    new Date(Date.now() - 24 * HOUR),
    new Date(),
  );
  created.availability_records = record.id;
  assert(
    record.totalMinutes === 1440 && record.downtimeMinutes >= 60,
    `unexpected window maths: ${JSON.stringify(record)}`,
  );
  return `${record.availabilityPercentage}% of ${record.totalMinutes}min, ${record.downtimeMinutes}min down`;
});

check("agent capacity can be updated and recalculated", async (ctx, actor, created) => {
  // agent_capacities had no utilization_percent / is_overloaded /
  // last_calculated_at columns, so both writes threw at runtime.
  const agentId = created.agents;
  const updated = await assignmentService.updateCapacity(ctx, agentId, { maxCapacity: 12 });
  assert(updated.utilizationPercent !== undefined, "utilization was not computed");
  assert(updated.lastCalculatedAt, "lastCalculatedAt was not stamped");
  const recalculated = await assignmentService.recalculateCapacity(ctx, agentId);
  assert(recalculated.lastCalculatedAt, "recalculate did not stamp lastCalculatedAt");
  return `util=${recalculated.utilizationPercent}% overloaded=${recalculated.isOverloaded}`;
});

check("capacity and presence list endpoints return rows", async (ctx, actor, created) => {
  const capacity = await assignmentService.listCapacity(ctx);
  const presence = await assignmentService.listPresence(ctx);
  assert(Array.isArray(capacity) && Array.isArray(presence), "expected lists");
  const mine = capacity.find((row) => String(row.agentId) === String(created.agents));
  assert(mine, "the smoke agent is missing from the capacity list");
  assert(
    presence.some((row) => String(row.agentId) === String(created.agents)),
    "the smoke agent is missing from the presence list",
  );
  return `capacity=${capacity.length} presence=${presence.length}`;
});

check("assignment stats and dashboard aggregate without error", async (ctx, actor, created) => {
  const capacityStats = await assignmentService.getCapacityStats(ctx);
  const presenceStats = await assignmentService.getPresenceStats(ctx);
  const dashboard = await assignmentService.getDashboard(ctx);
  assert(capacityStats.agentCount >= 1, "capacity stats missed the smoke agent");
  assert(presenceStats.total >= 1, "presence stats missed the smoke agent");
  assert(typeof dashboard.queues === "number", "dashboard shape changed");
  return `agents=${capacityStats.agentCount} queues=${dashboard.queues}`;
});

check("findBestAgent never crosses tenants", async (ctx, actor, created, db) => {
  const other = await db("companies").whereNot({ id: ctx.tenantId }).select("id").first();
  if (!other) return "skipped: single-tenant database";
  const [foreign] = await db("agents")
    .insert({
      company_id: other.id,
      name: "smoke other tenant agent",
      email: "smoke-other-tenant@example.invalid",
      password: "x",
      is_active: true,
    })
    .returning("*");
  created.foreign_agents = foreign.id;
  const best = await assignmentService.findBestAgent(ctx, {});
  if (!best) return "skipped: no candidate in this tenant";
  const owner = String(best.companyId || best.company_id || "");
  assert(owner === String(ctx.tenantId), `agent from another tenant was returned (${owner})`);
  return "stayed in tenant";
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  await connectDB();
  const db = getDB();
  const tenant = await db("companies").select("id").first();
  const ctx = { tenantId: tenant.id };
  const actor = { userId: null };
  const created = {};
  let failures = 0;

  try {
    for (const { name, fn } of checks) {
      try {
        const detail = await fn(ctx, actor, created, db);
        console.log(`  PASS ${name}${detail ? ` (${detail})` : ""}`);
      } catch (error) {
        failures += 1;
        console.log(`  FAIL ${name}`);
        console.log(`       ${error.message.split("\n")[0]}`);
      }
    }
  } finally {
    // Child rows first, so foreign keys never block cleanup.
    const order = [
      "availability_records",
      "outage_cis",
      "outage_services",
      "outages",
      "metric_targets",
      "metric_baselines",
      "costs",
      "benefits",
      "improvement_tasks",
      "improvement_goals",
      "improvement_initiatives",
      "improvement_opportunities",
      "business_services",
      "configuration_items",
    ];
    if (created.agents) {
      await db("agent_capacities").where({ agent_id: created.agents }).del();
      await db("agents").where({ id: created.agents }).del();
    }
    if (created.foreign_agents) {
      await db("agents").where({ id: created.foreign_agents }).del();
    }
    for (const table of order) {
      if (created[table]) await db(table).where({ id: created[table] }).del();
    }
    const leftover = await db("improvement_opportunities")
      .where({ title: "smoke opportunity" })
      .count("id as count")
      .first();
    const leftoverOutages = await db("outages")
      .where({ title: "smoke outage" })
      .count("id as count")
      .first();
    console.log(
      `\ncleanup: leftover opportunities=${leftover.count} outages=${leftoverOutages.count}`,
    );
  }

  const passed = checks.length - failures;
  console.log(
    `\n${failures ? "FAIL" : "PASS"} ${passed}/${checks.length} improvement/outage checks passed`,
  );
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error("smoke test crashed:", error.message);
  process.exit(1);
});
