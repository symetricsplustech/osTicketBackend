/**
 * Email-driven ITSM record executor.
 *
 * Runs BEHIND the emailPermissionGate: no ITSM record is ever created or
 * mutated by email until the tenant holds the target `itsm.*` business
 * permission. `instance.email.*` only covers channel configuration.
 *
 * - create_incident / create_request / create_task build their record from
 *   the parsed message and `action_config` and create via the canonical
 *   services/models.
 * - update_record / run_workflow have no safe default payload: they refuse to
 *   execute (fail closed) until an explicit target permission AND a per-record
 *   executor are supplied.
 *
 * Business guards enforced before execution (GRANULAR §intake.email):
 *   - tenant must resolve
 *   - sender must be a well-formed email address
 *   - the inbound action must be active
 */

const IncidentService = require("./incidentService");
const { createTask } = require("./task.service");
const Request = require("../models/helpdesk/catalog/Request");
const numberingService = require("./numbering.service");
const ticketService = require("./ticket.service");
const { canExecuteInboundAction } = require("./emailPermissionGate.service");

const EMAIL_RECORD_SOURCE = "email";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREAMBLE_LENGTH = 2000;

const pick = (value, fallback) => (value == null || value === "" ? fallback : value);
const preamble = (text) => (text || "").slice(0, PREAMBLE_LENGTH);
const cfgOf = (ctx) => (ctx && ctx.action && ctx.action.action_config) || {};
const userIdOf = (ctx) => {
  const user = ctx && ctx.user;
  return (user && (user._id || user.id)) || null;
};

/* ------------------------------------------------------------------ *
 * Pure record-payload builders (unit-testable without DB)
 * ------------------------------------------------------------------ */

function buildIncidentRecord(ctx) {
  const cfg = cfgOf(ctx);
  return {
    company: ctx.companyId,
    title: pick(cfg.title, ctx.subject || "Email-driven incident"),
    description: pick(cfg.summary || cfg.description, preamble(ctx.text)),
    severity: pick(cfg.severity, "sev3"),
    impact: pick(cfg.impact, "medium"),
    urgency: pick(cfg.urgency, "medium"),
    priority: pick(cfg.priority, "normal"),
    status: pick(cfg.status, "new"),
    assignedTo: null,
    assignment_group_id: null,
    callerId: null,
    customFields: {
      source: EMAIL_RECORD_SOURCE,
      messageId: ctx.messageId,
      callerEmail: ctx.senderEmail,
      receivedAt: new Date(ctx.receivedAt || Date.now()).toISOString(),
    },
  };
}

function buildRequestRecord(ctx) {
  const cfg = cfgOf(ctx);
  return {
    title: pick(cfg.title, ctx.subject || "Email-driven request"),
    description: pick(cfg.summary || cfg.description, preamble(ctx.text)),
    requester: userIdOf(ctx),
    requestedFor: userIdOf(ctx),
    openedBy: userIdOf(ctx),
    createdBy: userIdOf(ctx),
    source: EMAIL_RECORD_SOURCE,
    priority: pick(cfg.priority, "medium"),
    status: pick(cfg.status, "open"),
  };
}

function buildTaskRecord(ctx) {
  const cfg = cfgOf(ctx);
  return {
    title: pick(cfg.title, ctx.subject || "Email-driven task"),
    description: pick(cfg.summary || cfg.description, preamble(ctx.text)),
    type: pick(cfg.type, "task"),
    priority: pick(cfg.priority, "medium"),
    impact: cfg.impact,
    urgency: cfg.urgency,
    category: cfg.category,
    requestedBy: userIdOf(ctx),
    requestedFor: userIdOf(ctx),
    source: EMAIL_RECORD_SOURCE,
  };
}

/* ------------------------------------------------------------------ *
 * Business guards (pure) — valid source states before execution
 * ------------------------------------------------------------------ */

