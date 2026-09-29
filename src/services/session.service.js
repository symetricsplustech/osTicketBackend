/**
 * Session registry for the User Access Workspace "Sessions / MFA" tab.
 *
 * Auth is stateless JWT, so this service records authentication events into
 * `user_sessions` and exposes them for a directory user. A directory user is
 * a `users` row; the operational identity is the matching `agents` row
 * (same tenant + email), so sessions from either identity are shown.
 *
 * Revoking a session marks the row revoked and bumps the subject's
 * session_version, which the auth middleware compares against the token's
 * `sv` claim — invalidating outstanding JWTs.
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

function optionalUuid(value) {
  if (!value) return null;
  const id = String(value);
  return UUID_RE.test(id) ? id : null;
}

function shapeSession(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id,
    email: row.email,
    ip: row.ip,
    userAgent: row.user_agent,
    device: row.device,
    mfaVerified: !!row.mfa_verified,
    lastActiveAt: row.last_active_at,
    revokedAt: row.revoked_at,
    revokedBy: row.revoked_by,
    status: row.revoked_at ? "revoked" : "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveAgentIds(db, tenantId, email) {
  if (!email) return [];
  const rows = await db("agents")
    .where({ company_id: tenantId })
    .whereRaw("lower(email) = ?", [String(email).toLowerCase()])
    .select("id");
  return rows.map((r) => r.id);
}

async function loadUser(tenantId, userId) {
  const id = assertUuid(userId, "userId");
  const user = await getDB()("users")
    .where({ id })
    .select(
      "id",
      "name",
      "email",
      "two_factor_enabled",
      "two_factor_backup_codes",
      "last_login",
      "last_seen_at",
      "session_version",
    )
    .first();
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

/** Best-effort: never throws, so it can be called from the auth hot path. */
async function recordSession({
  tenantId = null,
  userId = null,
  agentId = null,
  email = "",
  ip = "",
  userAgent = "",
  mfaVerified = false,
} = {}) {
  try {
    const db = getDB();
    const device = /mobile|android|iphone|ipad/i.test(userAgent)
      ? "Mobile"
      : /curl|postman|node|axios/i.test(userAgent)
        ? "API client"
        : "Web browser";
    await db("user_sessions").insert({
      tenant_id: optionalUuid(tenantId),
      user_id: optionalUuid(userId),
      agent_id: optionalUuid(agentId),
      email: String(email || "").toLowerCase(),
      ip: String(ip || "").slice(0, 100),
      user_agent: String(userAgent || "").slice(0, 500),
      device,
      mfa_verified: !!mfaVerified,
    });
  } catch {
    // Session recording must never block authentication.
  }
}

async function mfaStatusForUser(tenantId, userId) {
  const user = await loadUser(tenantId, userId);
  const codes = Array.isArray(user.two_factor_backup_codes)
    ? user.two_factor_backup_codes
    : [];
  // Either the user or the linked agent (same email) can hold issued tokens,
  // so report the highest session version across both identities.
  const agentIds = await resolveAgentIds(getDB(), tenantId, user.email);
  let agentVersion = 0;
  if (agentIds.length) {
    const row = await getDB()("agents")
      .whereIn("id", agentIds)
      .max("session_version as v")
      .first();
    agentVersion = Number((row && row.v) || 0);
  }
  return {
    enabled: !!user.two_factor_enabled,
    backupCodesRemaining: codes.length,
    lastLogin: user.last_login,
    lastSeenAt: user.last_seen_at,
    sessionVersion: Math.max(Number(user.session_version || 0), agentVersion),
  };
}

async function listSessionsForUser({ tenantId, userId }) {
  const tenant = assertUuid(tenantId, "tenantId");
  const user = await loadUser(tenant, userId);
  const db = getDB();
  const agentIds = await resolveAgentIds(db, tenant, user.email);

  const query = db("user_sessions")
    .where({ tenant_id: tenant })
    .where((builder) => {
      builder.where("user_id", user.id);
      if (agentIds.length) builder.orWhereIn("agent_id", agentIds);
    })
    .orderBy("created_at", "desc")
    .limit(200);

  const rows = await query;
  return {
    mfa: await mfaStatusForUser(tenant, user.id),
    items: rows.map(shapeSession),
  };
}

async function revokeSession({ tenantId, userId, sessionId, revokedBy = null }) {
  const tenant = assertUuid(tenantId, "tenantId");
  const user = await loadUser(tenant, userId);
  const id = assertUuid(sessionId, "sessionId");
  const db = getDB();

  const existing = await db("user_sessions")
    .where({ id, tenant_id: tenant })
    .first();
  if (!existing) return null;

  const [row] = await db("user_sessions")
    .where({ id, tenant_id: tenant })
    .update({
      revoked_at: db.fn.now(),
      revoked_by: optionalUuid(revokedBy),
      updated_at: db.fn.now(),
    })
    .returning("*");

  if (existing.user_id) {
    await db("users")
      .where({ id: existing.user_id })
      .increment("session_version", 1);
  }
  if (existing.agent_id) {
    await db("agents")
      .where({ id: existing.agent_id })
      .increment("session_version", 1);
  }

  return shapeSession(row);
}

module.exports = {
  recordSession,
  listSessionsForUser,
  mfaStatusForUser,
  revokeSession,
};
