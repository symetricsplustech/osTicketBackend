exports.up = async function (knex) {
  await knex.schema.alterTable("ticket_threads", (t) => {
    t.timestamp("deleted_at");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("ticket_threads", (t) => {
    t.dropColumn("deleted_at");
  });
};
