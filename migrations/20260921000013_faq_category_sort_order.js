exports.up = async function(knex) {
  await knex.schema.alterTable("faq_categories", (t) => {
    t.integer("sort_order").defaultTo(0);
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable("faq_categories", (t) => {
    t.dropColumn("sort_order");
  });
};
