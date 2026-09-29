/**
 * PostgreSQL-backed model — compatibility shim with ITSM FK aliases.
 * The service layer addresses implementation results via `change` /
 * `implementedBy` / `remediationEvidence`; the table stores `_id`-suffixed and
 * snake_case columns.
 */
const { model } = require("../../compat");
module.exports = model("change_implementation_results", {
  fieldAliases: {
    company: "company_id",
    change: "change_id",
    implementedBy: "implemented_by",
  },
});