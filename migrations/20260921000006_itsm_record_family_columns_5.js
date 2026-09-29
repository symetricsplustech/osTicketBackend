/**
 * Fifth wave of record-family schema fixes:
 *  - the task activity log needs a `content` column,
 *  - standalone catalog categories must not force a parent catalog,
 *  - legacy `releases.name` (NOT NULL) must not block `title`-based creates.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  await addColumnIfMissing("task_activities", "content", () =>
    knex.schema.alterTable("task_activities", (t) => t.text("content").defaultTo("")),
  );

  await knex.raw(
    "ALTER TABLE catalog_categories ALTER COLUMN catalog_id DROP NOT NULL",
  );
  await knex.raw("ALTER TABLE releases ALTER COLUMN name DROP NOT NULL");
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op.
};