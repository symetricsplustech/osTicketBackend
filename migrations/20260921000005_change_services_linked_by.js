/**
 * change_services.linked_by: ChangeService.linkService persists the acting
 * agent into `linkedBy` (mirroring change_cis.linked_by / problem_cis.linked_by)
 * but the column was never in the base table. Add additively.
 */

exports.up = async function (knex) {
  const exists = await knex.schema.hasColumn("change_services", "linked_by");
  if (!exists) {
    await knex.schema.alterTable("change_services", (t) => t.uuid("linked_by"));
  }
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op.
};