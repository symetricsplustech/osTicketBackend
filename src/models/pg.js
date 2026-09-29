const { getDB } = require("../config/db");
const PostgresRepository = require("../repositories/PostgresRepository");

let _db;

function db() {
  if (!_db) _db = getDB();
  return _db;
}

function repo(table, opts = {}) {
  return new PostgresRepository(db(), table, opts);
}

// ── Platform / Billing ──────────────────────────────────────

const Plan = () => repo("plans", { tenantField: null });
const SuperAdmin = () => repo("super_admins", { tenantField: null });

// ── Company / Tenant ───────────────────────────────────────

const Company = () => repo("companies", { tenantField: null });
const InstanceCompany = () =>
  repo("instance_companies", { tenantField: "tenant_id" });
const InstanceInvitation = () => repo("instance_invitations", { tenantField: "tenant_id" });

// ── Users / Agents / Identity ──────────────────────────────

const User = () => repo("users", { tenantField: "company_id" });
const Agent = () => repo("agents", { tenantField: "company_id" });

// ── Roles / RBAC ──────────────────────────────────────────

const Role = () => repo("roles", { tenantField: "company_id" });
const CustomRole = () => repo("custom_roles", { tenantField: "company_id" });
const CustomPermission = () =>
  repo("custom_permissions", { tenantField: "company_id" });

// ── Organization / Department / Team ───────────────────────

const Organization = () => repo("organizations", { tenantField: "company_id" });
const OrganizationUnit = () =>
  repo("organization_units", { tenantField: "company_id" });
const Department = () => repo("departments", { tenantField: "company_id" });
const Team = () => repo("teams", { tenantField: "company_id" });

// ── Help Topics / Priorities / SLA ─────────────────────────

const SlaPlan = () => repo("sla_plans", { tenantField: "company_id" });
const Priority = () => repo("priorities", { tenantField: "company_id" });
const HelpTopic = () => repo("help_topics", { tenantField: "company_id" });

// ── Tickets ────────────────────────────────────────────────

const Ticket = () => repo("tickets", { tenantField: "company_id" });
const TicketThread = () => repo("ticket_threads", { tenantField: "company_id" });
const TicketFilter = () =>
  repo("ticket_filters", { tenantField: "company_id" });
const TicketLink = () => repo("ticket_links", { tenantField: "company_id" });
const TicketForm = () => repo("ticket_forms", { tenantField: "company_id" });
const TicketStatus = () =>
  repo("ticket_statuses", { tenantField: "company_id" });
const SavedQueue = () => repo("saved_queues", { tenantField: "company_id" });
const TicketTemplate = () =>
  repo("ticket_templates", { tenantField: "company_id" });

// ── Tasks (core engine) ───────────────────────────────────

const Task = () => repo("tasks", { tenantField: "tenant_id" });
const TaskActivity = () =>
  repo("task_activities", { tenantField: "tenant_id" });
const TaskAssignment = () =>
  repo("task_assignments", { tenantField: "tenant_id" });
const TaskAttachment = () =>
  repo("task_attachments", { tenantField: "tenant_id" });
const TaskRelationship = () => repo("task_relationships", { tenantField: "tenant_id" });
const TaskSLA = () => repo("task_slas", { tenantField: "tenant_id" });
const TaskWatcher = () => repo("task_watchers", { tenantField: "tenant_id" });

// ── Incidents ──────────────────────────────────────────────

const Incident = () => repo("incidents", { tenantField: "company_id" });
const IncidentTask = () =>
  repo("incident_tasks", { tenantField: "company_id" });
const IncidentRelationship = () =>
  repo("incident_relationships", { tenantField: "company_id" });
const IncidentCI = () => repo("incident_cis", { tenantField: "company_id" });
const IncidentResolution = () =>
  repo("incident_resolutions", { tenantField: "company_id" });
const IncidentAssignmentHistory = () =>
  repo("incident_assignment_histories", { tenantField: "company_id" });
const IncidentServiceOffering = () =>
  repo("incident_service_offerings", { tenantField: "company_id" });

// ── Problems ───────────────────────────────────────────────

const Problem = () => repo("problems", { tenantField: "company_id" });
const ProblemTask = () => repo("problem_tasks", { tenantField: "company_id" });
const ProblemChange = () =>
  repo("problem_changes", { tenantField: "company_id" });
