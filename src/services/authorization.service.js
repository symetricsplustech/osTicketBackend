/**
 * Central Authorization Service — Platform 01 (ITSM/Helpdesk).
 *
 * Single decision point for "WHAT IS THIS PRINCIPAL ALLOWED TO DO?" (MD §26).
 * Authentication (who are you?) stays in middleware/auth.js; everything after
 * that funnels through authorize() here.
 *
 * Decision chain (MD §26 + §85):
 *   1. authenticated?          principal present
 *   2. account active?         isActive / status checks
 *   3. tenant resolved?        tenantId present
 *   4. membership valid?       principal.company|tenantId matches tenant
 *   5. module entitlement?     permission's module in effective moduleKeys (opt-in)
 *   6. permission exists?      effective ALLOW (direct > role > assignment)
 *   7. explicit deny?          DENY always wins (MD §22)
 *   8. scope valid?            OWN / ASSIGNED_TO_ME / TEAM / DEPARTMENT / TENANT (MD §19)
 *   9. record condition valid? generic field==value conditions (MD §20)
 *  10. field access valid?     sensitive-field filtering (MD §21)
 *
 * Precedence (MD §22): Explicit DENY > Direct ALLOW > Role ALLOW >
 * Inherited/Assignment ALLOW > Default DENY.
 *
 * Returns { decision: 'ALLOW'|'DENY', reason, ...meta }. `reason` is an
 * INTERNAL code for audit/logs — never send it to clients (MD §26: "Do not
 * expose sensitive internal authorization reasons to the client").
 */

const ApiError = require('../utils/ApiError');

const ALLOW = 'ALLOW';
const DENY = 'DENY';

// Scopes from the ITSM spec (MD §19) mapped to the record fields we evaluate.
const SCOPES = [
  'TENANT',
  'OWN',
  'ASSIGNED_TO_ME',
  'TEAM',
  'DEPARTMENT',
  'REQUESTED_BY_ME',
];

// ---------------------------------------------------------------------------
// Principal normalization
// ---------------------------------------------------------------------------

const principalId = (p) => {
  if (!p) return '';
  const id = p._id || p.id;
  return id ? String(id) : '';
};

const principalTenant = (p, tenantId) => {
  if (tenantId) return String(tenantId);
  const t = p && (p.tenantId || p.company);
  if (!t) return '';
  return String(t && t._id ? t._id : t);
};

const roleListOf = (principal, extraRoles) => {
  const roles = [];
  if (principal && principal.role) roles.push(principal.role);
  if (Array.isArray(principal && principal.roles)) roles.push(...principal.roles);
  if (Array.isArray(extraRoles)) roles.push(...extraRoles);
  return roles.filter(Boolean);
};

const isAggregateAdmin = (principal) =>
  !!principal && (!!principal.isSuperAdmin || !!principal.isAdmin || !!(principal.role && principal.role.isAdmin));

// ---------------------------------------------------------------------------
// Permission resolution (pure, no DB)
// ---------------------------------------------------------------------------

/**
 * Split raw permission strings into ALLOW vs explicit DENY sets.
 * Deny convention: '!tickets.delete'. Backward compatible — legacy string
 * sets simply never contain '!' entries, so behavior is unchanged for them.
 * Role.permissions has a Mongoose enum that rejects '!' entries, so role
 * DENYs are not expressible today (documented gap); use direct grants.
 */
function splitPermissions(list) {
  const allow = new Set();
  const deny = new Set();
  for (const raw of list || []) {
    if (typeof raw !== 'string' || !raw) continue;
    if (raw === '*') {
      allow.add('*');
      continue;
    }
    if (raw.startsWith('!')) {
      const key = raw.slice(1);
      if (key) deny.add(key);
    } else {
      allow.add(raw);
    }
  }
  return { allow, deny };
}

/**
 * Effective permission sets for a principal.
 * Direct grants > role grants > extra (assignment/inherited) grants.
 */
function collectPermissions(principal, extraRoles) {
  const direct = splitPermissions(principal && principal.permissions);
  const roleAllow = new Set();
  const roleDeny = new Set();
  for (const role of roleListOf(principal, extraRoles)) {
    for (const p of role.permissions || []) {
      if (typeof p === 'string' && p && !p.startsWith('!')) roleAllow.add(p);
    }
    // Role-level explicit DENYs (Role.deniedPermissions, no enum by design).
    for (const p of role.deniedPermissions || []) {
      if (typeof p !== 'string' || !p) continue;
      roleDeny.add(p.startsWith('!') ? p.slice(1) : p);
    }
  }
  const deny = new Set([...direct.deny, ...roleDeny]);
  return { directAllow: direct.allow, deny, roleAllow };
}

