/**
 * Phase 16 schema: a real store for the 16.3 Outage Relationships module.
 *
 * The `/outage-relationships` screens (Related Incidents, Major Incident,
 * Related Change) had no backing data. outageService.associateIncident and
 * associateChange only verified that the target record existed and then
 * returned `{ success: true }` with a comment saying the link should be stored
 * "in production", so every relationship was discarded and nothing could be
 * listed.
 *
 * This follows the same shape as the existing outage_cis and outage_services
 * association tables rather than adding an array to outages, so 16.2 and 16.3
 * stay consistent and a relationship can carry its own impact metadata.
 *
 * Targets are polymorphic (an outage can relate to incidents or changes), so
 * the pair is validated in the service and `relation_type` is constrained here
 * to keep the column honest.
 *
 * Additive and idempotent: created behind a hasTable guard, so re-running is a
 * no-op. No existing table is dropped, renamed, truncated or rewritten, and no
 * existing row is touched. The outages table is tenant scoped by tenant_id (not
 * company_id like the Phase 15 tables), so this table follows outages.
 */

const RELATION_TYPES = ["incident", "change", "major_incident"];

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("outage_relations"))) {
    await knex.schema.createTable("outage_relations", (t) => {
      t.uuid("id", { primaryKey: true }).defaultTo(knex.raw("uuid_generate_v4()"));
      // The owning outage. ON DELETE CASCADE matches outage_cis/outage_services,
      // so deleting an outage does not leave dangling relations behind.
      t.uuid("outage_id")
        .notNullable()
        .references("id")
        .inTable("outages")
        .onDelete("CASCADE");
      t.uuid("tenant_id")
        .notNullable()
        .references("id")
        .inTable("companies")
        .onDelete("CASCADE");
      t.string("relation_type", 32).notNullable();
      // Polymorphic target: incidents.id or change_requests.id. Deliberately
      // not a foreign key, because either column can hold the id.
      t.uuid("target_id").notNullable();
      t.string("title", 255);
      t.string("number", 64);
      t.string("role", 64);
      t.string("impact", 64);
      t.text("notes");
      t.uuid("added_by");
      t.timestamp("removed_at");
      t.uuid("removed_by");
      t.timestamps(true, true);
    });

    // The 16.3 screens list an outage's relationships, and the service scopes
    // every query by tenant first, so the tenant column leads the index.
    await knex.raw("CREATE INDEX IF NOT EXISTS idx_outage_relations_tenant_outage ON outage_relations (tenant_id, outage_id)");
    // A target is unique per outage and relation type. A partial index keeps
    // the guarantee for live rows only, so a removed link can be re-added
    // without a soft-delete tombstone blocking it.
    await knex.raw(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_outage_relations_unique_target ON outage_relations (outage_id, relation_type, target_id) WHERE removed_at IS NULL",
    );
  }

  // Guard the enum for databases created before this file, and keep the
  // constraint name stable so the down migration can drop it.
  await knex.raw(`DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'outage_relations_relation_type_check'
    ) THEN
      ALTER TABLE outage_relations
        ADD CONSTRAINT outage_relations_relation_type_check
        CHECK (relation_type IN (${RELATION_TYPES.map((type) => `'${type}'`).join(", ")}));
    END IF;
  END $$;`);
};

exports.down = async function down(knex) {
  if (await knex.schema.hasTable("outage_relations")) {
    await knex.raw("ALTER TABLE outage_relations DROP CONSTRAINT IF EXISTS outage_relations_relation_type_check");
    await knex.raw("DROP INDEX IF EXISTS idx_outage_relations_unique_target");
    await knex.raw("DROP INDEX IF EXISTS idx_outage_relations_tenant_outage");
    await knex.schema.dropTableIfExists("outage_relations");
  }
};
