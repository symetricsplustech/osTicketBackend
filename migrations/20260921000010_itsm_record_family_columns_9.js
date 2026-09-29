/**
 * Ninth wave: task_relationships tenant_id, tasks updated_by
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  await addColumnIfMissing("task_relationships", "tenant_id", () =>
    knex.schema.alterTable("task_relationships", (t) => t.uuid("tenant_id")),
  );

  await addColumnIfMissing("tasks", "updated_by", () =>
    knex.schema.alterTable("tasks", (t) => t.uuid("updated_by")),
  );
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op.
};