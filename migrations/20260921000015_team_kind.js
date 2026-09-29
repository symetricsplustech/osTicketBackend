/**
 * Distinguish operational groups from assignment groups on `teams`.
 * Additive with a default so existing teams remain plain groups.
 */
exports.up = async function (knex) {
  const has = await knex.schema.hasColumn("teams", "kind");
  if (!has) {
    await knex.schema.alterTable("teams", (t) => {
      t.enum("kind", ["group", "assignment_group"]).notNullable().defaultTo("group");
    });
  }
};

exports.down = async function (knex) {
  const has = await knex.schema.hasColumn("teams", "kind");
  if (has) {
    await knex.schema.alterTable("teams", (t) => {
      t.dropColumn("kind");
    });
  }
};
