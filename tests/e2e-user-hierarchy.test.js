/* eslint-disable no-console */
// Real end-to-end test of the user-hierarchy module against the configured
// PostgreSQL runtime (no mocks). Proves the schema + services work:
//   - reporting_lines: set/read, direct reports, chain, cycle rejection
//   - engineer_profiles: upsert/get
//   - delegations: create/active/expiry/revoke + mergeDelegations
//   - effective access: membership baseline + role + temporary grant + delegation
//   - directory: groups vs assignment groups, placement, manager/team lead
// All seed rows are removed afterward so the run is idempotent.
// Run: node tests/e2e-user-hierarchy.test.js
const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  console.log(`PASS ${message}`);
};

(async () => {
  console.log("\n=== USER HIERARCHY E2E (REAL POSTGRES) ===\n");

  const connectDB = require("../src/config/db");
  const { getDB } = require("../src/config/db");
  await connectDB();
  const db = getDB();

  const Company = require("../src/models/Company");
  const User = require("../src/models/User");
  const hierarchy = require("../src/services/hierarchy.service");
  const delegation = require("../src/services/delegation.service");
  const { resolveUserEffectiveAccess } = require("../src/services/effectiveAccess.service");
  const { buildDirectory } = require("../src/services/directory.service");
  const { grantPermission } = require("../src/services/authorizationGrants.service");
  const { resolveEffectivePermissions } = require("../src/services/authorization.service");

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const createdCompanyIds = [];

  try {
    const company = await Company.create({
      name: `E2E hierarchy ${suffix}`,
      domain: `hierarchy-${suffix}.example.com`,
      status: "active",
      is_instance: true,
    });
    const tenantId = String(company.id);
    createdCompanyIds.push(tenantId);

    const mkUser = async (tag, role, permissions = []) =>
      User.create({
        name: `E2E ${tag} ${suffix}`,
        email: `hierarchy-${tag}-${suffix}@example.com`,
        password: "e2e-temp-password-123",
        company_id: tenantId,
        instance_memberships: [
          { instance: tenantId, role, status: "active", permissions },
        ],
      });

    const owner = await mkUser("owner", "instance_owner");
    const manager = await mkUser("manager", "agent");
    const teamLead = await mkUser("teamlead", "agent");
    const report = await mkUser("report", "agent");
    const delegate = await mkUser("delegate", "agent");
    const ownerId = String(owner.id || owner._id);
    const managerId = String(manager.id || manager._id);
    const teamLeadId = String(teamLead.id || teamLead._id);
    const reportId = String(report.id || report._id);
    const delegateId = String(delegate.id || delegate._id);

    // ── Reporting line ─────────────────────────────────────────────────
    const line = await hierarchy.setReportingLine({
      tenantId,
      memberUserId: reportId,
      managerUserId: managerId,
      teamLeadUserId: teamLeadId,
      actorId: ownerId,
    });
    assert(line && line.id, "reporting line persisted");
    assert(line.managerUserId === managerId, "manager recorded");
    assert(line.teamLeadUserId === teamLeadId, "team lead recorded");

    const active = await hierarchy.activeReportingLine(tenantId, reportId);
    assert(active && active.managerUserId === managerId, "active reporting line read back");

    const reports = await hierarchy.getDirectReports(tenantId, managerId);
    assert(reports.some((r) => r.memberUserId === reportId), "direct report listed for manager");
    const tlReports = await hierarchy.getDirectReports(tenantId, teamLeadId);
    assert(tlReports.some((r) => r.memberUserId === reportId), "direct report listed for team lead");

    const chain = await hierarchy.getReportingChain(tenantId, reportId);
    assert(chain.length >= 1 && chain[0].userId === managerId, "reporting chain starts at manager");

    let cycleRejected = false;
    try {
      await hierarchy.setReportingLine({
        tenantId,
        memberUserId: managerId,
        managerUserId: reportId,
        actorId: ownerId,
      });
    } catch (err) {
      cycleRejected = String(err.message).toLowerCase().includes("cycle");
    }
    assert(cycleRejected, "reporting cycle rejected");

    let selfRejected = false;
    try {
      await hierarchy.setReportingLine({ tenantId, memberUserId: reportId, managerUserId: reportId });
    } catch (err) {
      selfRejected = String(err.message).toLowerCase().includes("themselves");
    }
    assert(selfRejected, "self-report rejected");

    // replacing deactivates the previous active row
    await hierarchy.setReportingLine({
      tenantId,
      memberUserId: reportId,
      managerUserId: teamLeadId,
      actorId: ownerId,
    });
    const replaced = await hierarchy.activeReportingLine(tenantId, reportId);
    assert(replaced.managerUserId === teamLeadId, "reporting line replaced");
    const history = await db("reporting_lines").where({ tenant_id: tenantId, member_user_id: reportId });
    assert(history.length === 2 && history.filter((r) => r.is_active).length === 1, "old reporting line kept as inactive history");

    // ── Engineer profile ───────────────────────────────────────────────
    const profile = await hierarchy.upsertEngineerProfile({
      tenantId,
      userId: reportId,
      availability: { status: "available" },
      skills: ["networking", "linux"],
      territories: ["APAC"],
      schedule: { shift: "day" },
      actorId: ownerId,
    });
    assert(profile && Array.isArray(profile.skills) && profile.skills.length === 2, "engineer profile created");
    const profile2 = await hierarchy.upsertEngineerProfile({
      tenantId,
      userId: reportId,
      skills: ["networking"],
      actorId: ownerId,
    });
    assert(profile2.skills.length === 1, "engineer profile updated in place");
    const fetchedProfile = await hierarchy.getEngineerProfile(tenantId, reportId);
    assert(fetchedProfile.skills.length === 1, "engineer profile read back");

    // ── Delegation ─────────────────────────────────────────────────────
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const delegation1 = await delegation.createDelegation({
      tenantId,
      delegatorUserId: managerId,
      delegateUserId: delegateId,
      permissions: ["itsm.incident.incident.read"],
      reason: "vacation cover",
      expiresAt: future,
      actorId: managerId,
    });
    assert(delegation1 && delegation1.status === "active", "delegation created active");
    const activeDelegations = await delegation.activeDelegationsFor({ tenantId, delegateUserId: delegateId });
    assert(activeDelegations.length === 1, "active delegation listed for delegate");

    const expired = await delegation.createDelegation({
      tenantId,
      delegatorUserId: managerId,
      delegateUserId: delegateId,
      permissions: ["itsm.incident.incident.delete"],
      startsAt: new Date(Date.now() - 120_000),
      expiresAt: new Date(Date.now() - 60_000),
      actorId: managerId,
    });
    assert(expired.status === "expired", "past delegation reports expired");
    const activeAfterExpiry = await delegation.activeDelegationsFor({ tenantId, delegateUserId: delegateId });
    assert(activeAfterExpiry.length === 1, "expired delegation excluded from active");

    const merged = delegation.mergeDelegations(resolveEffectivePermissions({ _id: delegateId, permissions: [] }), activeDelegations);
    assert(merged.sources["itsm.incident.incident.read"] === "delegated", "delegation layered as source 'delegated'");

    const revoked = await delegation.revokeDelegation({ id: delegation1.id, tenantId, revokedBy: managerId });
    assert(revoked && revoked.status === "revoked", "delegation revoked");
    const activeAfterRevoke = await delegation.activeDelegationsFor({ tenantId, delegateUserId: delegateId });
    assert(activeAfterRevoke.length === 0, "revoked delegation excluded from active");

    // ── Effective access (membership + role + temporary grant + delegation) ──
    const role = await db("roles")
      .insert({ company_id: tenantId, name: `E2E Role ${suffix}`, scope: "tenant", permissions: JSON.stringify(["itsm.incident.incident.update"]) })
      .returning("*");
    const roleId = String(role[0].id);
    await db("user_roles").insert({ tenant_id: tenantId, user_id: delegateId, role_id: roleId });
    await grantPermission({
      tenantId,
      granteeId: delegateId,
      granteeType: "user",
      permission: "itsm.incident.incident.export",
      grantedBy: ownerId,
    });
    await delegation.createDelegation({
      tenantId,
      delegatorUserId: managerId,
      delegateUserId: delegateId,
      permissions: ["itsm.incident.incident.read"],
      expiresAt: future,
      actorId: managerId,
    });

    const effective = await resolveUserEffectiveAccess({ tenantId, targetUserId: delegateId });
    assert(effective.roles.some((r) => r.id === roleId), "role surfaced in effective access");
    assert(effective.sources["itsm.incident.incident.update"] === "role", "role permission resolved");
    assert(effective.sources["itsm.incident.incident.export"] === "temporary", "temporary grant resolved");
    assert(effective.sources["itsm.incident.incident.read"] === "delegated", "delegated permission resolved");
    assert(effective.membership.role === "agent", "membership surfaced");

    // ── Directory ──────────────────────────────────────────────────────
    const unit = await db("organization_units")
      .insert({ company_id: tenantId, name: `E2E BU ${suffix}`, type: "business_unit" })
      .returning("*");
    const unitId = String(unit[0].id);
    await db("users").where({ id: delegateId }).update({
      instance_memberships: JSON.stringify([
        { instance: tenantId, role: "agent", status: "active", permissions: [], organizationUnit: unitId },
      ]),
    });
    const group = await db("teams").insert({ company_id: tenantId, name: `E2E Group ${suffix}`, kind: "group" }).returning("*");
    const assignGroup = await db("teams").insert({ company_id: tenantId, name: `E2E Assign ${suffix}`, kind: "assignment_group" }).returning("*");
    await db("group_memberships").insert({ tenant_id: tenantId, user_id: delegateId, group_id: String(group[0].id) });
    await db("group_memberships").insert({ tenant_id: tenantId, user_id: delegateId, group_id: String(assignGroup[0].id) });
    await hierarchy.setReportingLine({ tenantId, memberUserId: delegateId, managerUserId: managerId });

    const directory = await buildDirectory(tenantId, tenantId, { search: `delegate-${suffix}` });
    assert(directory.total === 1, "directory finds the member");
    const row = directory.items[0];
    assert(row.businessUnit === `E2E BU ${suffix}`, "directory resolves business unit placement");
    assert(row.managerUserId === managerId, "directory resolves manager");
    assert(row.groups.some((g) => g.name === `E2E Group ${suffix}`), "directory resolves groups");
    assert(row.assignmentGroups.some((g) => g.name === `E2E Assign ${suffix}`), "directory resolves assignment groups");
    assert(row.roleSummary.some((r) => r.id === roleId), "directory resolves role summary");

    const single = await buildDirectory(tenantId, tenantId, { userId: delegateId });
    assert(single.total === 1 && single.items[0]._id === delegateId, "directory filters by userId");

    console.log("\n🎉 USER HIERARCHY E2E VERIFIED (LIVE POSTGRES)\n");
  } finally {
    try {
      if (createdCompanyIds.length) {
        await db("group_memberships").whereIn("tenant_id", createdCompanyIds).del();
        await db("user_roles").whereIn("tenant_id", createdCompanyIds).del();
        await db("authorization_grants").whereIn("tenant_id", createdCompanyIds).del();
        await db("delegations").whereIn("tenant_id", createdCompanyIds).del();
        await db("reporting_lines").whereIn("tenant_id", createdCompanyIds).del();
        await db("engineer_profiles").whereIn("tenant_id", createdCompanyIds).del();
        await db("teams").whereIn("company_id", createdCompanyIds).del();
        await db("organization_units").whereIn("company_id", createdCompanyIds).del();
        await db("roles").whereIn("company_id", createdCompanyIds).del();
        await db("audit_events").whereIn("tenant_id", createdCompanyIds).del();
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
