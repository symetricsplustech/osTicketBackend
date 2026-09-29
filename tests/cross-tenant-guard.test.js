/* eslint-disable no-console */
// DB-free tests for cross-tenant relationship guards and the audit trail
// before/after value mapping. Run: node tests/cross-tenant-guard.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

const { assertTenantOf } = require("../src/services/tenantGuard");
const auditEventService = require("../src/services/auditEvent.service");
const AuditEvent = require("../src/models/core/AuditEvent");

(async () => {
  console.log("\n=== CROSS-TENANT GUARD TESTS ===\n");

  const tenantA = "tenant-a";
  const tenantB = "tenant-b";

  const makeModel = (index) => {
    const rows = [
      { id: "ci-1", tenantId: tenantA },
      { id: "ci-2", tenantId: tenantB },
    ];
    return {
      async findOne({ _id }) {
        return rows.find((r) => r.id === _id) || null;
      },
    };
  };

  const model = makeModel();

  // Same tenant → allowed, returns the record
  const same = await assertTenantOf(model, "ci-1", tenantA, "configuration item");
  assert(same && same.id === "ci-1", "same-tenant reference allowed");

  // Cross-tenant → 403
  let crossTenantBlocked = false;
  try {
    await assertTenantOf(model, "ci-2", tenantA, "configuration item");
  } catch (err) {
    crossTenantBlocked = err.statusCode === 403;
  }
  assert(crossTenantBlocked, "cross-tenant reference rejected with 403");

  // Unknown id → 404
  let missing = false;
  try {
    await assertTenantOf(model, "ci-999", tenantA, "configuration item");
  } catch (err) {
    missing = err.statusCode === 404;
  }
  assert(missing, "missing record rejected with 404");

  // Missing id → 400
  let blankId = false;
  try {
    await assertTenantOf(model, null, tenantA, "configuration item");
  } catch (err) {
    blankId = err.statusCode === 400;
  }
  assert(blankId, "blank id rejected with 400");

  // Company-scoped records are matched via the company alias
  const companyModel = {
    async findOne({ _id }) {
      if (_id === "chg-1") return { id: "chg-1", company: tenantA };
      return { id: "chg-2", company: tenantB };
    },
  };
  const changeOk = await assertTenantOf(
    companyModel,
    "chg-1",
    tenantA,
    "change",
  );
  assert(changeOk && changeOk.id === "chg-1", "company-scoped record matched");

  console.log("\n=== AUDIT TRAIL MAPPING TESTS ===\n");

  // Capture the row that record() tries to persist
  let captured = null;
  const originalCreate = AuditEvent.create.bind(AuditEvent);
  AuditEvent.create = async (data) => {
    captured = data;
    return { ...data, id: "audit-1", toObject: () => data };
  };

  try {
    await auditEventService.record({
      tenantId: tenantA,
      actor: "user-1",
      entityType: "Problem",
      entityId: "prob-1",
      action: "problem.created",
      before: { status: "new", priority: "high" },
      after: { status: "assess", priority: "high" },
      userAgent: "test-agent",
    });

    assert(captured !== null, "audit event persisted payload captured");
    assert(captured.actorId === "user-1", "actor mapped to actorId");
    assert(captured.resourceType === "Problem", "entityType -> resourceType");
    assert(captured.resourceId === "prob-1", "entityId -> resourceId");
    assert(
      captured.oldValues && captured.oldValues.status === "new",
      "before -> oldValues",
    );
    assert(
      captured.newValues && captured.newValues.status === "assess",
      "after -> newValues",
    );
    assert(captured.tenantId === tenantA, "tenantId preserved");
  } finally {
    AuditEvent.create = originalCreate;
  }
})().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});