/**
 * Third wave of record-family schema fixes: the create paths of every
 * portfolio/scheduler/catalog/outage table persist an audit `created_by`
 * actor (and sub-task numbers), plus the task activity log's actor link.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  // Audit actor column used on every create insert.
  for (const table of [
    "business_services",
    "catalog_categories",
    "catalog_items",
    "catalogs",
    "configuration_items",
    "improvement_opportunities",
    "olas",
    "outages",
    "releases",
    "service_offerings",
    "service_portfolios",
    "technical_services",
  ]) {
    await addColumnIfMissing(table, "created_by", () =>
      knex.schema.alterTable(table, (t) => t.uuid("created_by")),
    );
  }

  // Improvement create also stamps the submitter.
  await addColumnIfMissing("improvement_opportunities", "submitted_by", () =>
    knex.schema.alterTable("improvement_opportunities", (t) => t.uuid("submitted_by")),
  );

  // Outage create stamps detector/owner and a timeline column is written.
  await addColumnIfMissing("outages", "detected_by", () =>
    knex.schema.alterTable("outages", (t) => t.uuid("detected_by")),
  );
  await addColumnIfMissing("outages", "owner_id", () =>
    knex.schema.alterTable("outages", (t) => t.uuid("owner_id")),
  );
  await addColumnIfMissing("outages", "timeline", () =>
    knex.schema.alterTable("outages", (t) => t.jsonb("timeline").defaultTo("[]")),
  );

  // Sub-task numbering.
  await addColumnIfMissing("incident_tasks", "number", () =>
    knex.schema.alterTable("incident_tasks", (t) => t.string("number").defaultTo("")),
  );
  await addColumnIfMissing("change_tasks", "number", () =>
    knex.schema.alterTable("change_tasks", (t) => t.string("number").defaultTo("")),
  );

  // Task activity log actor link.
  await addColumnIfMissing("task_activities", "actor", () =>
    knex.schema.alterTable("task_activities", (t) => t.uuid("actor")),
  );
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op to keep the migration safe to revert.
};