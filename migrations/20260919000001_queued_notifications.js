exports.up = async (knex) => {
  await knex.schema.createTable("queued_notifications", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").references("id").inTable("companies").onDelete("CASCADE");
    t.string("channel").defaultTo("email");
    t.string("recipient_type").defaultTo("agent");
    t.uuid("recipient").notNullable();
    t.jsonb("payload").defaultTo("{}");
    t.timestamp("deliver_after").notNullable();
    t.boolean("delivered").defaultTo(false);
    t.timestamp("delivered_at");
    t.timestamps(true, true);
    t.index(["tenant_id", "delivered"]);
    t.index("deliver_after");
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("queued_notifications");
};