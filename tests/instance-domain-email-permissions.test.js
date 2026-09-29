/* eslint-disable no-console */
// DB-free tests for the instance custom-domain and email-channel permission
// families: default membership grants, exact vs namespace permissions, the
// cross-instance membership isolation check, and field-policy coverage.
// Run: node tests/instance-domain-email-permissions.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const { authorize, DENY, ALLOW } = require("../src/services/authorization.service");
const { permissionsForMembership } = require("../src/services/instanceAccess.service");
const { TENANT_CORE_PERMISSIONS } = require("../src/permissions/tenantCorePermissions");
const { sensitiveFieldsFor, resourceOf, isHighRisk, isCanonicalKey } = require("../src/permissions/itsmCatalog");
const {
  INSTANCE_DOMAIN_PREFIX,
  DEFAULT_SCOPE,
  DELEGATABLE_SCOPES,
  DEFAULT_ROLES,
  RECORD_CONDITION,
  DOMAIN_PERMISSIONS,
  isDomainPermission,
  scopesForPermission,
  defaultRolesForPermission,
} = require("../src/permissions/instanceDomainDefaults");
const {
  isEmailChannelPermission,
  scopesForPermission: emailScopesForPermission,
  defaultRolesForPermission: emailDefaultRolesForPermission,
} = require("../src/permissions/instanceChannelDefaults");

const INSTANCE_KEYS = TENANT_CORE_PERMISSIONS.filter((k) => k.startsWith("instance."));
const DOMAIN_KEYS = INSTANCE_KEYS.filter((k) => k.startsWith("instance.domain."));

const quietAuthorize = (options) =>
  authorize({ customAuth: false, audit: false, ...options });

