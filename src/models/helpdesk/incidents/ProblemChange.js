/**
 * PostgreSQL-backed model — compatibility shim with ITSM FK aliases.
 * The service layer addresses change links via `problem` / `change` /
 * `relationshipType` / `linkedBy` / `isActive`; the table stores `_id`-suffixed
 * and snake_case columns.
 */
const { model } = require("../../compat");
module.exports = model("problem_changes", {
  fieldAliases: {
    company: "company_id",
    problem: "problem_id",
    change: "change_id",
    relationshipType: "relationship_type",
    linkedBy: "linked_by",
    isActive: "is_active",
  },
});