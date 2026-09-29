/**
 * Close the remaining service-vs-schema gaps for the 1.1 flow
 * (Incident → Problem → Known Error → Knowledge → Change → Permanent Fix):
 *
 *  - incident_cis / problem_cis: linkCI writes role, is_active and linked_by.
 *  - problem_tasks: createTask writes number and created_by; listTasks filters
 *    by is_active.
 *  - known_errors: createKnownError writes number and created_by; lifecycle
 *    edits write is_active/updated_by.
 *  - post_incident_reviews: the PIR service writes created_by, approved_by,
 *    approved_at and published_at during create/approve/publish.
 *  - change_implementation_results: createImplementationResult now persists
 *    remediation evidence (jsonb) alongside the existing result/notes.
 *
 * Every column is added with a hasColumn guard so the migration is idempotent
 * and additive — no table is dropped.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  for (const table of ["incident_cis", "problem_cis"]) {
    await addColumnIfMissing(table, "role", () =>
      knex.schema.alterTable(table, (t) => t.string("role").defaultTo("affected")),
    );
    await addColumnIfMissing(table, "is_active", () =>
      knex.schema.alterTable(table, (t) => t.boolean("is_active").notNullable().defaultTo(true)),
    );
    await addColumnIfMissing(table, "linked_by", () =>
      knex.schema.alterTable(table, (t) => t.uuid("linked_by")),
    );
  }

  await addColumnIfMissing("problem_tasks", "number", () =>
    knex.schema.alterTable("problem_tasks", (t) => t.string("number").defaultTo("")),
  );
  await addColumnIfMissing("problem_tasks", "created_by", () =>
    knex.schema.alterTable("problem_tasks", (t) => t.uuid("created_by")),
  );
  await addColumnIfMissing("problem_tasks", "is_active", () =>
    knex.schema.alterTable("problem_tasks", (t) => t.boolean("is_active").notNullable().defaultTo(true)),
  );

  await addColumnIfMissing("known_errors", "number", () =>
    knex.schema.alterTable("known_errors", (t) => t.string("number").defaultTo("")),
  );
  await addColumnIfMissing("known_errors", "is_active", () =>
    knex.schema.alterTable("known_errors", (t) => t.boolean("is_active").notNullable().defaultTo(true)),
  );
  await addColumnIfMissing("known_errors", "created_by", () =>
    knex.schema.alterTable("known_errors", (t) => t.uuid("created_by")),
  );
  await addColumnIfMissing("known_errors", "updated_by", () =>
    knex.schema.alterTable("known_errors", (t) => t.uuid("updated_by")),
  );

  await addColumnIfMissing("post_incident_reviews", "created_by", () =>
    knex.schema.alterTable("post_incident_reviews", (t) => t.uuid("created_by")),
  );
  await addColumnIfMissing("post_incident_reviews", "approved_by", () =>
    knex.schema.alterTable("post_incident_reviews", (t) => t.uuid("approved_by")),
  );
  await addColumnIfMissing("post_incident_reviews", "approved_at", () =>
    knex.schema.alterTable("post_incident_reviews", (t) => t.timestamp("approved_at")),
  );
  await addColumnIfMissing("post_incident_reviews", "published_at", () =>
    knex.schema.alterTable("post_incident_reviews", (t) => t.timestamp("published_at")),
  );

  await addColumnIfMissing("change_implementation_results", "remediation_evidence", () =>
    knex.schema.alterTable("change_implementation_results", (t) => t.jsonb("remediation_evidence").defaultTo("[]")),
  );
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op to keep the migration safe to revert.
};