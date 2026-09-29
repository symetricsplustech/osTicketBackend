/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("./compat");
module.exports = model("priorities", { tenantField: "company_id", fieldAliases: { level: "priority_level" } });
