/**
 * Part 3: Knowledge, Catalog, SLM, Approvals, Assignment, On-Call, Walkup,
 * Release, Improvement, Outage, Workflows, Notifications, Audit, System,
 * Surveys, Assets, ITOM, Conversations, Locale, Instance, etc.
 */

exports.up = async function (knex) {
  // ──────────────────────────────────────────────
  // SLM
  // ──────────────────────────────────────────────

  await knex.schema.createTable("business_schedules", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.jsonb("schedule").defaultTo("{}");
    t.boolean("is_default").defaultTo(false);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("holiday_calendars", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.jsonb("holidays").defaultTo("[]");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("olas", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.uuid("sla_plan_id").references("id").inTable("sla_plans").onDelete("SET NULL");
    t.uuid("team_id").references("id").inTable("teams").onDelete("SET NULL");
    t.jsonb("targets").defaultTo("{}");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("sla_breakdowns", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("ticket_id").references("id").inTable("tickets").onDelete("CASCADE");
    t.string("phase").defaultTo("");
    t.timestamp("started_at");
    t.timestamp("ended_at");
    t.bigInteger("duration_ms").defaultTo(0);
    t.timestamps(true, true);
    t.index("ticket_id");
  });

  await knex.schema.createTable("sla_conditions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("sla_plan_id").notNullable().references("id").inTable("sla_plans").onDelete("CASCADE");
    t.string("field").notNullable();
    t.string("operator").defaultTo("equals");
    t.jsonb("value");
    t.timestamps(true, true);
    t.index("sla_plan_id");
  });

  await knex.schema.createTable("sla_repair_jobs", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("ticket_id").references("id").inTable("tickets").onDelete("CASCADE");
    t.string("status").defaultTo("pending");
    t.text("reason").defaultTo("");
    t.jsonb("changes").defaultTo("[]");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("underpinning_contract_targets", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.jsonb("targets").defaultTo("{}");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("sla_events", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.enum("level", ["platform", "tenant"]).notNullable();
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("ticket_id").references("id").inTable("tickets").onDelete("SET NULL");
    t.uuid("policy_id");
    t.string("policy_model").defaultTo("SlaPlan");
    t.string("service").notNullable();
    t.string("clock").defaultTo("");
    t.enum("event", ["started", "warning", "paused", "resumed", "met", "breached", "stopped", "measurement"]).notNullable();
    t.string("priority").defaultTo("");
    t.timestamp("occurred_at").defaultTo(knex.fn.now());
    t.timestamp("started_at");
    t.timestamp("due_at");
    t.timestamp("completed_at");
    t.bigInteger("paused_duration_ms").defaultTo(0);
    t.bigInteger("duration_ms");
    t.decimal("target", 12, 2);
    t.decimal("actual", 12, 2);
    t.string("unit").defaultTo("");
    t.text("reason").defaultTo("");
    t.jsonb("metadata").defaultTo("{}");
    t.string("actor_type").defaultTo("system");
    t.uuid("actor_id");
    t.timestamps(true, true);
    t.index("company_id");
    t.index("ticket_id");
    t.index(["level", "company_id", "occurred_at"]);
  });

  // ──────────────────────────────────────────────
  // APPROVALS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("approval_definitions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.string("entity_type").defaultTo("ticket");
    t.jsonb("steps").defaultTo("[]");
    t.enum("mode", ["sequential", "parallel"]).defaultTo("sequential");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("approval_instances", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("entity_type").notNullable();
    t.uuid("entity_id").notNullable();
    t.uuid("definition_id").references("id").inTable("approval_definitions").onDelete("SET NULL");
    t.enum("mode", ["sequential", "parallel"]).defaultTo("sequential");
    t.enum("status", ["pending", "approved", "rejected", "expired", "cancelled", "skipped"]).defaultTo("pending");
    t.enum("result", ["approved", "rejected", "escalated", "timeout"]);
    t.integer("current_step").defaultTo(0);
    t.integer("total_steps").defaultTo(0);
    t.integer("required_approvals").defaultTo(1);
    t.integer("approval_count").defaultTo(0);
    t.integer("rejection_count").defaultTo(0);
    t.decimal("auto_approve_after_hours", 8, 2);
    t.decimal("escalation_after_hours", 8, 2);
    t.uuid("escalate_to");
    t.enum("sla_impact", ["none", "pause", "reset"]).defaultTo("none");
    t.timestamp("due_at");
    t.jsonb("metadata").defaultTo("{}");
    t.timestamps(true, true);
    t.index("tenant_id");
    t.index(["tenant_id", "entity_id", "entity_type"]);
    t.index(["tenant_id", "status", "due_at"]);
  });

  await knex.schema.createTable("approval_steps", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("instance_id").notNullable().references("id").inTable("approval_instances").onDelete("CASCADE");
    t.integer("step_order").defaultTo(1);
    t.string("name").defaultTo("");
    t.enum("mode", ["approve", "reject", "acknowledge"]).defaultTo("approve");
    t.enum("status", ["pending", "approved", "rejected", "skipped", "expired"]).defaultTo("pending");
    t.integer("required_approvals").defaultTo(1);
    t.integer("current_approvals").defaultTo(0);
    t.uuid("escalate_to");
    t.decimal("escalation_after_hours", 8, 2);
    t.timestamps(true, true);
    t.index("instance_id");
  });

  await knex.schema.createTable("approval_decisions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("step_id").notNullable().references("id").inTable("approval_steps").onDelete("CASCADE");
    t.uuid("approver_id").references("id").inTable("users").onDelete("SET NULL");
    t.string("approver_name").defaultTo("");
    t.enum("decision", ["approved", "rejected", "delegated", "expired"]).defaultTo("approved");
    t.text("comment").defaultTo("");
    t.uuid("delegated_to");
    t.timestamps(true, true);
    t.index("step_id");
  });

  await knex.schema.createTable("approvers", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("step_id").notNullable().references("id").inTable("approval_steps").onDelete("CASCADE");
    t.string("approver_type").defaultTo("user");
    t.uuid("approver_id").notNullable();
    t.timestamps(true, true);
    t.index("step_id");
  });

  await knex.schema.createTable("delegations", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("delegator_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.uuid("delegate_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.timestamp("from_date");
    t.timestamp("to_date");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("delegator_id");
  });

  // ──────────────────────────────────────────────
  // CATALOG
  // ──────────────────────────────────────────────

  await knex.schema.createTable("catalogs", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.boolean("is_active").defaultTo(true);
    t.string("icon").defaultTo("");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("catalog_categories", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("catalog_id").notNullable().references("id").inTable("catalogs").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.uuid("parent_id").references("id").inTable("catalog_categories").onDelete("SET NULL");
    t.boolean("is_active").defaultTo(true);
    t.integer("sort_order").defaultTo(0);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("catalog_items", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("category_id").references("id").inTable("catalog_categories").onDelete("SET NULL");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.string("icon").defaultTo("");
    t.decimal("price", 12, 2).defaultTo(0);
    t.string("currency", 10).defaultTo("INR");
    t.enum("pricing_model", ["fixed", "per_user", "per_ticket"]).defaultTo("fixed");
    t.boolean("requires_approval").defaultTo(false);
    t.boolean("is_active").defaultTo(true);
    t.uuid("sla_plan_id").references("id").inTable("sla_plans").onDelete("SET NULL");
    t.jsonb("fulfillment_config").defaultTo("{}");
    t.jsonb("variables").defaultTo("[]");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("catalog_item_variables", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("item_id").notNullable().references("id").inTable("catalog_items").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("label").notNullable();
    t.string("type").defaultTo("text");
    t.boolean("required").defaultTo(false);
    t.jsonb("options").defaultTo("[]");
    t.string("placeholder").defaultTo("");
    t.jsonb("default_value");
    t.integer("sort_order").defaultTo(0);
    t.timestamps(true, true);
    t.index("item_id");
  });

  await knex.schema.createTable("catalog_tasks", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("item_id").notNullable().references("id").inTable("catalog_items").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("pending");
    t.integer("sort_order").defaultTo(0);
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.uuid("assignment_group_id").references("id").inTable("teams").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("item_id");
  });

  await knex.schema.createTable("catalog_entitlements", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("item_id").notNullable().references("id").inTable("catalog_items").onDelete("CASCADE");
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.boolean("is_entitled").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("carts", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("status").defaultTo("active");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("cart_items", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("cart_id").notNullable().references("id").inTable("carts").onDelete("CASCADE");
    t.uuid("item_id").notNullable().references("id").inTable("catalog_items").onDelete("CASCADE");
    t.integer("quantity").defaultTo(1);
    t.jsonb("variables").defaultTo("{}");
    t.timestamps(true, true);
    t.index("cart_id");
  });

  await knex.schema.createTable("requests", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("number").notNullable().unique();
    t.uuid("requested_for").references("id").inTable("users").onDelete("SET NULL");
    t.uuid("requested_by").references("id").inTable("users").onDelete("SET NULL");
    t.string("status").defaultTo("pending");
    t.string("stage").defaultTo("request");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("requested_items", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("request_id").notNullable().references("id").inTable("requests").onDelete("CASCADE");
    t.uuid("item_id").notNullable().references("id").inTable("catalog_items").onDelete("CASCADE");
    t.string("number").notNullable().unique();
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("pending");
    t.jsonb("variables").defaultTo("{}");
    t.decimal("price", 12, 2).defaultTo(0);
    t.timestamps(true, true);
    t.index("request_id");
  });

  await knex.schema.createTable("request_approvals", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("requested_item_id").notNullable().references("id").inTable("requested_items").onDelete("CASCADE");
    t.string("name").notNullable();
    t.enum("mode", ["sequential", "parallel"]).defaultTo("sequential");
    t.string("status").defaultTo("pending");
    t.timestamps(true, true);
    t.index("requested_item_id");
  });

  await knex.schema.createTable("item_approvals", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("request_approval_id").notNullable().references("id").inTable("request_approvals").onDelete("CASCADE");
    t.integer("step_order").defaultTo(1);
    t.uuid("approver_id").references("id").inTable("users").onDelete("SET NULL");
    t.string("approver_name").defaultTo("");
    t.string("status").defaultTo("pending");
    t.string("decision").defaultTo("");
    t.text("comment").defaultTo("");
    t.timestamps(true, true);
    t.index("request_approval_id");
  });

  await knex.schema.createTable("fulfillment_plans", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("item_id").references("id").inTable("catalog_items").onDelete("CASCADE");
    t.string("name").notNullable();
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("fulfillment_steps", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("plan_id").notNullable().references("id").inTable("fulfillment_plans").onDelete("CASCADE");
    t.string("name").notNullable();
    t.integer("step_order").defaultTo(1);
    t.string("type").defaultTo("manual");
    t.jsonb("config").defaultTo("{}");
    t.jsonb("conditions").defaultTo("[]");
    t.timestamps(true, true);
    t.index("plan_id");
  });

  await knex.schema.createTable("user_criteria", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("entity_id").notNullable();
    t.string("entity_type").notNullable();
    t.string("criteria_type").defaultTo("include");
    t.jsonb("rules").defaultTo("[]");
    t.timestamps(true, true);
    t.index("entity_type");
  });

  await knex.schema.createTable("variable_sets", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  // ──────────────────────────────────────────────
  // KNOWLEDGE BASE
  // ──────────────────────────────────────────────

  await knex.schema.createTable("knowledge_bases", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.boolean("is_active").defaultTo(true);
    t.enum("visibility", ["public", "internal", "private"]).defaultTo("public");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("faq_categories", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.uuid("parent_id").references("id").inTable("faq_categories").onDelete("SET NULL");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("faqs", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("knowledge_base_id").references("id").inTable("knowledge_bases").onDelete("SET NULL");
    t.uuid("category_id").references("id").inTable("faq_categories").onDelete("SET NULL");
    t.string("title").notNullable();
    t.text("question").defaultTo("");
    t.text("answer").defaultTo("");
    t.text("keywords").defaultTo("");
    t.string("status").defaultTo("draft");
    t.boolean("is_internal").defaultTo(false);
    t.integer("view_count").defaultTo(0);
    t.integer("helpful_count").defaultTo(0);
    t.integer("not_helpful_count").defaultTo(0);
    t.decimal("rating", 3, 2).defaultTo(0);
    t.uuid("published_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamp("published_at");
    t.timestamps(true, true);
    t.index("tenant_id");
    t.index("status");
  });

  await knex.schema.createTable("knowledge_comments", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("faq_id").notNullable().references("id").inTable("faqs").onDelete("CASCADE");
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.text("body").defaultTo("");
    t.string("status").defaultTo("pending");
    t.timestamps(true, true);
    t.index("faq_id");
  });

  await knex.schema.createTable("knowledge_contributor_criteria", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("faq_id").notNullable().references("id").inTable("faqs").onDelete("CASCADE");
    t.jsonb("rules").defaultTo("[]");
    t.timestamps(true, true);
    t.index("faq_id");
  });

  await knex.schema.createTable("knowledge_feedback", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("faq_id").notNullable().references("id").inTable("faqs").onDelete("CASCADE");
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.string("type").defaultTo("helpful");
    t.text("comment").defaultTo("");
    t.timestamps(true, true);
    t.index("faq_id");
  });

  await knex.schema.createTable("knowledge_ratings", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("faq_id").notNullable().references("id").inTable("faqs").onDelete("CASCADE");
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.integer("rating").notNullable();
    t.timestamps(true, true);
    t.unique(["faq_id", "user_id"]);
  });

  await knex.schema.createTable("knowledge_reader_criteria", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("faq_id").notNullable().references("id").inTable("faqs").onDelete("CASCADE");
    t.jsonb("rules").defaultTo("[]");
    t.timestamps(true, true);
    t.index("faq_id");
  });

  await knex.schema.createTable("knowledge_versions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("faq_id").notNullable().references("id").inTable("faqs").onDelete("CASCADE");
    t.integer("version").notNullable();
    t.string("title").notNullable();
    t.text("question").defaultTo("");
    t.text("answer").defaultTo("");
    t.uuid("created_by").references("id").inTable("users").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("faq_id");
  });

  await knex.schema.createTable("knowledge_approvals", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("faq_id").notNullable().references("id").inTable("faqs").onDelete("CASCADE");
    t.uuid("approver_id").references("id").inTable("agents").onDelete("SET NULL");
    t.string("status").defaultTo("pending");
    t.text("comment").defaultTo("");
    t.timestamps(true, true);
    t.index("faq_id");
  });

  await knex.schema.createTable("canned_responses", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("body").defaultTo("");
    t.string("category").defaultTo("");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("announcements", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("title").notNullable();
    t.text("body").defaultTo("");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  // ──────────────────────────────────────────────
  // ASSIGNMENT / ROUTING
  // ──────────────────────────────────────────────

  await knex.schema.createTable("skills", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("agent_skills", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("agent_id").notNullable().references("id").inTable("agents").onDelete("CASCADE");
    t.uuid("skill_id").notNullable().references("id").inTable("skills").onDelete("CASCADE");
    t.integer("proficiency").defaultTo(1);
    t.timestamps(true, true);
    t.unique(["agent_id", "skill_id"]);
  });

  await knex.schema.createTable("agent_capacities", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("agent_id").notNullable().references("id").inTable("agents").onDelete("CASCADE");
    t.integer("max_capacity").defaultTo(10);
    t.integer("current_load").defaultTo(0);
    t.timestamps(true, true);
    t.unique(["tenant_id", "agent_id"]);
  });

  await knex.schema.createTable("agent_presences", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("agent_id").notNullable().references("id").inTable("agents").onDelete("CASCADE");
    t.string("status").defaultTo("offline");
    t.timestamp("changed_at").defaultTo(knex.fn.now());
    t.timestamps(true, true);
    t.unique(["tenant_id", "agent_id"]);
  });

  await knex.schema.createTable("assignment_rules", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("entity_type").defaultTo("ticket");
    t.jsonb("conditions").defaultTo("[]");
    t.jsonb("actions").defaultTo("[]");
    t.integer("priority").defaultTo(0);
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("assignment_events", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("entity_id").notNullable();
    t.string("entity_type").defaultTo("ticket");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.uuid("assigned_by").references("id").inTable("agents").onDelete("SET NULL");
    t.string("method").defaultTo("manual");
    t.jsonb("metadata").defaultTo("{}");
    t.timestamps(true, true);
    t.index("tenant_id");
    t.index("entity_id");
  });

  await knex.schema.createTable("queues", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.jsonb("routing_config").defaultTo("{}");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("routing_rules", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("queue_id").references("id").inTable("queues").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("channel").defaultTo("web");
    t.jsonb("conditions").defaultTo("[]");
    t.jsonb("actions").defaultTo("[]");
    t.integer("priority").defaultTo(0);
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  // ──────────────────────────────────────────────
  // ON-CALL
  // ──────────────────────────────────────────────

  await knex.schema.createTable("oncall_schedules", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("rosters", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("schedule_id").notNullable().references("id").inTable("oncall_schedules").onDelete("CASCADE");
    t.string("name").notNullable();
    t.timestamp("start_date");
    t.timestamp("end_date");
    t.timestamps(true, true);
    t.index("schedule_id");
  });

  await knex.schema.createTable("roster_members", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("roster_id").notNullable().references("id").inTable("rosters").onDelete("CASCADE");
    t.uuid("agent_id").notNullable().references("id").inTable("agents").onDelete("CASCADE");
    t.timestamps(true, true);
    t.index("roster_id");
  });

  await knex.schema.createTable("rotations", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("schedule_id").notNullable().references("id").inTable("oncall_schedules").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("pattern").defaultTo("weekly");
    t.timestamps(true, true);
    t.index("schedule_id");
  });

  await knex.schema.createTable("shifts", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("rotation_id").notNullable().references("id").inTable("rotations").onDelete("CASCADE");
    t.string("name").notNullable();
    t.time("start_time");
    t.time("end_time");
    t.jsonb("days").defaultTo("[]");
    t.timestamps(true, true);
    t.index("rotation_id");
  });

  await knex.schema.createTable("escalation_levels", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.integer("level_order").defaultTo(1);
    t.decimal("timeout_minutes", 8, 2).defaultTo(30);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("oncall_escalation_policies", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("schedule_id").references("id").inTable("oncall_schedules").onDelete("CASCADE");
    t.string("name").notNullable();
    t.jsonb("levels").defaultTo("[]");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("contact_preferences", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("agent_id").notNullable().references("id").inTable("agents").onDelete("CASCADE");
    t.jsonb("preferences").defaultTo("{}");
    t.timestamps(true, true);
    t.unique(["tenant_id", "agent_id"]);
  });

  await knex.schema.createTable("coverage_requests", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("requester_id").notNullable().references("id").inTable("agents").onDelete("CASCADE");
    t.uuid("coverage_agent_id").references("id").inTable("agents").onDelete("SET NULL");
    t.string("type").defaultTo("swap");
    t.timestamp("start_time");
    t.timestamp("end_time");
    t.string("status").defaultTo("pending");
    t.text("reason").defaultTo("");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("time_off_requests", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("agent_id").notNullable().references("id").inTable("agents").onDelete("CASCADE");
    t.timestamp("start_date");
    t.timestamp("end_date");
    t.string("status").defaultTo("pending");
    t.text("reason").defaultTo("");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  // ──────────────────────────────────────────────
  // WALKUP
  // ──────────────────────────────────────────────

  await knex.schema.createTable("walkup_locations", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("address").defaultTo("");
    t.string("phone").defaultTo("");
    t.jsonb("hours").defaultTo("{}");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("walkup_queues", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("location_id").references("id").inTable("walkup_locations").onDelete("CASCADE");
    t.string("name").notNullable();
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("walkup_services", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("location_id").references("id").inTable("walkup_locations").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.decimal("estimated_minutes", 8, 2).defaultTo(30);
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("walkup_checkins", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("location_id").references("id").inTable("walkup_locations").onDelete("SET NULL");
    t.uuid("queue_id").references("id").inTable("walkup_queues").onDelete("SET NULL");
    t.uuid("service_id").references("id").inTable("walkup_services").onDelete("SET NULL");
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.uuid("ticket_id").references("id").inTable("tickets").onDelete("SET NULL");
    t.string("status").defaultTo("waiting");
    t.string("priority").defaultTo("normal");
    t.integer("queue_position");
    t.timestamp("checked_in_at").defaultTo(knex.fn.now());
    t.timestamp("served_at");
    t.timestamp("completed_at");
    t.uuid("served_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("walkup_interactions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("checkin_id").references("id").inTable("walkup_checkins").onDelete("SET NULL");
    t.uuid("agent_id").references("id").inTable("agents").onDelete("SET NULL");
    t.text("notes").defaultTo("");
    t.string("resolution").defaultTo("");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("appointments", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("location_id").references("id").inTable("walkup_locations").onDelete("SET NULL");
    t.uuid("service_id").references("id").inTable("walkup_services").onDelete("SET NULL");
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.uuid("agent_id").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamp("appointment_time");
    t.integer("duration_minutes").defaultTo(30);
    t.string("status").defaultTo("scheduled");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("kiosks", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("location_id").references("id").inTable("walkup_locations").onDelete("SET NULL");
    t.string("name").notNullable();
    t.string("device_id").notNullable();
    t.string("status").defaultTo("active");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("wait_time_events", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("checkin_id").references("id").inTable("walkup_checkins").onDelete("SET NULL");
    t.string("event_type").notNullable();
    t.bigInteger("wait_time_ms").defaultTo(0);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  // ──────────────────────────────────────────────
  // RELEASE MANAGEMENT
  // ──────────────────────────────────────────────

  await knex.schema.createTable("releases", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("number").notNullable().unique();
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.enum("type", ["standard", "normal", "emergency"]).defaultTo("normal");
    t.string("status").defaultTo("planning");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamp("planned_date");
    t.timestamp("actual_date");
    t.boolean("rollback_supported").defaultTo(true);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("release_approvals", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("release_id").notNullable().references("id").inTable("releases").onDelete("CASCADE");
    t.uuid("approver_id").references("id").inTable("agents").onDelete("SET NULL");
    t.string("status").defaultTo("pending");
    t.text("comment").defaultTo("");
    t.timestamps(true, true);
    t.index("release_id");
  });

  await knex.schema.createTable("release_components", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("release_id").notNullable().references("id").inTable("releases").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("version").defaultTo("");
    t.string("build_number").defaultTo("");
    t.timestamps(true, true);
    t.index("release_id");
  });

  await knex.schema.createTable("release_dependencies", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("release_id").notNullable().references("id").inTable("releases").onDelete("CASCADE");
    t.uuid("depends_on_release_id").references("id").inTable("releases").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["release_id", "depends_on_release_id"]);
  });

  await knex.schema.createTable("release_deployments", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("release_id").notNullable().references("id").inTable("releases").onDelete("CASCADE");
    t.string("environment").defaultTo("production");
    t.string("status").defaultTo("pending");
    t.timestamp("started_at");
    t.timestamp("completed_at");
    t.jsonb("pre_checks").defaultTo("[]");
    t.jsonb("post_checks").defaultTo("[]");
    t.timestamps(true, true);
    t.index("release_id");
  });

  await knex.schema.createTable("release_phases", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("release_id").notNullable().references("id").inTable("releases").onDelete("CASCADE");
    t.string("name").notNullable();
    t.integer("phase_order").defaultTo(1);
    t.string("status").defaultTo("pending");
    t.timestamps(true, true);
    t.index("release_id");
  });

  await knex.schema.createTable("release_tasks", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("release_id").notNullable().references("id").inTable("releases").onDelete("CASCADE");
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("pending");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("release_id");
  });

  // ──────────────────────────────────────────────
  // IMPROVEMENT
  // ──────────────────────────────────────────────

  await knex.schema.createTable("improvement_initiatives", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("proposed");
    t.uuid("owner_id").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamp("start_date");
    t.timestamp("end_date");
    t.jsonb("benefits").defaultTo("[]");
    t.jsonb("costs").defaultTo("[]");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("improvement_opportunities", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("initiative_id").references("id").inTable("improvement_initiatives").onDelete("SET NULL");
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("source").defaultTo("");
    t.string("status").defaultTo("identified");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("improvement_goals", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.string("metric").defaultTo("");
    t.decimal("target_value", 12, 2);
    t.string("unit").defaultTo("");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("improvement_tasks", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("initiative_id").references("id").inTable("improvement_initiatives").onDelete("SET NULL");
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("pending");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("benefits", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("initiative_id").notNullable().references("id").inTable("improvement_initiatives").onDelete("CASCADE");
    t.string("type").defaultTo("financial");
    t.string("description").defaultTo("");
    t.decimal("value", 12, 2).defaultTo(0);
    t.timestamps(true, true);
    t.index("initiative_id");
  });

  await knex.schema.createTable("costs", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("initiative_id").notNullable().references("id").inTable("improvement_initiatives").onDelete("CASCADE");
    t.string("category").defaultTo("operational");
    t.string("description").defaultTo("");
    t.decimal("amount", 12, 2).defaultTo(0);
    t.timestamps(true, true);
    t.index("initiative_id");
  });

  await knex.schema.createTable("metric_baselines", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("metric").notNullable();
    t.decimal("value", 12, 2);
    t.string("unit").defaultTo("");
    t.timestamp("measured_at").defaultTo(knex.fn.now());
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("metric_targets", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("goal_id").references("id").inTable("improvement_goals").onDelete("SET NULL");
    t.string("metric").notNullable();
    t.decimal("target_value", 12, 2);
    t.string("unit").defaultTo("");
    t.timestamp("target_date");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  // ──────────────────────────────────────────────
  // OUTAGE / AVAILABILITY
  // ──────────────────────────────────────────────

  await knex.schema.createTable("outages", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.enum("severity", ["critical", "major", "minor"]).defaultTo("major");
    t.string("status").defaultTo("investigating");
    t.timestamp("started_at").defaultTo(knex.fn.now());
    t.timestamp("resolved_at");
    t.jsonb("communication_plan").defaultTo("{}");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("outage_cis", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("outage_id").notNullable().references("id").inTable("outages").onDelete("CASCADE");
    t.uuid("ci_id").notNullable().references("id").inTable("configuration_items").onDelete("CASCADE");
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["outage_id", "ci_id"]);
  });

  await knex.schema.createTable("outage_services", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("outage_id").notNullable().references("id").inTable("outages").onDelete("CASCADE");
    t.uuid("service_id").notNullable().references("id").inTable("business_services").onDelete("CASCADE");
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["outage_id", "service_id"]);
  });

  await knex.schema.createTable("availability_records", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("service_id").references("id").inTable("business_services").onDelete("SET NULL");
    t.string("period").notNullable();
    t.decimal("availability_pct", 5, 2);
    t.bigInteger("downtime_ms").defaultTo(0);
    t.bigInteger("uptime_ms").defaultTo(0);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  // ──────────────────────────────────────────────
  // WORKFLOWS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("workflows", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.boolean("is_active").defaultTo(true);
    t.string("event").notNullable();
    t.jsonb("trigger_filters").defaultTo("{}");
    t.jsonb("conditions").defaultTo("[]");
    t.jsonb("actions").defaultTo("[]");
    t.integer("run_count").defaultTo(0);
    t.timestamp("last_run_at");
    t.uuid("created_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index(["company_id", "event", "is_active"]);
  });

  // ──────────────────────────────────────────────
  // NOTIFICATIONS / EMAIL
  // ──────────────────────────────────────────────

  await knex.schema.createTable("email_templates", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("key").notNullable();
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.string("subject").notNullable();
    t.text("body").notNullable();
    t.string("trigger");
    t.string("recipient").defaultTo("user");
    t.boolean("is_active").defaultTo(true);
    t.string("context").defaultTo("ticket");
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.index("trigger");
    t.index("company_id");
  });

  await knex.schema.createTable("email_logs", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("to").notNullable();
    t.string("from").defaultTo("");
    t.string("subject").defaultTo("");
    t.text("body").defaultTo("");
    t.string("event").defaultTo("general");
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("ticket_id").references("id").inTable("tickets").onDelete("SET NULL");
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.enum("status", ["sent", "queued", "failed", "processed"]).defaultTo("queued");
    t.text("error").defaultTo("");
    t.jsonb("meta").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("notifications", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.enum("recipient_type", ["agent", "user", "superadmin"]).notNullable();
    t.uuid("recipient_id").notNullable();
    t.enum("type", [
      "new_ticket", "reply", "assignment", "transfer", "overdue", "system",
      "status_change", "company_created", "company_updated", "company_status_changed",
      "company_plan_changed", "company_deleted", "payment_received", "invoice_paid",
      "trial_ending", "plan_created", "plan_updated", "account_created", "mention",
      "sla_paused", "sla_resumed", "merged", "split",
    ]).defaultTo("system");
    t.text("message").notNullable();
    t.string("link").defaultTo("");
    t.uuid("ticket_id").references("id").inTable("tickets").onDelete("SET NULL");
    t.boolean("read").defaultTo(false);
    t.timestamps(true, true);
    t.index("recipient_id");
    t.index(["recipient_id", "read"]);
  });

  await knex.schema.createTable("notification_events", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("event_type").notNullable();
    t.jsonb("recipients").defaultTo("[]");
    t.jsonb("payload").defaultTo("{}");
    t.string("status").defaultTo("pending");
    t.text("error").defaultTo("");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  // ──────────────────────────────────────────────
  // AUDIT / LOGGING
  // ──────────────────────────────────────────────

  await knex.schema.createTable("audit_logs", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("super_admin_id").references("id").inTable("super_admins").onDelete("SET NULL");
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.string("action").notNullable();
    t.string("entity_type").defaultTo("");
    t.string("entity_id").defaultTo("");
    t.jsonb("details").defaultTo("{}");
    t.string("ip").defaultTo("");
    t.string("user_agent").defaultTo("");
    t.timestamps(true, true);
    t.index("company_id");
    t.index("action");
    t.index("created_at");
  });

  await knex.schema.createTable("audit_events", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("actor_id").references("id").inTable("users").onDelete("SET NULL");
    t.string("resource_type").notNullable();
    t.uuid("resource_id").notNullable();
    t.string("action").notNullable();
    t.jsonb("old_values").defaultTo("{}");
    t.jsonb("new_values").defaultTo("{}");
    t.string("ip").defaultTo("");
    t.string("user_agent").defaultTo("");
    t.string("correlation_id");
    t.timestamps(true, true);
    t.index("tenant_id");
    t.index(["resource_type", "resource_id"]);
    t.index("created_at");
  });

  // ──────────────────────────────────────────────
  // SYSTEM / CONFIG / PLATFORM
  // ──────────────────────────────────────────────

  await knex.schema.createTable("system_settings", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("key").notNullable().unique();
    t.jsonb("value");
    t.timestamps(true, true);
  });

  await knex.schema.createTable("counters", (t) => {
    t.string("id", { primaryKey: true });
    t.integer("seq").defaultTo(0);
    t.timestamps(true, true);
  });

  await knex.schema.createTable("api_keys", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("name").notNullable();
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.string("key_hash").notNullable();
    t.string("key_prefix").notNullable();
    t.jsonb("scopes").defaultTo('["tickets:read","tickets:write"]');
    t.uuid("created_by").references("id").inTable("agents").onDelete("SET NULL");
    t.boolean("is_active").defaultTo(true);
    t.timestamp("expires_at");
    t.timestamp("last_used_at");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("webhooks", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("name").notNullable();
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.string("url").notNullable();
    t.string("secret").defaultTo("");
    t.jsonb("events").defaultTo('["ticket.created"]');
    t.enum("format", ["generic", "slack", "teams"]).defaultTo("generic");
    t.boolean("is_active").defaultTo(true);
    t.timestamp("last_delivery_at");
    t.string("last_status").defaultTo("");
    t.integer("failure_count").defaultTo(0);
    t.jsonb("delivery_logs").defaultTo("[]");
    t.uuid("created_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index(["company_id", "is_active"]);
  });

  await knex.schema.createTable("integrations", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("key").notNullable();
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.enum("category", ["chat", "email", "phone", "messaging", "authentication", "automation", "other"]).defaultTo("other");
    t.string("icon").defaultTo("");
    t.boolean("is_enabled").defaultTo(false);
    t.jsonb("config").defaultTo("{}");
    t.jsonb("events").defaultTo("[]");
    t.timestamp("last_delivery_at");
    t.string("last_status").defaultTo("");
    t.integer("failure_count").defaultTo(0);
    t.jsonb("delivery_logs").defaultTo("[]");
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["company_id", "key"]);
  });

  await knex.schema.createTable("custom_fields", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("name").notNullable();
    t.string("label").notNullable();
    t.enum("type", ["text", "textarea", "select", "checkbox", "date", "number"]).defaultTo("text");
    t.boolean("required").defaultTo(false);
    t.jsonb("options").defaultTo("[]");
    t.string("placeholder").defaultTo("");
    t.jsonb("conditions").defaultTo("[]");
    t.uuid("help_topic_id").references("id").inTable("help_topics").onDelete("SET NULL");
    t.boolean("is_active").defaultTo(true);
    t.integer("sort_order").defaultTo(0);
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["company_id", "name"]);
  });

  await knex.schema.createTable("custom_roles", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("key").notNullable();
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.string("module").defaultTo("itsm");
    t.jsonb("permissions").defaultTo("[]");
    t.jsonb("denied_permissions").defaultTo("[]");
    t.jsonb("record_scopes").defaultTo("[]");
    t.jsonb("field_access").defaultTo("[]");
    t.jsonb("agent_members").defaultTo("[]");
    t.jsonb("team_members").defaultTo("[]");
    t.timestamp("effective_from");
    t.timestamp("effective_until");
    t.enum("status", ["active", "disabled"]).defaultTo("active");
    t.boolean("system_defined").defaultTo(false);
    t.uuid("created_by").references("id").inTable("agents").onDelete("SET NULL");
    t.uuid("updated_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.unique(["company_id", "key"]);
    t.index("status");
  });

  await knex.schema.createTable("custom_permissions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.string("key").notNullable();
    t.string("name").notNullable();
    t.jsonb("definition").defaultTo("{}");
    t.enum("status", ["active", "disabled"]).defaultTo("active");
    t.timestamps(true, true);
    t.index("company_id");
  });

  // ──────────────────────────────────────────────
  // SURVEYS / CSAT
  // ──────────────────────────────────────────────

  await knex.schema.createTable("surveys", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("type").defaultTo("csat");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("survey_responses", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("survey_id").notNullable().references("id").inTable("surveys").onDelete("CASCADE");
    t.uuid("ticket_id").references("id").inTable("tickets").onDelete("SET NULL");
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.integer("rating").notNullable();
    t.text("comment").defaultTo("");
    t.timestamp("responded_at").defaultTo(knex.fn.now());
    t.timestamps(true, true);
    t.index("company_id");
  });

  // ──────────────────────────────────────────────
  // ASSETS / ITOM
  // ──────────────────────────────────────────────

  await knex.schema.createTable("assets", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("serial").defaultTo("");
    t.string("ip").defaultTo("");
    t.string("hostname").defaultTo("");
    t.string("type").defaultTo("hardware");
    t.string("environment").defaultTo("");
    t.string("location").defaultTo("");
    t.string("status").defaultTo("active");
    t.timestamps(true, true);
    t.index("company_id");
  });

  // Add ticket.asset_id FK now that assets table exists
  await knex.schema.alterTable("tickets", (t) => {
    t.uuid("asset_id").references("id").inTable("assets").onDelete("SET NULL").alter();
  });

  await knex.schema.createTable("itom_alerts", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.string("title").notNullable();
    t.enum("severity", ["critical", "major", "minor", "info"]).defaultTo("major");
    t.enum("status", ["firing", "acknowledged", "resolved"]).defaultTo("firing");
    t.string("source").defaultTo("");
    t.uuid("resource_id").references("id").inTable("assets").onDelete("SET NULL");
    t.integer("count").defaultTo(1);
    t.timestamp("fired_at").defaultTo(knex.fn.now());
    t.timestamp("resolved_at");
    t.timestamps(true, true);
    t.index(["company_id", "status", "severity"]);
  });

  // ──────────────────────────────────────────────
  // CONVERSATIONS / CHAT
  // ──────────────────────────────────────────────

  await knex.schema.createTable("conversations", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.string("channel").defaultTo("chat");
    t.string("guest_name").defaultTo("");
    t.string("guest_email").defaultTo("");
    t.string("guest_phone").defaultTo("");
    t.string("subject").defaultTo("");
    t.string("status").defaultTo("open");
    t.timestamps(true, true);
    t.index("company_id");
  });

  // Add forward ref: tickets.conversation_id -> conversations
  await knex.schema.alterTable("tickets", (t) => {
    t.foreign("conversation_id").references("id").inTable("conversations").onDelete("SET NULL");
  });

  await knex.schema.createTable("chat_messages", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("conversation_id").notNullable().references("id").inTable("conversations").onDelete("CASCADE");
    t.string("sender").defaultTo("user");
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.text("body").notNullable();
    t.timestamps(true, true);
    t.index("conversation_id");
  });

  // ──────────────────────────────────────────────
  // LOCALE
  // ──────────────────────────────────────────────

  await knex.schema.createTable("message_bundles", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("locale").notNullable();
    t.string("namespace").defaultTo("common");
    t.string("key").notNullable();
    t.string("value").notNullable();
    t.uuid("tenant_id");
    t.timestamps(true, true);
    t.index("locale");
    t.index("namespace");
  });

  await knex.schema.createTable("tenant_locale_preferences", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE").unique();
    t.string("default_locale").defaultTo("en");
    t.string("timezone").defaultTo("UTC");
    t.timestamps(true, true);
  });

  await knex.schema.createTable("user_locale_preferences", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE").unique();
    t.string("locale").defaultTo("en");
    t.string("timezone").defaultTo("UTC");
    t.timestamps(true, true);
  });

  // ──────────────────────────────────────────────
  // INSTANCE / MULTI-TENANCY
  // ──────────────────────────────────────────────

  await knex.schema.createTable("instance_companies", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("name_key").notNullable();
    t.string("domain").defaultTo("");
    t.string("email").defaultTo("");
    t.string("phone").defaultTo("");
    t.text("address").defaultTo("");
    t.enum("status", ["active", "inactive"]).defaultTo("active");
    t.boolean("is_primary").defaultTo(false);
    t.uuid("owner_user").references("id").inTable("users").onDelete("SET NULL");
    t.timestamps(true, true);
    t.unique(["tenant_id", "name_key"]);
  });

  await knex.schema.createTable("instance_invitations", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("instance").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("email").notNullable();
    t.enum("role", ["instance_admin", "agent", "requester"]).notNullable();
    t.jsonb("permissions").defaultTo("[]");
    t.uuid("organization_unit").references("id").inTable("organization_units").onDelete("SET NULL");
    t.string("token_hash").notNullable().unique();
    t.timestamp("expires_at").notNullable();
    t.timestamp("accepted_at");
    t.uuid("invited_by").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.timestamps(true, true);
    t.index("instance");
  });

  // Add companies.primary_company FK now that instance_companies exists
  await knex.schema.alterTable("companies", (t) => {
    t.uuid("primary_company").references("id").inTable("instance_companies").onDelete("SET NULL");
  });

  // ──────────────────────────────────────────────
  // BILLING
  // ──────────────────────────────────────────────

  await knex.schema.createTable("subscriptions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("plan_id").references("id").inTable("plans").onDelete("SET NULL");
    t.string("status").defaultTo("active");
    t.timestamp("current_period_start");
    t.timestamp("current_period_end");
    t.string("provider").defaultTo("");
    t.string("provider_id").defaultTo("");
    t.jsonb("metadata").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("invoices", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("subscription_id").references("id").inTable("subscriptions").onDelete("SET NULL");
    t.string("number").defaultTo("");
    t.decimal("amount", 12, 2).defaultTo(0);
    t.string("currency", 10).defaultTo("INR");
    t.string("status").defaultTo("pending");
    t.timestamp("due_date");
    t.timestamp("paid_at");
    t.jsonb("metadata").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("billing_adjustments", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("invoice_id").references("id").inTable("invoices").onDelete("SET NULL");
    t.decimal("amount", 12, 2).notNullable();
    t.text("reason").defaultTo("");
    t.string("status").defaultTo("pending");
    t.uuid("created_by").references("id").inTable("super_admins").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("company_id");
  });

  // ──────────────────────────────────────────────
  // MISCELLANEOUS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("holidays", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("name").notNullable();
    t.date("date").notNullable();
    t.boolean("is_recurring").defaultTo(false);
    t.boolean("is_active").defaultTo(true);
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.index(["company_id", "date"]);
  });

  await knex.schema.createTable("privileged_sessions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("super_admin_id").notNullable().references("id").inTable("super_admins").onDelete("CASCADE");
    t.uuid("target_user_id").references("id").inTable("users").onDelete("SET NULL");
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.string("token").notNullable().unique();
    t.text("reason").defaultTo("");
    t.timestamp("expires_at").notNullable();
    t.timestamp("revoked_at");
    t.timestamps(true, true);
    t.index("super_admin_id");
    t.index("company_id");
    t.index("token");
  });

  await knex.schema.createTable("usage_limits", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("metric").notNullable();
    t.integer("limit").notNullable();
    t.boolean("hard_block").defaultTo(false);
    t.integer("warn_at_pct").defaultTo(80);
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("usage_meters", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("period").notNullable();
    t.integer("api_calls").defaultTo(0);
    t.bigInteger("storage_bytes").defaultTo(0);
    t.integer("agents").defaultTo(0);
    t.integer("users").defaultTo(0);
    t.integer("tickets").defaultTo(0);
    t.timestamps(true, true);
    t.unique(["tenant_id", "period"]);
  });

  await knex.schema.createTable("handover_notes", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.timestamp("shift_date");
    t.jsonb("pending_tickets").defaultTo("[]");
    t.text("risks").defaultTo("");
    t.text("notes").defaultTo("");
    t.boolean("acknowledged").defaultTo(false);
    t.uuid("acknowledged_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamp("acknowledged_at");
    t.uuid("created_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index(["company_id", "shift_date"]);
  });

  await knex.schema.createTable("status_pages", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.string("name").notNullable();
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.string("slug").notNullable().unique();
    t.text("description").defaultTo("");
    t.boolean("is_public").defaultTo(true);
    t.jsonb("branding").defaultTo("{}");
    t.jsonb("components").defaultTo("[]");
    t.uuid("created_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("slug");
    t.index("company_id");
  });

  await knex.schema.createTable("status_incidents", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("status_page_id").references("id").inTable("status_pages").onDelete("SET NULL");
    t.string("title").notNullable();
    t.text("body").defaultTo("");
    t.enum("status", ["investigating", "identified", "monitoring", "resolved", "maintenance"]).defaultTo("investigating");
    t.enum("severity", ["critical", "major", "minor", "maintenance"]).defaultTo("major");
    t.jsonb("components_affected").defaultTo("[]");
    t.jsonb("updates").defaultTo("[]");
    t.timestamp("started_at").defaultTo(knex.fn.now());
    t.timestamp("resolved_at");
    t.uuid("linked_incident_id");
    t.jsonb("linked_tickets").defaultTo("[]");
    t.uuid("created_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index(["company_id", "status_page_id", "status"]);
  });

  // ──────────────────────────────────────────────
  // GROUP MEMBERSHIP / USER ROLES / ROLE PERMISSIONS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("group_memberships", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.uuid("group_id").notNullable().references("id").inTable("teams").onDelete("CASCADE");
    t.string("role").defaultTo("member");
    t.timestamps(true, true);
    t.unique(["user_id", "group_id"]);
  });

  await knex.schema.createTable("user_roles", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.uuid("role_id").notNullable().references("id").inTable("roles").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["user_id", "role_id"]);
  });

  await knex.schema.createTable("role_permissions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("role_id").notNullable().references("id").inTable("roles").onDelete("CASCADE");
    t.string("permission").notNullable();
    t.timestamps(true, true);
    t.unique(["role_id", "permission"]);
  });
};