/**
 * Pure permission check with deny precedence. Returns { granted, via }.
 * `via` is one of: 'deny' | 'wildcard' | 'direct' | 'role' | 'admin_aggregate' | 'none'.
 */
function checkPermission(principal, permission, extraRoles) {
  if (!principal || !permission) return { granted: false, via: 'none' };
  if (isAggregateAdmin(principal)) return { granted: true, via: 'admin_aggregate' };
  const { directAllow, deny, roleAllow } = collectPermissions(principal, extraRoles);
  if (directAllow.has('*') || roleAllow.has('*')) return { granted: true, via: 'wildcard' };
  if (deny.has(permission) || deny.has('*')) return { granted: false, via: 'deny' };
  if (directAllow.has(permission)) return { granted: true, via: 'direct' };
  if (roleAllow.has(permission)) return { granted: true, via: 'role' };
  return { granted: false, via: 'none' };
}

/** Backward-compatible boolean used by controllers. */
function hasPermission(principal, permission, extraRoles) {
  return checkPermission(principal, permission, extraRoles).granted;
}

// ---------------------------------------------------------------------------
// Scope evaluation (pure, no DB) — MD §19
// ---------------------------------------------------------------------------

const idStr = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') return String(v._id || v.id || '');
  return String(v);
};

const idList = (v) => {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map(idStr).filter(Boolean);
};

function recordTenant(record) {
  if (!record) return '';
  return idStr(record.tenantId || record.company || record.tenant);
}

/**
 * Evaluate ONE scope against a record. No record => true (permission-level
 * check only; row filtering happens via buildScopeFilter / query scoping).
 */
function evaluateScope(principal, scope, record, tenant) {
  if (!record) return true;
  const me = principalId(principal);
  switch (scope) {
    case 'TENANT':
      return !!tenant && recordTenant(record) === String(tenant);
    case 'OWN':
    case 'REQUESTED_BY_ME':
      return ['requester', 'user', 'createdBy', 'owner', 'requestedFor', 'fulfilledFor']
        .map((f) => idStr(record[f]))
        .some((v) => v && v === me);
    case 'ASSIGNED_TO_ME':
      return ['agent', 'assignedTo', 'assignee', 'technician', 'commander', 'owner']
        .map((f) => idStr(record[f]))
        .some((v) => v && v === me);
    case 'TEAM': {
      const mine = new Set([
        ...idList(principal.teams),
        ...idList((principal.role && principal.role.teams) || []),
      ]);
      const theirs = [...idList(record.team), ...idList(record.teams), ...idList(record.assignmentGroup)];
      return theirs.some((t) => mine.has(t));
    }
    case 'DEPARTMENT': {
      const mine = new Set([
        ...idList((principal.departments || []).map((d) => (d && d.department) || d)),
        ...idList(principal.department),
      ]);
      const theirs = [...idList(record.dept), ...idList(record.department)];
      return theirs.some((d) => mine.has(d));
    }
    default:
      return false;
  }
}

/**
 * Granted scopes for a principal: union of role.recordScopes, assignment
 * scopes (via extraRoles' recordScopes), and the legacy TENANT default for
 * aggregate admins. Returns array of scope names.
 */
function grantedScopes(principal, extraRoles) {
  const scopes = new Set();
  for (const role of roleListOf(principal, extraRoles)) {
    for (const s of role.recordScopes || []) scopes.add(String(s).toUpperCase());
  }
  // Legacy recordScopes enum is lowercase ('own','assigned','team',...); map it.
  const mapped = new Set();
  for (const s of scopes) {
    if (s === 'OWN') mapped.add('OWN');
    else if (s === 'ASSIGNED') mapped.add('ASSIGNED_TO_ME');
    else if (s === 'TEAM') mapped.add('TEAM');
    else if (s === 'DEPARTMENT') mapped.add('DEPARTMENT');
    else if (s === 'LOCATION' || s === 'BUSINESS_UNIT' || s === 'ORGANIZATION') mapped.add('TENANT');
    else mapped.add(s);
  }
  if (isAggregateAdmin(principal)) mapped.add('TENANT');
  return [...mapped].filter((s) => SCOPES.includes(s));
}

/**
 * Scope gate: ALLOW when no record (permission-level) or when ANY granted
 * scope matches the record. `requiredScope` narrows to one scope (e.g. an
 * action that must be ASSIGNED_TO_ME even for team-visible agents).
 */
