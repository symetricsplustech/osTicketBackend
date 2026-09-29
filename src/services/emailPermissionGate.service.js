/**
 * Email-driven ITSM intake permission gate.
 *
 * `instance.email.*` permissions govern channel CONFIGURATION and channel
 * administration only. Executing an inbound action that creates or mutates
 * an ITSM record (incident / request / task / update / workflow) additionally
 * requires the corresponding canonical `itsm.*` BUSINESS permission to be
 * granted to the tenant (GRANULAR_PERMISSIONS_FINAL §117-120).
 *
 * With no principal in flight (the IMAP poller is anonymous), the gate
 * authorizes a synthetic tenant principal built from the tenant's effective
 * membership grants. TENANT_CORE_PERMISSIONS deliberately contains no `itsm.*`
 * keys, so an inbound action only runs when the tenant explicitly granted the
 * target business permission — configuration alone is never sufficient.
 */

const { authorize, ALLOW, DENY } = require("./authorization.service");
const { permissionsForMembership } = require("./instanceAccess.service");
const { TENANT_CORE_PERMISSIONS } = require("../permissions/tenantCorePermissions");
const ApiError = require("../utils/ApiError");

/**
 * Default canonical `itsm.*` business permission per inbound action type.
 * Entry types that mutate an arbitrary record (update_record) or run a
 * user-selected workflow (run_workflow) have NO safe default: the action must
 * declare its target permission via `action_config.permission`, otherwise the
 * gate refuses to run it.
 */
const ACTION_PERMISSION_MAP = {
  create_incident: "itsm.incident.intake.email",
  create_request: "itsm.request_catalog.request.create",
  create_task: "itsm.core.task.create",
  update_record: null,
  run_workflow: null,
};

/**
 * Resolve the canonical target `itsm.*` permission for an inbound action.
 * `action_config.permission` always overrides the per-type default so admins
 * can pin a more specific key (e.g. itsm.incident.incident.create).
 */
const requiredPermissionForAction = (action) => {
  const explicit = action && action.action_config && action.action_config.permission;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  return ACTION_PERMISSION_MAP[action && action.action_type] || null;
};

/**
 * Synthetic tenant principal representing the email-driven inbound action.
 * Built purely from membership grants (no DB) so the gate is unit-testable.
 */
const tenantPrincipalFromMembership = (membership, companyId) => ({
  _id: (membership && (membership.user || membership.userId)) || null,
  name: "Instance email inbound action",
  // The principal belongs to the membership's OWN tenant; authorizing into any
  // other tenant trips the MEMBERSHIP_MISMATCH gate inside authorize().
  company: (membership && membership.instance) || companyId,
  isActive: true,
  permissions: [
    ...new Set([
      ...TENANT_CORE_PERMISSIONS,
      ...permissionsForMembership(membership),
    ]),
  ],
});

/**
 * Gate: may an inbound email action create/mutate ITSM records?
 *
 * @param {object} opts
 * @param {string} opts.companyId  tenant/instance id being ingested into
 * @param {object} [opts.membership] tenant membership carrying itsm.* grants
 * @param {object} [opts.principal] prebuilt principal (overrides membership)
 * @param {object} opts.action      InstanceEmailInboundAction doc/plain object
 * @param {object} [opts.record]    target record for scope/condition checks
 * @param {object} [opts.req]       express req for IP/UA audit context
 * @param {string} [opts.audit]     'deny' (default) | true | false
 *
 * Never throws. Returns { allowed, permission, reason, decision }.
 */
async function canExecuteInboundAction({
  companyId,
  membership,
  principal,
  action,
  record,
  req,
  audit = "deny",
}) {
  const deny = (reason, permission) => ({
    allowed: false,
    decision: DENY,
    reason,
    permission,
  });

  if (!action) return deny("NO_ACTION", null);
  if (action.is_active === false || action.isDisabled) {
    return deny("ACTION_INACTIVE", null);
  }
  const permission = requiredPermissionForAction(action);
  if (!permission) return deny("NO_TARGET_PERMISSION", null);
  if (!companyId) return deny("TENANT_UNRESOLVED", permission);

  const effPrincipal =
    principal || tenantPrincipalFromMembership(membership, companyId);
  if (!effPrincipal) return deny("PRINCIPAL_UNRESOLVED", permission);

  const result = await authorize({
    principal: effPrincipal,
    permission,
    tenant: companyId,
    record,
    req,
    customAuth: false,
    audit,
  });
  return {
    allowed: result.decision === ALLOW,
    decision: result.decision,
    reason: result.reason,
    permission,
  };
}

/**
 * Throwing variant for guarded service contexts.
 */
async function assertInboundActionPermission(opts) {
  const decision = await canExecuteInboundAction(opts);
  if (!decision.allowed) {
    throw new ApiError(403, "You do not have permission for this action");
  }
  return decision;
}

/**
 * Guarded execution seam: runs `handler` only when the tenant holds the
 * target `itsm.*` business permission. Execution is a pluggable backbone for
 * the inbound-action executor; until that executor ships, ALLOW returns the
 * decision and the caller decides how to proceed.
 */
async function executeInboundAction({ handler, ...gateOpts }) {
  const decision = await canExecuteInboundAction(gateOpts);
  if (!decision.allowed) return { executed: false, ...decision };
  if (typeof handler !== "function") return { executed: false, ...decision, reason: "NO_HANDLER" };
  await handler({ ...gateOpts, permission: decision.permission });
  return { executed: true, allowed: true, decision: ALLOW, reason: "OK", permission: decision.permission };
}

module.exports = {
  ACTION_PERMISSION_MAP,
  requiredPermissionForAction,
  tenantPrincipalFromMembership,
  canExecuteInboundAction,
  assertInboundActionPermission,
  executeInboundAction,
};