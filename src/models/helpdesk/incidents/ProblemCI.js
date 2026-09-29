/**
 * PostgreSQL-backed model — compatibility shim with ITSM FK aliases.
 * The service layer addresses child entities as `problem` / `ci`; the tables
 * store the `_id`-suffixed FK columns, plus snake_case soft columns.
 */
const { model } = require("../../compat");
module.exports = model("problem_cis", {
  fieldAliases: {
    company: "company_id",
    problem: "problem_id",
    ci: "ci_id",
    linkedBy: "linked_by",
    isActive: "is_active",
  },
});