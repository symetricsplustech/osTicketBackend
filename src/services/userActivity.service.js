/**
 * Assigned Work and Work History projections for a directory user.
 *
 * A directory user is a `users` row; operational work is owned by the matching
 * `agents` row (same tenant + email). Everything here is read from real
 * operational tables (tickets, tasks, audit_events) — nothing is inferred.
 */

const { getDB } = require("../config/db");
const ApiError = require("../utils/ApiError");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value, field) {
  if (!value || !UUID_RE.test(String(value))) {
    throw new ApiError(422, `${field} must be a valid id`);
  }
  return String(value);
}

async function resolveUser(tenantId, userId) {
  const id = assertUuid(userId, "userId");
  const user = await getDB()("users")
    .where({ id })
    .select("id", "name", "email")
    .first();
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

async function resolveAgentIds(db, tenantId, email) {
  if (!email) return [];
  const rows = await db("agents")
    .where({ company_id: tenantId })
    .whereRaw("lower(email) = ?", [String(email).toLowerCase()])
    .select("id");
  return rows.map((r) => r.id);
}

const OPEN_TICKET_STATUSES = ["closed", "resolved", "cancelled"];
const OPEN_TASK_STATES = ["closed", "cancelled", "done"];

async function listAssignedWork({ tenantId, userId }) {
  const tenant = assertUuid(tenantId, "tenantId");
  const user = await resolveUser(tenant, userId);
  const db = getDB();
  const agentIds = await resolveAgentIds(db, tenant, user.email);
  if (!agentIds.length) return { tickets: [], tasks: [] };

  const [tickets, tasks] = await Promise.all([
    db("tickets")
      .where({ company_id: tenant })
      .whereIn("agent_id", agentIds)
      .whereNotIn("status", OPEN_TICKET_STATUSES)
      .orderBy("last_activity", "desc")
      .limit(100)
      .select(
        "id",
        "number",
        "subject",
        "status",
        "priority",
        "due_date",
        "last_activity",
        "updated_at",
      ),
    db("tasks")
      .where({ tenant_id: tenant })
      .whereIn("assigned_to", agentIds)
      .whereNotIn("state", OPEN_TASK_STATES)
      .orderBy("updated_at", "desc")
      .limit(100)
      .select("id", "number", "title", "state", "priority", "due_at", "updated_at"),
  ]);

  return {
    tickets: tickets.map((t) => ({
      id: t.id,
      type: "ticket",
      number: t.number,
      title: t.subject,
      status: t.status,
      priority: t.priority,
      dueAt: t.due_date,
      updatedAt: t.last_activity || t.updated_at,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      type: "task",
      number: t.number,
      title: t.title,
      status: t.state,
      priority: t.priority,
      dueAt: t.due_at,
      updatedAt: t.updated_at,
    })),
  };
}

async function listWorkHistory({ tenantId, userId, limit = 100 }) {
  const tenant = assertUuid(tenantId, "tenantId");
  const user = await resolveUser(tenant, userId);
  const db = getDB();
  const agentIds = await resolveAgentIds(db, tenant, user.email);
  const cap = Math.min(500, Math.max(1, Number(limit) || 100));

  const [tasks, tickets, audits] = await Promise.all([
    agentIds.length
      ? db("tasks")
          .where({ tenant_id: tenant })
          .whereIn("assigned_to", agentIds)
          .whereIn("state", ["closed", "resolved", "done"])
          .orderBy("closed_at", "desc")
          .limit(cap)
          .select("id", "number", "title", "state", "closed_at", "updated_at")
      : Promise.resolve([]),
    agentIds.length
      ? db("tickets")
          .where({ company_id: tenant })
          .whereIn("agent_id", agentIds)
          .whereIn("status", ["resolved", "closed"])
          .orderBy("resolved_at", "desc")
          .limit(cap)
          .select(
            "id",
            "number",
            "subject",
            "status",
            "resolved_at",
            "closed_at",
            "updated_at",
          )
      : Promise.resolve([]),
    db("audit_events")
      .where({ tenant_id: tenant, actor_id: user.id })
      .orderBy("created_at", "desc")
      .limit(cap)
      .select("id", "action", "resource_type", "resource_id", "created_at"),
  ]);

  const items = [
    ...tasks.map((t) => ({
      id: t.id,
      type: "task",
      reference: t.number,
      title: t.title,
      status: t.state,
      at: t.closed_at || t.updated_at,
    })),
    ...tickets.map((t) => ({
      id: t.id,
      type: "ticket",
      reference: t.number,
      title: t.subject,
      status: t.status,
      at: t.resolved_at || t.closed_at || t.updated_at,
    })),
    ...audits.map((a) => ({
      id: a.id,
      type: "audit",
      reference: a.resource_type,
      title: a.action,
      status: a.resource_type,
      at: a.created_at,
    })),
  ]
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, cap);

  return { items };
}

module.exports = { listAssignedWork, listWorkHistory };
