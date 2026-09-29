/**
 * Second wave of record-family schema fixes surfaced by the matrix suite:
 * the remaining soft-delete flags, sorting keys, audit actor ids and the
 * legacy `tasks.due_date` row shape that the ITSM task service persists.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  // ITSM Task model columns the legacy `tasks` table never carried.
  for (const [column, build] of [
    ["category", (t) => t.string("category")],
    ["configuration_item", (t) => t.uuid("configuration_item")],
    ["created_by", (t) => t.uuid("created_by")],
    ["department", (t) => t.uuid("department")],
    ["due_date", (t) => t.timestamp("due_date")],
    ["impact", (t) => t.string("impact")],
    ["is_major_incident", (t) => t.boolean("is_major_incident").notNullable().defaultTo(false)],
    ["location", (t) => t.string("location")],
    ["metadata", (t) => t.jsonb("metadata").defaultTo("{}")],
    ["parent_task", (t) => t.uuid("parent_task")],
    ["requested_by", (t) => t.uuid("requested_by")],
    ["service", (t) => t.uuid("service")],
    ["service_offering", (t) => t.uuid("service_offering")],
    ["subcategory", (t) => t.string("subcategory")],
    ["tags", (t) => t.jsonb("tags").defaultTo("[]")],
    ["urgency", (t) => t.string("urgency")],
  ]) {
    await addColumnIfMissing("tasks", column, () =>
      knex.schema.alterTable("tasks", (t) => build(t)),
    );
  }

  // Sub-task audit actor + numbering columns.
  await addColumnIfMissing("incident_tasks", "created_by", () =>
    knex.schema.alterTable("incident_tasks", (t) => t.uuid("created_by")),
  );
  await addColumnIfMissing("change_tasks", "created_by", () =>
    knex.schema.alterTable("change_tasks", (t) => t.uuid("created_by")),
  );

  // Queues/skills numbering + queue sort position.
  await addColumnIfMissing("queues", "number", () =>
    knex.schema.alterTable("queues", (t) => t.string("number").defaultTo("")),
  );
  await addColumnIfMissing("queues", "order", () =>
    knex.schema.alterTable("queues", (t) => t.integer("order").defaultTo(0)),
  );
  await addColumnIfMissing("skills", "number", () =>
    knex.schema.alterTable("skills", (t) => t.string("number").defaultTo("")),
  );

  // Soft-delete flags for the CMDB/improvement/outage/release portfolios.
  for (const table of [
    "business_services",
    "configuration_items",
    "improvement_opportunities",
    "outages",
    "releases",
    "service_offerings",
    "service_portfolios",
    "technical_services",
  ]) {
    await addColumnIfMissing(table, "is_deleted", () =>
      knex.schema.alterTable(table, (t) =>
        t.boolean("is_deleted").notNullable().defaultTo(false),
      ),
    );
  }

  // Outage list sorts on `start_time`.
  await addColumnIfMissing("outages", "start_time", () =>
    knex.schema.alterTable("outages", (t) => t.timestamp("start_time")),
  );

  // Catalog list ordering keys.
  await addColumnIfMissing("catalogs", "sort_order", () =>
    knex.schema.alterTable("catalogs", (t) => t.integer("sort_order").defaultTo(0)),
  );
  await addColumnIfMissing("catalog_items", "sort_order", () =>
    knex.schema.alterTable("catalog_items", (t) => t.integer("sort_order").defaultTo(0)),
  );
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op to keep the migration safe to revert.
};