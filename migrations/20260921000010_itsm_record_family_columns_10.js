/**
 * Tenth wave: task_relationships full columns, remove empty-string defaults
 * on `number` columns (service generates them), add updated_by to core ITSM tables.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  // task_relationships: source/target/task relationship
  await addColumnIfMissing("task_relationships", "source_task_id", () =>
    knex.schema.alterTable("task_relationships", (t) => t.uuid("source_task_id")),
  );
  await addColumnIfMissing("task_relationships", "target_task_id", () =>
    knex.schema.alterTable("task_relationships", (t) => t.uuid("target_task_id")),
  );
  await addColumnIfMissing("task_relationships", "relationship_type", () =>
    knex.schema.alterTable("task_relationships", (t) => t.string("relationship_type").defaultTo("")),
  );

  // Core ITSM tables: updated_by audit column (mirroring tasks)
  for (const table of ["incidents", "problems", "change_requests"]) {
    await addColumnIfMissing(table, "updated_by", () =>
      knex.schema.alterTable(table, (t) => t.uuid("updated_by")),
    );
  }

  // Remove empty-string defaults from number columns to avoid unique-constraint collisions.
  // Knex doesn't support dropping default directly; use raw SQL.
  for (const table of [
    "business_services",
    "catalog_categories",
    "catalog_items",
    "catalogs",
    "change_tasks",
    "configuration_items",
    "improvement_opportunities",
    "incident_tasks",
    "olas",
    "outages",
    "problem_tasks",
    "releases",
    "service_offerings",
    "service_portfolios",
    "technical_services",
  ]) {
    await knex.raw(`ALTER TABLE "${table}" ALTER COLUMN "number" DROP DEFAULT`);
  }
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op.
};