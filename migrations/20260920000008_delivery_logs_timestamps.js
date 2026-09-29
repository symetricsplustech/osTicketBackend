/**
 * The instance_email_delivery_logs table was created without created_at /
 * updated_at (it records event-specific `*_at` timestamps), but the compat
 * repository auto-injects both on create(). Add them additively so delivery
 * logs written through the standard model layer succeed.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("instance_email_delivery_logs", (t) => {
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("instance_email_delivery_logs", (t) => {
    t.dropColumn("created_at");
    t.dropColumn("updated_at");
  });
};