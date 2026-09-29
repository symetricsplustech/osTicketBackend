/**
 * Add ServiceNow-standard impact/urgency columns to problems. The problem
 * create payload (and the ITSM test matrix) carry impact + urgency; the
 * original problems migration only exposed priority.
 */

exports.up = async function (knex) {
  const exists = await knex.schema.hasColumn("problems", "impact");
  if (!exists) {
    await knex.schema.alterTable("problems", (t) => {
      t.enum("impact", ["low", "medium", "high"]);
      t.enum("urgency", ["low", "medium", "high"]);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.alterTable("problems", (t) => {
    t.dropColumn("impact");
    t.dropColumn("urgency");
  }).catch(() => {});
};