exports.down = async function (knex) {
  // Drop in reverse dependency order
  const tables = [
    "role_permissions", "user_roles", "group_memberships",
    "status_incidents", "status_pages", "handover_notes",
    "usage_meters", "usage_limits", "privileged_sessions", "holidays",
    "billing_adjustments", "invoices", "subscriptions",
    "instance_invitations", "instance_companies",
    "user_locale_preferences", "tenant_locale_preferences", "message_bundles",
    "chat_messages", "conversations",
    "itom_alerts", "assets", "survey_responses", "surveys",
    "custom_permissions", "custom_roles", "custom_fields",
    "integrations", "webhooks", "api_keys",
    "counters", "system_settings",
    "audit_events", "audit_logs",
    "notification_events", "notifications", "email_logs", "email_templates",
    "workflows",
    "availability_records", "outage_services", "outage_cis", "outages",
    "metric_targets", "metric_baselines", "costs", "benefits",
    "improvement_tasks", "improvement_goals", "improvement_opportunities", "improvement_initiatives",
    "release_tasks", "release_phases", "release_deployments",
    "release_dependencies", "release_components", "release_approvals", "releases",
    "wait_time_events", "kiosks", "appointments",
    "walkup_interactions", "walkup_checkins", "walkup_services",
    "walkup_queues", "walkup_locations",
    "time_off_requests", "coverage_requests", "contact_preferences",
    "oncall_escalation_policies", "escalation_levels",
    "shifts", "rotations", "roster_members", "rosters", "oncall_schedules",
    "routing_rules", "queues", "assignment_events", "assignment_rules",
    "agent_presences", "agent_capacities", "agent_skills", "skills",
    "announcements", "canned_responses",
    "knowledge_approvals", "knowledge_versions", "knowledge_reader_criteria",
    "knowledge_ratings", "knowledge_feedback",
    "knowledge_contributor_criteria", "knowledge_comments", "faqs",
    "faq_categories", "knowledge_bases",
    "variable_sets", "user_criteria",
    "fulfillment_steps", "fulfillment_plans",
    "item_approvals", "request_approvals", "requested_items", "requests",
    "cart_items", "carts", "catalog_entitlements", "catalog_tasks",
    "catalog_item_variables", "catalog_items", "catalog_categories", "catalogs",
    "delegations", "approvers", "approval_decisions", "approval_steps",
    "approval_instances", "approval_definitions",
    "underpinning_contract_targets", "sla_repair_jobs", "sla_conditions",
    "sla_breakdowns", "olas", "holiday_calendars", "business_schedules", "sla_events",
    "sla_events",
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
};
