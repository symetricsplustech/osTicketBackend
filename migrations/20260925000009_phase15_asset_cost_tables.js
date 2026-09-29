/**
 * Phase 15 schema: the nine Asset & Cost Management resources that had no
 * backing tables.
 *
 * Only 15.1 Assets had a table (`assets`, served by /enterprise/assets), so
 * 15.2 Asset Models, 15.3 Stockrooms, 15.4 Inventory, 15.5 Transfers,
 * 15.6 Asset Assignment, 15.7 Asset Lifecycle, 15.8 Asset Audit,
 * 15.9 Cost Management and 15.10 Configuration were frontend screens with no
 * data source at all. The canonical permission spec now defines the
 * `itsm.asset.*` keys for these resources (2913 keys, up from 2824), and this
 * migration creates the tables those permissions and the Phase 15 services
 * write to.
 *
 * Additive and idempotent: every table is created behind a hasTable guard, so
 * re-running is a no-op. No existing table is dropped, renamed, truncated or
 * rewritten, and no existing row is touched.
 *
 * Ordering: parents before children (categories -> models -> stockrooms ->
 * inventory, then transfers/lines, assignments, lifecycle, audit, cost).
 */

const PK = (knex, t) =>
  t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));

// Every Phase 15 table is tenant scoped, so each one gets the same
// company_id column and a matching index.
const scoped = (t) => {
  t.uuid("company_id").notNullable();
  return t;
};

