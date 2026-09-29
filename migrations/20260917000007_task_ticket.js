exports.up = async function (knex) {
  await knex.schema.alterTable("tasks", (t) => {
    t.uuid("ticket_id").references("id").inTable("tickets").onDelete("SET NULL");
    t.index("ticket_id");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("tasks", (t) => {
    t.dropColumn("ticket_id");
  });
};
