/* eslint-disable no-console */
// Real end-to-end test of the temporary-permission-grant subsystem against the
// configured PostgreSQL runtime (no mocks). Proves the schema, the grant
// service and the effective-permissions layering work at the data layer:
//   - grantPermission writes authorization_grants rows (ENUM/catalog checks)
//   - layeredEffectivePermissions surfaces source == "temporary" + metadata
//   - expiry: null -> active; past -> filtered; future -> active
//   - revokeGrant sets revoked_at and the grant drops from the effective set
//   - cross-tenant revocation returns null (no enumeration)
//   - grantee isolation: another agent in the same tenant sees nothing
// All seed rows are removed afterward so the run is idempotent.
// Run: node tests/e2e-effective-access-grants.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

(async () => {
  console.log("\n=== EFFECTIVE-ACCESS TEMPORARY GRANTS E2E (REAL POSTGRES) ===\n");

  const connectDB = require("../src/config/db");
  const { getDB } = require("../src/config/db");
  await connectDB();
  const db = getDB();

  const Company = require("../src/models/Company");
  const Agent = require("../src/models/Agent");
  const { resolveEffectivePermissions } = require("../src/services/authorization.service");
  const {
    activeGrantsFor,
    layeredEffectivePermissions,
    grantPermission,
    revokeGrant,
    isValidPermissionKey,
  } = require("../src/services/authorizationGrants.service");

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const createdCompanyIds = [];

  const seedTenant = async (tag) => {
    const company = await Company.create({
      name: `E2E grants ${tag} ${suffix}`,
      domain: `grants-${tag}-${suffix}.example.com`,
      status: "active",
    });
    const agent = await Agent.create({
      name: `E2E grants owner ${tag}`,
      email: `grants-${tag}-${suffix}@example.com`,
      password: "e2e-temp-password-123",
      is_admin: true,
      company_id: String(company.id),
      instance_memberships: [
        {
          instance: String(company.id),
          role: "instance_owner",
          status: "active",
          permissions: [],
        },
      ],
    });
    const peer = await Agent.create({
      name: `E2E grants peer ${tag}`,
      email: `grants-peer-${tag}-${suffix}@example.com`,
      password: "e2e-temp-password-123",
      is_admin: false,
      company_id: String(company.id),
      instance_memberships: [
        {
          instance: String(company.id),
          role: "agent",
          status: "active",
          permissions: [],
        },
      ],
    });
    createdCompanyIds.push(String(company.id));
    return { company, agent, peer };
  };

  try {
    const A = await seedTenant("A");
    const tenantId = String(A.company.id);
    const agentId = String(A.agent.id || A.agent._id);
    const peerId = String(A.peer.id || A.peer._id);

    // ── Validation of permission keys ───────────────────────────────────
    assert(isValidPermissionKey("itsm.incident.incident.delete"), "valid itsm key accepted");
    assert(!isValidPermissionKey("not a real permission"), "garbage key rejected");

    let rejected = null;
    try {
      await grantPermission({
        tenantId,
        granteeId: agentId,
        granteeType: "agent",
        permission: "garbage grant key",
        grantedBy: agentId,
      });
    } catch (err) {
      rejected = String(err.message).includes("valid permission key");
    }
    assert(rejected === true, "grantPermission rejects an invalid permission key");

    let rejectedType = null;
    try {
      await grantPermission({
        tenantId,
        granteeId: agentId,
        granteeType: "superadmin",
        permission: "itsm.incident.incident.delete",
        grantedBy: agentId,
      });
    } catch (err) {
      rejectedType = String(err.message).includes("granteeType");
    }
    assert(rejectedType === true, "grantPermission rejects an invalid grantee type");

    // ── Grant creation + effective layering (no expiry) ─────────────────
    const g1 = await grantPermission({
      tenantId,
      granteeId: agentId,
      granteeType: "agent",
      permission: "itsm.incident.incident.delete",
      grantedBy: agentId,
    });
    const grantId = String(g1._id || g1.id);
    assert(grantId && grantId.length > 10, "grant row persisted with uuid id");

    const base = resolveEffectivePermissions(A.agent);
    assert(!base.sources["itsm.incident.incident.delete"], "permission absent before grant");
    const layered = await layeredEffectivePermissions(A.agent, tenantId, base, {
      granteeType: "agent",
    });
    assert(layered.sources["itsm.incident.incident.delete"] === "temporary", "grant surfaces as source 'temporary'");
    assert(layered.grants.includes("itsm.incident.incident.delete"), "grant appended to grants");
    assert(layered.effective.includes("itsm.incident.incident.delete"), "grant appended to effective");
    assert(
      Array.isArray(layered.temporaryGrants) && layered.temporaryGrants.length === 1,
      "temporaryGrants metadata emitted",
    );
    assert(layered.temporaryGrants[0].grantId === grantId, "grantId matches row id");
    assert(layered.temporaryGrants[0].permission === "itsm.incident.incident.delete", "permission echoed");
    assert(layered.temporaryGrants[0].expiresAt === null, "no-expiry grant reports null expiresAt");

    // ── Expiry semantics ────────────────────────────────────────────────
    await grantPermission({
      tenantId,
      granteeId: agentId,
      granteeType: "agent",
      permission: "itsm.incident.incident.read",
      expiresAt: new Date(Date.now() - 60_000),
      grantedBy: agentId,
    });
    await grantPermission({
      tenantId,
      granteeId: agentId,
      granteeType: "agent",
      permission: "itsm.incident.incident.export",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      grantedBy: agentId,
    });
    const active = await activeGrantsFor({ tenantId, granteeId: agentId, granteeType: "agent" });
    assert(!active.some((g) => g.permission === "itsm.incident.incident.read"), "expired grant filtered out");
    assert(active.some((g) => g.permission === "itsm.incident.incident.export"), "future-expiry grant active");
    assert(active.some((g) => g.permission === "itsm.incident.incident.delete"), "no-expiry grant active");

    const layered2 = await layeredEffectivePermissions(A.agent, tenantId, resolveEffectivePermissions(A.agent), {
      granteeType: "agent",
    });
    assert(layered2.sources["itsm.incident.incident.read"] === undefined, "expired grant never layered");
    assert(layered2.sources["itsm.incident.incident.export"] === "temporary", "future-expiry grant layered");
    const exp = layered2.temporaryGrants.find((t) => t.permission === "itsm.incident.incident.export");
    assert(exp && exp.expiresAt, "future-expiry grant reports expiresAt");

    // ── Grantee isolation (same tenant, different principal) ────────────
    const peerLayered = await layeredEffectivePermissions(A.peer, tenantId, resolveEffectivePermissions(A.peer), {
      granteeType: "agent",
    });
    assert(peerLayered.sources["itsm.incident.incident.delete"] === undefined, "peer sees no temporary grants");
    assert(!peerLayered.temporaryGrants.length, "peer has empty temporaryGrants list");

    // ── Revocation ──────────────────────────────────────────────────────
    const revokedRow = await db("authorization_grants").where("id", grantId).first();
    assert(revokedRow && revokedRow.revoked_at === null, "grant row persisted as not revoked");

    const revoked = await revokeGrant({ id: grantId, tenantId, revokedBy: peerId });
    assert(revoked && revoked._id, "revokeGrant returns the updated row");
    const afterRevoke = await db("authorization_grants").where("id", grantId).first();
    assert(afterRevoke.revoked_at !== null, "revoked_at persisted (soft delete)");
    assert(afterRevoke.revoked_by === peerId, "revoked_by persisted");

    const layered3 = await layeredEffectivePermissions(A.agent, tenantId, resolveEffectivePermissions(A.agent), {
      granteeType: "agent",
    });
    assert(layered3.sources["itsm.incident.incident.delete"] === undefined, "revoked grant no longer layered");
    assert(
      !layered3.temporaryGrants.some((t) => t.permission === "itsm.incident.incident.delete"),
      "revoked grant gone from temporaryGrants metadata",
    );

    // ── Cross-tenant revocation cannot touch another tenant's grant ─────
    const B = await seedTenant("B");
    const g2 = await grantPermission({
      tenantId: tenantId,
      granteeId: agentId,
      granteeType: "agent",
      permission: "itsm.incident.incident.merge",
      grantedBy: agentId,
    });
    const crossRevoke = await revokeGrant({
      id: String(g2._id || g2.id),
      tenantId: String(B.company.id),
      revokedBy: String(B.agent.id || B.agent._id),
    });
    assert(crossRevoke === null, "cross-tenant revoke returns null (no enumeration)");
    const stillThere = await db("authorization_grants").where("id", String(g2._id || g2.id)).first();
    assert(stillThere.revoked_at === null, "cross-tenant revoke left the grant untouched");

    console.log("\n🎉 EFFECTIVE-ACCESS TEMPORARY GRANTS E2E VERIFIED (LIVE POSTGRES)\n");
  } finally {
    try {
      if (createdCompanyIds.length) {
        await db("authorization_grants").whereIn("tenant_id", createdCompanyIds).del();
        await db("audit_events").whereIn("tenant_id", createdCompanyIds).del();
        await db("agents").whereIn("company_id", createdCompanyIds).del();
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