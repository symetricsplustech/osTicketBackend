exports.up = async function (knex) {
  await knex.schema.alterTable("tickets", (t) => {
    t.string("entitlement_status").defaultTo("unknown");
    t.uuid("contract_id");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("tickets", (t) => {
    t.dropColumn("entitlement_status");
    t.dropColumn("contract_id");
  });
};
