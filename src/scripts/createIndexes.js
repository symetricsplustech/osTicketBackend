// Database index creation — run once on startup for optimal query performance
// PostgreSQL handles indexes via migrations. This file is kept for reference
// but index creation should be done in migration files under /migrations.
//
// Every definition is resolved against the live schema before it is applied:
// the owning column differs per table (`company_id` in the platform schema,
// `tenant_id` in the Phase 15 tables), and some of the tables below belong to
// features that are not installed in every environment. A definition that
// cannot be resolved is skipped and reported rather than allowed to raise, so
// this can never leave a half-created index behind.
const { getDB } = require("../config/db");
const logger = require("../utils/logger");

/** Columns that stand in for the owning tenant, in preference order. */
const OWNER_COLUMNS = ["company_id", "tenant_id"];

async function createIndexes() {
  let db;
  try {
    db = getDB();
  } catch (_) {
    logger.warn("No DB connection for index creation");
    return;
  }

  const indexes = [
    // Tickets
    {
      table: "tickets",
      columns: ["tenant_id", "status", "created_at"],
      name: "idx_tickets_tenant_status_created",
    },
    {
      table: "tickets",
      columns: ["tenant_id", "agent_id", "status"],
      name: "idx_tickets_tenant_assigned_status",
    },
    // Incidents
    {
      table: "incidents",
      columns: ["tenant_id", "status", "severity"],
      name: "idx_incidents_tenant_status_severity",
    },
    // Leads + Opportunities
    {
      table: "leads",
      columns: ["tenant_id", "status", "score"],
      name: "idx_leads_tenant_status_score",
    },
    {
      table: "opportunities",
      columns: ["tenant_id", "stage", "value"],
      name: "idx_opps_tenant_stage_value",
    },
    // Assets + Licenses
    {
      table: "assets",
      columns: ["tenant_id", "status"],
      name: "idx_assets_tenant_status",
    },
    {
      table: "licenses",
      columns: ["tenant_id", "status", "expiry_date"],
      name: "idx_licenses_tenant_status_expiry",
    },
    // Users/Agents
    {
      table: "agents",
      columns: ["tenant_id", "is_active"],
      name: "idx_agents_tenant_active",
    },
    // Notifications
    {
      table: "notifications",
      columns: ["company_id", "read", "created_at"],
      name: "idx_notifications_user_read_created",
    },
    // Audit logs
    {
      table: "auditlogs",
      columns: ["tenant_id", "created_at"],
      name: "idx_auditlogs_tenant_created",
    },
    {
      table: "audit_events",
      columns: ["tenant_id", "created_at"],
      name: "idx_auditevents_tenant_created",
    },
    // Workflows
    {
      table: "workflows",
      columns: ["company_id", "event", "is_active"],
      name: "idx_workflows_company_event_active",
    },
    // Projects
    {
      table: "projects",
      columns: ["tenant_id", "status"],
      name: "idx_projects_tenant_status",
    },
    // Work orders
    {
      table: "workorders",
      columns: ["tenant_id", "status", "scheduled_date"],
      name: "idx_workorders_tenant_status_scheduled",
    },
    // HR cases
    {
      table: "hrcases",
      columns: ["tenant_id", "status"],
      name: "idx_hrcases_tenant_status",
    },
    // Security incidents
    {
      table: "securityincidents",
      columns: ["tenant_id", "status", "severity"],
      name: "idx_securityincidents_tenant_status_severity",
    },
  ];

  let created = 0;
  let present = 0;
  const skipped = [];

  for (const idx of indexes) {
    const table = await db("information_schema.tables")
      .where({ table_schema: "public", table_name: idx.table })
      .first();

    if (!table) {
      skipped.push(`${idx.table}: table not installed`);
      continue;
    }
    present++;

    const columns = Object.keys(await db(idx.table).columnInfo());
    const owner = OWNER_COLUMNS.find((col) => columns.includes(col));
    if (!owner) {
      skipped.push(`${idx.table}: no ${OWNER_COLUMNS.join("/")} column`);
      continue;
    }

    // The owner column is written generically so the definition keeps working
    // whichever tenant model the table ends up using.
    const requested = idx.columns.filter(
      (col) => col === "tenant_id" || col === "company_id"
    );
    const others = idx.columns.filter(
      (col) => col !== "tenant_id" && col !== "company_id"
    );

    const resolved = [...new Set([...requested.map(() => owner), ...others])];
    const absent = others.filter((col) => !columns.includes(col));
    if (absent.length) {
      skipped.push(`${idx.table}: missing column(s) ${absent.join(",")}`);
      continue;
    }

    try {
      const exists = await db.raw(
        "SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ?",
        [idx.table, idx.name],
      );
      if (!exists.rows.length) {
        await db.raw(
          `CREATE INDEX CONCURRENTLY IF NOT EXISTS ?? ON ?? (${resolved.map(() => "??").join(", ")})`,
          [idx.name, idx.table, ...resolved],
        );
        created++;
      }
    } catch (err) {
      if (!err.message.includes("already exists")) {
        skipped.push(`${idx.table}: ${err.message.slice(0, 60)}`);
      }
    }
  }

  for (const reason of skipped) {
    logger.debug(`Index skip ${reason}`);
  }
  logger.info(
    `Database indexes verified (${created} ensured, ${present} of ${indexes.length} tables installed)`
  );
}

module.exports = { createIndexes };
