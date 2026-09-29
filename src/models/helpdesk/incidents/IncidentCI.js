/**
 * PostgreSQL-backed model — compatibility shim with ITSM FK aliases.
 * The service layer addresses child entities as `incident` / `ci` / `problem`
 * / `change`; the tables store the `_id`-suffixed FK columns, plus snake_case
 * soft columns (`linkedBy` → `linked_by`, `isActive` → `is_active`).
 */
const { model } = require("../../compat");
module.exports = model("incident_cis", {
  fieldAliases: {
    company: "company_id",
    incident: "incident_id",
    ci: "ci_id",
    linkedBy: "linked_by",
    isActive: "is_active",
  },
});