(async () => {
  console.log("\n=== INSTANCE DOMAIN / EMAIL PERMISSION TESTS ===\n");

  // 1. Owner / admin memberships inherit the full instance.* plane.
  for (const role of ["instance_owner", "instance_admin"]) {
    const grants = permissionsForMembership({ role, instance: "inst-A", status: "active" });
    for (const key of INSTANCE_KEYS) {
      assert(grants.includes(key), `owner/admin membership grants ${key}`);
    }
  }

  // 2. Requester / agent memberships do NOT inherit instance.* permissions.
  const requester = permissionsForMembership({ role: "requester", instance: "inst-A", status: "active" });
  assert(requester.length > 0, "requester membership still has defaults");
  for (const key of INSTANCE_KEYS) {
    assert(!requester.includes(key), `non-admin membership lacks ${key}`);
  }
  const agent = permissionsForMembership({ role: "agent", instance: "inst-A", status: "active" });
  assert(!agent.some((k) => k.startsWith("instance.")), "agent membership lacks instance.* keys");

  // 3. Exact-key grant: allowed for the granted action, denied otherwise.
  const readOnly = {
    _id: "u-read",
    isActive: true,
    company: "inst-A",
    permissions: ["instance.domain.read", "instance.email.channel.read"],
  };
  const allowedRead = await quietAuthorize({
    principal: readOnly,
    permission: "instance.domain.read",
    tenant: "inst-A",
  });
  assert(allowedRead.decision === ALLOW, "exact instance.domain.read grant allowed");
  const deniedDelete = await quietAuthorize({
    principal: readOnly,
    permission: "instance.domain.delete",
    tenant: "inst-A",
  });
  assert(deniedDelete.decision === DENY, "missing instance.domain.delete denied");

  // 4. Namespace grant `instance.domain.*` covers every key beneath it.
  const domainAdmin = {
    _id: "u-domain",
    isActive: true,
    company: "inst-A",
    permissions: ["instance.domain.*"],
  };
  for (const key of ["instance.domain.read", "instance.domain.add", "instance.domain.delete", "instance.domain.view_audit"]) {
    const res = await quietAuthorize({ principal: domainAdmin, permission: key, tenant: "inst-A" });
    assert(res.decision === ALLOW, `instance.domain.* satisfies ${key}`);
  }
  const emailBlocked = await quietAuthorize({
    principal: domainAdmin,
    permission: "instance.email.channel.configure",
    tenant: "inst-A",
  });
  assert(emailBlocked.decision === DENY, "instance.domain.* does not leak into email channel plane");

  // 5. Wildcard grant covers the whole instance plane.
  const wildcard = { _id: "u-wild", isActive: true, company: "inst-A", permissions: ["*"] };
  for (const key of ["instance.domain.add", "instance.email.message_audit.read", "instance.email.inbound_action.manage"]) {
    const res = await quietAuthorize({ principal: wildcard, permission: key, tenant: "inst-A" });
    assert(res.decision === ALLOW, `wildcard satisfies ${key}`);
  }

  // 6. Cross-instance isolation: membership mismatch is rejected regardless
  //    of how many grants the principal holds.
  const crossInstance = await quietAuthorize({
    principal: wildcard,
    permission: "instance.domain.add",
    tenant: "inst-B",
  });
  assert(crossInstance.decision === DENY && crossInstance.reason === "MEMBERSHIP_MISMATCH",
    "cross-instance access rejected with MEMBERSHIP_MISMATCH");

  // 7. Catalog validation: instance.* keys are canonical and field-policy
  //    aware, and destructive instance actions are flagged high-risk.
  for (const key of INSTANCE_KEYS) {
    assert(isCanonicalKey(key), `${key} is a canonical key`);
  }
  assert(isHighRisk("instance.domain.delete"), "instance.domain.delete flagged high-risk");
  assert(isHighRisk("instance.email.channel.configure") === false, "channel configure is not high-risk");

  // Field-policy coverage for raw secrets and metadata.
  assert(
    sensitiveFieldsFor("instance.email.delivery_log.read").includes("error_message"),
    "delivery-log fields covered",
  );
  assert(
    sensitiveFieldsFor("instance.email.message_audit.read").includes("headers"),
    "message-audit fields covered",
  );
  assert(
    sensitiveFieldsFor("instance.email.sender.read").includes("headers"),
    "sender-config fields covered",
  );
  assert(
    sensitiveFieldsFor("instance.email.channel.read").includes("smtp_password"),
    "email channel secret fields covered",
  );
  assert(
    sensitiveFieldsFor("instance.email.inbound_action.read").includes("verification_token"),
    "email verification-token fields covered",
  );
  assert(
    sensitiveFieldsFor("instance.domain.add").includes("verification_token"),
    "domain verification-token fields covered",
  );
  assert(
    sensitiveFieldsFor("instance.domain.read").includes("tls_private_key"),
    "domain TLS material covered",
  );

  // resourceOf mapping for instance.* sub-resources.
  assert(resourceOf("instance.domain.verify") === "instance_domain", "domain resource resolved");
  assert(resourceOf("instance.email.channel.read") === "instance_email", "email channel resource resolved");
  assert(resourceOf("instance.email.sender.read") === "instance_email_sender", "sender resource resolved");
  assert(resourceOf("instance.email.delivery_log.read") === "instance_email_delivery", "delivery resource resolved");
  assert(resourceOf("instance.email.message_audit.read") === "instance_email_message", "message resource resolved");

  // 8. Custom-domain permission metadata: allowed scopes, record conditions,
  //    field policies and default roles are defined for every one of the 8 keys.
  assert(DOMAIN_PERMISSIONS.length === 8, "all 8 custom-domain keys enumerated");
  assert(JSON.stringify(DOMAIN_PERMISSIONS) === JSON.stringify(DOMAIN_KEYS),
    "catalog keys match declared DOMAIN_PERMISSIONS");
  for (const key of DOMAIN_KEYS) {
    assert(isCanonicalKey(key), `${key} is a canonical key`);
    assert(isDomainPermission(key), `${key} recognized by instanceDomainDefaults`);
    assert(scopesForPermission(key).length === 1 && scopesForPermission(key)[0] === DEFAULT_SCOPE,
      `${key} scope defined as TENANT`);
    const roles = defaultRolesForPermission(key);
    assert(roles.length === 2 && roles.includes("instance_owner") && roles.includes("instance_admin"),
      `${key} default roles are instance_owner/instance_admin`);
    assert(DELEGATABLE_SCOPES.has("TENANT"), "tenancy is a delegatable scope");
    assert(DELEGATABLE_SCOPES.has("ORGANIZATION") && DELEGATABLE_SCOPES.has("BUSINESS_UNIT"),
      "organization/business-unit delegable scopes retained");
  }
  assert(typeof RECORD_CONDITION === "string" && RECORD_CONDITION.includes("company_id"),
    "record condition binds to authorizing instance");

  // 9. Authorized / unauthorized / cross-instance cases for EVERY custom-domain
  //    permission key (mirror of the email-channel per-key sweep).
  for (const key of DOMAIN_KEYS) {
    const grantee = {
      _id: `u-${key}`,
      isActive: true,
      company: "inst-A",
      permissions: [key],
    };
    // authorized in the granted instance
    const ok = await quietAuthorize({ principal: grantee, permission: key, tenant: "inst-A" });
    assert(ok.decision === ALLOW, `${key} authorized in owning instance`);
    // every other custom-domain key stays denied
    for (const other of DOMAIN_KEYS) {
      if (other === key) continue;
      const denied = await quietAuthorize({ principal: grantee, permission: other, tenant: "inst-A" });
      assert(denied.decision === DENY, `${key} does not authorize sibling ${other}`);
    }
    // email-channel plane stays closed even with a full domain grant
    const emailClosed = await quietAuthorize({
      principal: grantee,
      permission: "instance.email.channel.read",
      tenant: "inst-A",
    });
    assert(emailClosed.decision === DENY, `${key} does not leak into email-channel plane`);
    // cross-instance: same grant cannot cross the instance boundary
    const cross = await quietAuthorize({ principal: grantee, permission: key, tenant: "inst-B" });
    assert(cross.decision === DENY && cross.reason === "MEMBERSHIP_MISMATCH",
      `${key} cross-instance access rejected with MEMBERSHIP_MISMATCH`);
    // unauthenticated principal has no instance-admin access
    const anon = await quietAuthorize({ principal: null, permission: key, tenant: "inst-A" });
    assert(anon.decision === DENY, `${key} denied for anonymous principal`);
  }

  // 9a. Namespace `instance.domain.*` satisfies every key it governs.
  const domainNamespaceAdmin = {
    _id: "u-domain-ns", isActive: true, company: "inst-A", permissions: [INSTANCE_DOMAIN_PREFIX + "*"],
  };
  for (const key of DOMAIN_KEYS) {
    const res = await quietAuthorize({ principal: domainNamespaceAdmin, permission: key, tenant: "inst-A" });
    assert(res.decision === ALLOW, `instance.domain.* satisfies ${key}`);
  }

  // 10. Email-channel metadata continues to be defined for every one of its keys.
  const EMAIL_KEYS = INSTANCE_KEYS.filter((k) => k.startsWith("instance.email."));
  assert(EMAIL_KEYS.length === 10, "all 10 email-channel keys present in catalog");
  for (const key of EMAIL_KEYS) {
    assert(isEmailChannelPermission(key), `${key} recognized by instanceChannelDefaults`);
    assert(emailScopesForPermission(key).length === 1 && emailScopesForPermission(key)[0] === DEFAULT_SCOPE,
      `${key} scope defined as TENANT`);
    const roles = emailDefaultRolesForPermission(key);
    assert(roles.length === 2 && roles.includes("instance_owner") && roles.includes("instance_admin"),
      `${key} default roles are instance_owner/instance_admin`);
  }

  console.log("\n🎉 ALL INSTANCE DOMAIN / EMAIL PERMISSION TESTS PASSED\n");
  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});