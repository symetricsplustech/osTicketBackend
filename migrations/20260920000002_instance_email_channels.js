/**
 * Instance Email Channel configuration
 */
exports.up = async function (knex) {
  await knex.schema.createTable("instance_email_channels", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("instance_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.enum("type", ["platform_managed", "customer_owned"]).defaultTo("platform_managed");
    t.string("inbound_address").notNullable(); // e.g., support@company.example.com
    t.string("inbound_domain").notNullable();  // domain part for routing
    t.enum("status", ["pending_verification", "verified", "active", "disabled", "failed"]).defaultTo("pending_verification");
    t.string("verification_token").notNullable();
    t.enum("verification_method", ["txt", "cname"]).defaultTo("txt");
    // Outbound sender configuration
    t.string("smtp_host");
    t.integer("smtp_port").defaultTo(587);
    t.boolean("smtp_secure").defaultTo(true);
    t.string("smtp_username");
    t.string("smtp_password"); // encrypted
    t.string("from_address");  // e.g., support@company.example.com
    t.string("from_name");
    t.string("reply_to_address");
    // SPF/DKIM/DMARC
    t.text("spf_record").defaultTo("");
    t.text("dkim_private_key").defaultTo("");
    t.string("dkim_selector").defaultTo("default");
    t.text("dmarc_record").defaultTo("");
    t.boolean("spf_verified").defaultTo(false);
    t.boolean("dkim_verified").defaultTo(false);
    t.boolean("dmarc_verified").defaultTo(false);
    t.timestamp("verified_at");
    t.uuid("verified_by").references("id").inTable("users").onDelete("SET NULL");
    t.timestamp("activated_at");
    t.uuid("activated_by").references("id").inTable("users").onDelete("SET NULL");
    t.timestamp("disabled_at");
    t.uuid("disabled_by").references("id").inTable("users").onDelete("SET NULL");
    t.text("failure_reason").defaultTo("");
    t.timestamps(true, true);
    t.unique(["instance_id", "inbound_address"]);
  });

  await knex.schema.createTable("instance_email_inbound_actions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("channel_id").notNullable().references("id").inTable("instance_email_channels").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("description").defaultTo("");
    t.enum("trigger", ["new_ticket", "reply", "forward", "all"]).defaultTo("all");
    t.jsonb("conditions").defaultTo("{}"); // e.g., { from: ["billing@"], subject: ["invoice"] }
    t.enum("action_type", ["create_incident", "create_request", "create_task", "update_record", "run_workflow"]).defaultTo("create_incident");
    t.jsonb("action_config").defaultTo("{}"); // e.g., { category: "billing", priority: "high" }
    t.boolean("is_active").defaultTo(true);
    t.integer("priority").defaultTo(100);
    t.timestamps(true, true);
  });

  await knex.schema.createTable("instance_email_sender_configs", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("channel_id").notNullable().references("id").inTable("instance_email_channels").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("from_address").notNullable();
    t.string("from_name");
    t.string("reply_to_address");
    t.boolean("is_default").defaultTo(false);
    t.jsonb("headers").defaultTo("{}");
    t.timestamps(true, true);
  });

  await knex.schema.createTable("instance_email_delivery_logs", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("channel_id").notNullable().references("id").inTable("instance_email_channels").onDelete("CASCADE");
    t.uuid("sender_config_id").references("id").inTable("instance_email_sender_configs").onDelete("SET NULL");
    t.string("to_address").notNullable();
    t.string("from_address").notNullable();
    t.string("subject");
    t.enum("status", ["sent", "delivered", "bounced", "complained", "failed", "deferred"]).defaultTo("sent");
    t.string("message_id");
    t.text("error_message").defaultTo("");
    t.text("raw_response").defaultTo("");
    t.timestamp("sent_at").notNullable();
    t.timestamp("delivered_at");
    t.timestamp("bounced_at");
    t.timestamp("complained_at");
    t.index(["channel_id", "status"]);
    t.index(["channel_id", "sent_at"]);
    t.index(["message_id"]);
  });

  await knex.schema.createTable("instance_email_message_audit", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("channel_id").notNullable().references("id").inTable("instance_email_channels").onDelete("CASCADE");
    t.string("message_id").notNullable();
    t.string("in_reply_to");
    t.text("references").defaultTo("");
    t.string("from_address").notNullable();
    t.text("to_addresses").defaultTo("");
    t.text("cc_addresses").defaultTo("");
    t.string("subject");
    t.text("headers").defaultTo("");
    t.enum("direction", ["inbound", "outbound"]).notNullable();
    t.enum("action", ["created_ticket", "updated_ticket", "created_request", "updated_request", "skipped", "bounced", "error"]).notNullable();
    t.uuid("record_id").references("id").inTable("tickets").onDelete("SET NULL"); // or other record types
    t.string("record_type").defaultTo("ticket");
    t.text("error_message").defaultTo("");
    t.timestamp("processed_at").notNullable();
    t.index(["channel_id", "processed_at"]);
    t.index(["message_id"]);
    t.index(["record_id", "record_type"]);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("instance_email_message_audit");
  await knex.schema.dropTableIfExists("instance_email_delivery_logs");
  await knex.schema.dropTableIfExists("instance_email_sender_configs");
  await knex.schema.dropTableIfExists("instance_email_inbound_actions");
  await knex.schema.dropTableIfExists("instance_email_channels");
};
