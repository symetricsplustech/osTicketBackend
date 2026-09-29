/* eslint-disable no-console */
// DB-free tests for the email-driven ITSM intake permission gate.
// Verifies that executing an inbound action requires the target canonical
// `itsm.*` business permission in addition to the `instance.email.*`
// configuration plane, which by itself never authorizes record intake.
// Run: node tests/instance-email-permission-gate.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const { ALLOW, DENY } = require("../src/services/authorization.service");
const { TENANT_CORE_PERMISSIONS } = require("../src/permissions/tenantCorePermissions");
const { isCanonicalKey } = require("../src/permissions/itsmCatalog");
const {
  ACTION_PERMISSION_MAP,
  requiredPermissionForAction,
  tenantPrincipalFromMembership,
  canExecuteInboundAction,
  executeInboundAction,
} = require("../src/services/emailPermissionGate.service");

const MEMBERSHIP_OWNER = { user: "u-owner", instance: "inst-A", role: "instance_owner", status: "active" };
const MEMBERSHIP_REQ = { user: "u-req", instance: "inst-A", role: "requester", status: "active" };

const action = (actionType, overrides = {}) => ({
  id: "act-1",
  channel_id: "chan-1",
  action_type: actionType,
  action_config: {},
  priority: 100,
  is_active: true,
  trigger: "all",
  ...overrides,
});

