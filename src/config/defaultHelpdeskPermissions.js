// Default HelpDesk access granted to every newly created user.
//
// Every user created by anyone (self-registration, inbound email, admin-created
// customer, import, etc.) starts out with the full HelpDesk console access so
// they can actually use the product. The tenant / platform owner can then
// restrict things and features per user from Settings -> User Management by
// removing (or adding) these granular keys.
//
// Keys mirror the HelpDesk ITSM route map (all modules 1-12: tasks/tickets,
// incidents, major incidents, problems, changes, request catalog, knowledge,
// SLAs, assignment/my-work, approvals, walk-up, on-call). These are read/UI
// access keys; mutation actions remain action-gated elsewhere.
const DEFAULT_HELPDESK_PERMISSIONS = [
  // Tasks / Tickets
  "itsm.core.task.read",
  "itsm.core.ui.task_record_shell.access",
  "itsm.core.ui.my_work.access",
  "itsm.core.task_read",
  "itsm.core.audit_event.read",
  "itsm.core.audit_read",
  // Incidents
  "itsm.incident.incident.read",
  "itsm.incident.ui.incident_list.access",
  "itsm.incident.ui.incident_record.access",
  "itsm.incident.ui.incident_dashboards.access",
  "itsm.incident.ui.triage_panel.access",
  "itsm.incident.incident_resolution.read",
  // Major Incidents
  "itsm.major_incident.major_incident.read",
  "itsm.major_incident.ui.mi_dashboard.access",
  "itsm.major_incident.bridge_session.read",
  "itsm.major_incident.ui.collaborate.access",
  "itsm.major_incident.ui.mi_workbench.access",
  "itsm.major_incident.post_incident_report.read",
  "itsm.major_incident.ui.pir.access",
  // Problems
  "itsm.problem.problem.read",
  "itsm.problem.ui.problem_list.access",
  "itsm.problem.ui.problem_dashboard.access",
  "itsm.problem.known_error.read",
  "itsm.problem.ui.known_error.access",
  // Changes
  "itsm.change.change_request.read",
  "itsm.change.ui.change_list.access",
  "itsm.change.ui.change_dashboard.access",
  "itsm.change.ui.change_calendar.access",
  "itsm.change.cabmeeting.read",
  "itsm.change.ui.cab_workbench.access",
  // Request catalog
  "itsm.request_catalog.catalog_item.read",
  "itsm.request_catalog.ui.catalog_home.access",
  "itsm.request_catalog.request.read",
  "itsm.request_catalog.ui.req_detail.access",
  "itsm.request_catalog.ritm_read",
  "itsm.request_catalog.ui.ritm_detail.access",
  // Knowledge
  "itsm.knowledge.knowledge_article.read",
  "itsm.knowledge.ui.knowledge_search.access",
  "itsm.knowledge.article_read",
  "itsm.knowledge.kb_read",
  "itsm.knowledge.ui.knowledge_analytics.access",
  // SLA
  "itsm.sla.definition_read",
  "itsm.sla.ui.sla_dashboard.access",
  "itsm.sla.task_sla_read",
  "itsm.sla.ui.sla_timer.access",
  // Assignment / My Work
  "itsm.assignment.queue_read",
  "itsm.assignment.ui.agent_inbox.access",
  "itsm.assignment.queue.read",
  "itsm.assignment.ui.queue_view.access",
  "itsm.assignment.routing_read",
  "itsm.assignment.ui.routing_diagnostics.access",
  "itsm.assignment.routing_rule.read",
  "itsm.assignment.ui.assignment_admin.access",
  // Approvals
  "itsm.approval.approval_read",
  "itsm.approval.ui.my_approvals.access",
  "itsm.approval.delegation.read",
  "itsm.approval.ui.delegation.access",
  // Walk-Up
  "itsm.walkup.walkup_location.read",
  "itsm.walkup.ui.location_finder.access",
  "itsm.walkup.walkup_checkin.create",
  "itsm.walkup.ui.check_in.access",
  "itsm.walkup.walkup_queue.read",
  "itsm.walkup.ui.queue_monitor.access",
  "itsm.walkup.appointment_read_own",
  "itsm.walkup.ui.appointment_booking.access",
  "itsm.walkup.kiosk.read",
  "itsm.walkup.ui.kiosk.access",
  // On-Call
  "itsm.on_call.on_call_schedule.read",
  "itsm.on_call.ui.on_call_dashboard.access",
  "itsm.on_call.schedule_read",
  "itsm.on_call.ui.calendar.access",
  "itsm.on_call.roster_read",
  "itsm.on_call.ui.roster_editor.access",
  "itsm.on_call.shift_read",
  "itsm.on_call.ui.shift_editor.access",
  "itsm.on_call.escalation_policy_read",
  "itsm.on_call.ui.escalation_policy.access",
];

module.exports = { DEFAULT_HELPDESK_PERMISSIONS };