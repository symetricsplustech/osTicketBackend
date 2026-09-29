exports.up = async function (knex) {
  await knex.schema.alterTable("priorities", (t) => {
    t.boolean("is_default").defaultTo(false);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("priorities", (t) => {
    t.dropColumn("is_default");
  });
};