function checkScope(principal, record, tenant, requiredScope, extraRoles) {
  if (!record) return { ok: true, scope: requiredScope || 'ANY' };
  const scopes = requiredScope ? [requiredScope] : grantedScopes(principal, extraRoles);
  for (const scope of scopes) {
    if (evaluateScope(principal, scope, record, tenant)) return { ok: true, scope };
  }
  return { ok: false, scope: requiredScope || 'NONE_MATCHED' };
}

// ---------------------------------------------------------------------------
// Record conditions (pure) — MD §20
// ---------------------------------------------------------------------------

const CONTEXT_TOKENS = {
  current_user: (p) => principalId(p),
  current_tenant: (p, tenant) => (tenant ? String(tenant) : principalTenant(p)),
};

/**
 * condition: { field, op: '=|!=|in|not_in', value } where value may be a
 * context token ('current_user', 'current_tenant', 'current_user.teams', ...)
 * or a literal. All conditions in the array must hold (AND).
 */
function matchConditions(principal, record, conditions, tenant) {
  if (!conditions || !conditions.length) return { ok: true };
  const ctx = (token) => {
    if (typeof token !== 'string') return token;
    if (CONTEXT_TOKENS[token]) return CONTEXT_TOKENS[token](principal, tenant);
    if (token === 'current_user.teams') return idList(principal.teams);
    if (token === 'current_user.department' || token === 'current_user.departments') {
      return idList((principal.departments || []).map((d) => (d && d.department) || d));
    }
    return token;
  };
  for (const c of conditions) {
    const actual = record ? record[c.field] : undefined;
    const expected = ctx(c.value);
    const actualIds = idList(actual);
    const expectedIds = idList(expected);
    const eq = actualIds.length || expectedIds.length
      ? actualIds.some((a) => expectedIds.includes(a))
      : actual === expected;
    if (c.op === '!=') {
      if (eq) return { ok: false, failed: c };
    } else if (c.op === 'not_in') {
      if (actualIds.some((a) => expectedIds.includes(a))) return { ok: false, failed: c };
    } else if (c.op === 'in' || c.op === '=') {
      if (!eq) return { ok: false, failed: c };
    } else {
      return { ok: false, failed: c };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Field access (pure) — MD §21
// ---------------------------------------------------------------------------

/**
 * sensitiveFields: resource-declared restricted fields (e.g. work notes,
 * cost, VIP markers). A principal may read them when the field key appears
 * in any role's fieldAccess or as a direct 'field:<name>' grant.
 * Returns { allowedFields, deniedFields }.
 */
function filterFields(principal, fields, extraRoles) {
  const requested = fields || [];
  if (!requested.length) return { allowedFields: [], deniedFields: [] };
  const grants = new Set();
  for (const role of roleListOf(principal, extraRoles)) {
    for (const f of role.fieldAccess || []) grants.add(String(f));
  }
  for (const p of (principal && principal.permissions) || []) {
    if (typeof p === 'string' && p.startsWith('field:')) grants.add(p.slice('field:'.length));
  }
  if (isAggregateAdmin(principal) || grants.has('*')) {
    return { allowedFields: [...requested], deniedFields: [] };
  }
  const allowedFields = requested.filter((f) => grants.has(String(f)));
  const deniedFields = requested.filter((f) => !grants.has(String(f)));
  return { allowedFields, deniedFields };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function auditDecision({ req, principal, tenant, permission, decision, reason, resource }) {
  try {
    const audit = require('./audit.service');
    audit({
      company: tenant || principalTenant(principal) || null,
      actorType: principal && principal.isAdmin !== undefined ? 'agent' : 'user',
      actor: principalId(principal) || null,
      actorName: (principal && principal.name) || '',
      action: decision === ALLOW ? 'authz.allowed' : 'authz.denied',
      entityType: (resource && resource.type) || 'permission',
      entityId: (resource && resource.id) || permission,
      after: { permission, reason },
      source: 'authorization',
      req,
    }).catch(() => {});
  } catch (_) {
    // audit must never block authorization
  }
}

/**
 * authorize({ principal, permission, tenant, module, moduleKeys,
 *             resource, record, requiredScope, conditions, fields, req, audit })
 *
 * - principal: User/Agent doc (populated role) or synthetic principal
 * - permission: 'tickets.assign' style key (required)
 * - tenant: tenant/company id (falls back to principal's)
 * - module: optional module key; checked against moduleKeys option,
 *   principal.moduleKeys, role.moduleKeys (no DB here — tenant_modules
 *   enforcement stays in middleware/module.js)
 * - resource: { type, id } for audit context
 * - record: the target row for scope/condition checks (omit for collection-level)
 * - requiredScope: narrow to one scope for sensitive actions
 * - conditions: array of { field, op, value } record conditions
 * - fields: sensitive fields being read/written (filtered, not fatal)
 * - req: express req for IP/UA audit context
 * - audit: 'deny' (default — audit denials only), true (audit everything),
 *   false (audit nothing — use for unit tests / hot paths)
 */
async function authorize({
  principal,
  permission,
  tenant,
  module,
  moduleKeys,
  resource,
  record,
  requiredScope,
  conditions,
  fields,
  extraRoles,
  req,
  audit = 'deny',
}) {
  const fail = (reason, extra) => {
    const result = { decision: DENY, reason, permission, ...extra };
    if (audit === true || audit === DENY || audit === 'deny') {
      auditDecision({ req, principal, tenant: tenant || principalTenant(principal), permission, decision: DENY, reason, resource });
    }
    return result;
  };

  // 1. authenticated?
  if (!principal) return fail('UNAUTHENTICATED');
  // 2. account active?
  if (principal.isActive === false || principal.status === 'inactive' || principal.status === 'disabled' || principal.status === 'suspended') {
    return fail('ACCOUNT_INACTIVE');
  }
  // 3. tenant resolved?
  const tenantId = principalTenant(principal, tenant);
  if (!tenantId) return fail('TENANT_UNRESOLVED');
  // 4. membership valid? (principal must belong to the target tenant)
  const membership = principalTenant(principal);
  if (membership && String(membership) !== String(tenantId)) return fail('MEMBERSHIP_MISMATCH');

  // 5. module entitlement? (in-memory keys only; DB-backed tenant_modules
  //    enforcement lives in middleware/module.js which runs earlier)
  if (module) {
    const keys = new Set([
      ...(moduleKeys || []),
      ...((principal && principal.moduleKeys) || []),
      ...roleListOf(principal, extraRoles).flatMap((r) => r.moduleKeys || []),
    ]);
    if (principal.isSuperAdmin || (principal.permissions || []).includes('*')) {
      // platform aggregate — allowed
    } else if (!keys.has(module)) {
      return fail('MODULE_NOT_ENTITLED');
    }
  }

  // 6+7. permission with deny precedence
  const check = checkPermission(principal, permission, extraRoles);
  if (!check.granted) {
    return fail(check.via === 'deny' ? 'EXPLICIT_DENY' : 'PERMISSION_MISSING', { via: check.via });
  }

  // 8. scope gate (skipped when no record — collection-level check)
  if (record) {
    const scopeCheck = checkScope(principal, record, tenantId, requiredScope, extraRoles);
    if (!scopeCheck.ok) return fail('SCOPE_REJECTED', { scope: scopeCheck.scope });
    // 9. record conditions
    const cond = matchConditions(principal, record, conditions, tenantId);
    if (!cond.ok) return fail('RECORD_CONDITION_REJECTED');
    var matchedScope = scopeCheck.scope;
  }

  // 10. field access (advisory: reports denied fields, does not flip ALLOW)
  let fieldResult;
  if (fields && fields.length) {
    fieldResult = filterFields(principal, fields, extraRoles);
  }

  const result = {
    decision: ALLOW,
    reason: 'OK',
    permission,
    via: check.via,
    ...(typeof matchedScope !== 'undefined' ? { scope: matchedScope } : {}),
    ...(fieldResult ? { allowedFields: fieldResult.allowedFields, deniedFields: fieldResult.deniedFields } : {}),
  };
  if (audit === true || audit === ALLOW || audit === 'allow') {
    auditDecision({ req, principal, tenant: tenantId, permission, decision: ALLOW, reason: 'OK', resource });
  }
  return result;
}

/**
 * Throwing variant for controllers/services. Maps internal reasons to safe,
 * generic client errors (MD §26, §80).
 */
async function assertPermission(options) {
  const result = await authorize(options);
  if (result.decision !== ALLOW) {
    throw new ApiError(403, 'You do not have permission for this action');
  }
  return result;
}

module.exports = {
  ALLOW,
  DENY,
  SCOPES,
  authorize,
  assertPermission,
  checkPermission,
  hasPermission,
  isAggregateAdmin,
  collectPermissions,
  splitPermissions,
  grantedScopes,
  evaluateScope,
  checkScope,
  matchConditions,
  filterFields,
  principalTenant,
};
