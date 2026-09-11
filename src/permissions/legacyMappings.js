/**
 * Legacy ↔ Canonical Permission Mappings (compatibility layer)
 *
 * Legacy keys (`tickets.*`, `incident.*`, `problem.*`, `kb.*`, `users.manage`,
 * `roles.manage`, …) are migration inputs only. Every decision is evaluated
 * against the CANONICAL grant set; the transcoder below expands a principal's
 * stored keys into that canonical set BEFORE authorization runs (never
 * "can(a) || can(b)" scattered across controllers).
 *
 * Mapping types:
 *   ALIAS   — 1:1 legacy → canonical key (translation is bidirectional)
 *   BUNDLE  — 1:many legacy → canonical bundle (a bundle member satisfies the
 *             legacy key; a canonical member grants its legacy bundle key)
 *
 * The catalog is the referee: targets are validated against
 * src/permissions/itsmCatalog.js at require time (see validate()).
 */

const { isCanonicalKey } = require('./itsmCatalog');

const ALIAS = {
  // tickets.* — legacy helpdesk tickets were incidents
  'tickets.view': 'itsm.incident.incident.read',
  'tickets.create': 'itsm.incident.incident.create',
  'tickets.edit': 'itsm.incident.incident.update',
  'tickets.assign': 'itsm.incident.assign',
  'tickets.transfer': 'itsm.incident.reassign',
  'tickets.close': 'itsm.incident.close',
  'tickets.delete': 'itsm.incident.incident.delete',
  'tickets.reply': 'itsm.incident.add_public_comment',
  'tickets.note': 'itsm.incident.add_work_note',
  'tickets.tasks': 'itsm.core.task.update',

  // incident.*
  'incident.view': 'itsm.incident.incident.read',
  'incident.create': 'itsm.incident.incident.create',
  'incident.update': 'itsm.incident.incident.update',
  'incident.assign': 'itsm.incident.assign',
  'incident.resolve': 'itsm.incident.resolve',
  'incident.close': 'itsm.incident.close',
  'incident.reopen': 'itsm.incident.reopen',
  'incident.cancel': 'itsm.incident.cancel',

  // problem.*
  'problem.view': 'itsm.problem.problem.read',
  'problem.create': 'itsm.problem.problem.create',
  'problem.update': 'itsm.problem.problem.update',
  'problem.assign': 'itsm.problem.assign',
  'problem.resolve': 'itsm.problem.resolve',
  'problem.close': 'itsm.problem.close',

  // change.*
  'change.view': 'itsm.change.change_request.read',
  'change.create': 'itsm.change.change_request.create',
  'change.update': 'itsm.change.change_request.update',
  'change.approve': 'itsm.change.approve',
  'change.implement': 'itsm.change.implement',
  'change.rollback': 'itsm.change.rollback',

  // tasks (core) / requests / knowledge / sla / assignment
  'task.view': 'itsm.core.task.read',
  'task.create': 'itsm.core.task.create',
  'task.update': 'itsm.core.task.update',
  'task.assign': 'itsm.core.task_assign',
  'task.delete': 'itsm.core.task.delete',
  'request.view': 'itsm.request_catalog.request.read',
  'request.create': 'itsm.request_catalog.request.create',
  'request.update': 'itsm.request_catalog.request.update',
  'knowledge.view': 'itsm.knowledge.knowledge_article.read',
  'kb.read': 'itsm.knowledge.knowledge_article.read',
  'kb.manage': 'itsm.knowledge.article_manage_access',
  'sla.view': 'itsm.sla.definition_read',
  'sla.manage': 'itsm.sla.definition_update',
  'assignment.view': 'itsm.assignment.routing_rule.read',
  'assignment.manage': 'itsm.assignment.routing_rule.create',
  'users.view': 'tenant.user.read',

  // admin-plane aliases
  'roles.view': 'tenant.role.read',
  'audit.view': 'tenant.permission.read',
  'modules.view': 'tenant.module.read',
};

