/**
 * Close remaining service-vs-schema gaps surfaced by the live 1.1 flow E2E:
 * problem.knownErrorId is written by createKnownError but problems lacked the
 * known_error_id column. Additive only — no table is dropped.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  await addColumnIfMissing("problems", "known_error_id", () =>
    knex.schema.alterTable("problems", (t) => t.uuid("known_error_id")),
  );
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op.
};