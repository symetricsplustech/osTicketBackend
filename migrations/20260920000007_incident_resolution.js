/**
 * incidents.resolution — ITSM Incident model persists a resolution note on
 * the record during the resolved transition, but the base ITSM schema only
 * stored it on incident_resolutions. Add the column so resolve succeeds.
 */

exports.up = async function (knex) {
  const exists = await knex.schema.hasColumn("incidents", "resolution");
  if (!exists) {
    await knex.schema.alterTable("incidents", (t) =>
      t.text("resolution").defaultTo(""),
    );
  }
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op.
};