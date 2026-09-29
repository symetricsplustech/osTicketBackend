/**
 * The instance_email_message_audit table was created without created_at /
 * updated_at, but the compat repository auto-injects both on create().
 * Add them additively so audit rows (allowed + denied intake) can be written
 * through the standard model layer.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("instance_email_message_audit", (t) => {
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("instance_email_message_audit", (t) => {
    t.dropColumn("created_at");
    t.dropColumn("updated_at");
  });
};