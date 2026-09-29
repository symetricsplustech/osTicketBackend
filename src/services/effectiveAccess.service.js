/**
 * Effective-access resolver for a single user within an instance.
 *
 * Composes the same layers the request middleware uses so the Effective
 * Access tab and the Permission Simulator read real server data:
 *   1. membership baseline (requester defaults, admin core, explicit grants)
 *   2. role permissions (user_roles -> roles)
 *   3. temporary authorization_grants (expiry-aware)
 *   4. active delegations (expiry-aware)
 * Nothing is computed on the client.
 */

const { getDB } = require("../config/db");
const ApiError = require("../utils/ApiError");
const {
  resolveEffectivePermissions,
} = require("./authorization.service");
const {
  layeredEffectivePermissions,
} = require("./authorizationGrants.service");
const {
  activeDelegationsFor,
  mergeDelegations,
} = require("./delegation.service");
const { permissionsForMembership } = require("./instanceAccess.service");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value, field) {
  if (!value || !UUID_RE.test(String(value))) throw new ApiError(422, `${field} must be a valid id`);
  return String(value);
}

async function loadRolesForUser(tenantId, userId) {
  const rows = await getDB()("user_roles as ur")
    .join("roles as r", "r.id", "ur.role_id")
    .where("ur.tenant_id", tenantId)
    .where("ur.user_id", userId)
    .select("r.id", "r.name", "r.permissions", "r.denied_permissions", "r.status");
  return rows.map((r) => ({
    _id: r.id,
    name: r.name,
    permissions: r.permissions || [],
    deniedPermissions: r.denied_permissions || [],
    status: r.status,
  }));
}

async function resolveUserEffectiveAccess({ tenantId, targetUserId }) {
  const userId = assertUuid(targetUserId, "targetUserId");
  const user = await getDB()("users")
    .where({ id: userId })
    .select("id", "name", "email", "permissions", "instance_memberships")
    .first();
  if (!user) throw new ApiError(404, "User not found");

  const membership = (user.instance_memberships || []).find(
    (m) => String(m.instance) === String(tenantId),
  );
  if (!membership) throw new ApiError(404, "User is not a member of this instance");

  const directPermissions = permissionsForMembership(membership);
  const roles = await loadRolesForUser(tenantId, userId);
  const principal = {
    _id: user.id,
    name: user.name,
    email: user.email,
    permissions: directPermissions,
    roles,
  };

  let result = resolveEffectivePermissions(principal);
  result = await layeredEffectivePermissions(principal, tenantId, result, {
    granteeType: "user",
  });
  const delegations = await activeDelegationsFor({ tenantId, delegateUserId: userId });
  result = mergeDelegations(result, delegations);

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    membership: {
      role: membership.role,
      status: membership.status,
      organizationUnit: membership.organizationUnit || null,
      joinedAt: membership.joinedAt || null,
    },
    directPermissions,
    membershipPermissions: membership.permissions || [],
    roles: result.roles,
    grants: result.grants,
    effective: result.effective,
    denied: result.denied,
    sources: result.sources,
    scopes: result.scopes,
    temporaryGrants: result.temporaryGrants || [],
    delegatedGrants: result.delegatedGrants || [],
  };
}

module.exports = { resolveUserEffectiveAccess };
