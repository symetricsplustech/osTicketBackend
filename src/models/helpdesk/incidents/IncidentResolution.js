/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("../../compat");
module.exports = model("incident_resolutions", {
  fieldAliases: {
    company: "company_id",
    incident: "incident_id",
    resolutionCode: "resolution_code",
    resolvedBy: "resolved_by",
    resolvedAt: "resolved_at",
    rootCause: "root_cause",
    rootCauseCategory: "root_cause_category",
    problem: "problem_id",
    linkedBy: "linked_by",
  },
});