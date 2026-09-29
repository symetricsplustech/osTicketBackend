/**
 * Phase 15.2/15.9: link assets to models and record acquisition data.
 *
 * `assets` was created before Phase 15 with only name, serial, ip, hostname,
 * type, environment, location and status. Nothing could associate an asset
 * with an asset model, so:
 *  - assetCatalog.removeModel referenced `assets.model_id` and failed with
 *    `column "model_id" of relation "assets" does not exist`;
 *  - a model could never be used to filter or report on the assets built from
 *    it, and asset costs could not point at the asset they were bought for.
 *
 * These columns are the ones the Phase 15 services and the 15.1/15.9 screens
 * read. Additive and idempotent: every column is added behind a hasColumn
 * guard, so no existing row is dropped, renamed or rewritten.
 */

exports.up = async function (knex) {
  const add = async (column, build) => {
    if (await knex.schema.hasColumn("assets", column)) return;
    await knex.schema.alterTable("assets", build);
  };

  // 15.2: the model an asset was built from.
  if (!(await knex.schema.hasColumn("assets", "model_id"))) {
    await knex.schema.alterTable("assets", (t) => {
      t.uuid("model_id").nullable();
      t.foreign("model_id").references("id").inTable("asset_models").onDelete("SET NULL");
    });
  }

  await add("model", (t) => t.string("model"));
  await add("purchase_date", (t) => t.date("purchase_date"));
  await add("purchase_cost", (t) => t.decimal("purchase_cost", 12, 2).defaultTo(0));
  await add("warranty_expiry", (t) => t.date("warranty_expiry"));
  await add("retired_at", (t) => t.timestamp("retired_at"));
  await add("disposed_at", (t) => t.timestamp("disposed_at"));
  await add("disposal_method", (t) => t.string("disposal_method"));
  await add("disposal_value", (t) => t.decimal("disposal_value", 12, 2).defaultTo(0));

  // Assets are listed and filtered by status and location on every Phase 15
  // screen, and searched by name/serial.
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_assets_company_status ON assets (company_id, status)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_assets_company_model ON assets (company_id, model_id)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_assets_company_serial ON assets (company_id, serial)");
};

exports.down = async function (knex) {
  await knex.raw("DROP INDEX IF EXISTS idx_assets_company_serial");
  await knex.raw("DROP INDEX IF EXISTS idx_assets_company_model");
  await knex.raw("DROP INDEX IF EXISTS idx_assets_company_status");
  for (const column of [
    "disposal_value", "disposal_method", "disposed_at", "retired_at",
    "warranty_expiry", "purchase_cost", "purchase_date", "model",
  ]) {
    if (await knex.schema.hasColumn("assets", column)) {
      await knex.schema.alterTable("assets", (t) => t.dropColumn(column));
    }
  }
  if (await knex.schema.hasColumn("assets", "model_id")) {
    await knex.schema.alterTable("assets", (t) => t.dropForeign(["model_id"]));
    await knex.schema.alterTable("assets", (t) => t.dropColumn("model_id"));
  }
};
