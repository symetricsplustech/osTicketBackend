/**
 * Phase 15/16 schema alignment, part 3: relax legacy NOT NULL columns the
 * current services can never populate.
 *
 * These columns come from the original table skeletons and are enforced
 * NOT NULL, but the services that own the tables write different fields:
 *
 *   improvement_initiatives.name  <- the service writes `title`
 *   metric_baselines.metric      <- the service writes `metricName`
 *   metric_targets.metric        <- the service writes `metricName`
 *   availability_records.period  <- the service writes period_start/period_end
 *
 * Nothing reads the legacy columns, so every insert failed with
 * `null value in column ... violates not-null constraint`. The columns are
 * kept (historical rows keep their values) and only the constraint is dropped.
 */

const RELAX = [
  ["improvement_initiatives", "name"],
  ["metric_baselines", "metric"],
  ["metric_targets", "metric"],
  ["availability_records", "period"],
];

exports.up = async function (knex) {
  for (const [table, column] of RELAX) {
    if (!(await knex.schema.hasColumn(table, column))) continue;
    await knex.raw(
      `ALTER TABLE ?? ALTER COLUMN ?? DROP NOT NULL`,
      [table, column],
    );
  }
};

exports.down = async function () {
  // Not restored automatically: rows created without the legacy columns would
  // make a NOT NULL rollback fail.
};
