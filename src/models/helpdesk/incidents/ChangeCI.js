/**
 * PostgreSQL-backed model — compatibility shim with ITSM FK aliases.
 * The service layer addresses change-CI links via `change` / `ci` /
 * `linkedBy` / `isActive`; the table stores `_id`-suffixed and snake_case
 * columns.
 */
const { model } = require("../../compat");
module.exports = model("change_cis", {
  fieldAliases: {
    company: "company_id",
    change: "change_id",
    ci: "ci_id",
    linkedBy: "linked_by",
    isActive: "is_active",
  },
});