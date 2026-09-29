exports.up = async function (knex) {
  await knex.schema.createTable("organization_unit_labels", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("type").notNullable();
    t.string("label").notNullable();
    t.timestamps(true, true);
    t.unique(["company_id", "type"]);
  });
  await knex.schema.alterTable("organization_units", (t) => {
    t.uuid("instance_company").references("id").inTable("instance_companies").onDelete("SET NULL");
    t.text("description").defaultTo("");
    t.boolean("active").defaultTo(true);
    t.index("instance_company");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("organization_units", (t) => {
    t.dropColumn("instance_company");
    t.dropColumn("description");
    t.dropColumn("active");
  });
  await knex.schema.dropTableIfExists("organization_unit_labels");
};