const ProblemCI = () => repo("problem_cis", { tenantField: "company_id" });
const ProblemIncident = () =>
  repo("problem_incidents", { tenantField: "company_id" });
const ProblemKnowledge = () =>
  repo("problem_knowledge", { tenantField: "company_id" });
const ProblemServiceOffering = () =>
  repo("problem_service_offerings", { tenantField: "company_id" });
const ProblemAssignmentHistory = () =>
  repo("problem_assignment_histories", { tenantField: "company_id" });

// ── Changes ────────────────────────────────────────────────

const Change = () => repo("change_requests", { tenantField: "company_id" });
const ChangeTask = () => repo("change_tasks", { tenantField: "company_id" });
const ChangeCI = () => repo("change_cis", { tenantField: "company_id" });
const ChangeConflict = () =>
  repo("change_conflicts", { tenantField: "company_id" });
const ChangeRiskAssessment = () =>
  repo("change_risk_assessments", { tenantField: "company_id" });
const ChangeService = () =>
  repo("change_services", { tenantField: "company_id" });
const ChangeApprovalPolicy = () =>
  repo("change_approval_policies", { tenantField: "company_id" });
const ChangeImplementationResult = () =>
  repo("change_implementation_results", { tenantField: "company_id" });
const StandardChangeTemplate = () =>
  repo("standard_change_templates", { tenantField: "company_id" });

// ── Major Incident ─────────────────────────────────────────

const MajorIncident = () =>
  repo("major_incidents", { tenantField: "company_id" });
const MajorIncidentTimelineEvent = () =>
  repo("major_incident_timeline_events", { tenantField: "company_id" });
const MajorIncidentParticipant = () =>
  repo("major_incident_participants", { tenantField: "company_id" });
const MajorIncidentTeam = () =>
  repo("major_incident_teams", { tenantField: "company_id" });
const MajorIncidentCandidate = () =>
  repo("major_incident_candidates", { tenantField: "company_id" });
const MajorIncidentCommunication = () =>
  repo("major_incident_communications", { tenantField: "company_id" });

// ── Other ITSM ─────────────────────────────────────────────

const KnownError = () => repo("known_errors", { tenantField: "company_id" });
const ServiceRequest = () =>
  repo("service_requests", { tenantField: "company_id" });
const Stakeholder = () => repo("stakeholders", { tenantField: "company_id" });
const EscalationRule = () =>
  repo("escalation_rules", { tenantField: "company_id" });
const MaintenanceWindow = () =>
  repo("maintenance_windows", { tenantField: "company_id" });
const BlackoutWindow = () =>
  repo("blackout_windows", { tenantField: "company_id" });
const CommunicationPlan = () =>
  repo("communication_plans", { tenantField: "company_id" });
const CommunicationTask = () =>
  repo("communication_tasks", { tenantField: "company_id" });
const CommunicationTemplate = () =>
  repo("communication_templates", { tenantField: "company_id" });
const BridgeSession = () =>
  repo("bridge_sessions", { tenantField: "company_id" });
const Pir = () => repo("pirs", { tenantField: "company_id" });
const RootCauseRecord = () =>
  repo("root_cause_records", { tenantField: "company_id" });
const PostIncidentReview = () =>
  repo("post_incident_reviews", { tenantField: "company_id" });

// ── CMDB / Service Portfolio ───────────────────────────────

const ConfigurationItem = () =>
  repo("configuration_items", { tenantField: "tenant_id" });
const CIRelationship = () =>
  repo("ci_relationships", { tenantField: "tenant_id" });
const Dependency = () => repo("dependencies", { tenantField: "company_id" });
const BusinessService = () =>
  repo("business_services", { tenantField: "tenant_id" });
const TechnicalService = () =>
  repo("technical_services", { tenantField: "tenant_id" });
const ServicePortfolio = () =>
  repo("service_portfolios", { tenantField: "tenant_id" });
const ServiceOffering = () =>
  repo("service_offerings", { tenantField: "tenant_id" });
const ServiceCommitment = () =>
  repo("service_commitments", { tenantField: "tenant_id" });
const ServiceLevelCommitment = () =>
  repo("service_level_commitments", { tenantField: "tenant_id" });
