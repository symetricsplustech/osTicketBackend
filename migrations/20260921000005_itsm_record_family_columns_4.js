/**
 * Fourth wave of record-family schema fixes: every create path stamps a
 * `number` (sequence label), the release rows carry a `title`, and the
 * task activity log stores a human-readable actor name.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  for (const table of [
    "business_services",
    "catalog_categories",
    "catalog_items",
    "catalogs",
    "configuration_items",
    "improvement_opportunities",
    "olas",
    "outages",
    "service_offerings",
    "service_portfolios",
    "technical_services",
  ]) {
    await addColumnIfMissing(table, "number", () =>
      knex.schema.alterTable(table, (t) => t.string("number").defaultTo("")),
    );
  }

  await addColumnIfMissing("releases", "title", () =>
    knex.schema.alterTable("releases", (t) => t.string("title").defaultTo("")),
  );

  await addColumnIfMissing("task_activities", "actor_name", () =>
    knex.schema.alterTable("task_activities", (t) => t.string("actor_name").defaultTo("")),
  );
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op to keep the migration safe to revert.
};