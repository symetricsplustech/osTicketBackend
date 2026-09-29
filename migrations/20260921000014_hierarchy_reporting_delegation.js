/**
 * User-hierarchy module: reporting lines, operational engineer profiles and
 * permission-scoped delegated access.
 *
 * - reporting_lines: explicit manager / team-lead / delegated-manager chain
 *   with effective dates. Reporting line is deliberately separate from
 *   assignment-group membership (spec: "Do not infer reporting line from
 *   Assignment Group membership").
 * - engineer_profiles: operational profile attributes (availability, skills,
 *   territories, schedule). Work/time/dispatch sections are derived from
 *   operational tables, not duplicated here.
 * - delegations: the table already exists (delegator/delegate/from/to). This
 *   migration adds the permission scope, reason, revoke and audit columns
 *   needed for the Delegated Access surface. Columns are added only when
 *   absent so the migration is safe on databases where delegations was
 *   already extended.
 */
exports.up = async function (knex) {
  await knex.schema.createTable("reporting_lines", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("member_user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.uuid("manager_user_id").references("id").inTable("users").onDelete("SET NULL");
    t.uuid("team_lead_user_id").references("id").inTable("users").onDelete("SET NULL");
    t.uuid("delegated_manager_user_id").references("id").inTable("users").onDelete("SET NULL");
    t.timestamp("effective_from").defaultTo(knex.fn.now());
    t.timestamp("effective_to");
    t.boolean("is_active").notNullable().defaultTo(true);
    t.text("notes");
    t.uuid("created_by");
    t.uuid("updated_by");
    t.timestamps(true, true);
    t.index(["tenant_id", "member_user_id"]);
    t.index(["tenant_id", "manager_user_id"]);
    t.index(["tenant_id", "team_lead_user_id"]);
  });

  await knex.schema.createTable("engineer_profiles", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.jsonb("availability").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    t.jsonb("skills").notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    t.jsonb("territories").notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    t.jsonb("schedule").notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    t.text("notes");
    t.uuid("created_by");
    t.uuid("updated_by");
    t.timestamps(true, true);
    t.unique(["tenant_id", "user_id"]);
  });

  const hasColumn = async (table, column) => knex.schema.hasColumn(table, column);
  const addColumn = async (table, column, builder) => {
    if (!(await hasColumn(table, column))) {
      await knex.schema.alterTable(table, builder);
    }
  };

  // Distinguish operational groups from assignment groups (dispatch/routing
  // targets). Additive with a default so existing teams stay plain groups.
  await addColumn("teams", "kind", (t) =>
    t.enum("kind", ["group", "assignment_group"]).notNullable().defaultTo("group"));

  await addColumn("delegations", "permissions", (t) =>
    t.jsonb("permissions").notNullable().defaultTo(knex.raw("'[]'::jsonb")));
  await addColumn("delegations", "role_ids", (t) =>
    t.jsonb("role_ids").notNullable().defaultTo(knex.raw("'[]'::jsonb")));
  await addColumn("delegations", "scope", (t) =>
    t.jsonb("scope").notNullable().defaultTo(knex.raw("'{}'::jsonb")));
  await addColumn("delegations", "reason", (t) => t.text("reason"));
  await addColumn("delegations", "revoked_at", (t) => t.timestamp("revoked_at"));
  await addColumn("delegations", "revoked_by", (t) => t.uuid("revoked_by"));
  await addColumn("delegations", "created_by", (t) => t.uuid("created_by"));
  await addColumn("delegations", "updated_by", (t) => t.uuid("updated_by"));

  const hasIndex = async (indexName) => {
    const row = await knex.raw(
      "SELECT 1 FROM pg_indexes WHERE indexname = ?",
      [indexName],
    );
    return row.rows.length > 0;
  };
  if (!(await hasIndex("delegations_tenant_id_delegate_id_index"))) {
    await knex.schema.alterTable("delegations", (t) => {
      t.index(["tenant_id", "delegate_id"]);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("engineer_profiles");
  await knex.schema.dropTableIfExists("reporting_lines");
  // Delegation columns are left in place; removing them would risk data loss
  // on databases that extended the table independently.
};
