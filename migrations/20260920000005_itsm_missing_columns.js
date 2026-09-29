/**
 * Second round of service-vs-schema gaps surfaced by the ITSM hierarchy
 * test run: incident hold status, assignment-history from agents/groups,
 * and the tenant anchor on knowledge bases (the earlier migration already
 * ran so these must land in a fresh migration).
 */

exports.up = async function (knex) {
  const addColumnIfMissing = async (table, column, build) => {
    const exists = await knex.schema.hasColumn(table, column);
    if (!exists) await build();
  };

  for (const [table, column, build] of [
    ["incidents", "hold_reason", (t) => t.string("hold_reason").defaultTo("")],
    ["incident_assignment_histories", "from_agent", (t) => t.uuid("from_agent")],
    ["incident_assignment_histories", "from_group", (t) => t.uuid("from_group")],
    ["incident_assignment_histories", "reason", (t) => t.string("reason").defaultTo("")],
    ["problem_assignment_histories", "from_agent", (t) => t.uuid("from_agent")],
    ["problem_assignment_histories", "from_group", (t) => t.uuid("from_group")],
    ["problem_assignment_histories", "reason", (t) => t.string("reason").defaultTo("")],
    ["knowledge_bases", "company_id", (t) => t.uuid("company_id")],
  ]) {
    await addColumnIfMissing(table, column, () =>
      knex.schema.alterTable(table, (t) => build(t)),
    );
  }
};

exports.down = async function (knex) {
  // Best-effort reverse: no-op.
};