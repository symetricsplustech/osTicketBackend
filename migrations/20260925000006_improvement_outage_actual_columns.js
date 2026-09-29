/**
 * Phase 15/16 schema alignment, part 4: actuals, measurement and outage
 * communication timestamps.
 *
 * These columns are written by the services on every state transition but were
 * never migrated, so the transitions failed at runtime with
 * `column "..." of relation "..." does not exist`:
 *
 *   improvement_initiatives  actual_start_date / actual_end_date
 *   improvement_tasks       actual_start_date / actual_end_date / actual_duration
 *   improvement_goals       last_measured_at / last_measured_by
 *   benefits                realized_at / realized_by
 *   metric_targets          improvement_percentage / last_measured_at / last_measured_by
 *   outages                 actual_restoration / last_communication_at /
 *                           next_communication_at
 *
 * `actual_duration` is stored in minutes (the service rounds `(end - start)`
 * to whole minutes) and `last_measured_by` / `realized_by` are actor user ids.
 *
 * Additive and idempotent: every column is added behind a hasColumn guard, so
 * no table is dropped, renamed or truncated and no existing row is rewritten.
 */

exports.up = async function (knex) {
  const add = async (table, column, build) => {
    if (await knex.schema.hasColumn(table, column)) return;
    await knex.schema.alterTable(table, build);
  };

  for (const table of ["improvement_initiatives", "improvement_tasks"]) {
    await add(table, "actual_start_date", (t) => t.timestamp("actual_start_date"));
    await add(table, "actual_end_date", (t) => t.timestamp("actual_end_date"));
  }

  await add("improvement_tasks", "actual_duration", (t) =>
    t.integer("actual_duration"),
  );

  for (const table of ["improvement_goals", "metric_targets"]) {
    await add(table, "last_measured_at", (t) => t.timestamp("last_measured_at"));
    await add(table, "last_measured_by", (t) => t.uuid("last_measured_by"));
  }

  await add("metric_targets", "improvement_percentage", (t) =>
    t.decimal("improvement_percentage"),
  );

  await add("benefits", "realized_at", (t) => t.timestamp("realized_at"));
  await add("benefits", "realized_by", (t) => t.uuid("realized_by"));

  await add("outages", "actual_restoration", (t) =>
    t.timestamp("actual_restoration"),
  );
  await add("outages", "last_communication_at", (t) =>
    t.timestamp("last_communication_at"),
  );
  await add("outages", "next_communication_at", (t) =>
    t.timestamp("next_communication_at"),
  );
};

exports.down = async function () {
  // Additive-only migration: intentionally a no-op so reverting cannot drop
  // data that the services may already have written.
};
