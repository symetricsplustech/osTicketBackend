/**
 * PostgreSQL-backed model — 16.3 Outage Relationships.
 *
 * A join row between an outage and an incident or change. Targets are
 * polymorphic, so there is no single FK to the target table; relation_type
 * (incident | change | major_incident) is constrained in the migration and the
 * service resolves the target's own tenancy column before linking.
 *
 * This table follows outages, which is tenant scoped by tenant_id rather than
 * company_id.
 */
const { model } = require("../compat");

module.exports = model("outage_relations", { tenant_id: "tenant_id" });
