exports.up = async function (knex) {
  await knex.schema.alterTable("teams", (t) => {
    t.uuid("organization_unit").references("id").inTable("organization_units").onDelete("SET NULL");
    t.index("organization_unit");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("teams", (t) => {
    t.dropColumn("organization_unit");
  });
};
