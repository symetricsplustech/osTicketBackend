/**
 * Custom roles & permissions engine (MD §15/§16).
 *
 * Tenants extend business authorization without code changes. Hard boundaries:
 * - custom grants never cross the tenant, never mint SaaS permissions
 *   (enforced by CustomRole schema validation + key namespacing checks here),
 * - custom DENY participates in deny-precedence (MD §22),
 * - a matched custom permission's scope/conditions NARROW the decision.
 *
 * Tenant custom auth is cached 60s in-memory; CRUD endpoints invalidate on
 * write, so worst-case propagation delay is one minute (documented).
 */

const CustomPermission = require('../models/CustomPermission');
const CustomRole = require('../models/CustomRole');

const TTL_MS = 60 * 1000;
const cache = new Map(); // companyId -> { at, permissions, roles }

function invalidateTenantCustomAuth(companyId) {
  cache.delete(String(companyId));
}

async function getTenantCustomAuth(companyId) {
  const key = String(companyId || '');
  if (!key) return { permissions: [], roles: [] };
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const [permissions, roles] = await Promise.all([
    CustomPermission.find({ company: key, status: 'active' }).lean(),
    CustomRole.find({ company: key, status: 'active' }).lean(),
  ]);
  const snap = { permissions, roles };
  cache.set(key, { at: Date.now(), ...snap });
  return snap;
}

const isSaasKey = (k) => typeof k === 'string' && /^(saas\.|platform\.|superadmin)/.test(k);

/** A custom permission matches a requested key directly or by module.resource.action triple. */
function matchCustomPermission(perm, permission) {
  if (!perm || perm.status === 'disabled') return false;
  if (perm.key === permission) return true;
  if (perm.module && perm.resource && perm.action && `${perm.module}.${perm.resource}.${perm.action}` === permission) return true;
  return false;
}

const idStr = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') return String(v._id || v.id || '');
  return String(v);
};

/** Custom roles applying to this principal: active window + direct/team membership. */
function customRolesFor(principal, roles, now = new Date()) {
  const me = idStr(principal && (principal._id || principal.id));
  const myTeams = new Set(((principal && principal.teams) || []).map(idStr));
  // Agent.teams entries may be { team: ObjectId } join docs in some shapes.
  for (const t of (principal && principal.teams) || []) {
    if (t && typeof t === 'object' && t.team) myTeams.add(idStr(t.team));
  }
  return (roles || []).filter((r) => {
    if (r.status === 'disabled') return false;
    if (r.effectiveFrom && new Date(r.effectiveFrom) > now) return false;
    if (r.effectiveUntil && new Date(r.effectiveUntil) <= now) return false;
    if ((r.agentMembers || []).map(idStr).includes(me)) return true;
    return (r.teamMembers || []).map(idStr).some((t) => myTeams.has(t));
  });
}

/**
 * Evaluate custom auth for a permission. Returns null when no custom rule
 * matches, else { decision: 'ALLOW'|'DENY', via, scope?, conditions? }.
 * Precedence inside custom space: role/member DENY > direct custom DENY >
 * member ALLOW > direct custom ALLOW (stock checks happen in authorize()).
 */
function evaluateCustom(permission, customAuth, principal) {
  if (!customAuth) return null;
  const mine = customRolesFor(principal, customAuth.roles);
  const memberDenies = [];
  const memberAllows = [];
  for (const role of mine) {
    for (const p of role.deniedPermissions || []) {
      if (typeof p === 'string' && (p === permission || (p.startsWith('!') && p.slice(1) === permission))) {
        memberDenies.push({ role: role.key });
      }
    }
    for (const p of role.permissions || []) {
      if (p === permission) memberAllows.push({ role: role.key });
    }
  }
  const direct = (customAuth.permissions || []).filter((p) => matchCustomPermission(p, permission));
  const directDeny = direct.find((p) => p.effect === 'deny');
  const directAllow = direct.find((p) => p.effect !== 'deny');
  if (memberDenies.length) return { decision: 'DENY', via: 'custom_role_deny', roles: memberDenies.map((d) => d.role) };
  if (directDeny && !isSaasKey(permission)) return { decision: 'DENY', via: 'custom_deny', key: directDeny.key };
  if (memberAllows.length) return { decision: 'ALLOW', via: 'custom_role', roles: memberAllows.map((a) => a.role) };
  if (directAllow && !isSaasKey(permission)) {
    return {
      decision: 'ALLOW', via: 'custom', key: directAllow.key,
      scope: directAllow.scope || undefined,
      conditions: directAllow.conditions && directAllow.conditions.length ? directAllow.conditions : undefined,
    };
  }
  return null;
}

module.exports = {
  getTenantCustomAuth,
  invalidateTenantCustomAuth,
  matchCustomPermission,
  customRolesFor,
  evaluateCustom,
  isSaasKey,
};
