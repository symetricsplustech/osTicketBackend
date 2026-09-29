/**
 * Time-scoped/permission-level grants powering EffectiveAccess "Revoke".
 *
 * A temporary grant adds a single permission key to a principal's effective
 * set (surfaced as source "temporary" with an optional expiry). Revoke is
 * implemented as a soft delete: revoked_at is set, the row is filtered out of
 * every effective lookup, and the audit trail is preserved.
 *
 * grantee_id has no FK because grantees live in either agents or users.
 */
exports.up = async function (knex) {
  await knex.schema.createTable("authorization_grants", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("grantee_id").notNullable(); // agents.id | users.id
    t.enum("grantee_type", ["agent", "user"]).notNullable();
    t.string("permission").notNullable();
    t.timestamp("expires_at");
    t.uuid("granted_by");
    t.timestamp("revoked_at");
    t.uuid("revoked_by");
    t.timestamps(true, true);
    t.index(["tenant_id", "grantee_id", "grantee_type"]);
    t.index(["revoked_at"]);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("authorization_grants");
};