/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("../../compat");
module.exports = model("faq_categories", { tenantField: "tenant_id", fieldAliases: { company: "tenant_id" } });
