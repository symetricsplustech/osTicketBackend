exports.up = async function(knex) {
  // Add state column to approval_definitions (using is_active as source)
  await knex.schema.alterTable("approval_definitions", (t) => {
    t.string("state").defaultTo("active");
  });
  
  // Backfill state from is_active
  await knex("approval_definitions").update({ 
    state: knex.raw("CASE WHEN is_active THEN 'active' ELSE 'inactive' END") 
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable("approval_definitions", (t) => {
    t.dropColumn("state");
  });
};
