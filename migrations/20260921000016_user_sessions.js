/**
 * Session registry for the User Access Workspace "Sessions / MFA" tab.
 *
 * Auth in this system is stateless JWT, so there is no existing per-user
 * session table. This table records authentication events (user or agent)
 * with the request fingerprint so the workspace can show and revoke sessions
 * from real data. Revoking a session bumps the subject's session_version,
 * which invalidates its issued JWTs via the auth middleware.
 */
exports.up = async function (knex) {
  await knex.schema.createTable("user_sessions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("user_id").references("id").inTable("users").onDelete("CASCADE");
    t.uuid("agent_id").references("id").inTable("agents").onDelete("CASCADE");
    t.string("email").notNullable().defaultTo("");
    t.string("ip").notNullable().defaultTo("");
    t.string("user_agent").notNullable().defaultTo("");
    t.string("device").notNullable().defaultTo("");
    t.boolean("mfa_verified").notNullable().defaultTo(false);
    t.timestamp("last_active_at").defaultTo(knex.fn.now());
    t.timestamp("revoked_at");
    t.uuid("revoked_by");
    t.timestamps(true, true);
    t.index("tenant_id");
    t.index("user_id");
    t.index("agent_id");
    t.index("email");
    t.index(["tenant_id", "user_id"]);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("user_sessions");
};
