/**
 * Assignment-history reason columns (added after 00005 had already been
 * recorded, so the columns ship in a fresh migration). The assign service
 * persists a reassignment reason; the base ITSM schema omitted it.
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  for (const table of [
    "incident_assignment_histories",
    "problem_assignment_histories",
  ]) {
    await addColumnIfMissing(table, "reason", () =>
      knex.schema.alterTable(table, (t) =>
        t.string("reason").defaultTo(""),
      ),
    );
  }
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op.
};