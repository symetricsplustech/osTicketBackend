/**
 * Augment ITSM tables with the common columns the service layer assumes
 * (is_active filters, created_by/updated_by audit actor ids, assignment
 * tracking, and KB/FAQ numbering/lifecycle state). The original ITSM
 * migrations only carried the domain-specific columns; services consistently
 * read/write these soft columns, so the schema must provide them.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  for (const table of ["incidents", "problems", "change_requests"]) {
    await addColumnIfMissing(table, "is_active", () =>
      knex.schema.alterTable(table, (t) =>
        t.boolean("is_active").notNullable().defaultTo(true),
      ),
    );
    await addColumnIfMissing(table, "created_by", () =>
      knex.schema.alterTable(table, (t) => t.uuid("created_by")),
    );
    await addColumnIfMissing(table, "updated_by", () =>
      knex.schema.alterTable(table, (t) => t.uuid("updated_by")),
    );
  }

  for (const table of [
    "incident_assignment_histories",
    "problem_assignment_histories",
  ]) {
    await addColumnIfMissing(table, "assignment_type", () =>
      knex.schema.alterTable(table, (t) =>
        t.string("assignment_type").defaultTo("initial"),
      ),
    );
    await addColumnIfMissing(table, "to_group", () =>
      knex.schema.alterTable(table, (t) => t.uuid("to_group")),
    );
    await addColumnIfMissing(table, "to_agent", () =>
      knex.schema.alterTable(table, (t) => t.uuid("to_agent")),
    );
    await addColumnIfMissing(table, "from_group", () =>
      knex.schema.alterTable(table, (t) => t.uuid("from_group")),
    );
    await addColumnIfMissing(table, "from_agent", () =>
      knex.schema.alterTable(table, (t) => t.uuid("from_agent")),
    );
  }

  await addColumnIfMissing("knowledge_bases", "company_id", () =>
    knex.schema.alterTable("knowledge_bases", (t) => t.uuid("company_id")),
  );
  await addColumnIfMissing("knowledge_bases", "is_deleted", () =>
    knex.schema.alterTable("knowledge_bases", (t) =>
      t.boolean("is_deleted").notNullable().defaultTo(false),
    ),
  );
  await addColumnIfMissing("knowledge_bases", "number", () =>
    knex.schema.alterTable("knowledge_bases", (t) =>
      t.string("number").defaultTo(""),
    ),
  );
  await addColumnIfMissing("knowledge_bases", "created_by", () =>
    knex.schema.alterTable("knowledge_bases", (t) => t.uuid("created_by")),
  );
  await addColumnIfMissing("knowledge_bases", "updated_by", () =>
    knex.schema.alterTable("knowledge_bases", (t) => t.uuid("updated_by")),
  );
  await addColumnIfMissing("knowledge_bases", "sort_order", () =>
    knex.schema.alterTable("knowledge_bases", (t) =>
      t.integer("sort_order").defaultTo(0),
    ),
  );

  for (const [column, build] of [
    ["company_id", (t) => t.uuid("company_id")],
    ["body", (t) => t.text("body").defaultTo("")],
    ["number", (t) => t.string("number").defaultTo("")],
    ["lifecycle", (t) => t.string("lifecycle").defaultTo("draft")],
    ["is_published", (t) => t.boolean("is_published").notNullable().defaultTo(false)],
    ["version", (t) => t.integer("version").defaultTo(1)],
    ["max_version", (t) => t.integer("max_version").defaultTo(1)],
    ["created_by", (t) => t.uuid("created_by")],
    ["updated_by", (t) => t.uuid("updated_by")],
    ["visibility", (t) => t.string("visibility").defaultTo("public")],
    ["is_deleted", (t) => t.boolean("is_deleted").notNullable().defaultTo(false)],
    ["related_articles", (t) => t.jsonb("related_articles").defaultTo("[]")],
  ]) {
    await addColumnIfMissing("faqs", column, () =>
      knex.schema.alterTable("faqs", (t) => build(t)),
    );
  }
  // faqs.tenant_id is NOT NULL but the article service writes `company`
  // (company_id) only; relax it so inserts do not violate the constraint.
  await knex.raw(
    "ALTER TABLE faqs ALTER COLUMN tenant_id DROP NOT NULL",
  );

  for (const [column, build] of [
    ["article_id", (t) => t.uuid("article_id")],
    ["keywords", (t) => t.text("keywords").defaultTo("")],
    ["category", (t) => t.string("category").defaultTo("")],
    ["visibility", (t) => t.string("visibility").defaultTo("public")],
    ["lifecycle", (t) => t.string("lifecycle").defaultTo("draft")],
    ["change_summary", (t) => t.string("change_summary").defaultTo("")],
    ["change_type", (t) => t.string("change_type").defaultTo("")],
    ["updated_by", (t) => t.uuid("updated_by")],
  ]) {
    await addColumnIfMissing("knowledge_versions", column, () =>
      knex.schema.alterTable("knowledge_versions", (t) => build(t)),
    );
  }
  // knowledge_versions has NOT NULL faq_id/title and a created_by FK to users,
  // but the version service writes article_id + agent actor ids. Relax those.
  await knex.raw(
    "ALTER TABLE knowledge_versions ALTER COLUMN faq_id DROP NOT NULL, ALTER COLUMN title DROP NOT NULL",
  );
  await knex.raw(
    "ALTER TABLE knowledge_versions DROP CONSTRAINT IF EXISTS knowledge_versions_created_by_foreign",
  );
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op to keep the migration safe to revert.
};