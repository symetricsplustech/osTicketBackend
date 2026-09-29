/**
 * PostgreSQL-backed model — compatibility shim with ITSM FK aliases.
 * The service layer addresses known errors via `problem` / `createdBy` /
 * `updatedBy` / `isActive`; the table stores `_id`-suffixed and snake_case
 * columns.
 */
const { model } = require("../../compat");
module.exports = model("known_errors", {
  fieldAliases: {
    company: "company_id",
    problem: "problem_id",
    createdBy: "created_by",
    updatedBy: "updated_by",
    isActive: "is_active",
  },
});