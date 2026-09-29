/**
 * Eighth wave: remaining task_activities activity_log columns
 * new_value, old_value, type
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  await addColumnIfMissing("task_activities", "new_value", () =>
    knex.schema.alterTable("task_activities", (t) => t.jsonb("new_value")),
  );
  await addColumnIfMissing("task_activities", "old_value", () =>
    knex.schema.alterTable("task_activities", (t) => t.jsonb("old_value")),
  );
  await addColumnIfMissing("task_activities", "type", () =>
    knex.schema.alterTable("task_activities", (t) => t.string("type").defaultTo("")),
  );
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op.
};