const ServiceOwner = () => repo("service_owners", { tenantField: "tenant_id" });

// ── SLM ────────────────────────────────────────────────────

const BusinessSchedule = () =>
  repo("business_schedules", { tenantField: "tenant_id" });
const HolidayCalendar = () =>
  repo("holiday_calendars", { tenantField: "tenant_id" });
const OLA = () => repo("olas", { tenantField: "tenant_id" });
const SLABreakdown = () => repo("sla_breakdowns", { tenantField: "tenant_id" });
const SLACondition = () => repo("sla_conditions", { tenantField: "tenant_id" });
const SLARepairJob = () =>
  repo("sla_repair_jobs", { tenantField: "tenant_id" });
const UnderpinningContractTarget = () =>
  repo("underpinning_contract_targets", { tenantField: "tenant_id" });
const SlaEvent = () => repo("sla_events", { tenantField: "company_id" });

// ── Approvals ──────────────────────────────────────────────

const ApprovalDefinition = () =>
  repo("approval_definitions", { tenantField: "tenant_id" });
const ApprovalInstance = () =>
  repo("approval_instances", { tenantField: "tenant_id" });
const ApprovalStep = () => repo("approval_steps", { tenantField: "tenant_id" });
const ApprovalDecision = () =>
  repo("approval_decisions", { tenantField: "tenant_id" });
const Approver = () => repo("approvers", { tenantField: "tenant_id" });
const Delegation = () => repo("delegations", { tenantField: "tenant_id" });
const Approval = () =>
  repo("approval_definitions", { tenantField: "tenant_id" });

// ── Catalog ────────────────────────────────────────────────

const Catalog = () => repo("catalogs", { tenantField: "tenant_id" });
const CatalogCategory = () =>
  repo("catalog_categories", { tenantField: "tenant_id" });
const CatalogItem = () => repo("catalog_items", { tenantField: "tenant_id" });
const CatalogItemVariable = () =>
  repo("catalog_item_variables", { tenantField: "tenant_id" });
const CatalogTask = () => repo("catalog_tasks", { tenantField: "tenant_id" });
const CatalogEntitlement = () =>
  repo("catalog_entitlements", { tenantField: "tenant_id" });
const Cart = () => repo("carts", { tenantField: "tenant_id" });
const CartItem = () => repo("cart_items");
const Request = () => repo("requests", { tenantField: "tenant_id" });
const RequestedItem = () =>
  repo("requested_items", { tenantField: "tenant_id" });
const RequestApproval = () =>
  repo("request_approvals", { tenantField: "tenant_id" });
const ItemApproval = () => repo("item_approvals", { tenantField: "tenant_id" });
const FulfillmentPlan = () =>
  repo("fulfillment_plans", { tenantField: "tenant_id" });
const FulfillmentStep = () =>
  repo("fulfillment_steps", { tenantField: "tenant_id" });
const UserCriteria = () => repo("user_criteria", { tenantField: "tenant_id" });
const VariableSet = () => repo("variable_sets", { tenantField: "tenant_id" });

// ── Knowledge Base ─────────────────────────────────────────

const KnowledgeBase = () =>
  repo("knowledge_bases", { tenantField: "tenant_id" });
const FaqCategory = () => repo("faq_categories", { tenantField: "tenant_id" });
const Faq = () => repo("faqs", { tenantField: "tenant_id" });
const KnowledgeComment = () =>
  repo("knowledge_comments", { tenantField: "tenant_id" });
const KnowledgeContributorCriteria = () =>
  repo("knowledge_contributor_criteria", { tenantField: "tenant_id" });
const KnowledgeFeedback = () =>
  repo("knowledge_feedback", { tenantField: "tenant_id" });
const KnowledgeRating = () =>
  repo("knowledge_ratings", { tenantField: "tenant_id" });
const KnowledgeReaderCriteria = () =>
  repo("knowledge_reader_criteria", { tenantField: "tenant_id" });
const KnowledgeVersion = () =>
  repo("knowledge_versions", { tenantField: "tenant_id" });
const KnowledgeApproval = () =>
  repo("knowledge_approvals", { tenantField: "tenant_id" });
