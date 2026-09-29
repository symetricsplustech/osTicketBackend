/**
 * PostgreSQL-backed model — auto-generated compatibility shim.
 */
const { model } = require("./compat");
const repo = model("workflows", { company_id: "company_id" });

repo.EVENTS = [
  "ticket.created", "ticket.updated", "ticket.assigned", "ticket.claimed",
  "ticket.transferred", "ticket.replied", "ticket.note_added", "ticket.status_changed",
  "ticket.priority_changed", "ticket.overdue", "ticket.escalated", "ticket.resolved",
  "ticket.closed", "ticket.reopened", "customer.replied", "sla.breached",
  "sla.at_risk", "task.completed", "approval.completed", "inbound.email", "schedule.timer",
];

repo.ACTIONS = [
  "assign_agent", "assign_team", "transfer_dept", "set_priority", "set_sla",
  "set_status", "add_tags", "add_note", "create_task", "notify_agent",
  "notify_team", "notify_dept_manager", "notify_customer", "send_email",
  "send_webhook", "start_approval", "pause_sla", "resume_sla", "escalate",
  "create_incident", "link_asset", "call_api",
];

module.exports = repo;
