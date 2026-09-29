exports.up = async function (knex) {
  await knex.schema.alterTable("users", (t) => {
    t.uuid("organization_id").references("id").inTable("organizations").onDelete("SET NULL");
    t.index("organization_id");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("users", (t) => {
    t.dropColumn("organization_id");
  });
};
