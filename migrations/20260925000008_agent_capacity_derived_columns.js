/**
 * Phase 11 schema alignment: agent capacity derived columns.
 *
 * assignmentService.updateCapacity and recalculateCapacity persist
 * utilizationPercent, isOverloaded and lastCalculatedAt, but agent_capacities
 * only ever had agent_id / max_capacity / current_load. Both functions failed
 * with `column "utilization_percent" of relation "agent_capacities" does not
 * exist`, so agent capacity could be read but never updated or recalculated,
 * and getCapacityStats always reported overloaded = 0.
 *
 * These are the values the service already computes, so the columns are added
 * rather than the computations removed.
 *
 * Additive and idempotent: every column is added behind a hasColumn guard, so
 * no table is dropped, renamed or truncated and no existing row is rewritten.
 * Existing rows are backfilled from max_capacity / current_load.
 */

exports.up = async function (knex) {
  const add = async (column, build) => {
    if (await knex.schema.hasColumn("agent_capacities", column)) return;
    await knex.schema.alterTable("agent_capacities", build);
  };

  await add("utilization_percent", (t) =>
    t.decimal("utilization_percent", 5, 2).defaultTo(0),
  );
  await add("is_overloaded", (t) => t.boolean("is_overloaded").defaultTo(false));
  await add("last_calculated_at", (t) => t.timestamp("last_calculated_at"));

  await knex("agent_capacities")
    .whereNull("utilization_percent")
    .update({
      utilization_percent: knex.raw(
        "case when max_capacity > 0 then round((current_load::numeric / max_capacity) * 100, 2) else 0 end",
      ),
    });

  await knex("agent_capacities")
    .whereNull("is_overloaded")
    .update({ is_overloaded: knex.raw("current_load > max_capacity") });
};

exports.down = async function () {
  // Additive-only migration: intentionally a no-op so reverting cannot drop
  // data that the services may already have written.
};
