exports.up = async function (knex) {
  await knex.schema.alterTable("ticket_statuses", (t) => {
    t.string("key");
    t.boolean("pause_sla").defaultTo(false);
    t.string("waiting_on").defaultTo("");
    t.boolean("is_closed").defaultTo(false);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("ticket_statuses", (t) => {
    t.dropColumn("key");
    t.dropColumn("pause_sla");
    t.dropColumn("waiting_on");
    t.dropColumn("is_closed");
  });
};
