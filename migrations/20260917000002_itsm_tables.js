/**
 * Part 2: ITSM tables (Incidents, Problems, Changes, etc.)
 */

exports.up = async function (knex) {
  // ──────────────────────────────────────────────
  // INCIDENTS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("incidents", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("number").notNullable().unique();
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("new");
    t.enum("severity", ["sev1", "sev2", "sev3", "sev4"]).defaultTo("sev3");
    t.enum("priority", ["low", "normal", "high", "emergency"]).defaultTo("normal");
    t.enum("impact", ["low", "medium", "high"]);
    t.enum("urgency", ["low", "medium", "high"]);
    t.string("category").defaultTo("");
    t.string("subcategory").defaultTo("");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.uuid("assignment_group_id").references("id").inTable("teams").onDelete("SET NULL");
    t.uuid("caller_id").references("id").inTable("users").onDelete("SET NULL");
    t.uuid("parent_incident_id").references("id").inTable("incidents").onDelete("SET NULL");
    t.jsonb("affected_tickets").defaultTo("[]");
    t.jsonb("affected_services").defaultTo("[]");
    t.jsonb("resolution_team").defaultTo("[]");
    t.boolean("is_major").defaultTo(false);
    t.uuid("incident_commander").references("id").inTable("agents").onDelete("SET NULL");
    t.boolean("notified_stakeholders").defaultTo(false);
    t.jsonb("timeline").defaultTo("[]");
    t.jsonb("updates").defaultTo("[]");
    t.timestamp("resolved_at");
    t.timestamp("closed_at");
    t.jsonb("custom_fields").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
    t.index("status");
    t.index("severity");
    t.index("assigned_to");
    t.index(["company_id", "status"]);
    t.index(["company_id", "priority"]);
  });

  // ──────────────────────────────────────────────
  // PROBLEMS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("problems", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("number").notNullable().unique();
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("new");
    t.string("priority").defaultTo("normal");
    t.boolean("known_error").defaultTo(false);
    t.text("root_cause").defaultTo("");
    t.text("workaround").defaultTo("");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.uuid("assignment_group_id").references("id").inTable("teams").onDelete("SET NULL");
    t.jsonb("affected_tickets").defaultTo("[]");
    t.jsonb("affected_cis").defaultTo("[]");
    t.jsonb("custom_fields").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
    t.index("status");
  });

  // ──────────────────────────────────────────────
  // CHANGE REQUESTS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("change_requests", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("number").notNullable().unique();
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("new");
    t.enum("change_type", ["standard", "normal", "emergency"]).defaultTo("normal");
    t.enum("risk", ["low", "medium", "high"]).defaultTo("medium");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.uuid("assignment_group_id").references("id").inTable("teams").onDelete("SET NULL");
    t.uuid("requested_by").references("id").inTable("users").onDelete("SET NULL");
    t.text("implementation_plan").defaultTo("");
    t.text("backout_plan").defaultTo("");
    t.text("test_plan").defaultTo("");
    t.timestamp("planned_start_date");
    t.timestamp("planned_end_date");
    t.timestamp("actual_start_date");
    t.timestamp("actual_end_date");
    t.jsonb("affected_cis").defaultTo("[]");
    t.jsonb("custom_fields").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
    t.index("status");
  });

  // ──────────────────────────────────────────────
  // CMDB
  // ──────────────────────────────────────────────

  await knex.schema.createTable("configuration_items", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("ci_class").defaultTo("");
    t.string("ci_subclass").defaultTo("");
    t.enum("environment", ["production", "staging", "development", "test", "dr"]);
    t.enum("criticality", ["critical", "high", "medium", "low", "non_critical"]);
    t.enum("status", ["planned", "build", "deploy", "active", "degraded", "outage", "maintenance", "retired", "disposed"]).defaultTo("active");
    t.string("lifecycle_state").defaultTo("active");
    t.string("ip_address").defaultTo("");
    t.string("mac_address").defaultTo("");
    t.string("hostname").defaultTo("");
    t.string("serial_number").defaultTo("");
    t.string("asset_tag").defaultTo("");
    t.string("location").defaultTo("");
    t.string("rack").defaultTo("");
    t.string("data_center").defaultTo("");
    t.uuid("owner_id").references("id").inTable("users").onDelete("SET NULL");
    t.uuid("owner_group_id").references("id").inTable("teams").onDelete("SET NULL");
    t.uuid("support_group_id").references("id").inTable("teams").onDelete("SET NULL");
    t.jsonb("business_services").defaultTo("[]");
    t.jsonb("technical_services").defaultTo("[]");
    t.jsonb("service_offerings").defaultTo("[]");
    t.jsonb("attributes").defaultTo("{}");
    t.jsonb("custom_fields").defaultTo("{}");
    t.timestamps(true, true);
    t.index("tenant_id");
    t.index("name");
    t.index("status");
  });

  await knex.schema.createTable("ci_relationships", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("source_ci_id").notNullable().references("id").inTable("configuration_items").onDelete("CASCADE");
    t.uuid("target_ci_id").notNullable().references("id").inTable("configuration_items").onDelete("CASCADE");
    t.string("type").defaultTo("depends_on");
    t.timestamps(true, true);
    t.unique(["source_ci_id", "target_ci_id", "type"]);
  });

  await knex.schema.createTable("dependencies", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("entity_type").notNullable();
    t.uuid("entity_id").notNullable();
    t.string("depends_on_type").notNullable();
    t.uuid("depends_on_id").notNullable();
    t.string("dependency_type").defaultTo("hard");
    t.string("impact_level").defaultTo("medium");
    t.text("description").defaultTo("");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("business_services", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.decimal("availability_target", 5, 2).defaultTo(99.9);
    t.string("business_owner").defaultTo("");
    t.string("technical_owner").defaultTo("");
    t.string("status").defaultTo("active");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("technical_services", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.uuid("business_service_id").references("id").inTable("business_services").onDelete("SET NULL");
    t.string("status").defaultTo("active");
    t.jsonb("components").defaultTo("[]");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("service_portfolios", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("active");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("service_offerings", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.uuid("business_service_id").references("id").inTable("business_services").onDelete("SET NULL");
    t.uuid("portfolio_id").references("id").inTable("service_portfolios").onDelete("SET NULL");
    t.decimal("price", 12, 2).defaultTo(0);
    t.string("currency", 10).defaultTo("INR");
    t.enum("pricing_model", ["fixed", "per_user", "per_ticket", "usage"]).defaultTo("fixed");
    t.string("status").defaultTo("active");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  await knex.schema.createTable("service_commitments", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("service_offering_id").notNullable().references("id").inTable("service_offerings").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.string("metric").defaultTo("");
    t.decimal("target_value", 12, 2);
    t.string("unit").defaultTo("");
    t.string("measurement_period").defaultTo("monthly");
    t.timestamps(true, true);
    t.index("service_offering_id");
  });

  await knex.schema.createTable("service_level_commitments", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("service_offering_id").notNullable().references("id").inTable("service_offerings").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("metric").defaultTo("");
    t.decimal("target_value", 12, 2);
    t.string("unit").defaultTo("");
    t.enum("priority", ["low", "medium", "high", "critical"]).defaultTo("medium");
    t.timestamps(true, true);
    t.index("service_offering_id");
  });

  await knex.schema.createTable("service_owners", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("tenant_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("service_id").notNullable();
    t.string("service_type").defaultTo("business_service");
    t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("role").defaultTo("owner");
    t.timestamps(true, true);
    t.index("tenant_id");
  });

  // ──────────────────────────────────────────────
  // PROBLEM RELATIONS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("problem_tasks", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("problem_id").notNullable().references("id").inTable("problems").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("new");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("problem_id");
  });

  await knex.schema.createTable("problem_changes", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("problem_id").notNullable().references("id").inTable("problems").onDelete("CASCADE");
    t.uuid("change_id").notNullable().references("id").inTable("change_requests").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["problem_id", "change_id"]);
  });

  await knex.schema.createTable("problem_cis", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("problem_id").notNullable().references("id").inTable("problems").onDelete("CASCADE");
    t.uuid("ci_id").notNullable().references("id").inTable("configuration_items").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["problem_id", "ci_id"]);
  });

  await knex.schema.createTable("problem_incidents", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("problem_id").notNullable().references("id").inTable("problems").onDelete("CASCADE");
    t.uuid("incident_id").notNullable().references("id").inTable("incidents").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["problem_id", "incident_id"]);
  });

  await knex.schema.createTable("problem_knowledge", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("problem_id").notNullable().references("id").inTable("problems").onDelete("CASCADE");
    t.uuid("faq_id").notNullable();
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["problem_id", "faq_id"]);
  });

  await knex.schema.createTable("problem_service_offerings", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("problem_id").notNullable().references("id").inTable("problems").onDelete("CASCADE");
    t.uuid("service_offering_id").notNullable().references("id").inTable("service_offerings").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["problem_id", "service_offering_id"]);
  });

  await knex.schema.createTable("problem_assignment_histories", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("problem_id").notNullable().references("id").inTable("problems").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.uuid("assigned_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("problem_id");
  });

  // ──────────────────────────────────────────────
  // INCIDENT RELATIONS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("incident_tasks", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("incident_id").notNullable().references("id").inTable("incidents").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("new");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("incident_id");
  });

  await knex.schema.createTable("incident_relationships", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("incident_id").notNullable().references("id").inTable("incidents").onDelete("CASCADE");
    t.uuid("related_incident_id").notNullable().references("id").inTable("incidents").onDelete("CASCADE");
    t.string("type").defaultTo("related");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["incident_id", "related_incident_id"]);
  });

  await knex.schema.createTable("incident_cis", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("incident_id").notNullable().references("id").inTable("incidents").onDelete("CASCADE");
    t.uuid("ci_id").notNullable().references("id").inTable("configuration_items").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["incident_id", "ci_id"]);
  });

  await knex.schema.createTable("incident_resolutions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("incident_id").notNullable().references("id").inTable("incidents").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.text("resolution").defaultTo("");
    t.uuid("resolved_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("incident_id");
  });

  await knex.schema.createTable("incident_assignment_histories", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("incident_id").notNullable().references("id").inTable("incidents").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.uuid("assigned_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("incident_id");
  });

  await knex.schema.createTable("incident_service_offerings", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("incident_id").notNullable().references("id").inTable("incidents").onDelete("CASCADE");
    t.uuid("service_offering_id").notNullable().references("id").inTable("service_offerings").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["incident_id", "service_offering_id"]);
  });

  // ──────────────────────────────────────────────
  // CHANGE RELATIONS
  // ──────────────────────────────────────────────

  await knex.schema.createTable("change_tasks", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("change_id").notNullable().references("id").inTable("change_requests").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("new");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("change_id");
  });

  await knex.schema.createTable("change_cis", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("change_id").notNullable().references("id").inTable("change_requests").onDelete("CASCADE");
    t.uuid("ci_id").notNullable().references("id").inTable("configuration_items").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["change_id", "ci_id"]);
  });

  await knex.schema.createTable("change_conflicts", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("change_id").notNullable().references("id").inTable("change_requests").onDelete("CASCADE");
    t.uuid("conflicting_change_id").notNullable().references("id").inTable("change_requests").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("reason").defaultTo("");
    t.timestamps(true, true);
    t.unique(["change_id", "conflicting_change_id"]);
  });

  await knex.schema.createTable("change_risk_assessments", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("change_id").notNullable().references("id").inTable("change_requests").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("overall_risk").defaultTo("medium");
    t.jsonb("conditions").defaultTo("[]");
    t.jsonb("factors").defaultTo("{}");
    t.timestamps(true, true);
    t.index("change_id");
  });

  await knex.schema.createTable("change_services", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("change_id").notNullable().references("id").inTable("change_requests").onDelete("CASCADE");
    t.uuid("service_id").notNullable().references("id").inTable("business_services").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.timestamps(true, true);
    t.unique(["change_id", "service_id"]);
  });

  await knex.schema.createTable("change_approval_policies", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.jsonb("conditions").defaultTo("[]");
    t.jsonb("approvers").defaultTo("[]");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("change_implementation_results", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("change_id").notNullable().references("id").inTable("change_requests").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("result").defaultTo("success");
    t.text("notes").defaultTo("");
    t.uuid("implemented_by").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("change_id");
  });

  await knex.schema.createTable("standard_change_templates", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.jsonb("template_data").defaultTo("{}");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("company_id");
  });

  // ──────────────────────────────────────────────
  // MAJOR INCIDENT
  // ──────────────────────────────────────────────

  await knex.schema.createTable("major_incidents", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("incident_id").notNullable().references("id").inTable("incidents").onDelete("CASCADE");
    t.string("status").defaultTo("declared");
    t.uuid("incident_commander").references("id").inTable("agents").onDelete("SET NULL");
    t.jsonb("communication_plan").defaultTo("{}");
    t.jsonb("stakeholders").defaultTo("[]");
    t.timestamps(true, true);
    t.index("company_id");
    t.index("incident_id");
  });

  await knex.schema.createTable("major_incident_timeline_events", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("major_incident_id").notNullable().references("id").inTable("major_incidents").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("event_type").notNullable();
    t.text("description").defaultTo("");
    t.uuid("actor_id").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("major_incident_id");
  });

  await knex.schema.createTable("major_incident_participants", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("major_incident_id").notNullable().references("id").inTable("major_incidents").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("agent_id").notNullable().references("id").inTable("agents").onDelete("CASCADE");
    t.string("role").defaultTo("participant");
    t.timestamps(true, true);
    t.unique(["major_incident_id", "agent_id"]);
  });

  await knex.schema.createTable("major_incident_teams", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("major_incident_id").notNullable().references("id").inTable("major_incidents").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("team_id").notNullable().references("id").inTable("teams").onDelete("CASCADE");
    t.string("role").defaultTo("support");
    t.timestamps(true, true);
    t.unique(["major_incident_id", "team_id"]);
  });

  await knex.schema.createTable("major_incident_candidates", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("incident_id").notNullable().references("id").inTable("incidents").onDelete("CASCADE");
    t.string("reason").defaultTo("");
    t.string("status").defaultTo("pending");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("major_incident_communications", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("incident_id").notNullable().references("id").inTable("incidents").onDelete("CASCADE");
    t.enum("audience", ["internal", "customer", "public"]).notNullable();
    t.text("message").notNullable();
    t.uuid("actor_id").notNullable().references("id").inTable("agents").onDelete("CASCADE");
    t.string("actor_name").defaultTo("");
    t.timestamp("delivered_at").defaultTo(knex.fn.now());
    t.timestamps(true, true);
    t.index(["company_id", "incident_id"]);
  });

  // ──────────────────────────────────────────────
  // OTHER ITSM
  // ──────────────────────────────────────────────

  await knex.schema.createTable("known_errors", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("problem_id");
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.text("root_cause").defaultTo("");
    t.text("workaround").defaultTo("");
    t.string("status").defaultTo("active");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("service_requests", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("number").notNullable().unique();
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("new");
    t.uuid("requested_by").references("id").inTable("users").onDelete("SET NULL");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.jsonb("variables").defaultTo("{}");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("stakeholders", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("email").defaultTo("");
    t.string("phone").defaultTo("");
    t.string("role").defaultTo("");
    t.uuid("user_id").references("id").inTable("users").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("escalation_rules", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.jsonb("conditions").defaultTo("[]");
    t.jsonb("actions").defaultTo("[]");
    t.boolean("is_active").defaultTo(true);
    t.integer("sort_order").defaultTo(0);
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("maintenance_windows", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.timestamp("start_time");
    t.timestamp("end_time");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("blackout_windows", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.timestamp("start_time");
    t.timestamp("end_time");
    t.jsonb("affected_change_types").defaultTo("[]");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("communication_plans", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("incident_id");
    t.string("name").notNullable();
    t.text("description").defaultTo("");
    t.jsonb("stakeholders").defaultTo("[]");
    t.jsonb("templates").defaultTo("[]");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("communication_tasks", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("communication_plan_id").notNullable().references("id").inTable("communication_plans").onDelete("CASCADE");
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("title").notNullable();
    t.text("description").defaultTo("");
    t.string("status").defaultTo("pending");
    t.uuid("assigned_to").references("id").inTable("agents").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index("communication_plan_id");
  });

  await knex.schema.createTable("communication_templates", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("audience").defaultTo("internal");
    t.text("subject").defaultTo("");
    t.text("body").defaultTo("");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("bridge_sessions", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("incident_id");
    t.string("title").defaultTo("");
    t.string("status").defaultTo("active");
    t.jsonb("participants").defaultTo("[]");
    t.timestamp("started_at").defaultTo(knex.fn.now());
    t.timestamp("ended_at");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("pirs", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("change_id");
    t.timestamp("planned_date");
    t.timestamp("completed_date");
    t.text("lessons_learned").defaultTo("");
    t.text("outcome").defaultTo("");
    t.enum("risk_rating", ["low", "medium", "high", "critical"]).defaultTo("medium");
    t.enum("status", ["draft", "in_review", "approved", "published"]).defaultTo("draft");
    t.jsonb("questions").defaultTo("[]");
    t.timestamps(true, true);
    t.index(["company_id", "status"]);
  });

  await knex.schema.createTable("root_cause_records", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("incident_id");
    t.uuid("problem_id");
    t.string("category").defaultTo("");
    t.text("description").defaultTo("");
    t.text("root_cause").defaultTo("");
    t.text("corrective_action").defaultTo("");
    t.timestamps(true, true);
    t.index("company_id");
  });

  await knex.schema.createTable("post_incident_reviews", (t) => {
    t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
    t.uuid("company_id").notNullable().references("id").inTable("companies").onDelete("CASCADE");
    t.uuid("incident_id").notNullable().references("id").inTable("incidents").onDelete("CASCADE");
    t.string("status").defaultTo("draft");
    t.jsonb("findings").defaultTo("[]");
    t.jsonb("action_items").defaultTo("[]");
    t.timestamps(true, true);
    t.index("company_id");
  });
};

exports.down = async function (knex) {
  const tables = [
    "post_incident_reviews", "root_cause_records", "pirs",
    "bridge_sessions", "communication_templates", "communication_tasks", "communication_plans",
    "blackout_windows", "maintenance_windows", "escalation_rules",
    "stakeholders", "service_requests", "known_errors",
    "major_incident_communications", "major_incident_candidates",
    "major_incident_teams", "major_incident_participants",
    "major_incident_timeline_events", "major_incidents",
    "standard_change_templates", "change_implementation_results",
    "change_approval_policies", "change_services",
    "change_risk_assessments", "change_conflicts", "change_cis", "change_tasks",
    "incident_service_offerings", "incident_assignment_histories",
    "incident_resolutions", "incident_cis", "incident_relationships", "incident_tasks",
    "problem_assignment_histories", "problem_service_offerings",
    "problem_knowledge", "problem_incidents", "problem_cis", "problem_changes", "problem_tasks",
    "service_owners", "service_level_commitments", "service_commitments",
    "service_offerings", "service_portfolios", "technical_services", "business_services",
    "dependencies", "ci_relationships", "configuration_items",
    "change_requests", "problems", "incidents",
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
};
