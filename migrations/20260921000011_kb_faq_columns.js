exports.up = async function(knex) {
  // Add is_public column to faq_categories (alias for is_active)
  await knex.schema.alterTable("faq_categories", (t) => {
    t.boolean("is_public").defaultTo(true);
  });
  
  // Backfill is_public from is_active
  await knex("faq_categories").update({ is_public: knex.raw("is_active") });
};

exports.down = async function(knex) {
  await knex.schema.alterTable("faq_categories", (t) => {
    t.dropColumn("is_public");
  });
};
