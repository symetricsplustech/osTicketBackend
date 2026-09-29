const PostgresRepository = require("../repositories/PostgresRepository");

const _cache = {};

// Default field aliases: Mongoose-style ref names → DB column names
// NOTE: 'role' is excluded because some tables use 'role' as a text enum, not a FK
const DEFAULT_FIELD_ALIASES = {
  company: "company_id",
  organization: "organization_id",
  ticket: "ticket_id",
  agent: "agent_id",
  dept: "dept_id",
  team: "team_id",
  user: "user_id",
  sla: "sla_id",
  topic: "topic_id",
  manager: "manager_id",
  leader: "leader_id",
  incident: "incident_id",
  problem: "problem_id",
  change: "change_id",
};

function model(tableName, opts = {}) {
  if (!_cache[tableName]) {
    // Merge default aliases with model-specific ones
    const mergedAliases = { ...DEFAULT_FIELD_ALIASES, ...(opts.fieldAliases || {}) };
    _cache[tableName] = new PostgresRepository(null, tableName, { ...opts, fieldAliases: mergedAliases });
  } else if (opts.instanceMethods || opts.hooks) {
    const existing = _cache[tableName];
    if (opts.instanceMethods) Object.assign(existing.instanceMethods, opts.instanceMethods);
    if (opts.hooks) Object.assign(existing.hooks, opts.hooks);
  }
  return _cache[tableName];
}

const STATUSES = {
  NEW: "new",
  OPEN: "open",
  TRIAGED: "triaged",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  PENDING_CUSTOMER: "pending_customer",
  PENDING_VENDOR: "pending_vendor",
  PENDING_APPROVAL: "pending_approval",
  ON_HOLD: "on_hold",
  ESCALATED: "escalated",
  OVERDUE: "overdue",
  RESOLVED: "resolved",
  VERIFICATION: "verification",
  CLOSED: "closed",
  CANCELLED: "cancelled",
  REJECTED: "rejected",
  DUPLICATE: "duplicate",
  SPAM: "spam",
  ARCHIVED: "archived",
  DELETED: "deleted",
};

module.exports = { model, STATUSES };
