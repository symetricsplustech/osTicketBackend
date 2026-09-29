exports.up = async function up(knex) {
  await knex.schema.createTable("universal_requests", (table) => {
    table.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    table.string("number").notNullable();
    table.string("title").notNullable();
    table.text("description").defaultTo("");
    table.string("status").defaultTo("new");
    table.string("priority").defaultTo("P3");
    table.uuid("requester_id");
    table.uuid("assigned_to");
    table.uuid("assignment_group");
    table.uuid("parent_id").references("id").inTable("universal_requests").onDelete("SET NULL");
    table.string("source_type").defaultTo("");
    table.uuid("source_id");
    table.jsonb("metadata").defaultTo("{}");
    table.uuid("created_by");
    table.uuid("updated_by");
    table.timestamps(true, true);
    table.unique(["tenant_id", "number"]);
    table.index(["tenant_id", "status"]);
  });
};

exports.down = (knex) => knex.schema.dropTableIfExists("universal_requests");
