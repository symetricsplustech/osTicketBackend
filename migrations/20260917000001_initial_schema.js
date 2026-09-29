/**
 * into a relational schema with proper foreign keys, indexes, and
 * JSONB columns for flexible/extensible fields.
 *
 * Tables are created in dependency order (parents before children).
 */

exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  // ──────────────────────────────────────────────
  // 1. PLATFORM / BILLING
  // ──────────────────────────────────────────────

  await knex.schema.createTable("plans", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("name").notNullable();
    t.string("code").notNullable().unique();
    t.text("description").defaultTo("");
    t.decimal("price_monthly", 12, 2).defaultTo(0);
    t.decimal("price_yearly", 12, 2).defaultTo(0);
    t.string("currency", 10).defaultTo("INR");
    t.integer("max_agents").defaultTo(5);
    t.integer("max_users").defaultTo(100);
    t.integer("max_contacts").defaultTo(0);
    t.integer("max_tickets").defaultTo(0);
    t.bigInteger("storage_limit").defaultTo(5368709120);
    t.integer("api_rate_limit").defaultTo(1000);
    t.integer("api_monthly_limit").defaultTo(100000);
    t.integer("monthly_usage_limit").defaultTo(0);
    t.jsonb("features").defaultTo("[]");
    t.jsonb("module_keys").defaultTo("[]");
    t.boolean("api_access").defaultTo(false);
    t.boolean("priority_support").defaultTo(false);
    t.integer("trial_days").defaultTo(14);
    t.integer("grace_period_days").defaultTo(7);
    t.jsonb("subscription_restrictions").defaultTo("{}");
    t.boolean("is_active").defaultTo(true);
    t.boolean("is_default").defaultTo(false);
    t.timestamps(true, true);
  });

  await knex.schema.createTable("super_admins", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("name").notNullable();
    t.string("email").notNullable().unique();
    t.string("password").notNullable();
    t.enum("role", ["super_admin", "support"]).defaultTo("super_admin");
    t.string("platform_role").defaultTo("platform_support_administrator");
    t.boolean("is_active").defaultTo(true);
    t.jsonb("permissions").defaultTo("[]");
    t.jsonb("module_keys").defaultTo("[]");
    t.boolean("two_factor_enabled").defaultTo(false);
    t.string("two_factor_secret").defaultTo("");
    t.jsonb("allowed_ips").defaultTo("[]");
    t.timestamp("last_login");
    t.timestamp("last_seen_at");
    t.integer("session_version").defaultTo(0);
    t.timestamps(true, true);
  });

  // ──────────────────────────────────────────────
  // 2. COMPANY / TENANT (forward references added after children)
  // ──────────────────────────────────────────────

  await knex.schema.createTable("companies", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("name").notNullable();
    t.string("email").defaultTo("");
    t.string("support_email").defaultTo("");
    t.string("domain").defaultTo("");
    t.string("logo").defaultTo("");
    t.text("address").defaultTo("");
    t.string("contact_person").defaultTo("");
    t.string("phone").defaultTo("");
    t.enum("status", [
      "pending_verification",
      "trial",
      "active",
      "grace",
      "restricted",
      "suspended",
      "expired",
      "archived",
      "terminated",
    ]).defaultTo("trial");
    t.boolean("is_instance").defaultTo(false);
    t.string("instance_code");
    t.string("verification_token");
    t.timestamp("verification_expires");
    t.uuid("plan_id").references("id").inTable("plans").onDelete("SET NULL");
    t.timestamp("plan_started_at");
    t.timestamp("plan_expires_at");
    t.enum("billing_cycle", ["monthly", "yearly"]).defaultTo("monthly");
    t.timestamp("trial_ends_at");
    t.boolean("auto_renew").defaultTo(true);
    t.string("status_reason").defaultTo("");
    t.timestamp("grace_ends_at");
    t.timestamp("archived_at");
    t.timestamp("terminated_at");
    t.timestamp("purge_scheduled_at");
    t.boolean("legal_hold").defaultTo(false);
    t.jsonb("lifecycle_history").defaultTo("[]");
    t.bigInteger("storage_used").defaultTo(0);
    t.string("api_key").defaultTo("");
    t.jsonb("settings").defaultTo("{}");
    t.uuid("created_by")
      .references("id")
      .inTable("super_admins")
      .onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("status");
    t.index("is_instance");
  });

  // ──────────────────────────────────────────────
  // 3. USERS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("users", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("name").notNullable();
    t.string("email").notNullable().unique();
    t.string("phone").defaultTo("");
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("SET NULL");
    t.jsonb("instance_memberships").defaultTo("[]");
    t.string("password");
    t.enum("user_type", ["employee", "external"]).defaultTo("employee");
    t.enum("org_role", ["member", "manager"]).defaultTo("member");
    t.boolean("is_registered").defaultTo(false);
    t.boolean("email_confirmed").defaultTo(false);
    t.timestamp("policy_consent_at");
    t.string("confirmation_token");
    t.timestamp("confirmation_expires");
    t.string("pending_email").defaultTo("");
    t.string("pending_email_token");
    t.timestamp("pending_email_expires");
    t.string("reset_token");
    t.timestamp("reset_expires");
    t.enum("status", ["pending_verification", "active", "disabled"]).defaultTo(
      "active",
    );
    t.boolean("two_factor_enabled").defaultTo(false);
    t.string("two_factor_secret");
    t.jsonb("two_factor_backup_codes").defaultTo("[]");
    t.uuid("created_by").references("id").inTable("users").onDelete("SET NULL");
    t.jsonb("permissions").defaultTo("[]");
    t.timestamp("last_login");
    t.timestamp("last_seen_at");
    t.integer("session_version").defaultTo(0);
    t.text("notes").defaultTo("");
    t.string("avatar").defaultTo("");
    t.enum("tier", ["standard", "priority", "enterprise"]).defaultTo(
      "standard",
    );
    t.string("locale").defaultTo("");
    t.string("timezone").defaultTo("");
    t.jsonb("health").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
    t.index("user_type");
    t.index("status");
    t.index("created_by");
  });

  // ──────────────────────────────────────────────
  // 4. ORGANIZATION / DEPARTMENT / TEAM
  // ──────────────────────────────────────────────

  await knex.schema.createTable("organizations", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("type").defaultTo("company");
    t.uuid("parent_id")
      .references("id")
      .inTable("organizations")
      .onDelete("SET NULL");
    t.jsonb("contacts").defaultTo("[]");
    t.jsonb("addresses").defaultTo("[]");
    t.jsonb("custom_data").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("organization_units", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("type").defaultTo("business_unit");
    t.uuid("parent_id")
      .references("id")
      .inTable("organization_units")
      .onDelete("SET NULL");
    t.jsonb("labels").defaultTo("[]");
    t.jsonb("config").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
  });

  // ──────────────────────────────────────────────
  // 5. ROLES / RBAC
  // ──────────────────────────────────────────────

  await knex.schema.createTable("roles", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("name").notNullable();
    t.string("description").defaultTo("");
    t.enum("scope", ["platform", "tenant"]).defaultTo("tenant");
    t.enum("status", ["active", "disabled"]).defaultTo("active");
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.jsonb("permissions").defaultTo("[]");
    t.jsonb("denied_permissions").defaultTo("[]");
    t.jsonb("record_scopes").defaultTo("[]");
    t.jsonb("field_access").defaultTo("[]");
    t.decimal("approval_limit", 12, 2).defaultTo(0);
    t.jsonb("assignable_by").defaultTo("[]");
    t.jsonb("module_keys").defaultTo("[]");
    t.timestamps(true, true);
    t.index("company_id");
    t.index("scope");
  });

  await knex.schema.createTable("teams", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("name").notNullable();
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.boolean("is_active").defaultTo(true);
    t.jsonb("members").defaultTo("[]");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("departments", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("name").notNullable();
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.uuid("parent_id")
      .references("id")
      .inTable("departments")
      .onDelete("SET NULL");
    t.uuid("auto_assign_team_id")
      .references("id")
      .inTable("teams")
      .onDelete("SET NULL");
    t.jsonb("schedule").defaultTo("{}");
    t.boolean("is_active").defaultTo(true);
    t.uuid("organization_unit")
      .references("id")
      .inTable("organization_units")
      .onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("company_id");
  });

  // Now add forward refs to companies
  await knex.schema.alterTable("companies", (t) => {
    t.uuid("instance_owner")
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
  });

  // ──────────────────────────────────────────────
  // 6. AGENTS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("agents", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("name").notNullable();
    t.string("email").notNullable().unique();
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("SET NULL");
    t.string("password").notNullable();
    t.uuid("role_id").references("id").inTable("roles").onDelete("SET NULL");
    t.boolean("is_admin").defaultTo(false);
    t.boolean("is_active").defaultTo(true);
    t.jsonb("permissions").defaultTo("[]");
    t.jsonb("departments").defaultTo("[]");
    t.jsonb("teams").defaultTo("[]");
    t.string("signature").defaultTo("");
    t.text("notes").defaultTo("");
    t.timestamp("last_login");
    t.timestamp("last_seen_at");
    t.integer("session_version").defaultTo(0);
    t.string("avatar").defaultTo("");
    t.jsonb("locked_tickets").defaultTo("[]");
    t.jsonb("skills").defaultTo("[]");
    t.enum("level", ["L1", "L2", "L3"]).defaultTo("L1");
    t.enum("presence", [
      "online",
      "away",
      "busy",
      "offline",
      "on_break",
      "in_meeting",
      "dnd",
    ]).defaultTo("offline");
    t.timestamp("presence_changed_at").defaultTo(knex.fn.now());
    t.integer("capacity").defaultTo(10);
    t.string("timezone").defaultTo("");
    t.decimal("qa_score", 5, 2);
    t.jsonb("notification_prefs").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
    t.index("level");
    t.index("presence");
  });

  // Add forward ref: teams.leader_id -> agents
  await knex.schema.alterTable("teams", (t) => {
    t.uuid("leader_id").references("id").inTable("agents").onDelete("SET NULL");
  });
  // Add forward ref: departments.manager_id -> agents
  await knex.schema.alterTable("departments", (t) => {
    t.uuid("manager_id")
      .references("id")
      .inTable("agents")
      .onDelete("SET NULL");
  });
  // Add forward ref: companies.owner_id -> agents
  await knex.schema.alterTable("companies", (t) => {
    t.uuid("owner_id").references("id").inTable("agents").onDelete("SET NULL");
  });

  // ──────────────────────────────────────────────
  // 7. HELP TOPICS / PRIORITIES / SLA
  // ──────────────────────────────────────────────

  await knex.schema.createTable("sla_plans", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("name").notNullable();
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.text("description").defaultTo("");
    t.boolean("is_active").defaultTo(true);
    t.jsonb("conditions").defaultTo("[]");
    t.jsonb("sla_targets").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
  });

  // Add sla_id to departments
  await knex.schema.alterTable("departments", (t) => {
    t.uuid("sla_id").references("id").inTable("sla_plans").onDelete("SET NULL");
  });

  await knex.schema.createTable("priorities", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("name").notNullable();
    t.integer("priority_level").defaultTo(0);
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.boolean("is_active").defaultTo(true);
    t.string("color").defaultTo("");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("help_topics", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("name").notNullable();
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.uuid("parent_id")
      .references("id")
      .inTable("help_topics")
      .onDelete("SET NULL");
    t.uuid("department_id")
      .references("id")
      .inTable("departments")
      .onDelete("SET NULL");
    t.uuid("sla_id").references("id").inTable("sla_plans").onDelete("SET NULL");
    t.boolean("is_active").defaultTo(true);
    t.boolean("is_public").defaultTo(true);
    t.boolean("auto_response").defaultTo(false);
    t.boolean("priority_enabled").defaultTo(false);
    t.jsonb("custom_fields").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
  });

  // ──────────────────────────────────────────────
  // 8. TICKETS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("ticket_statuses", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("name").notNullable();
    t.string("state").defaultTo("open");
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.boolean("is_active").defaultTo(true);
    t.boolean("is_default").defaultTo(false);
    t.string("color").defaultTo("");
    t.integer("sort_order").defaultTo(0);
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("tickets", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.string("number").notNullable().unique();
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("SET NULL");
    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.uuid("created_by").references("id").inTable("users").onDelete("SET NULL");
    t.jsonb("collaborators").defaultTo("[]");
    t.jsonb("escalated_by").defaultTo("[]");
    t.jsonb("escalation_tiers_fired").defaultTo("[]");
    t.uuid("dept_id")
      .references("id")
      .inTable("departments")
      .onDelete("SET NULL");
    t.uuid("topic_id")
      .references("id")
      .inTable("help_topics")
      .onDelete("SET NULL");
    t.string("status").defaultTo("open");
    t.string("priority").defaultTo("Normal");
    t.enum("impact", ["low", "medium", "high"]);
    t.enum("urgency", ["low", "medium", "normal", "high", "critical"]);
    t.uuid("sla_id").references("id").inTable("sla_plans").onDelete("SET NULL");
    t.uuid("agent_id").references("id").inTable("agents").onDelete("SET NULL");
    t.uuid("team_id").references("id").inTable("teams").onDelete("SET NULL");
    t.string("subject").notNullable();
    t.enum("source", ["web", "email", "phone", "api"]).defaultTo("web");
    t.timestamp("due_date");
    t.boolean("is_overdue").defaultTo(false);
    t.timestamp("response_due_at");
    t.timestamp("response_met_at");
    t.boolean("response_breached").defaultTo(false);
    t.timestamp("resolution_due_at");
    t.timestamp("resolution_met_at");
    t.uuid("locked_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamp("locked_at");
    t.timestamp("lock_expires_at");
    t.timestamp("last_activity").defaultTo(knex.fn.now());
    t.timestamp("resolved_at");
    t.uuid("resolved_by")
      .references("id")
      .inTable("agents")
      .onDelete("SET NULL");
    t.jsonb("resolution").defaultTo("{}");
    t.timestamp("closed_at");
    t.uuid("closed_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamp("last_message_at");
    t.jsonb("custom_data").defaultTo("{}");
    t.jsonb("stats").defaultTo("{}");
    t.string("intent").defaultTo("");
    t.enum("sentiment", [
      "positive",
      "neutral",
      "negative",
      "frustrated",
    ]).defaultTo("neutral");
    t.string("language").defaultTo("");
    t.text("ai_summary").defaultTo("");
    t.jsonb("tags").defaultTo("[]");
    t.decimal("ai_risk", 5, 2);
    t.enum("complexity", ["low", "medium", "high"]).defaultTo("low");
    t.string("sla_type").defaultTo("first_response");
    t.timestamp("sla_started_at");
    t.boolean("sla_paused").defaultTo(false);
    t.timestamp("sla_paused_at");
    t.timestamp("sla_resume_at");
    t.enum("waiting_on", [
      "customer",
      "agent",
      "vendor",
      "approval",
      "none",
    ]).defaultTo("none");
    t.uuid("asset_id");
    t.uuid("conversation_id");
    t.timestamp("csat_sent_at");
    t.integer("csat_rating");
    t.text("csat_comment").defaultTo("");
    t.timestamps(true, true);
    t.index("company_id");
    t.index("user_id");
    t.index("created_by");
    t.index("status");
    t.index("priority");
    t.index("dept_id");
    t.index("agent_id");
    t.index("subject");
    t.index(["status", "updated_at"]);
    t.index(["dept_id", "status"]);
  });

  await knex.schema.createTable("ticket_threads", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("ticket_id")
      .notNullable()
      .references("id")
      .inTable("tickets")
      .onDelete("CASCADE");
    t.string("type").defaultTo("message");
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.uuid("agent_id").references("id").inTable("agents").onDelete("SET NULL");
    t.text("body").defaultTo("");
    t.jsonb("attachments").defaultTo("[]");
    t.boolean("is_internal").defaultTo(false);
    t.timestamps(true, true);
    t.index("ticket_id");
  });

  await knex.schema.createTable("ticket_filters", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("status").defaultTo("active");
    t.integer("sort_order").defaultTo(0);
    t.jsonb("conditions").defaultTo("[]");
    t.jsonb("actions").defaultTo("[]");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("ticket_links", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("ticket_id")
      .notNullable()
      .references("id")
      .inTable("tickets")
      .onDelete("CASCADE");
    t.uuid("linked_ticket_id")
      .notNullable()
      .references("id")
      .inTable("tickets")
      .onDelete("CASCADE");
    t.string("type").defaultTo("related");
    t.timestamps(true, true);
    t.unique(["ticket_id", "linked_ticket_id"]);
  });

  await knex.schema.createTable("ticket_forms", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.string("name").notNullable();
    t.boolean("is_active").defaultTo(true);
    t.jsonb("fields").defaultTo("[]");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("saved_queues", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.uuid("agent_id")
      .notNullable()
      .references("id")
      .inTable("agents")
      .onDelete("CASCADE");
    t.string("name").notNullable();
    t.jsonb("filters").defaultTo("{}");
    t.timestamps(true, true);
    t.unique(["agent_id", "name"]);
  });

  await knex.schema.createTable("ticket_templates", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("subject").defaultTo("");
    t.text("body").defaultTo("");
    t.string("category").defaultTo("General");
    t.string("priority").defaultTo("Normal");
    t.uuid("created_by")
      .references("id")
      .inTable("agents")
      .onDelete("SET NULL");
    t.timestamps(true, true);
    t.index(["company_id", "category"]);
  });

  // ──────────────────────────────────────────────
  // 9. TASKS (core engine)
  // ──────────────────────────────────────────────

  await knex.schema.createTable("tasks", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("tenant_id")
      .notNullable()
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.uuid("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.string("number").notNullable().unique();
    t.string("type").defaultTo("task");
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("state").defaultTo("new");
    t.string("priority").defaultTo("normal");
    t.uuid("opened_by").references("id").inTable("users").onDelete("SET NULL");
    t.uuid("requested_for")
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    t.uuid("assigned_to")
      .references("id")
      .inTable("agents")
      .onDelete("SET NULL");
    t.uuid("assignment_group_id")
      .references("id")
      .inTable("teams")
      .onDelete("SET NULL");
    t.uuid("parent_id").references("id").inTable("tasks").onDelete("SET NULL");
    t.timestamp("due_at");
    t.timestamp("closed_at");
    t.jsonb("custom_fields").defaultTo("{}");
    t.timestamps(true, true);
    t.index("tenant_id");
    t.index("company_id");
    t.index(["tenant_id", "state"]);
    t.index(["tenant_id", "assigned_to", "state"]);
  });

  await knex.schema.createTable("task_activities", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("task_id")
      .notNullable()
      .references("id")
      .inTable("tasks")
      .onDelete("CASCADE");
    t.uuid("tenant_id")
      .notNullable()
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.string("type").defaultTo("comment");
    t.text("body").defaultTo("");
    t.uuid("author_id").references("id").inTable("users").onDelete("SET NULL");
    t.boolean("is_internal").defaultTo(false);
    t.timestamps(true, true);
    t.index("task_id");
  });

  await knex.schema.createTable("task_assignments", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("task_id")
      .notNullable()
      .references("id")
      .inTable("tasks")
      .onDelete("CASCADE");
    t.uuid("tenant_id")
      .notNullable()
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.uuid("assigned_to")
      .references("id")
      .inTable("agents")
      .onDelete("SET NULL");
    t.uuid("assigned_by")
      .references("id")
      .inTable("agents")
      .onDelete("SET NULL");
    t.string("assignment_type").defaultTo("manual");
    t.timestamp("assigned_at").defaultTo(knex.fn.now());
    t.timestamps(true, true);
    t.index("task_id");
  });

  await knex.schema.createTable("task_attachments", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("task_id")
      .notNullable()
      .references("id")
      .inTable("tasks")
      .onDelete("CASCADE");
    t.uuid("tenant_id")
      .notNullable()
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.string("file_name").notNullable();
    t.string("content_type");
    t.bigInteger("size");
    t.string("storage_key");
    t.uuid("uploaded_by")
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("task_id");
  });

  await knex.schema.createTable("task_relationships", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("task_id")
      .notNullable()
      .references("id")
      .inTable("tasks")
      .onDelete("CASCADE");
    t.uuid("related_task_id")
      .notNullable()
      .references("id")
      .inTable("tasks")
      .onDelete("CASCADE");
    t.string("type").defaultTo("related");
    t.timestamps(true, true);
    t.unique(["task_id", "related_task_id"]);
  });

  await knex.schema.createTable("task_slas", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("task_id")
      .notNullable()
      .references("id")
      .inTable("tasks")
      .onDelete("CASCADE");
    t.uuid("tenant_id")
      .notNullable()
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.uuid("sla_plan_id")
      .references("id")
      .inTable("sla_plans")
      .onDelete("SET NULL");
    t.string("sla_type").defaultTo("resolution");
    t.timestamp("started_at");
    t.timestamp("due_at");
    t.timestamp("breached_at");
    t.string("status").defaultTo("active");
    t.timestamps(true, true);
    t.index("task_id");
  });

  await knex.schema.createTable("task_watchers", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(
      knex.raw("uuid_generate_v4()"),
    );
    t.uuid("task_id")
      .notNullable()
      .references("id")
      .inTable("tasks")
      .onDelete("CASCADE");
    t.uuid("tenant_id")
      .notNullable()
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");
    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["task_id", "user_id"]);
  });

  // ──────────────────────────────────────────────
  // 10. ITSM MODELS (concurrent placeholder tables)
  // ──────────────────────────────────────────────

  // We use a single large migration for clarity. The rest follows in part 2.
};

exports.down = async function (knex) {
  const tables = [
    "task_watchers",
    "task_slas",
    "task_relationships",
    "task_attachments",
    "task_assignments",
    "task_activities",
    "tasks",
    "ticket_templates",
    "saved_queues",
    "ticket_forms",
    "ticket_links",
    "ticket_filters",
    "ticket_threads",
    "tickets",
    "ticket_statuses",
    "help_topics",
    "priorities",
    "sla_plans",
    "departments",
    "teams",
    "roles",
    "organization_units",
    "organizations",
    "agents",
    "users",
    "companies",
    "super_admins",
    "plans",
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
};
