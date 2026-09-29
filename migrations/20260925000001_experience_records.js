exports.up = async function (knex) {
  await knex.schema.createTable("experience_records", (table) => {
    table.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    table.string("domain", 80).notNullable();
    table.string("resource", 120).notNullable();
    table.string("number", 64);
    table.string("name", 255).notNullable();
    table.text("description");
    table.string("status", 64).notNullable().defaultTo("active");
    table.string("priority", 32).defaultTo("P3");
    table.uuid("owner_id");
    table.jsonb("details").notNullable().defaultTo("{}");
    table.uuid("created_by");
    table.uuid("updated_by");
    table.timestamps(true, true);
    table.index(["tenant_id", "domain", "resource"]);
    table.index(["tenant_id", "status"]);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("experience_records");
};
