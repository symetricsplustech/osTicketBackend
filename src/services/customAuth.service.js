const CustomPermission = require("../models/CustomPermission");
const CustomRole = require("../models/CustomRole");

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

const id = (value) => String(value && value._id ? value._id : value || "");

function activeNow(role) {
  const now = Date.now();
  return (
    role.status === "active" &&
    (!role.effectiveFrom || new Date(role.effectiveFrom).getTime() <= now) &&
    (!role.effectiveUntil || new Date(role.effectiveUntil).getTime() >= now)
  );
}

async function getTenantCustomAuth(companyId) {
  const tenantId = id(companyId);
  if (!tenantId) return null;

  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const [permissions, roles] = await Promise.all([
    CustomPermission.find({ company: tenantId, status: "active" }).lean(),
    CustomRole.find({ company: tenantId, status: "active" }).lean(),
  ]);
  const value = {
    permissions: permissions.filter(activeNow),
    roles: roles.filter(activeNow),
  };
  cache.set(tenantId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

function evaluateCustom(permission, snapshot, principal) {
  const customPermissions = snapshot?.permissions || [];
  const customRoles = snapshot?.roles || [];
  const matchingPermissions = customPermissions.filter(
    (item) => item.key === permission,
  );

  if (matchingPermissions.some((item) => item.effect === "deny")) {
    return { decision: "DENY", via: "custom_permission" };
  }
  if (matchingPermissions.some((item) => item.effect === "allow")) {
    const item = matchingPermissions.find((entry) => entry.effect === "allow");
    return {
      decision: "ALLOW",
      via: "custom_permission",
      scope: item.scope || undefined,
      conditions: item.conditions || undefined,
    };
  }

  const principalId = id(principal);
  const principalTeams = new Set((principal?.teams || []).map(id));
  const matchingRoles = customRoles.filter(
    (role) =>
      (role.agentMembers || []).some((member) => id(member) === principalId) ||
      (role.teamMembers || []).some((member) => principalTeams.has(id(member))),
  );
  if (
    matchingRoles.some((role) =>
      (role.deniedPermissions || []).includes(permission),
    )
  ) {
    return { decision: "DENY", via: "custom_role" };
  }
  const role = matchingRoles.find((entry) =>
    (entry.permissions || []).includes(permission),
  );
  if (role) {
    return {
      decision: "ALLOW",
      via: "custom_role",
      scope: role.recordScopes?.[0],
      fields: role.fieldAccess,
    };
  }
  return null;
}

function clearTenantCustomAuth(companyId) {
  cache.delete(id(companyId));
}

module.exports = { getTenantCustomAuth, evaluateCustom, clearTenantCustomAuth };
