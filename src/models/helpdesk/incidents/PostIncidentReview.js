/**
 * PostgreSQL-backed model — compatibility shim with ITSM FK aliases.
 * The PIR service addresses the record via `incident` / `majorIncident` /
 * `createdBy` / `approvedBy` / `approvedAt` / `publishedAt`; the table stores
 * `_id`-suffixed and snake_case columns.
 */
const { model } = require("../../compat");
module.exports = model("post_incident_reviews", {
  fieldAliases: {
    company: "company_id",
    incident: "incident_id",
    majorIncident: "major_incident_id",
    createdBy: "created_by",
    approvedBy: "approved_by",
    approvedAt: "approved_at",
    publishedAt: "published_at",
    actionItems: "action_items",
  },
});