/**
 * PostgreSQL-backed model — compatibility shim with ITSM FK aliases.
 * The conflict service addresses change conflicts via `change` /
 * `conflictingChange`; the table stores `_id`-suffixed columns.
 */
const { model } = require("../../compat");
module.exports = model("change_conflicts", {
  fieldAliases: {
    company: "company_id",
    change: "change_id",
    conflictingChange: "conflicting_change_id",
  },
});