/**
 * Canonical ITSM Permission Catalog (Modules 1–12)
 *
 * Single source of truth for the granular `itsm.*` permission model
 * (SERVICENOW_ITSM_GRANULAR_PERMISSIONS_FROM_TECHNICAL_MASTER.md §Modules 1–12).
 *
 * Layout: Layer('itsm') → Module → Group → Resource → Action. Every action is a
 * flat key like `itsm.incident.incident.update`. Keys are authoritative (1908
 * total); the structural grouping is derived so the tree, the picker UI and the
 * high-risk audit all share one definition.
 *
 * `tenant.*` core keys (tenant administration plane) are included here too so
 * legacy `users.manage` / `roles.manage` / `orgs.manage` bundle-mapping targets
 * exist in the same catalog. SaaS layer keys live in config/platformPermissions.
 */

const ITSM_DATA = require("./itsmCatalogData");
const { TENANT_CORE_PERMISSIONS } = require("./tenantCorePermissions");

const MODULES = [
  {
    key: "core",
    namespace: "itsm.core.*",
    label: "Core Platform / Task Engine",
    moduleKey: "helpdesk",
    scope: "tenant",
  },
  {
    key: "incident",
    namespace: "itsm.incident.*",
    label: "Incident Management",
    moduleKey: "helpdesk",
    scope: "tenant",
  },
  {
    key: "problem",
    namespace: "itsm.problem.*",
    label: "Problem Management",
    moduleKey: "helpdesk",
    scope: "tenant",
  },
  {
    key: "change",
    namespace: "itsm.change.*",
    label: "Change Management",
    moduleKey: "helpdesk",
    scope: "tenant",
  },
  {
    key: "request_catalog",
    namespace: "itsm.request_catalog.*",
    label: "Request Management + Service Catalog",
    moduleKey: "helpdesk",
    scope: "tenant",
  },
  {
    key: "knowledge",
    namespace: "itsm.knowledge.*",
    label: "Knowledge Management",
    moduleKey: "helpdesk",
    scope: "tenant",
  },
  {
    key: "sla",
    namespace: "itsm.sla.*",
    label: "Service Level Management",
    moduleKey: "helpdesk",
    scope: "tenant",
  },
  {
    key: "assignment",
    namespace: "itsm.assignment.*",
    label: "Assignment / Routing",
    moduleKey: "helpdesk",
    scope: "tenant",
  },
  {
    key: "approval",
    namespace: "itsm.approval.*",
    label: "Approval Engine",
    moduleKey: "helpdesk",
    scope: "tenant",
  },
  {
    key: "major_incident",
    namespace: "itsm.major_incident.*",
    label: "Major Incident + Communications",
    moduleKey: "helpdesk",
    scope: "tenant",
  },
  {
    key: "on_call",
    namespace: "itsm.on_call.*",
    label: "On-Call Scheduling",
    moduleKey: "helpdesk",
    scope: "tenant",
  },
  {
    key: "walkup",
    namespace: "itsm.walkup.*",
    label: "Walk-Up Experience",
    moduleKey: "helpdesk",
    scope: "tenant",
  },
];

const GROUPS = [
  { key: "entity", label: "Record Permissions (CRUD)" },
  { key: "business", label: "Business Actions" },
  { key: "relationship", label: "Relationships & Linkage" },
  { key: "state", label: "State & Business Rules" },
  { key: "intake", label: "Intake Channels" },
  { key: "screen", label: "Screen & Experience" },
  { key: "automation", label: "Automation & Background Jobs" },
];

const CRUD_ACTIONS = new Set([
  "create",
  "read",
  "update",
  "delete",
  "archive",
  "restore",
  "view_history",
  "view_audit",
  "export",
]);

// Patterns that mark a permission as high-risk for UI warnings + always-audit.
const HIGH_RISK_PATTERNS = [
  "delete",
  "override",
  "export",
  "view_audit",
  "impersonate",
  "reset_mfa",
  "revoke_sessions",
  "bulk_",
  "restore",
  "manage_access",
  "security",
  "break_glass",
  "demote",
  "approve",
  "reject",
  "impersonation",
  "privileged",
];

// Per-resource sensitive fields (field-policy engine). Keys use the canonical
// field names used by the domain models (snake_case). HIDE => stripped before
// serialization unless the actor holds field access via fieldAccess grant.
const FIELD_POLICIES = {
  incident: ["work_notes", "internal_security_note", "diagnosis", "resolution"],
  problem: ["work_notes", "root_cause", "workaround"],
  change: ["implementation_plan", "backout_plan", "failure_notes"],
  request: ["fulfillment_notes", "approval_rationale"],
  requested_item: ["fulfillment_notes", "approval_rationale"],
  task: ["work_notes"],
  knowledge_article: ["draft", "reviewer_notes"],
  major_incident: ["comm_plan", "exec_summary"],
  post_incident_review: ["closed_loop_items"],
  on_call_schedule: ["escalation_policy", "contact_preferences"],
  shift: ["swap_history", "override_reason"],
  roster: ["member_notes"],
  escalation_policy: ["contact_methods", "timeout_config"],
  walkup_location: ["internal_notes", "security_code"],
  walkup_checkin: ["vip_flag", "security_notes"],
  appointment: ["internal_notes", "patient_data"],
  walkup_interaction: ["internal_notes", "diagnosis"],
};