function guardEmailIntake(ctx = {}) {
  if (!ctx.companyId) return { ok: false, reason: "TENANT_UNRESOLVED" };
  if (!ctx.senderEmail || !EMAIL_PATTERN.test(ctx.senderEmail)) {
    return { ok: false, reason: "INVALID_SENDER" };
  }
  if (ctx.action && ctx.action.is_active === false) {
    return { ok: false, reason: "ACTION_INACTIVE" };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Sender user resolution (mirrors legacy handleNewTicket semantics)
 * ------------------------------------------------------------------ */

async function resolveEmailUser({ senderName, senderEmail, companyId }) {
  const User = require("../models/User");
  const normalized = String(senderEmail || "").toLowerCase().trim();
  if (!normalized) return null;
  const existing = await User.findOne({ email: normalized });
  const user =
    existing ||
    (await ticketService.findOrCreateUser({
      name: senderName,
      email: normalized,
      company: companyId,
    }));
  if (user && !user.company && companyId) {
    user.company = companyId;
    await user.save().catch(() => {});
  }
  return user;
}

/* ------------------------------------------------------------------ *
 * Record creators (per action_type) — DB-backed, gated upstream
 * ------------------------------------------------------------------ */

async function createIncidentFromEmail(ctx) {
  const incident = await IncidentService.create(buildIncidentRecord(ctx), userIdOf(ctx));
  return { recordType: "incident", number: incident.number, record: incident };
}

async function createRequestFromEmail(ctx) {
  const number = await numberingService.nextNumber(ctx.companyId, "REQ");
  const request = await Request.create({
    tenantId: ctx.companyId,
    number,
    ...buildRequestRecord(ctx),
  });
  return { recordType: "request", number: request.number, record: request };
}

async function createTaskFromEmail(ctx) {
  const task = await createTask({
    tenantId: ctx.companyId,
    ...buildTaskRecord(ctx),
  });
  return { recordType: "task", number: task.number, record: task };
}

const EXECUTORS = {
  create_incident: createIncidentFromEmail,
  create_request: createRequestFromEmail,
  create_task: createTaskFromEmail,
};
const USER_REQUIRED_TYPES = new Set(["create_request", "create_task"]);

/**
 * Gated entry point: permission gate -> business guards -> record creation.
 * Never throws. Returns { executed, allowed?, decision?, reason?, permission?,
 * recordType?, number?, record? }.
 */
async function executeInboundRecord(ctx) {
  const gate = await canExecuteInboundAction({
    companyId: ctx.companyId,
    membership: ctx.membership,
    principal: ctx.principal,
    action: ctx.action,
    record: ctx.record,
    req: ctx.req,
    audit: ctx.audit, // undefined -> 'deny' default; true audits ALLOW
  });
  if (!gate.allowed) return { executed: false, ...gate };

  const guards = guardEmailIntake(ctx);
  if (!guards.ok) return { executed: false, allowed: false, reason: guards.reason, permission: gate.permission };

  const handler = EXECUTORS[ctx.action && ctx.action.action_type];
  if (!handler) {
    return {
      executed: false,
      allowed: true,
      reason: "EXECUTOR_NOT_AVAILABLE",
      permission: gate.permission,
    };
  }

  if (USER_REQUIRED_TYPES.has(ctx.action.action_type) && !userIdOf(ctx)) {
    // `user: null` is an explicit "no user available" signal — never resolve;
    // `user` undefined auto-resolves the sender account from the message.
    if (ctx.user === undefined) {
      ctx.user = await resolveEmailUser(ctx).catch(() => null);
    }
    if (!userIdOf(ctx)) {
      return { executed: false, allowed: true, reason: "SENDER_UNRESOLVED", permission: gate.permission };
    }
  }

  const outcome = await handler(ctx);
  return { executed: true, allowed: true, permission: gate.permission, ...outcome };
}

module.exports = {
  EMAIL_RECORD_SOURCE,
  buildIncidentRecord,
  buildRequestRecord,
  buildTaskRecord,
  guardEmailIntake,
  resolveEmailUser,
  executeInboundRecord,
  EXECUTORS,
};