const BUNDLES = {
  'kb.manage': [
    'itsm.knowledge.knowledge_base.create',
    'itsm.knowledge.knowledge_base.update',
    'itsm.knowledge.knowledge_base.delete',
    'itsm.knowledge.knowledge_category.create',
    'itsm.knowledge.knowledge_category.update',
    'itsm.knowledge.knowledge_category.delete',
    'itsm.knowledge.article_create',
    'itsm.knowledge.article_update',
    'itsm.knowledge.article_review',
    'itsm.knowledge.article_approve',
    'itsm.knowledge.article_publish',
    'itsm.knowledge.article_retire',
    'itsm.knowledge.article_manage_access',
  ],
  'users.manage': [
    'tenant.user.create', 'tenant.user.read', 'tenant.user.update',
    'tenant.user.invite', 'tenant.user.suspend', 'tenant.user.reactivate',
    'tenant.user.deactivate', 'tenant.user.archive', 'tenant.user.restore',
    'tenant.user.reset_mfa', 'tenant.user.revoke_sessions',
  ],
  'roles.manage': [
    'tenant.role.create', 'tenant.role.read', 'tenant.role.update',
    'tenant.role.delete', 'tenant.role.assign',
  ],
  'groups.manage': [
    'tenant.group.create', 'tenant.group.read', 'tenant.group.update',
    'tenant.group.delete', 'tenant.group.assign',
  ],
  'orgs.manage': [
    'tenant.organization.create', 'tenant.organization.read', 'tenant.organization.update',
    'tenant.department.create', 'tenant.department.update',
    'tenant.team.create', 'tenant.team.update',
    'tenant.location.create', 'tenant.location.update',
  ],
  'organization.manage': [
    'tenant.organization.create', 'tenant.organization.read', 'tenant.organization.update',
    'tenant.department.create', 'tenant.department.update',
    'tenant.team.create', 'tenant.team.update',
    'tenant.location.create', 'tenant.location.update',
  ],
  'escalations.manage': [
    'itsm.incident.automation.sla_escalation.manage',
    'itsm.assignment.agent_assign',
  ],
  'exports.create': [],
  'reports.manage': [],
  'data.manage': [],
  'canned.manage': [],
  'workflow.manage': [],
  'integrations.manage': [],
  'billing.view': [],
  'billing.manage': [],
  'modules.manage': [],
  'access.manage': [],
  'admin.manage': [],
  'security.manage': [],
  'approvals.decide': [],
  'records.view': [],
  'records.create': [],
  'records.update': [],
  'records.delete': [],
  'organization.units.manage': [],
  'organization.locations.manage': [],
};

// --- Build reverse indexes (canonical → legacy) -----------------------------

const REVERSE_ALIAS = {};
for (const [legacy, canonical] of Object.entries(ALIAS)) {
  REVERSE_ALIAS[canonical] = REVERSE_ALIAS[canonical] || [];
  REVERSE_ALIAS[canonical].push(legacy);
}

const REVERSE_BUNDLE = {};
for (const [legacy, cannons] of Object.entries(BUNDLES)) {
  for (const canonical of cannons) {
    REVERSE_BUNDLE[canonical] = REVERSE_BUNDLE[canonical] || [];
    REVERSE_BUNDLE[canonical].push(legacy);
  }
}

// --- Transcoder --------------------------------------------------------------

/**
 * Expand a list of stored grant keys into the effective ALLOW set:
 *   - the raw key itself (canonical, legacy, or opaque)
 *   - canonical targets of legacy ALIAS/BUNDLE keys
 *   - legacy keys that map back from a canonical key (so legacy-string guard
 *     routes keep working after an actor is granted the canonical key)
 */
function expandGrants(rawKeys) {
  const out = new Set();
  for (const raw of rawKeys || []) {
    if (typeof raw !== 'string' || !raw) continue;
    out.add(raw);
    const canon = ALIAS[raw] || null;
    if (canon && isCanonicalKey(canon)) out.add(canon);
    for (const canonKey of BUNDLES[raw] || []) {
      if (isCanonicalKey(canonKey)) out.add(canonKey);
    }
    if (REVERSE_ALIAS[raw]) for (const legacy of REVERSE_ALIAS[raw]) out.add(legacy);
    if (REVERSE_BUNDLE[raw]) for (const legacy of REVERSE_BUNDLE[raw]) out.add(legacy);
    // wildcard prefix grants stay wildcards as-is
  }
  return out;
}

const canonicalFromLegacy = (legacyKey) => {
  if (!ALIAS[legacyKey]) return BUNDLES[legacyKey] || [];
  return [ALIAS[legacyKey]];
};
const legacyFromCanonical = (canonicalKey) => [
  ...(REVERSE_ALIAS[canonicalKey] || []),
  ...(REVERSE_BUNDLE[canonicalKey] || []),
];

const isLegacyKey = (key) => !!ALIAS[key] || !!BUNDLES[key];

/** Mapping table for the admin UI (migration visibility). */
function getMappings() {
  const out = [];
  for (const [legacy, canonical] of Object.entries(ALIAS)) {
    out.push({ legacy, type: 'ALIAS', canonical: [canonical], deprecated: false });
  }
  for (const [legacy, cannons] of Object.entries(BUNDLES)) {
    if (!cannons.length) continue;
    out.push({ legacy, type: 'BUNDLE', canonical: cannons, deprecated: false });
  }
  return out;
}

// --- Validation (fail fast at load when catalog changes) ---------------------

function validate() {
  const missing = [];
  for (const [legacy, canonical] of Object.entries(ALIAS)) {
    if (!isCanonicalKey(canonical)) missing.push(`ALIAS ${legacy} -> ${canonical}`);
  }
  for (const [legacy, cannons] of Object.entries(BUNDLES)) {
    for (const c of cannons) {
      if (c && !isCanonicalKey(c)) missing.push(`BUNDLE ${legacy} -> ${c}`);
    }
  }
  if (missing.length) {
    throw new Error(`legacyMappings validation failed:\n  ${missing.join('\n  ')}`);
  }
}
validate();

module.exports = {
  ALIAS,
  BUNDLES,
  expandGrants,
  canonicalFromLegacy,
  legacyFromCanonical,
  isLegacyKey,
  getMappings,
};