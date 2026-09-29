/**
 * Close the recorded schema/model drift uncovered by the record-family
 * matrix tests: the ITSM service layer reads/writes soft-delete flags,
 * audit actor ids, entity links and tenant/owner columns that the original
 * table definitions never carried. This migration adds the missing columns
 * (guarded) and materializes the `service_catalog_items` table that the
 * helpdesk portal catalogue reads.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  // Tasks: soft delete + assignment group the core task service persists.
  await addColumnIfMissing("tasks", "assignment_group", () =>
    knex.schema.alterTable("tasks", (t) => t.uuid("assignment_group")),
  );
  await addColumnIfMissing("tasks", "deleted_at", () =>
    knex.schema.alterTable("tasks", (t) => t.timestamp("deleted_at")),
  );

  // Sub-task families: parent entity link columns.
  const parents = [
    ["incident_tasks", "incident"],
    ["problem_tasks", "problem"],
    ["change_tasks", "change"],
  ];
  for (const [table, column] of parents) {
    await addColumnIfMissing(table, column, () =>
      knex.schema.alterTable(table, (t) => t.uuid(column)),
    );
  }

  // Soft-delete flags used pervasively by list queries.
  for (const table of [
    "olas",
    "queues",
    "skills",
    "catalogs",
    "catalog_categories",
    "catalog_items",
    "approval_definitions",
    "task_attachments",
    "oncall_schedules",
  ]) {
    await addColumnIfMissing(table, "is_deleted", () =>
      knex.schema.alterTable(table, (t) =>
        t.boolean("is_deleted").notNullable().defaultTo(false),
      ),
    );
  }

  // Audit/actor columns writes pass on insert.
  await addColumnIfMissing("queues", "created_by", () =>
    knex.schema.alterTable("queues", (t) => t.uuid("created_by")),
  );
  await addColumnIfMissing("skills", "created_by", () =>
    knex.schema.alterTable("skills", (t) => t.uuid("created_by")),
  );
  await addColumnIfMissing("survey_responses", "agent_id", () =>
    knex.schema.alterTable("survey_responses", (t) => t.uuid("agent_id")),
  );

  // FAQ internal-only flag the portal reader tests.
  await addColumnIfMissing("faqs", "internal_only", () =>
    knex.schema.alterTable("faqs", (t) =>
      t.boolean("internal_only").notNullable().defaultTo(false),
    ),
  );

  // Portal service catalogue table referenced by the customer public surface.
  if (!(await knex.schema.hasTable("service_catalog_items"))) {
    await knex.schema.createTable("service_catalog_items", (t) => {
      t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
      t.uuid("company_id");
      t.uuid("tenant_id");
      t.string("name").defaultTo("");
      t.text("description").defaultTo("");
      t.string("category").defaultTo("");
      t.integer("sort_order").defaultTo(0);
      t.boolean("visible_in_portal").notNullable().defaultTo(true);
      t.boolean("is_active").notNullable().defaultTo(true);
      t.uuid("help_topic_id");
      t.uuid("department_id");
      t.uuid("sla_id");
      t.uuid("form_id");
      t.timestamps(true, true);
      t.index("company_id");
    });
  }
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op to keep the migration safe to revert.
};