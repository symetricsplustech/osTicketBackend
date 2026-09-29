/**
 * Complete ITSM operational columns required by the Problem → Incident
 * cross-module flows (workaround push-back and permanent-fix resolution).
 */

exports.up = async function (knex) {
  await knex.schema.alterTable("problems", (t) => {
    t.uuid("created_by").references("id").inTable("agents").onDelete("SET NULL");
    t.uuid("updated_by").references("id").inTable("agents").onDelete("SET NULL");
    t.jsonb("timeline").defaultTo("[]");
    t.timestamp("resolved_at");
    t.timestamp("closed_at");
    t.boolean("workaround_published").defaultTo(false);
    t.boolean("permanent_fix_verified").defaultTo(false);
    t.boolean("is_active").defaultTo(true);
    t.index("created_by");
    t.index("updated_by");
  });

  await knex.schema.alterTable("problem_incidents", (t) => {
    t.uuid("linked_by").references("id").inTable("agents").onDelete("SET NULL");
    t.boolean("is_active").defaultTo(true);
    t.index("problem_id");
    t.index("incident_id");
  });

  await knex.schema.alterTable("incident_resolutions", (t) => {
    t.string("resolution_code").defaultTo("resolved");
    t.text("notes").defaultTo("");
    t.text("root_cause").defaultTo("");
    t.string("root_cause_category").defaultTo("unknown");
    t.text("workaround").defaultTo("");
    t.timestamp("resolved_at");
    t.uuid("problem_id").references("id").inTable("problems").onDelete("SET NULL");
    t.uuid("linked_by").references("id").inTable("agents").onDelete("SET NULL");
    t.string("source").defaultTo("manual");
    t.index("problem_id");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("incident_resolutions", (t) => {
    t.dropColumn("source");
    t.dropColumn("linked_by");
    t.dropColumn("problem_id");
    t.dropColumn("resolved_at");
    t.dropColumn("workaround");
    t.dropColumn("root_cause_category");
    t.dropColumn("root_cause");
    t.dropColumn("notes");
    t.dropColumn("resolution_code");
  });

  await knex.schema.alterTable("problem_incidents", (t) => {
    t.dropColumn("is_active");
    t.dropColumn("linked_by");
  });

  await knex.schema.alterTable("problems", (t) => {
    t.dropColumn("is_active");
    t.dropColumn("permanent_fix_verified");
    t.dropColumn("workaround_published");
    t.dropColumn("closed_at");
    t.dropColumn("resolved_at");
    t.dropColumn("timeline");
    t.dropColumn("updated_by");
    t.dropColumn("created_by");
  });
};