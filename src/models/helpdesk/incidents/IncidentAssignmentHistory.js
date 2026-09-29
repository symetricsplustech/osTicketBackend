/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("../../compat");
module.exports = model("incident_assignment_histories", {
  company_id: "company_id",
  fieldAliases: { incident: "incident_id" },
});
