exports.up = async function (knex) {
  await knex.schema.alterTable("ticket_threads", (t) => {
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.string("poster_type").defaultTo("user");
    t.string("title").defaultTo("");
    t.text("system_message").defaultTo("");
    t.boolean("is_system").defaultTo(false);
    t.index("company_id");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("ticket_threads", (t) => {
    t.dropColumn("company_id");
    t.dropColumn("poster_type");
    t.dropColumn("title");
    t.dropColumn("system_message");
    t.dropColumn("is_system");
  });
};
