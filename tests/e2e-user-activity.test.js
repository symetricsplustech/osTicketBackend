/* eslint-disable no-console */
// Real end-to-end test of the User Access Workspace activity surfaces against
// the configured PostgreSQL runtime (no mocks):
//   - assigned work: open tickets/tasks owned by the matching agent
//   - work history: completed tasks, resolved tickets and actor audit events
//   - sessions / MFA: record, list and revoke (bumps session_version)
// All seed rows are removed afterward so the run is idempotent.
// Run: node tests/e2e-user-activity.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

(async () => {
  console.log("\n=== USER ACTIVITY E2E (REAL POSTGRES) ===\n");

  const connectDB = require("../src/config/db");
  const { getDB } = require("../src/config/db");
  await connectDB();
  const db = getDB();

  const Company = require("../src/models/Company");
  const User = require("../src/models/User");
  const Agent = require("../src/models/Agent");
  const userActivity = require("../src/services/userActivity.service");
  const sessionService = require("../src/services/session.service");

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const createdCompanyIds = [];

  try {
    const company = await Company.create({
      name: `E2E activity ${suffix}`,
      domain: `activity-${suffix}.example.com`,
      status: "active",
      is_instance: true,
    });
    const tenantId = String(company.id);
    createdCompanyIds.push(tenantId);

    const email = `activity-agent-${suffix}@example.com`;
    const user = await User.create({
      name: `E2E Activity ${suffix}`,
      email,
      password: "e2e-temp-password-123",
      company_id: tenantId,
      instance_memberships: [{ instance: tenantId, role: "agent", status: "active" }],
    });
    const userId = String(user.id || user._id);

    const agent = await Agent.create({
      name: `E2E Agent ${suffix}`,
      email,
      password: "e2e-temp-password-123",
      company_id: tenantId,
    });
    const agentId = String(agent.id || agent._id);

    // Requester that owns the ticket (tickets.user_id is NOT NULL)
    const requester = await User.create({
      name: `E2E Requester ${suffix}`,
      email: `activity-requester-${suffix}@example.com`,
      password: "e2e-temp-password-123",
      company_id: tenantId,
    });
    const requesterId = String(requester.id || requester._id);

    await db("tickets").insert([
      {
        number: `E2E-OPEN-${suffix}`,
        company_id: tenantId,
        user_id: requesterId,
        subject: `Open ticket ${suffix}`,
        status: "open",
        agent_id: agentId,
        last_activity: db.fn.now(),
      },
      {
        number: `E2E-DONE-${suffix}`,
        company_id: tenantId,
        user_id: requesterId,
        subject: `Resolved ticket ${suffix}`,
        status: "resolved",
        agent_id: agentId,
        resolved_at: db.fn.now(),
        last_activity: db.fn.now(),
      },
    ]);
    await db("tasks").insert([
      {
        tenant_id: tenantId,
        number: `E2E-TASK-OPEN-${suffix}`,
        title: `Open task ${suffix}`,
        state: "new",
        assigned_to: agentId,
      },
      {
        tenant_id: tenantId,
        number: `E2E-TASK-DONE-${suffix}`,
        title: `Closed task ${suffix}`,
        state: "closed",
        assigned_to: agentId,
        closed_at: db.fn.now(),
      },
    ]);
    await db("audit_events").insert({
      tenant_id: tenantId,
      actor_id: userId,
      resource_type: "user",
      resource_id: userId,
      action: "e2e.activity.action",
    });

    // ── Assigned work ─────────────────────────────────────────────────
    const assigned = await userActivity.listAssignedWork({ tenantId, userId });
    assert(
      assigned.tickets.some((t) => t.number === `E2E-OPEN-${suffix}`),
      "assigned work lists the open ticket",
    );
    assert(
      !assigned.tickets.some((t) => t.number === `E2E-DONE-${suffix}`),
      "assigned work excludes the resolved ticket",
    );
    assert(
      assigned.tasks.some((t) => t.number === `E2E-TASK-OPEN-${suffix}`),
      "assigned work lists the open task",
    );
    assert(
      !assigned.tasks.some((t) => t.number === `E2E-TASK-DONE-${suffix}`),
      "assigned work excludes the closed task",
    );

    // ── Work history ──────────────────────────────────────────────────
    const history = await userActivity.listWorkHistory({ tenantId, userId });
    const types = history.items.map((i) => i.type);
    assert(
      history.items.some((i) => i.reference === `E2E-TASK-DONE-${suffix}`),
      "work history includes the completed task",
    );
    assert(
      history.items.some((i) => i.reference === `E2E-DONE-${suffix}`),
      "work history includes the resolved ticket",
    );
    assert(
      history.items.some((i) => i.title === "e2e.activity.action"),
      "work history includes the actor audit event",
    );
    assert(
      types.includes("task") && types.includes("ticket") && types.includes("audit"),
      "work history mixes task, ticket and audit sources",
    );

    // ── Sessions / MFA ────────────────────────────────────────────────
    await sessionService.recordSession({
      tenantId,
      agentId,
      email,
      ip: "203.0.113.10",
      userAgent: "Mozilla/5.0 (Macintosh) E2E",
      mfaVerified: false,
    });
    const sessions = await sessionService.listSessionsForUser({ tenantId, userId });
    assert(sessions.items.length >= 1, "session recorded and listed for the user");
    assert(
      sessions.items.some((s) => s.email === email && s.status === "active"),
      "listed session is active and matched by email bridge",
    );
    assert(sessions.mfa && sessions.mfa.enabled === false, "MFA status read from the user");

    const sessionId = sessions.items[0]._id;
    const before = sessions.mfa.sessionVersion;
    const revoked = await sessionService.revokeSession({
      tenantId,
      userId,
      sessionId,
    });
    assert(revoked && revoked.status === "revoked", "session revoked");
    const after = await sessionService.mfaStatusForUser(tenantId, userId);
    assert(
      after.sessionVersion === before + 1,
      "revoking a session bumped session_version (invalidates JWTs)",
    );

    console.log("\n🎉 USER ACTIVITY E2E VERIFIED (LIVE POSTGRES)\n");
  } finally {
    try {
      if (createdCompanyIds.length) {
        await db("user_sessions").whereIn("tenant_id", createdCompanyIds).del();
        await db("tickets").whereIn("company_id", createdCompanyIds).del();
        await db("tasks").whereIn("tenant_id", createdCompanyIds).del();
        await db("audit_events").whereIn("tenant_id", createdCompanyIds).del();
        await db("agents").whereIn("company_id", createdCompanyIds).del();
        await db("users").whereIn("company_id", createdCompanyIds).del();
        await db("companies").whereIn("id", createdCompanyIds).del();
      }
      console.log("CLEANUP OK");
    } catch (cleanErr) {
      console.warn("CLEANUP WARN:", cleanErr.message);
    }
    await db.destroy();
  }
})().catch((err) => {
  console.error("E2E FAILED:", (err && err.message) || err);
  if (err && err.stack) console.error(err.stack.split("\n").slice(0, 8).join("\n"));
  process.exit(1);
});
