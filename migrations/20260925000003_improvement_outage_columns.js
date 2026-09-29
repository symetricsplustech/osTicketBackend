/**
 * Phase 15/16 service-vs-schema alignment: Continual Improvement + Outage.
 *
 * improvementService.js and outageService.js write these fields on create and
 * update, but the improvement/outage tables were only ever created with a
 * minimal skeleton, so every write raised a Postgres
 * "column ... does not exist" error. This migration adds the missing columns.
 *
 * Every column is added behind a hasColumn guard, so the migration is
 * idempotent and purely additive: no table is dropped, renamed or truncated,
 * and no existing row is rewritten.
 */

exports.up = async function (knex) {
  const add = async (table, column, build) => {
    if (await knex.schema.hasColumn(table, column)) return;
    await knex.schema.alterTable(table, build);
  };

  await add("improvement_opportunities", "category", (t) => t.string("category"));
  await add("improvement_opportunities", "priority", (t) => t.string("priority"));
  await add("improvement_opportunities", "impact", (t) => t.text("impact"));
  await add("improvement_opportunities", "effort", (t) => t.decimal("effort"));
  await add("improvement_opportunities", "risk", (t) => t.text("risk"));
  await add("improvement_opportunities", "assigned_to", (t) => t.uuid("assigned_to"));
  await add("improvement_opportunities", "rejection_reason", (t) => t.text("rejection_reason"));
  await add("improvement_opportunities", "metadata", (t) => t.jsonb("metadata").defaultTo("{}"));
  await add("improvement_opportunities", "qualified_by", (t) => t.uuid("qualified_by"));
  await add("improvement_opportunities", "qualified_at", (t) => t.timestamp("qualified_at"));
  await add("improvement_opportunities", "approved_by", (t) => t.uuid("approved_by"));
  await add("improvement_opportunities", "approved_at", (t) => t.timestamp("approved_at"));
  await add("improvement_opportunities", "deleted_at", (t) => t.timestamp("deleted_at"));
  await add("improvement_opportunities", "deleted_by", (t) => t.uuid("deleted_by"));
  await add("improvement_initiatives", "title", (t) => t.string("title"));
  await add("improvement_initiatives", "type", (t) => t.string("type"));
  await add("improvement_initiatives", "priority", (t) => t.string("priority"));
  await add("improvement_initiatives", "planned_start_date", (t) => t.timestamp("planned_start_date"));
  await add("improvement_initiatives", "planned_end_date", (t) => t.timestamp("planned_end_date"));
  await add("improvement_initiatives", "sponsor_id", (t) => t.uuid("sponsor_id"));
  await add("improvement_initiatives", "team_id", (t) => t.uuid("team_id"));
  await add("improvement_initiatives", "budget", (t) => t.decimal("budget"));
  await add("improvement_initiatives", "currency", (t) => t.string("currency"));
  await add("improvement_initiatives", "baseline_metrics", (t) => t.jsonb("baseline_metrics").defaultTo("{}"));
  await add("improvement_initiatives", "target_metrics", (t) => t.jsonb("target_metrics").defaultTo("{}"));
  await add("improvement_initiatives", "risks", (t) => t.jsonb("risks").defaultTo("{}"));
  await add("improvement_initiatives", "metadata", (t) => t.jsonb("metadata").defaultTo("{}"));
  await add("improvement_initiatives", "is_deleted", (t) => t.boolean("is_deleted").notNullable().defaultTo(false));
  await add("improvement_initiatives", "deleted_at", (t) => t.timestamp("deleted_at"));
  await add("improvement_initiatives", "deleted_by", (t) => t.uuid("deleted_by"));
  await add("improvement_tasks", "type", (t) => t.string("type"));
  await add("improvement_tasks", "priority", (t) => t.string("priority"));
  await add("improvement_tasks", "assignee_id", (t) => t.uuid("assignee_id"));
  await add("improvement_tasks", "start_date", (t) => t.timestamp("start_date"));
  await add("improvement_tasks", "end_date", (t) => t.timestamp("end_date"));
  await add("improvement_tasks", "planned_start_date", (t) => t.timestamp("planned_start_date"));
  await add("improvement_tasks", "planned_end_date", (t) => t.timestamp("planned_end_date"));
  await add("improvement_tasks", "estimated_duration", (t) => t.string("estimated_duration"));
  await add("improvement_tasks", "dependencies", (t) => t.jsonb("dependencies").defaultTo("{}"));
  await add("improvement_tasks", "deliverables", (t) => t.jsonb("deliverables").defaultTo("{}"));
  await add("improvement_tasks", "notes", (t) => t.text("notes"));
  await add("improvement_tasks", "metadata", (t) => t.jsonb("metadata").defaultTo("{}"));
  await add("improvement_tasks", "goal_id", (t) => t.uuid("goal_id"));
  await add("improvement_tasks", "is_deleted", (t) => t.boolean("is_deleted").notNullable().defaultTo(false));
  await add("improvement_tasks", "deleted_at", (t) => t.timestamp("deleted_at"));
  await add("improvement_tasks", "deleted_by", (t) => t.uuid("deleted_by"));
  await add("improvement_goals", "title", (t) => t.string("title"));
  await add("improvement_goals", "metric_name", (t) => t.text("metric_name"));
  await add("improvement_goals", "metric_unit", (t) => t.string("metric_unit"));
  await add("improvement_goals", "baseline_value", (t) => t.decimal("baseline_value"));
  await add("improvement_goals", "current_value", (t) => t.decimal("current_value"));
  await add("improvement_goals", "target_date", (t) => t.timestamp("target_date"));
  await add("improvement_goals", "status", (t) => t.string("status"));
  await add("improvement_goals", "direction", (t) => t.text("direction"));
  await add("improvement_goals", "threshold", (t) => t.decimal("threshold"));
  await add("improvement_goals", "measurement_frequency", (t) => t.string("measurement_frequency"));
  await add("improvement_goals", "measurement_source", (t) => t.text("measurement_source"));
  await add("improvement_goals", "metadata", (t) => t.jsonb("metadata").defaultTo("{}"));
  await add("improvement_goals", "initiative_id", (t) => t.uuid("initiative_id"));
  await add("improvement_goals", "is_deleted", (t) => t.boolean("is_deleted").notNullable().defaultTo(false));
  await add("improvement_goals", "deleted_at", (t) => t.timestamp("deleted_at"));
  await add("improvement_goals", "deleted_by", (t) => t.uuid("deleted_by"));
  await add("benefits", "name", (t) => t.string("name"));
  await add("benefits", "estimated_value", (t) => t.decimal("estimated_value"));
  await add("benefits", "actual_value", (t) => t.decimal("actual_value"));
  await add("benefits", "unit", (t) => t.string("unit"));
  await add("benefits", "currency", (t) => t.string("currency"));
  await add("benefits", "realization_date", (t) => t.timestamp("realization_date"));
  await add("benefits", "is_recurring", (t) => t.boolean("is_recurring").notNullable().defaultTo(false));
  await add("benefits", "recurring_period", (t) => t.string("recurring_period"));
  await add("benefits", "status", (t) => t.string("status"));
  await add("benefits", "validated_by", (t) => t.uuid("validated_by"));
  await add("benefits", "validated_at", (t) => t.timestamp("validated_at"));
  await add("benefits", "realization_method", (t) => t.text("realization_method"));
  await add("benefits", "assumptions", (t) => t.jsonb("assumptions").defaultTo("{}"));
  await add("benefits", "dependencies", (t) => t.jsonb("dependencies").defaultTo("{}"));
  await add("benefits", "metadata", (t) => t.jsonb("metadata").defaultTo("{}"));
  await add("benefits", "is_deleted", (t) => t.boolean("is_deleted").notNullable().defaultTo(false));
  await add("benefits", "deleted_at", (t) => t.timestamp("deleted_at"));
  await add("benefits", "deleted_by", (t) => t.uuid("deleted_by"));
  await add("costs", "planned_amount", (t) => t.decimal("planned_amount"));
  await add("costs", "actual_amount", (t) => t.decimal("actual_amount"));
  await add("costs", "currency", (t) => t.string("currency"));
  await add("costs", "incurred_at", (t) => t.timestamp("incurred_at"));
  await add("costs", "paid_at", (t) => t.timestamp("paid_at"));
  await add("costs", "status", (t) => t.string("status"));
  await add("costs", "vendor", (t) => t.string("vendor"));
  await add("costs", "invoice_number", (t) => t.string("invoice_number"));
  await add("costs", "approved_by", (t) => t.uuid("approved_by"));
  await add("costs", "approved_at", (t) => t.timestamp("approved_at"));
  await add("costs", "is_recurring", (t) => t.boolean("is_recurring").notNullable().defaultTo(false));
  await add("costs", "recurring_period", (t) => t.string("recurring_period"));
  await add("costs", "metadata", (t) => t.jsonb("metadata").defaultTo("{}"));
  await add("costs", "is_deleted", (t) => t.boolean("is_deleted").notNullable().defaultTo(false));
  await add("costs", "deleted_at", (t) => t.timestamp("deleted_at"));
  await add("costs", "deleted_by", (t) => t.uuid("deleted_by"));
  await add("metric_baselines", "metric_name", (t) => t.text("metric_name"));
  await add("metric_baselines", "metric_category", (t) => t.text("metric_category"));
  await add("metric_baselines", "metric_unit", (t) => t.string("metric_unit"));
  await add("metric_baselines", "baseline_value", (t) => t.decimal("baseline_value"));
  await add("metric_baselines", "baseline_date", (t) => t.timestamp("baseline_date"));
  await add("metric_baselines", "measurement_method", (t) => t.text("measurement_method"));
  await add("metric_baselines", "data_source", (t) => t.text("data_source"));
  await add("metric_baselines", "sample_size", (t) => t.string("sample_size"));
  await add("metric_baselines", "confidence_level", (t) => t.string("confidence_level"));
  await add("metric_baselines", "is_active", (t) => t.boolean("is_active").notNullable().defaultTo(false));
  await add("metric_baselines", "valid_from", (t) => t.timestamp("valid_from"));
  await add("metric_baselines", "valid_until", (t) => t.timestamp("valid_until"));
  await add("metric_baselines", "approved_by", (t) => t.uuid("approved_by"));
  await add("metric_baselines", "approved_at", (t) => t.timestamp("approved_at"));
  await add("metric_baselines", "metadata", (t) => t.jsonb("metadata").defaultTo("{}"));
  await add("metric_baselines", "initiative_id", (t) => t.uuid("initiative_id"));
  await add("metric_baselines", "goal_id", (t) => t.uuid("goal_id"));
  await add("metric_baselines", "is_deleted", (t) => t.boolean("is_deleted").notNullable().defaultTo(false));
  await add("metric_baselines", "deleted_at", (t) => t.timestamp("deleted_at"));
  await add("metric_baselines", "deleted_by", (t) => t.uuid("deleted_by"));
  await add("metric_targets", "metric_name", (t) => t.text("metric_name"));
  await add("metric_targets", "metric_category", (t) => t.text("metric_category"));
  await add("metric_targets", "metric_unit", (t) => t.string("metric_unit"));
  await add("metric_targets", "current_value", (t) => t.decimal("current_value"));
  await add("metric_targets", "baseline_id", (t) => t.uuid("baseline_id"));
  await add("metric_targets", "baseline_value", (t) => t.decimal("baseline_value"));
  await add("metric_targets", "measurement_frequency", (t) => t.string("measurement_frequency"));
  await add("metric_targets", "data_source", (t) => t.text("data_source"));
  await add("metric_targets", "status", (t) => t.string("status"));
  await add("metric_targets", "achieved_at", (t) => t.timestamp("achieved_at"));
  await add("metric_targets", "trend", (t) => t.text("trend"));
  await add("metric_targets", "metadata", (t) => t.jsonb("metadata").defaultTo("{}"));
  await add("metric_targets", "initiative_id", (t) => t.uuid("initiative_id"));
  await add("metric_targets", "is_deleted", (t) => t.boolean("is_deleted").notNullable().defaultTo(false));
  await add("metric_targets", "deleted_at", (t) => t.timestamp("deleted_at"));
  await add("metric_targets", "deleted_by", (t) => t.uuid("deleted_by"));
  await add("outages", "type", (t) => t.string("type"));
  await add("outages", "impact", (t) => t.text("impact"));
  await add("outages", "root_cause", (t) => t.text("root_cause"));
  await add("outages", "estimated_restoration", (t) => t.timestamp("estimated_restoration"));
  await add("outages", "planned_start", (t) => t.timestamp("planned_start"));
  await add("outages", "planned_end", (t) => t.timestamp("planned_end"));
  await add("outages", "metadata", (t) => t.jsonb("metadata").defaultTo("{}"));
  await add("outages", "deleted_at", (t) => t.timestamp("deleted_at"));
  await add("outages", "deleted_by", (t) => t.uuid("deleted_by"));
  await add("outage_cis", "role", (t) => t.string("role"));
  await add("outage_cis", "impact", (t) => t.text("impact"));
  await add("outage_cis", "notes", (t) => t.text("notes"));
  await add("outage_cis", "added_by", (t) => t.uuid("added_by"));
  await add("outage_cis", "removed_at", (t) => t.timestamp("removed_at"));
  await add("outage_cis", "removed_by", (t) => t.uuid("removed_by"));
  await add("outage_services", "role", (t) => t.string("role"));
  await add("outage_services", "impact", (t) => t.text("impact"));
  await add("outage_services", "notes", (t) => t.text("notes"));
  await add("outage_services", "added_by", (t) => t.uuid("added_by"));
  await add("outage_services", "removed_at", (t) => t.timestamp("removed_at"));
  await add("outage_services", "removed_by", (t) => t.uuid("removed_by"));
};

exports.down = async function () {
  // Additive-only migration: intentionally a no-op so reverting cannot drop
  // data that the services may already have written.
};
