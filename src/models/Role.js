/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("./compat");
const repo = model("roles", { company_id: "company_id" });

const PERMISSIONS = [
  "tickets.view", "tickets.create", "tickets.edit", "tickets.assign",
  "tickets.transfer", "tickets.close", "tickets.delete", "tickets.reply",
  "tickets.note", "tickets.tasks", "users.manage", "kb.manage", "canned.manage",
  "admin.manage", "orgs.manage", "escalations.manage", "organization.manage",
  "organization.units.manage", "organization.locations.manage", "access.manage",
  "roles.manage", "modules.manage", "billing.view", "billing.manage",
  "workflow.manage", "integrations.manage", "reports.manage", "data.manage",
  "audit.view", "approvals.decide", "records.view", "records.create",
  "records.update", "records.delete", "exports.create", "security.manage",
];

repo.PERMISSIONS = PERMISSIONS;
repo.ROLE_CATEGORIES = ["platform", "organization", "administrative", "module", "operational", "auditor"];
repo.ROLE_SCOPES = ["platform", "tenant"];

module.exports = repo;
