/**
 * Additive schema support for the Change record family. Migration
 * 20260921000003_problem_changes_columns.js was edited after it had already
 * run (batch 16), so its change_cis / change_tasks / change_services blocks
 * were never applied to the live schema. This migration lands those columns
 * additively so linkCI / createTask / linkService can persist role, numbering,
 * actor and impact metadata against the live tables.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

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