(async () => {
  console.log("\n=== EMAIL-DRIVEN ITSM INTAKE PERMISSION GATE TESTS ===\n");

  // 1. Per-type default target `itsm.*` permissions are canonical.
  const expected = {
    create_incident: "itsm.incident.intake.email",
    create_request: "itsm.request_catalog.request.create",
    create_task: "itsm.core.task.create",
  };
  for (const [type, key] of Object.entries(expected)) {
    assert(ACTION_PERMISSION_MAP[type] === key, `${type} maps to ${key}`);
    assert(isCanonicalKey(key), `${key} is a canonical itsm.* key`);
  }
  assert(ACTION_PERMISSION_MAP.update_record === null, "update_record has no default");
  assert(ACTION_PERMISSION_MAP.run_workflow === null, "run_workflow has no default");

  // 2. action_config.permission overrides the per-type default; a non-empty
  //    override wins, an empty/absent one falls back to the default.
  assert(
    requiredPermissionForAction(action("create_incident", { action_config: { permission: "itsm.incident.incident.create" } })) === "itsm.incident.incident.create",
    "explicit action_config.permission overrides default",
  );
  assert(
    requiredPermissionForAction(action("create_incident")) === "itsm.incident.intake.email",
    "default resolved when no explicit override",
  );
  assert(
    requiredPermissionForAction(action("update_record")) === null,
    "update_record without explicit permission has no target",
  );
  assert(
    requiredPermissionForAction(action("update_record", { action_config: { permission: "itsm.core.task.update" } })) === "itsm.core.task.update",
    "update_record with explicit permission resolves a target",
  );
  assert(requiredPermissionForAction(null) === null, "null action resolves nothing");

  // 3. TENANT_CORE_PERMISSIONS contain NO `itsm.*` business keys: the config
  //    plane alone can never satisfy the intake gate.
  assert(
    TENANT_CORE_PERMISSIONS.every((k) => !k.startsWith("itsm.")),
    "tenant core carries no itsm.* business permissions",
  );
  assert(
    isCanonicalKey("itsm.incident.intake.email"),
    "dedicated email-intake key exists in catalog",
  );

  // 4. Owner membership WITHOUT an explicit itsm.* business grant is DENIED —
  //    configuring a channel (instance.email.*) is not enough to create
  //    ITSM records from email.
  const ownerNoGrant = tenantPrincipalFromMembership(MEMBERSHIP_OWNER, "inst-A");
  const deniedNoGrant = await canExecuteInboundAction({
    companyId: "inst-A",
    membership: MEMBERSHIP_OWNER,
    principal: ownerNoGrant,
    action: action("create_incident"),
    audit: false,
  });
  assert(deniedNoGrant.allowed === false, "owner without intake grant denied");
  assert(deniedNoGrant.permission === "itsm.incident.intake.email", "denial names the required permission");

  // 5. Granting the target `itsm.*` key to the membership ALLOWS the action.
  const grantedOwner = tenantPrincipalFromMembership(
    { ...MEMBERSHIP_OWNER, permissions: ["itsm.incident.intake.email"] },
    "inst-A",
  );
  const allowed = await canExecuteInboundAction({
    companyId: "inst-A",
    membership: { ...MEMBERSHIP_OWNER, permissions: ["itsm.incident.intake.email"] },
    principal: grantedOwner,
    action: action("create_incident"),
    audit: false,
  });
  assert(allowed.allowed === true && allowed.decision === ALLOW, "membership grant satisfies intake gate");

  // 6. Different record types need their own business permission.
  const taskDenied = await canExecuteInboundAction({
    companyId: "inst-A",
    membership: MEMBERSHIP_OWNER,
    principal: tenantPrincipalFromMembership(
      { ...MEMBERSHIP_OWNER, permissions: ["itsm.incident.intake.email"] },
      "inst-A",
    ),
    action: action("create_task"),
    audit: false,
  });
  assert(taskDenied.allowed === false, "incident grant does not cover create_task");
  assert(taskDenied.permission === "itsm.core.task.create", "task denial names itsm.core.task.create");

  // 7. Explicit per-action override is enforced end to end.
  const overrideDenied = await canExecuteInboundAction({
    companyId: "inst-A",
    membership: { ...MEMBERSHIP_OWNER, permissions: ["itsm.request_catalog.request.create"] },
    principal: tenantPrincipalFromMembership(
      { ...MEMBERSHIP_OWNER, permissions: ["itsm.request_catalog.request.create"] },
      "inst-A",
    ),
    action: action("create_request", { action_config: { permission: "itsm.request_catalog.requested_item.create" } }),
    audit: false,
  });
  assert(overrideDenied.allowed === false, "explicit override key must also be granted");
  assert(overrideDenied.permission === "itsm.request_catalog.requested_item.create", "denial names the overridden key");

  const overrideGranted = await canExecuteInboundAction({
    companyId: "inst-A",
    membership: { ...MEMBERSHIP_OWNER, permissions: ["itsm.request_catalog.requested_item.create"] },
    principal: tenantPrincipalFromMembership(
      { ...MEMBERSHIP_OWNER, permissions: ["itsm.request_catalog.requested_item.create"] },
      "inst-A",
    ),
    action: action("create_request", { action_config: { permission: "itsm.request_catalog.requested_item.create" } }),
    audit: false,
  });
  assert(overrideGranted.allowed === true, "explicit override key allows when granted");

  // 8. Requester membership (non-admin, no explicit grant) is denied.
  const requesterDenied = await canExecuteInboundAction({
    companyId: "inst-A",
    membership: MEMBERSHIP_REQ,
    principal: tenantPrincipalFromMembership(MEMBERSHIP_REQ, "inst-A"),
    action: action("create_incident"),
    audit: false,
  });
  assert(requesterDenied.allowed === false, "requester membership denied");

  // 9. Inactive actions never run, regardless of grants.
  const inactive = await canExecuteInboundAction({
    companyId: "inst-A",
    membership: { ...MEMBERSHIP_OWNER, permissions: ["itsm.incident.intake.email"] },
    principal: grantedOwner,
    action: action("create_incident", { is_active: false }),
    audit: false,
  });
  assert(inactive.allowed === false && inactive.reason === "ACTION_INACTIVE", "inactive action denied");

  // 10. Actions without a resolvable target permission are never run.
  const noTarget = await canExecuteInboundAction({
    companyId: "inst-A",
    membership: MEMBERSHIP_OWNER,
    principal: grantedOwner,
    action: action("update_record"),
    audit: false,
  });
  assert(noTarget.allowed === false && noTarget.reason === "NO_TARGET_PERMISSION", "no-target action denied");

  // 11. Cross-tenant: a membership for inst-B cannot authorize intake into
  //     inst-A (MEMBERSHIP_MISMATCH inside authorize()).
  const crossTenant = await canExecuteInboundAction({
    companyId: "inst-A",
    membership: { user: "u-b", instance: "inst-B", role: "instance_owner", status: "active", permissions: ["itsm.incident.intake.email"] },
    principal: tenantPrincipalFromMembership(
      { user: "u-b", instance: "inst-B", role: "instance_owner", status: "active", permissions: ["itsm.incident.intake.email"] },
      "inst-A",
    ),
    action: action("create_incident"),
    audit: false,
  });
  assert(crossTenant.allowed === false && crossTenant.reason === "MEMBERSHIP_MISMATCH", "cross-instance intake membership rejected");

  // 12. executeInboundAction runs the handler only when the gate allows.
  const neverRan = await executeInboundAction({
    companyId: "inst-A",
    membership: MEMBERSHIP_OWNER,
    principal: ownerNoGrant,
    action: action("create_incident"),
    audit: false,
    handler: () => {
      throw new Error("handler must not run on denial");
    },
  });
  assert(neverRan.executed === false, "handler does not run on denied gate");

  let handlerRan = false;
  const ran = await executeInboundAction({
    companyId: "inst-A",
    membership: { ...MEMBERSHIP_OWNER, permissions: ["itsm.incident.intake.email"] },
    principal: grantedOwner,
    action: action("create_incident"),
    audit: false,
    handler: () => {
      handlerRan = true;
    },
  });
  assert(ran.executed === true && handlerRan === true, "handler runs when gate allows");

  // 13. Membership grants are instance-plane scoped: a raw `*` on a
  //     membership is NOT carried into the gate (fail-closed), while a direct
  //     principal that holds the wildcard satisfies every intake gate.
  const membershipWildcard = await canExecuteInboundAction({
    companyId: "inst-A",
    membership: { ...MEMBERSHIP_OWNER, permissions: ["*"] },
    principal: tenantPrincipalFromMembership(
      { ...MEMBERSHIP_OWNER, permissions: ["*"] },
      "inst-A",
    ),
    action: action("create_task"),
    audit: false,
  });
  assert(membershipWildcard.allowed === false, 'membership wildcard is not implicitly carried');

  const directWildcard = {
    _id: "u-op",
    name: "Platform operator",
    company: "inst-A",
    isActive: true,
    permissions: ["*"],
  };
  const wildAll = await canExecuteInboundAction({
    companyId: "inst-A",
    principal: directWildcard,
    action: action("create_task"),
    audit: false,
  });
  assert(wildAll.allowed === true, 'direct wildcard principal allows intake');

  console.log("\n🎉 ALL EMAIL-DRIVEN ITSM INTAKE GATE TESTS PASSED\n");
  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});