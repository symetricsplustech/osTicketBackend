/**
 * PostgreSQL-backed model — compatibility shim with ITSM FK aliases.
 * The service layer addresses change tasks via `change` / `createdBy` /
 * `assignedTo` / `isActive`; the table stores `_id`-suffixed and snake_case
 * columns.
 */
const { model } = require("../../compat");
module.exports = model("change_tasks", {
  fieldAliases: {
    company: "company_id",
    change: "change_id",
    createdBy: "created_by",
    assignedTo: "assigned_to",
    isActive: "is_active",
  },
});