const CannedResponse = () =>
  repo("canned_responses", { tenantField: "tenant_id" });
const Announcement = () => repo("announcements", { tenantField: "tenant_id" });

// ── Assignment / Routing ───────────────────────────────────

const Skill = () => repo("skills", { tenantField: "tenant_id" });
const AgentSkill = () => repo("agent_skills", { tenantField: "tenant_id" });
const AgentCapacity = () =>
  repo("agent_capacities", { tenantField: "tenant_id" });
const AgentPresence = () =>
  repo("agent_presences", { tenantField: "tenant_id" });
const AssignmentRule = () =>
  repo("assignment_rules", { tenantField: "tenant_id" });
const AssignmentEvent = () =>
  repo("assignment_events", { tenantField: "tenant_id" });
const Queue = () => repo("queues", { tenantField: "tenant_id" });
const RoutingRule = () => repo("routing_rules", { tenantField: "tenant_id" });

// ── On-Call ─────────────────────────────────────────────────

const OnCallSchedule = () =>
  repo("oncall_schedules", { tenantField: "tenant_id" });
const Roster = () => repo("rosters", { tenantField: "tenant_id" });
const RosterMember = () => repo("roster_members", { tenantField: "tenant_id" });
const Rotation = () => repo("rotations", { tenantField: "tenant_id" });
const Shift = () => repo("shifts", { tenantField: "tenant_id" });
const EscalationLevel = () =>
  repo("escalation_levels", { tenantField: "tenant_id" });
const EscalationPolicy = () =>
  repo("oncall_escalation_policies", { tenantField: "tenant_id" });
const ContactPreference = () =>
  repo("contact_preferences", { tenantField: "tenant_id" });
const CoverageRequest = () =>
  repo("coverage_requests", { tenantField: "tenant_id" });
const TimeOffRequest = () =>
  repo("time_off_requests", { tenantField: "tenant_id" });

// ── Walkup ─────────────────────────────────────────────────

const WalkupLocation = () =>
  repo("walkup_locations", { tenantField: "tenant_id" });
const WalkupQueue = () => repo("walkup_queues", { tenantField: "tenant_id" });
const WalkupService = () =>
  repo("walkup_services", { tenantField: "tenant_id" });
const WalkupCheckin = () =>
  repo("walkup_checkins", { tenantField: "tenant_id" });
const WalkupInteraction = () =>
  repo("walkup_interactions", { tenantField: "tenant_id" });
const Appointment = () => repo("appointments", { tenantField: "tenant_id" });
const Kiosk = () => repo("kiosks", { tenantField: "tenant_id" });
const WaitTimeEvent = () =>
  repo("wait_time_events", { tenantField: "tenant_id" });

// ── Release ────────────────────────────────────────────────

const Release = () => repo("releases", { tenantField: "tenant_id" });
const ReleaseApproval = () =>
  repo("release_approvals", { tenantField: "tenant_id" });
const ReleaseComponent = () =>
  repo("release_components", { tenantField: "tenant_id" });
const ReleaseDependency = () =>
  repo("release_dependencies", { tenantField: "tenant_id" });
const ReleaseDeployment = () =>
  repo("release_deployments", { tenantField: "tenant_id" });
const ReleasePhase = () => repo("release_phases", { tenantField: "tenant_id" });
const ReleaseTask = () => repo("release_tasks", { tenantField: "tenant_id" });

// ── Improvement ────────────────────────────────────────────

const ImprovementInitiative = () =>
  repo("improvement_initiatives", { tenantField: "tenant_id" });
const ImprovementOpportunity = () =>
  repo("improvement_opportunities", { tenantField: "tenant_id" });
const ImprovementGoal = () =>
  repo("improvement_goals", { tenantField: "tenant_id" });
const ImprovementTask = () =>
  repo("improvement_tasks", { tenantField: "tenant_id" });
const Benefit = () => repo("benefits", { tenantField: "tenant_id" });
const Cost = () => repo("costs", { tenantField: "tenant_id" });
const MetricBaseline = () =>
  repo("metric_baselines", { tenantField: "tenant_id" });
const MetricTarget = () => repo("metric_targets", { tenantField: "tenant_id" });

// ── Outage / Availability ──────────────────────────────────

