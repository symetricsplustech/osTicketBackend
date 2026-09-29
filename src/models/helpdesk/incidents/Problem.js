/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("../../compat");
module.exports = model("problems", {
  fieldAliases: {
    company: "company_id",
    createdBy: "created_by",
    updatedBy: "updated_by",
    isActive: "is_active",
    workaroundPublished: "workaround_published",
    permanentFixVerified: "permanent_fix_verified",
    resolvedAt: "resolved_at",
    closedAt: "closed_at",
    knownError: "known_error",
    rootCause: "root_cause",
    assignedTo: "assigned_to",
    assignmentGroup: "assignment_group_id",
    affectedTickets: "affected_tickets",
    affectedCis: "affected_cis",
    customFields: "custom_fields",
  },
  jsonColumns: [
    "timeline",
    "affected_tickets",
    "affected_cis",
    "custom_fields",
  ],
});