const humanize = (slug = "") =>
  String(slug)
    .replace(/^itsm\./, "")
    .split(/[._]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const isHighRisk = (key) => {
  const low = key.toLowerCase();
  return HIGH_RISK_PATTERNS.some((p) => low.includes(p));
};

function deriveGroup(key) {
  const parts = key.split(".");
  const rest = parts.slice(2);
  if (rest.includes("automation")) return "automation";
  if (rest.includes("relationship")) return "relationship";
  if (rest.includes("state")) return "state";
  if (rest.includes("intake")) return "intake";
  if (
    rest.includes("screen") ||
    rest.includes("ui_") ||
    rest.includes("_page") ||
    rest.includes("_list")
  )
    return "screen";
  if (rest.length === 2 && CRUD_ACTIONS.has(rest[1])) return "entity";
  if (rest.length <= 2) return "business";
  // multi-segment business action e.g. itsm.knowledge.article_create_from_incident
  return "business";
}

function actionLabel(key) {
  const parts = key.split(".");
  const rest = parts.slice(2);
  let action = rest[rest.length - 1];
  if (rest.includes("automation")) {
    // ...automation.<job>.manage → action = manage, resource = <job>
    const i = rest.indexOf("automation");
    action = rest[rest.length - 1];
  }
  return humanize(action);
}

/**
 * Build the full catalog tree:
 * [ { module:{key,label}, groups:[{ key,label, resources:[{ key,label, actions:[{key,label,highRisk}] }] }] } ]
 */
function tree() {
  return MODULES.map((mod) => {
    const keys = ITSM_DATA[mod.key] || [];
    const byGroup = {};
    for (const k of keys) {
      const g = deriveGroup(k);
      byGroup[g] = byGroup[g] || [];
      byGroup[g].push(k);
    }
    const groups = Object.entries(byGroup)
      .map(([gkey, gkeys]) => {
        // resource grouping within group
        const resources = {};
        for (const k of gkeys) {
          const parts = k.split(".");
          const rest = parts.slice(2);
          let res;
          if (gkey === "automation") {
            const i = rest.indexOf("automation");
            res = rest[i + 1] || mod.key;
          } else if (gkey === "relationship") {
            const i = rest.indexOf("relationship");
            res = rest[i + 1] || mod.key;
          } else if (gkey === "entity") {
            res = rest[0];
          } else {
            res =
              rest[0] && CRUD_ACTIONS.has(rest[rest.length - 1])
                ? rest[0]
                : rest[0] || mod.key;
          }
          resources[res] = resources[res] || [];
          resources[res].push(k);
        }
        const resourceList = Object.entries(resources).map(
          ([rkey, actions]) => ({
            key: rkey,
            label: humanize(rkey),
            actions: actions.map((a) => ({
              key: a,
              label: actionLabel(a),
              highRisk: isHighRisk(a),
            })),
          }),
        );
        const gl = GROUPS.find((g) => g.key === gkey);
        return {
          key: gkey,
          label: gl ? gl.label : humanize(gkey),
          resources: resourceList,
        };
      })
      .sort(
        (a, b) =>
          GROUPS.findIndex((g) => g.key === a.key) -
          GROUPS.findIndex((g) => g.key === b.key),
      );
    return {
      module: { key: mod.key, label: mod.label, namespace: mod.namespace },
      groups,
    };
  });
}

const allItsmKeys = () => Object.values(ITSM_DATA).flat();
const allCanonicalKeys = () => [...TENANT_CORE_PERMISSIONS, ...allItsmKeys()];

const ITSM_KEY_SET = new Set(allItsmKeys());
const CANONICAL_KEY_SET = new Set(allCanonicalKeys());

const isItsmKey = (key) => ITSM_KEY_SET.has(key);
const isCanonicalKey = (key) => CANONICAL_KEY_SET.has(key);

// Resource key (e.g. 'incident') → sensitive field names, derived from the
// permission key itself (`itsm.incident.incident.*` → resource 'incident').
const resourceOf = (key) => {
  const parts = key.split(".");
  if (
    parts[1] === "knowledge" &&
    (parts[3] || "").includes("knowledge_article")
  )
    return "knowledge_article";
  if (parts[1] === "request_catalog" && parts[3] === "request")
    return "request";
  if (parts[1] === "request_catalog" && parts[3] === "requested_item")
    return "requested_item";
  return parts[2] || parts[1];
};

const sensitiveFieldsFor = (key) => FIELD_POLICIES[resourceOf(key)] || [];

// Default allowed scopes per action kind. Scopes match authorization.service
// (TENANT, OWN, ASSIGNED_TO_ME, TEAM, DEPARTMENT, REQUESTED_BY_ME).
const defaultScopesFor = (key) => {
  const action = key.split(".").pop();
  if (["create"].includes(action))
    return ["TENANT", "DEPARTMENT", "TEAM", "OWN", "REQUESTED_BY_ME"];
  if (
    [
      "delete",
      "export",
      "archive",
      "restore",
      "view_audit",
      "view_history",
      "approve",
      "reject",
      "override",
      "bulk_update",
    ].includes(action)
  ) {
    return ["TENANT", "DEPARTMENT", "TEAM"];
  }
  return [
    "TENANT",
    "DEPARTMENT",
    "TEAM",
    "ASSIGNED_TO_ME",
    "ASSIGNMENT_GROUP",
    "OWN",
    "REQUESTED_BY_ME",
  ];
};

module.exports = {
  MODULES,
  GROUPS,
  FIELD_POLICIES,
  ITSM_DATA,
  tree,
  allItsmKeys,
  allCanonicalKeys,
  isItsmKey,
  isCanonicalKey,
  isHighRisk,
  humanize,
  resourceOf,
  sensitiveFieldsFor,
  defaultScopesFor,
};
