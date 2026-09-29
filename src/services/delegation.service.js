/**
 * Delegated access service.
 *
 * A delegation lets a delegator temporarily lend permissions/roles to a
 * delegate within an effective window. Rows live in the existing
 * `delegations` table, extended by the hierarchy migration with permission
 * scope, reason, revoke and audit columns.
 *
 * Active = is_active AND not revoked AND within [from_date, to_date).
 * The frontend "Delegated Access" tab and the effective-access resolver both
 * read from here so nothing is faked on the client.
 */

const { getDB } = require("../config/db");
const ApiError = require("../utils/ApiError");
const { isValidPermissionKey } = require("./authorizationGrants.service");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeId(value, field = "id") {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const id = String(value);
  if (!UUID_RE.test(id)) throw new ApiError(422, `A valid ${field} is required`);
  return id;
}

function toDate(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new ApiError(422, `${field} is not a valid date`);
  return d;
}

function shapeDelegation(row) {
  if (!row) return null;
  const now = Date.now();
  const from = row.from_date ? new Date(row.from_date).getTime() : null;
  const to = row.to_date ? new Date(row.to_date).getTime() : null;
  const revoked = !!row.revoked_at;
  const active =
    !!row.is_active && !revoked && (from === null || from <= now) && (to === null || to > now);
  let status = "active";
  if (revoked) status = "revoked";
  else if (!row.is_active) status = "cancelled";
  else if (to !== null && to <= now) status = "expired";
  else if (from !== null && from > now) status = "scheduled";
  return {
    _id: row.id,
    id: row.id,
    delegatorUserId: row.delegator_id,
    delegateUserId: row.delegate_id,
    permissions: row.permissions || [],
    roleIds: row.role_ids || [],
    scope: row.scope || {},
    reason: row.reason || null,
    startsAt: row.from_date,
    expiresAt: row.to_date,
    isActive: active,
    status,
    revokedAt: row.revoked_at,
    revokedBy: row.revoked_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listDelegations({ tenantId, userId = null, includeInactive = false }) {
  const q = getDB()("delegations").where({ tenant_id: tenantId });
  if (userId) {
    const id = normalizeId(userId, "userId");
    q.andWhere((b) => b.where("delegator_id", id).orWhere("delegate_id", id));
  }
  const rows = await q.orderBy("from_date", "desc");
  const shaped = rows.map(shapeDelegation);
  return includeInactive ? shaped : shaped.filter((d) => d.status !== "cancelled");
}

async function createDelegation({
  tenantId,
  delegatorUserId,
  delegateUserId,
  permissions = [],
  roleIds = [],
  scope = {},
  reason = null,
  startsAt = null,
  expiresAt = null,
  actorId = null,
}) {
  const delegator = normalizeId(delegatorUserId, "delegatorUserId");
  const delegate = normalizeId(delegateUserId, "delegateUserId");
  if (!delegator || !delegate) throw new ApiError(422, "delegatorUserId and delegateUserId are required");
  if (delegator === delegate) throw new ApiError(422, "A user cannot delegate to themselves");

  const perms = (Array.isArray(permissions) ? permissions : []).map((p) => String(p).trim()).filter(Boolean);
  for (const key of perms) {
    if (!isValidPermissionKey(key)) throw new ApiError(422, `Invalid permission key: ${key}`);
  }
  const from = toDate(startsAt, "startsAt") || new Date();
  const to = toDate(expiresAt, "expiresAt");
  if (to && from && new Date(to).getTime() <= new Date(from).getTime()) {
    throw new ApiError(422, "expiresAt must be after startsAt");
  }

  const [row] = await getDB()("delegations")
    .insert({
      tenant_id: tenantId,
      delegator_id: delegator,
      delegate_id: delegate,
      from_date: from,
      to_date: to,
      is_active: true,
      permissions: JSON.stringify(perms),
      role_ids: JSON.stringify(Array.isArray(roleIds) ? roleIds : []),
      scope: JSON.stringify(scope || {}),
      reason: reason || null,
      created_by: normalizeId(actorId) || null,
      updated_by: normalizeId(actorId) || null,
    })
    .returning("*");
  return shapeDelegation(row);
}

async function revokeDelegation({ id, tenantId, revokedBy = null }) {
  const delegationId = normalizeId(id);
  if (!delegationId) return null;
  const existing = await getDB()("delegations").where({ id: delegationId, tenant_id: tenantId }).first();
  if (!existing) return null;
  const [row] = await getDB()("delegations")
    .where({ id: delegationId, tenant_id: tenantId })
    .update({
      is_active: false,
      revoked_at: getDB().fn.now(),
      revoked_by: normalizeId(revokedBy) || null,
      updated_by: normalizeId(revokedBy) || null,
      updated_at: getDB().fn.now(),
    })
    .returning("*");
  return shapeDelegation(row);
}

async function activeDelegationsFor({ tenantId, delegateUserId }) {
  const delegate = normalizeId(delegateUserId, "delegateUserId");
  if (!delegate) return [];
  const rows = await getDB()("delegations")
    .where({ tenant_id: tenantId, delegate_id: delegate, is_active: true, revoked_at: null })
    .orderBy("from_date", "desc");
  return rows.map(shapeDelegation).filter((d) => d.isActive);
}

/**
 * Pure: layer active delegations onto a resolveEffectivePermissions result.
 * Delegated keys are attributed to source "delegated" and also listed in
 * `delegatedGrants` so the Effective Access tab can show provenance.
 */
function mergeDelegations(base, delegations) {
  const result = {
    ...base,
    grants: [...(base.grants || [])],
    effective: [...(base.effective || base.grants || [])],
    sources: { ...(base.sources || {}) },
  };
  const delegatedGrants = [];
  for (const delegation of delegations || []) {
    const expanded = [...(delegation.permissions || [])];
    if (expanded.length) {
      delegatedGrants.push({
        delegationId: delegation.id || delegation._id,
        delegatorUserId: delegation.delegatorUserId,
        permissions: expanded,
        expiresAt: delegation.expiresAt || null,
      });
    }
    for (const key of expanded) {
      if (!result.sources[key]) {
        result.grants.push(key);
        result.effective.push(key);
        result.sources[key] = "delegated";
      }
    }
  }
  result.delegatedGrants = delegatedGrants;
  return result;
}

module.exports = {
  listDelegations,
  createDelegation,
  revokeDelegation,
  activeDelegationsFor,
  mergeDelegations,
  shapeDelegation,
};
