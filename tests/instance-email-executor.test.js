/* eslint-disable no-console */
// DB-free tests for the email-driven ITSM record executor and its business
// guards, plus the allowed-scope / default-role definitions for the
// instance email-channel permission family.
// Run: node tests/instance-email-executor.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const {
  buildIncidentRecord,
  buildRequestRecord,
  buildTaskRecord,
  guardEmailIntake,
  executeInboundRecord,
  EXECUTORS,
} = require("../src/services/inboundItmExecutor.service");
const {
  isEmailChannelPermission,
  scopesForPermission,
  defaultRolesForPermission,
  DEFAULT_SCOPE,
  DEFAULT_ROLES,
} = require("../src/permissions/instanceChannelDefaults");

const ownerWithGrant = {
  user: "u-owner",
  instance: "inst-A",
  role: "instance_owner",
  status: "active",
  permissions: ["itsm.incident.intake.email", "itsm.request_catalog.request.create", "itsm.core.task.create"],
};
const principalFor = (membership) => ({
  _id: membership.user,
  name: "Instance email inbound action",
  company: membership.instance,
  isActive: true,
  permissions: ["itsm.incident.intake.email", "itsm.request_catalog.request.create", "itsm.core.task.create"],
});

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
  console.log("\n=== EMAIL-DRIVEN ITSM EXECUTOR TESTS ===\n");

  const base = {
    companyId: "inst-A",
    senderEmail: "rita@acme.example",
    subject: "Prod is down",
    text: "The checkout API is returning 500s since 09:00.",
  };

  // 1. Record payload builders map email context -> ITSM record, honoring
  //    action_config overrides and falling back to safe defaults.
  const inc = buildIncidentRecord({ ...base, action: action("create_incident") });
  assert(inc.company === "inst-A" && inc.customFields.source === "email", "incident payload carries company + email source");
  assert(inc.title === "Prod is down", "incident title defaults to subject");
  assert(typeof inc.severity === "string" && inc.severity === "sev3", "incident severity defaulted");
  assert(inc.customFields.callerEmail === "rita@acme.example", "incident carries reporter email");

  const incCfg = buildIncidentRecord({
    ...base,
    action: action("create_incident", { action_config: { title: "Custom", summary: "S", severity: "Sev1", status: "investigating" } }),
  });
  assert(incCfg.title === "Custom" && incCfg.severity === "Sev1" && incCfg.status === "investigating", "action_config overrides incident fields");

  const req = buildRequestRecord({ ...base, user: { _id: "u1" }, action: action("create_request") });
  assert(req.title === "Prod is down" && req.requester === "u1" && req.source === "email", "request payload built with requester");
  assert(req.priority === "medium" && req.status === "open", "request defaults applied");

  const task = buildTaskRecord({ ...base, user: { _id: "u1" }, action: action("create_task") });
  assert(task.title === "Prod is down" && task.type === "task" && task.requestedBy === "u1", "task payload built");
  assert(task.tenantId === undefined && task.source === "email", "task payload excludes tenantId (added by executor)");

  // 2. Business guards enforce valid source states.
  assert(guardEmailIntake(base).ok === true, "well-formed intake passes guards");
  assert(guardEmailIntake({ ...base, companyId: "" }).reason === "TENANT_UNRESOLVED", "missing tenant rejected");
  assert(guardEmailIntake({ ...base, senderEmail: "not-an-email" }).reason === "INVALID_SENDER", "malformed sender rejected");
  assert(
    guardEmailIntake({ ...base, action: action("create_incident", { is_active: false }) }).reason === "ACTION_INACTIVE",
    "inactive action rejected",
  );

  // 3. Gating: denied membership never reaches a handler (no record created).
  let handlerRan = false;
  const denied = await executeInboundRecord({
    ...base,
    membership: { user: "u-req", instance: "inst-A", role: "requester", status: "active" },
    principal: { _id: "u-req", company: "inst-A", isActive: true, permissions: [] },
    action: action("create_incident"),
    audit: false,
    user: null,
  });
  assert(denied.executed === false && denied.allowed === false, "denied gate blocks execution");
  assert(denied.permission === "itsm.incident.intake.email", "denied outcome names the required permission");

  // 4. Unsupported action types fail closed (EXECUTOR_NOT_AVAILABLE) even when
  //    the gate allows — update_record / run_workflow have no safe default.
  const unsupported = await executeInboundRecord({
    ...base,
    membership: ownerWithGrant,
    principal: principalFor(ownerWithGrant),
    action: action("run_workflow", { action_config: { permission: "itsm.request_catalog.request.create" } }),
    audit: false,
    user: null,
  });
  assert(unsupported.executed === false && unsupported.reason === "EXECUTOR_NOT_AVAILABLE", "executor-unsupported action refused");
  assert(unsupported.allowed === true, "gate itself allowed the type-unsupported action");

  // 5. User-required record types refuse when no sender can be resolved.
  const noSender = await executeInboundRecord({
    ...base,
    membership: ownerWithGrant,
    principal: principalFor(ownerWithGrant),
    action: action("create_task"),
    audit: false,
    user: null,
  });
  assert(noSender.executed === false && noSender.reason === "SENDER_UNRESOLVED", "task refused without resolved sender");

  // 6. ALLOW path dispatches to the per-type handler (stubbed here so the
  //    test stays DB-free) and returns the created-record outcome.
  const original = EXECUTORS.create_task;
  EXECUTORS.create_task = async (ctx) => ({ recordType: "task", number: "TASK-2026-0001", record: { _id: "t1", number: "TASK-2026-0001" } });
  try {
    const executed = await executeInboundRecord({
      ...base,
      membership: ownerWithGrant,
      principal: principalFor(ownerWithGrant),
      action: action("create_task"),
      audit: false,
      user: { _id: "u1" },
    });
    assert(executed.executed === true && executed.recordType === "task", "allowed action dispatches to handler");
    assert(executed.number === "TASK-2026-0001" && executed.permission === "itsm.core.task.create", "handler outcome + permission surfaced");
  } finally {
    EXECUTORS.create_task = original;
  }

  // 7. Allowed-scope + default-role definitions for the email-channel family.
  for (const key of ["instance.email.channel.read", "instance.email.inbound_action.manage", "instance.email.delivery_log.read", "instance.email.message_audit.read"]) {
    assert(isEmailChannelPermission(key) === true, `${key} recognized as email-channel permission`);
    assert(scopesForPermission(key)[0] === DEFAULT_SCOPE, `${key} scoped to ${DEFAULT_SCOPE}`);
    assert(defaultRolesForPermission(key).length === DEFAULT_ROLES.length, `${key} default roles defined`);
  }
  assert(isEmailChannelPermission("instance.domain.read") === false, "domain permissions excluded");
  assert(scopesForPermission("itsm.incident.incident.create").length === 0, "non-email keys get no channel scopes");
  assert(defaultRolesForPermission("tenant.user.create").length === 0, "non-email keys get no channel roles");

  console.log("\n🎉 ALL EMAIL-DRIVEN ITSM EXECUTOR TESTS PASSED\n");
  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});