exports.up = async function (knex) {
  await knex.schema.alterTable("companies", (t) => {
    t.uuid("created_by_user").references("id").inTable("users").onDelete("SET NULL");
  });
  await knex.schema.alterTable("roles", (t) => {
    t.boolean("is_admin").defaultTo(false);
  });
  await knex.schema.alterTable("departments", (t) => {
    t.boolean("is_public").defaultTo(true);
    t.text("notes").defaultTo("");
  });
  await knex.schema.alterTable("sla_plans", (t) => {
    t.integer("grace_period").defaultTo(0);
    t.string("schedule").defaultTo("24/7");
    t.text("notes").defaultTo("");
  });
  await knex.schema.alterTable("teams", (t) => {
    t.text("notes").defaultTo("");
    t.uuid("lead_id").references("id").inTable("agents").onDelete("SET NULL");
  });
  await knex.schema.alterTable("help_topics", (t) => {
    t.string("category").defaultTo("");
    t.string("priority").defaultTo("Normal");
    t.uuid("auto_assign_team_id").references("id").inTable("teams").onDelete("SET NULL");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("help_topics", (t) => {
    t.dropColumn("category");
    t.dropColumn("priority");
    t.dropColumn("auto_assign_team_id");
  });
  await knex.schema.alterTable("teams", (t) => {
    t.dropColumn("notes");
    t.dropColumn("lead_id");
  });
  await knex.schema.alterTable("sla_plans", (t) => {
    t.dropColumn("grace_period");
    t.dropColumn("schedule");
    t.dropColumn("notes");
  });
  await knex.schema.alterTable("departments", (t) => {
    t.dropColumn("is_public");
    t.dropColumn("notes");
  });
  await knex.schema.alterTable("roles", (t) => {
    t.dropColumn("is_admin");
  });
  await knex.schema.alterTable("companies", (t) => {
    t.dropColumn("created_by_user");
  });
};
