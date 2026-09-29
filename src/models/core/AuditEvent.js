/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("../compat");
module.exports = model("audit_events", { tenantField: "tenant_id", fieldAliases: { company: "tenant_id", entityType: "resource_type", entityId: "resource_id" } });
