/**
 * Seventh wave: task_activities.activity_log column `is_public`
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  await addColumnIfMissing("task_activities", "is_public", () =>
    knex.schema.alterTable("task_activities", (t) => t.boolean("is_public").defaultTo(true)),
  );
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op.
};