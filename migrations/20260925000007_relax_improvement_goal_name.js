/**
 * Phase 15 schema alignment, part 3: relax the last legacy NOT NULL column the
 * service can never populate.
 *
 * `improvement_goals.name` is NOT NULL, but createGoal/updateGoal write `title`,
 * so every goal insert failed with
 * `null value in column "name" of relation "improvement_goals"`.
 *
 * The column is kept (historical rows keep their values) and only the
 * constraint is dropped, matching improvement_initiatives.name in
 * 20260925000005_relax_legacy_not_null.js.
 *
 * The relationship columns `benefits.initiative_id` / `costs.initiative_id`
 * and `outage_cis.ci_id` / `outage_services.service_id` are intentionally left
 * NOT NULL: those services forward the caller's payload, so they are populated
 * on the happy path.
 */

exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn("improvement_goals", "name"))) return;
  await knex.raw('ALTER TABLE ?? ALTER COLUMN ?? DROP NOT NULL', [
    "improvement_goals",
    "name",
  ]);
};

exports.down = async function () {
  // Not restored automatically: goals created without the legacy column would
  // make a NOT NULL rollback fail.
};
