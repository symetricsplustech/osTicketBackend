/**
 * Phase 15/16 schema alignment, part 2: record numbering, ownership and
 * availability tracking.
 *
 * - The improvement family services stamp every new record with a
 *   `number` (via numberingService) and `created_by`; only
 *   improvement_opportunities had those columns, so creating an initiative,
 *   task, goal, benefit, cost, metric baseline or metric target failed with
 *   `column "number" / "created_by" does not exist`.
 * - outageService.calculateAvailability writes the generic
 *   entity_type/entity_id + period_start/period_end + minute/percentage
 *   breakdown, but availability_records only had the older service_id/period/
 *   availability_pct/downtime_ms/uptime_ms shape. The new columns are added
 *   alongside the existing ones, which are left untouched.
 *
 * Additive and idempotent: every column is added behind a hasColumn guard, so
 * no table is dropped, renamed or truncated and no existing row is rewritten.
 */

exports.up = async function (knex) {
  const add = async (table, column, build) => {
    if (await knex.schema.hasColumn(table, column)) return;
    await knex.schema.alterTable(table, build);
  };

  const numbered = [
    "improvement_initiatives",
    "improvement_tasks",
    "improvement_goals",
    "benefits",
    "costs",
    "metric_baselines",
    "metric_targets",
  ];

  for (const table of numbered) {
    await add(table, "number", (t) => t.string("number").defaultTo(""));
    await add(table, "created_by", (t) => t.uuid("created_by"));
  }

  await add("availability_records", "entity_type", (t) => t.string("entity_type"));
  await add("availability_records", "entity_id", (t) => t.uuid("entity_id"));
  await add("availability_records", "period_start", (t) => t.timestamp("period_start"));
  await add("availability_records", "period_end", (t) => t.timestamp("period_end"));
  await add("availability_records", "granularity", (t) => t.string("granularity"));
  await add("availability_records", "total_minutes", (t) => t.integer("total_minutes"));
  await add("availability_records", "uptime_minutes", (t) => t.integer("uptime_minutes"));
  await add("availability_records", "downtime_minutes", (t) => t.integer("downtime_minutes"));
  await add("availability_records", "availability_percentage", (t) =>
    t.decimal("availability_percentage"),
  );
  await add("availability_records", "outage_count", (t) => t.integer("outage_count"));
};

exports.down = async function () {
  // Additive-only migration: intentionally a no-op so reverting cannot drop
  // data that the services may already have written.
};