const Outage = () => repo("outages", { tenantField: "tenant_id" });
const OutageCI = () => repo("outage_cis", { tenantField: "tenant_id" });
const OutageService = () =>
  repo("outage_services", { tenantField: "tenant_id" });
const AvailabilityRecord = () =>
  repo("availability_records", { tenantField: "tenant_id" });

// ── Workflows ──────────────────────────────────────────────

const Workflow = () => repo("workflows", { tenantField: "company_id" });

// ── Notifications / Email ──────────────────────────────────

const EmailTemplate = () =>
  repo("email_templates", { tenantField: "company_id" });
const EmailLog = () => repo("email_logs", { tenantField: "company_id" });
const Notification = () => repo("notifications", { tenantField: "company_id" });
const NotificationEvent = () =>
  repo("notification_events", { tenantField: "tenant_id" });

// ── Audit / Logging ────────────────────────────────────────

const AuditLog = () => repo("audit_logs", { tenantField: "company_id" });
const AuditEvent = () => repo("audit_events", { tenantField: "tenant_id" });

// ── System / Config ────────────────────────────────────────

const SystemSetting = () => repo("system_settings");
const Counter = () => repo("counters");
const ApiKey = () => repo("api_keys", { tenantField: "company_id" });
const Webhook = () => repo("webhooks", { tenantField: "company_id" });
const Integration = () => repo("integrations", { tenantField: "company_id" });
const CustomField = () => repo("custom_fields", { tenantField: "company_id" });

// ── Surveys ────────────────────────────────────────────────

const Survey = () => repo("surveys", { tenantField: "company_id" });
const SurveyResponse = () =>
  repo("survey_responses", { tenantField: "company_id" });

// ── Assets / ITOM ─────────────────────────────────────────

const Asset = () => repo("assets", { tenantField: "company_id" });
const ItomAlert = () => repo("itom_alerts", { tenantField: "company_id" });

// ── Conversations / Chat ───────────────────────────────────

const Conversation = () => repo("conversations", { tenantField: "company_id" });
const ChatMessage = () => repo("chat_messages", { tenantField: "company_id" });

// ── Locale ─────────────────────────────────────────────────

const MessageBundle = () => repo("message_bundles");
const TenantLocalePreference = () => repo("tenant_locale_preferences");
const UserLocalePreference = () => repo("user_locale_preferences");

// ── Billing ────────────────────────────────────────────────

const Subscription = () => repo("subscriptions", { tenantField: "company_id" });
const Invoice = () => repo("invoices", { tenantField: "company_id" });
const BillingAdjustment = () =>
  repo("billing_adjustments", { tenantField: "company_id" });

// ── Misc ───────────────────────────────────────────────────

const Holiday = () => repo("holidays", { tenantField: "company_id" });
const PrivilegedSession = () => repo("privileged_sessions");
const UsageLimit = () => repo("usage_limits", { tenantField: "tenant_id" });
const UsageMeter = () => repo("usage_meters", { tenantField: "tenant_id" });
const HandoverNote = () =>
  repo("handover_notes", { tenantField: "company_id" });
const StatusPage = () => repo("status_pages", { tenantField: "company_id" });
const StatusIncident = () =>
  repo("status_incidents", { tenantField: "company_id" });

// ── RBAC ───────────────────────────────────────────────────

const GroupMembership = () =>
  repo("group_memberships", { tenantField: "tenant_id" });
const UserRole = () => repo("user_roles", { tenantField: "tenant_id" });
const RolePermission = () =>
  repo("role_permissions", { tenantField: "tenant_id" });

