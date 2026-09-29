/**
 * problem_changes: linkChange writes relationship_type / linked_by / is_active
 * but the base table only carried the FK pair + company. Add them additively.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  await addColumnIfMissing("problem_changes", "relationship_type", () =>
    knex.schema.alterTable("problem_changes", (t) => t.string("relationship_type").defaultTo("remediation")),
  );
  await addColumnIfMissing("problem_changes", "linked_by", () =>
    knex.schema.alterTable("problem_changes", (t) => t.uuid("linked_by")),
  );
  await addColumnIfMissing("problem_changes", "is_active", () =>
    knex.schema.alterTable("problem_changes", (t) => t.boolean("is_active").notNullable().defaultTo(true)),
  );

  for (const table of ["change_cis"]) {
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

  await addColumnIfMissing("change_tasks", "number", () =>
    knex.schema.alterTable("change_tasks", (t) => t.string("number").defaultTo("")),
  );
  await addColumnIfMissing("change_tasks", "created_by", () =>
    knex.schema.alterTable("change_tasks", (t) => t.uuid("created_by")),
  );
  await addColumnIfMissing("change_tasks", "is_active", () =>
    knex.schema.alterTable("change_tasks", (t) => t.boolean("is_active").notNullable().defaultTo(true)),
  );

  await addColumnIfMissing("change_services", "is_active", () =>
    knex.schema.alterTable("change_services", (t) => t.boolean("is_active").notNullable().defaultTo(true)),
  );
  await addColumnIfMissing("change_services", "impact_level", () =>
    knex.schema.alterTable("change_services", (t) => t.string("impact_level").defaultTo("")),
  );
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op.
};