exports.up = async function (knex) {
  const create = async (name, build) => {
    if (await knex.schema.hasTable(name)) return;
    await knex.schema.createTable(name, (t) => {
      t.index(["company_id"], "idx_" + name + "_company");
      build(t);
    });
  };

  // ── 15.2 Asset Models ────────────────────────────────────────────────
  await create("model_categories", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.string("name").notNullable();
    t.string("code");
    t.text("description").defaultTo("");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.unique(["company_id", "name"]);
  });

  await create("asset_models", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("category_id").references("id").inTable("model_categories").onDelete("SET NULL");
    t.string("name").notNullable();
    t.string("manufacturer");
    t.string("model_number");
    t.string("category");
    t.integer("default_life_months");
    t.decimal("purchase_cost", 12, 2).defaultTo(0);
    t.decimal("retirement_value", 12, 2).defaultTo(0);
    t.text("description").defaultTo("");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.unique(["company_id", "name"]);
  });

  // ── 15.3 Stockrooms ──────────────────────────────────────────────────
  await create("stockrooms", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.string("name").notNullable();
    t.string("code");
    t.string("location");
    t.string("manager_user_id");
    t.integer("capacity").defaultTo(0);
    t.boolean("is_active").defaultTo(true);
    t.text("description").defaultTo("");
    t.timestamps(true, true);
    t.unique(["company_id", "name"]);
  });

  // ── 15.4 Inventory ───────────────────────────────────────────────────
  // Balances are stored so a location can hold stock that has no asset record
  // yet; the asset_id link is optional and set once an asset is created.
  await create("inventory_balances", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("stockroom_id").references("id").inTable("stockrooms").onDelete("CASCADE");
    t.uuid("model_id").references("id").inTable("asset_models").onDelete("SET NULL");
    t.uuid("asset_id").references("id").inTable("assets").onDelete("SET NULL");
    t.string("location");
    t.string("barcode");
    t.decimal("quantity_on_hand", 12, 2).defaultTo(0);
    t.decimal("quantity_reserved", 12, 2).defaultTo(0);
    t.decimal("quantity_in_transit", 12, 2).defaultTo(0);
    t.decimal("reorder_point", 12, 2).defaultTo(0);
    t.decimal("max_quantity", 12, 2).defaultTo(0);
    t.date("last_counted_at");
    t.timestamps(true, true);
  });

  await create("inventory_exceptions", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("balance_id").references("id").inTable("inventory_balances").onDelete("CASCADE");
    t.string("exception_type").notNullable(); // shortage | surplus | damage | mismatch | expiry
    t.string("severity").defaultTo("medium");
    t.text("description").defaultTo("");
    t.decimal("expected_quantity", 12, 2).defaultTo(0);
    t.decimal("actual_quantity", 12, 2).defaultTo(0);
    t.string("status").defaultTo("open"); // open | acknowledged | resolved | ignored
    t.text("resolution_note").defaultTo("");
    t.uuid("resolved_by");
    t.timestamp("resolved_at");
    t.timestamps(true, true);
  });

  // ── 15.5 Transfers ───────────────────────────────────────────────────
  await create("transfers", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.string("transfer_number").notNullable();
    t.uuid("from_stockroom_id").references("id").inTable("stockrooms").onDelete("SET NULL");
    t.uuid("to_stockroom_id").references("id").inTable("stockrooms").onDelete("SET NULL");
    t.string("from_location");
    t.string("to_location");
    t.string("status").defaultTo("draft"); // draft | requested | in_transit | received | cancelled
    t.date("requested_date");
    t.date("ship_date");
    t.date("receive_date");
    t.string("request_reason").defaultTo("");
    t.text("notes").defaultTo("");
    t.string("shipped_by");
    t.string("received_by");
    t.timestamps(true, true);
    t.unique(["company_id", "transfer_number"]);
  });

  await create("transfer_lines", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("transfer_id").notNullable().references("id").inTable("transfers").onDelete("CASCADE");
    t.uuid("asset_id").references("id").inTable("assets").onDelete("SET NULL");
    t.uuid("model_id").references("id").inTable("asset_models").onDelete("SET NULL");
    t.integer("line_number").defaultTo(1);
    t.decimal("quantity", 12, 2).defaultTo(1);
    t.decimal("quantity_received", 12, 2).defaultTo(0);
    t.decimal("quantity_shipped", 12, 2).defaultTo(0);
    t.string("serial_number");
    t.string("status").defaultTo("pending"); // pending | shipped | received | cancelled
    t.text("notes").defaultTo("");
    t.timestamps(true, true);
  });

  // ── 15.6 Asset Assignment ────────────────────────────────────────────
  await create("asset_assignments", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("asset_id").notNullable().references("id").inTable("assets").onDelete("CASCADE");
    t.uuid("assigned_to_user_id");
    t.string("assigned_to_name");
    t.string("assigned_to_dept");
    t.string("assigned_to_location");
    t.string("assignment_type").defaultTo("direct"); // direct | shared | project
    t.string("status").defaultTo("active"); // active | returned | swapped
    t.date("assigned_at");
    t.date("due_back_at");
    t.date("returned_at");
    t.string("return_condition");
    t.text("notes").defaultTo("");
    t.timestamps(true, true);
  });

  // ── 15.7 Asset Lifecycle ─────────────────────────────────────────────
  // One row per asset holding the current lifecycle position plus the full
  // movement history as jsonb, so the lifecycle screens read one table.
  await create("asset_lifecycles", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("asset_id").notNullable().references("id").inTable("assets").onDelete("CASCADE");
    t.string("state").defaultTo("in_stock"); // on_order | in_stock | in_use | in_maintenance | retired | disposed
    t.string("substate");
    t.date("state_since");
    t.uuid("state_changed_by");
    t.date("retired_at");
    t.date("disposed_at");
    t.string("disposal_method");
    t.decimal("disposal_value", 12, 2).defaultTo(0);
    t.text("disposal_note").defaultTo("");
    t.jsonb("history").defaultTo("[]");
    t.timestamps(true, true);
  });

  // ── 15.8 Asset Audit ─────────────────────────────────────────────────
  await create("asset_audits", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.string("audit_number").notNullable();
    t.string("name").notNullable();
    t.uuid("stockroom_id").references("id").inTable("stockrooms").onDelete("SET NULL");
    t.string("scope_type").defaultTo("stockroom"); // stockroom | location | custodian | global
    t.string("scope_value");
    t.string("status").defaultTo("planned"); // planned | in_progress | counting | completed | cancelled
    t.date("planned_date");
    t.timestamp("started_at");
    t.timestamp("completed_at");
    t.integer("task_count").defaultTo(0);
    t.integer("tasks_completed").defaultTo(0);
    t.integer("exception_count").defaultTo(0);
    t.uuid("created_by");
    t.text("notes").defaultTo("");
    t.timestamps(true, true);
    t.unique(["company_id", "audit_number"]);
  });

  await create("audit_tasks", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("audit_id").notNullable().references("id").inTable("asset_audits").onDelete("CASCADE");
    t.uuid("stockroom_id").references("id").inTable("stockrooms").onDelete("SET NULL");
    t.string("task_name");
    t.string("assigned_to");
    t.string("status").defaultTo("pending"); // pending | in_progress | completed | skipped
    t.integer("expected_count").defaultTo(0);
    t.integer("counted_count").defaultTo(0);
    t.timestamp("started_at");
    t.timestamp("completed_at");
    t.timestamps(true, true);
  });

  await create("audit_results", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("audit_id").notNullable().references("id").inTable("asset_audits").onDelete("CASCADE");
    t.uuid("task_id").references("id").inTable("audit_tasks").onDelete("SET NULL");
    t.uuid("asset_id").references("id").inTable("assets").onDelete("SET NULL");
    t.string("barcode");
    t.string("serial_number");
    t.string("result").defaultTo("match"); // match | missing | unexpected | duplicate | damaged
    t.string("verified_by");
    t.timestamp("verified_at");
    t.text("note").defaultTo("");
    t.timestamps(true, true);
  });

  // ── 15.9 Cost Management ─────────────────────────────────────────────
  await create("cost_centers", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.string("code").notNullable();
    t.string("name").notNullable();
    t.string("description").defaultTo("");
    t.string("department");
    t.string("manager");
    t.decimal("budget_amount", 14, 2).defaultTo(0);
    t.string("currency", 3).defaultTo("INR");
    t.date("fiscal_year_start");
    t.date("fiscal_year_end");
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.unique(["company_id", "code"]);
  });

  await create("asset_costs", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("cost_center_id").references("id").inTable("cost_centers").onDelete("SET NULL");
    t.uuid("asset_id").references("id").inTable("assets").onDelete("SET NULL");
    t.uuid("model_id").references("id").inTable("asset_models").onDelete("SET NULL");
    t.string("cost_type").notNullable(); // acquisition | maintenance | licensing | disposal | storage
    t.string("description").defaultTo("");
    t.decimal("amount", 14, 2).defaultTo(0);
    t.string("currency", 3).defaultTo("INR");
    t.date("cost_date");
    t.string("vendor");
    t.string("invoice_number");
    t.string("status").defaultTo("pending"); // pending | approved | rejected | paid
    t.uuid("approved_by");
    t.timestamp("approved_at");
    t.text("notes").defaultTo("");
    t.timestamps(true, true);
  });

  await create("cost_allocations", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("cost_id").notNullable().references("id").inTable("asset_costs").onDelete("CASCADE");
    t.uuid("cost_center_id").references("id").inTable("cost_centers").onDelete("SET NULL");
    t.string("department");
    t.string("project");
    t.decimal("allocation_percent", 5, 2).defaultTo(0);
    t.decimal("allocated_amount", 14, 2).defaultTo(0);
    t.date("period_start");
    t.date("period_end");
    t.text("note").defaultTo("");
    t.timestamps(true, true);
  });

  // ── 15.10 Configuration ──────────────────────────────────────────────
  await create("asset_states", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.string("name").notNullable(); // on_order | in_stock | in_use | in_maintenance | retired | disposed
    t.string("label").defaultTo("");
    t.string("color").defaultTo("#64748b");
    t.integer("sequence").defaultTo(0);
    t.boolean("is_default").defaultTo(false);
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
    t.unique(["company_id", "name"]);
  });

  await create("asset_substates", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("state_id").notNullable().references("id").inTable("asset_states").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("label").defaultTo("");
    t.integer("sequence").defaultTo(0);
    t.boolean("is_active").defaultTo(true);
    t.timestamps(true, true);
  });

  await create("asset_properties", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("model_id").references("id").inTable("asset_models").onDelete("CASCADE");
    t.string("name").notNullable();
    t.string("data_type").defaultTo("string"); // string | number | boolean | date
    t.string("default_value").defaultTo("");
    t.boolean("is_required").defaultTo(false);
    t.boolean("is_searchable").defaultTo(false);
    t.text("description").defaultTo("");
    t.timestamps(true, true);
  });

  // Per-stockroom settings; single row per stockroom.
  await create("stockroom_configurations", (t) => {
    PK(knex, t);
    scoped(t, knex);
    t.uuid("stockroom_id").notNullable().references("id").inTable("stockrooms").onDelete("CASCADE");
    t.boolean("allow_negative_stock").defaultTo(false);
    t.boolean("require_scan_on_receipt").defaultTo(true);
    t.boolean("require_approval_on_transfer").defaultTo(false);
    t.decimal("default_reorder_point", 12, 2).defaultTo(0);
    t.text("notes").defaultTo("");
    t.timestamps(true, true);
  });
};

exports.down = async function (knex) {
  // Child tables first. Additive migration: rolling back only removes the
  // tables this migration introduced and never touches pre-existing ones.
  const tables = [
    "stockroom_configurations", "asset_properties", "asset_substates", "asset_states",
    "cost_allocations", "asset_costs", "cost_centers",
    "audit_results", "audit_tasks", "asset_audits",
    "asset_lifecycles",
    "asset_assignments",
    "transfer_lines", "transfers",
    "inventory_exceptions", "inventory_balances",
    "stockrooms",
    "asset_models", "model_categories",
  ];
  for (const table of tables) {
    if (await knex.schema.hasTable(table)) await knex.schema.dropTable(table);
  }
};
