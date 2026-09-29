/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("./compat");
module.exports = model("organization_units", { tenantField: "company_id", fieldAliases: { parent: "parent_id" } });
