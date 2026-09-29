/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("../compat");
const repo = model("tasks", { tenantField: "tenant_id", fieldAliases: { status: "state" } });

repo.STATES = {
  NEW: "new", OPEN: "open", IN_PROGRESS: "in_progress",
  PENDING_CUSTOMER: "pending_customer", PENDING_VENDOR: "pending_vendor",
  PENDING_APPROVAL: "pending_approval", ON_HOLD: "on_hold",
  RESOLVED: "resolved", CLOSED: "closed", CANCELLED: "cancelled",
};

module.exports = repo;
