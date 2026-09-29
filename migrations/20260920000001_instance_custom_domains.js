/**
 * Instance Custom Domains table for branded URLs
 */
exports.up = async function (knex) {
  await knex.schema.createTable("instance_domains", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("instance_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("hostname").notNullable();
    t.enum("status", [
      "pending_verification",
      "verified",
      "provisioning",
      "active",
      "failed",
      "disabled",
    ]).defaultTo("pending_verification");
    t.string("verification_token").notNullable();
    t.enum("verification_method", ["txt", "cname"]).defaultTo("txt");
    t.string("verification_record").defaultTo("");
    t.boolean("is_primary").defaultTo(false);
    t.boolean("redirect_to_primary").defaultTo(true);
    t.enum("tls_status", ["pending", "provisioning", "active", "failed", "expired"]).defaultTo("pending");
    t.text("tls_certificate").defaultTo("");
    t.text("tls_private_key").defaultTo("");
    t.timestamp("tls_expires_at");
    t.string("tls_provider").defaultTo("letsencrypt");
    t.timestamp("verified_at");
    t.uuid("verified_by").references("id").inTable("users").onDelete("SET NULL");
    t.timestamp("activated_at");
    t.uuid("activated_by").references("id").inTable("users").onDelete("SET NULL");
    t.timestamp("disabled_at");
    t.uuid("disabled_by").references("id").inTable("users").onDelete("SET NULL");
    t.text("failure_reason").defaultTo("");
    t.timestamps(true, true);
    t.unique(["instance_id", "hostname"]);
    t.index(["instance_id", "status"]);
    t.index(["hostname"]);
  });

  // Add unique constraint for primary domain per instance
  await knex.schema.alterTable("instance_domains", (t) => {
    t.index(["instance_id", "is_primary"], "idx_instance_domains_primary", { where: "is_primary = true" });
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("instance_domains");
};