module.exports = {
  // Factory functions — call them to get a repo instance
  Plan,
  SuperAdmin,
  Company,
  InstanceCompany,
  InstanceInvitation,
  User,
  Agent,
  Role,
  CustomRole,
  CustomPermission,
  Organization,
  OrganizationUnit,
  Department,
  Team,
  SlaPlan,
  Priority,
  HelpTopic,
  Ticket,
  TicketThread,
  TicketFilter,
  TicketLink,
  TicketForm,
  TicketStatus,
  SavedQueue,
  TicketTemplate,
  Task,
  TaskActivity,
  TaskAssignment,
  TaskAttachment,
  TaskRelationship,
  TaskSLA,
  TaskWatcher,
  Incident,
  IncidentTask,
  IncidentRelationship,
  IncidentCI,
  IncidentResolution,
  IncidentAssignmentHistory,
  IncidentServiceOffering,
  Problem,
  ProblemTask,
  ProblemChange,
  ProblemCI,
  ProblemIncident,
  ProblemKnowledge,
  ProblemServiceOffering,
  ProblemAssignmentHistory,
  Change,
  ChangeTask,
  ChangeCI,
  ChangeConflict,
  ChangeRiskAssessment,
  ChangeService,
  ChangeApprovalPolicy,
  ChangeImplementationResult,
  StandardChangeTemplate,
  MajorIncident,
  MajorIncidentTimelineEvent,
  MajorIncidentParticipant,
  MajorIncidentTeam,
  MajorIncidentCandidate,
  MajorIncidentCommunication,
  KnownError,
  ServiceRequest,
  Stakeholder,
  EscalationRule,
  MaintenanceWindow,
  BlackoutWindow,
  CommunicationPlan,
  CommunicationTask,
  CommunicationTemplate,
  BridgeSession,
  Pir,
  RootCauseRecord,
  PostIncidentReview,
  ConfigurationItem,
  CIRelationship,
  Dependency,
  BusinessService,
  TechnicalService,
  ServicePortfolio,
  ServiceOffering,
  ServiceCommitment,
  ServiceLevelCommitment,
  ServiceOwner,
  BusinessSchedule,
  HolidayCalendar,
  OLA,
  SLABreakdown,
  SLACondition,
  SLARepairJob,
  UnderpinningContractTarget,
  SlaEvent,
  ApprovalDefinition,
  ApprovalInstance,
  ApprovalStep,
  ApprovalDecision,
  Approver,
  Delegation,
  Approval,
  Catalog,
  CatalogCategory,
  CatalogItem,
  CatalogItemVariable,
  CatalogTask,
  CatalogEntitlement,
  Cart,
  CartItem,
  Request,
  RequestedItem,
  RequestApproval,
  ItemApproval,
  FulfillmentPlan,
  FulfillmentStep,
  UserCriteria,
  VariableSet,
  KnowledgeBase,
  FaqCategory,
  Faq,
  KnowledgeComment,
  KnowledgeContributorCriteria,
  KnowledgeFeedback,
  KnowledgeRating,
  KnowledgeReaderCriteria,
  KnowledgeVersion,
  KnowledgeApproval,
  CannedResponse,
  Announcement,
  Skill,
  AgentSkill,
  AgentCapacity,
  AgentPresence,
  AssignmentRule,
  AssignmentEvent,
  Queue,
  RoutingRule,
  OnCallSchedule,
  Roster,
  RosterMember,
  Rotation,
  Shift,
  EscalationLevel,
  EscalationPolicy,
  ContactPreference,
  CoverageRequest,
  TimeOffRequest,
  WalkupLocation,
  WalkupQueue,
  WalkupService,
  WalkupCheckin,
  WalkupInteraction,
  Appointment,
  Kiosk,
  WaitTimeEvent,
  Release,
  ReleaseApproval,
  ReleaseComponent,
  ReleaseDependency,
  ReleaseDeployment,
  ReleasePhase,
  ReleaseTask,
  ImprovementInitiative,
  ImprovementOpportunity,
  ImprovementGoal,
  ImprovementTask,
  Benefit,
  Cost,
  MetricBaseline,
  MetricTarget,
  Outage,
  OutageCI,
  OutageService,
  AvailabilityRecord,
  Workflow,
  EmailTemplate,
  EmailLog,
  Notification,
  NotificationEvent,
  AuditLog,
  AuditEvent,
  SystemSetting,
  Counter,
  ApiKey,
  Webhook,
  Integration,
  CustomField,
  Survey,
  SurveyResponse,
  Asset,
  ItomAlert,
  Conversation,
  ChatMessage,
  MessageBundle,
  TenantLocalePreference,
  UserLocalePreference,
  Subscription,
  Invoice,
  BillingAdjustment,
  Holiday,
  PrivilegedSession,
  UsageLimit,
  UsageMeter,
  HandoverNote,
  StatusPage,
  StatusIncident,
  GroupMembership,
  UserRole,
  RolePermission,
};
