/**
 * Sixth wave: task_activities.activity_log column `field_changed`
 * still missing after previous passes.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  await addColumnIfMissing("task_activities", "field_changed", () =>
    knex.schema.alterTable("task_activities", (t) => t.string("field_changed").defaultTo("")),
  );
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op.
};