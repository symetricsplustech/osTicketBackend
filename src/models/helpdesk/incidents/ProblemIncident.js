/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("../../compat");
module.exports = model("problem_incidents", {
  fieldAliases: {
    company: "company_id",
    problem: "problem_id",
    incident: "incident_id",
    linkedBy: "linked_by",
    isActive: "is_active",
  },
});