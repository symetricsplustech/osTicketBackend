exports.up = async function (knex) {
  await knex.schema.createTable("tenant_modules", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("module_key").notNullable();
    t.string("status").notNullable().defaultTo("inactive");
    t.timestamp("activated_at");
    t.timestamp("grace_until");
    t.timestamp("trial_ends_at");
    t.timestamps(true, true);
    t.unique(["tenant_id", "module_key"]);
    t.index(["tenant_id", "status"]);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("tenant_modules");
};
