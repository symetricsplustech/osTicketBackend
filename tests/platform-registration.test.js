const assert = require("node:assert/strict");
const connectDB = require("../src/config/db");
const { getDB } = require("../src/config/db");

const database = `osticket_platform_registration_test_${process.pid}`;
process.env.NODE_ENV = "test";
process.env.EMAIL_HOST = "";
process.env.EMAIL_USER = "";

async function run() {
  await connectDB();
  const app = require("../src/app");
  const server = app.listen(0);
  const address = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
  const email = `registration-${process.pid}@example.invalid`;
  const post = (route, body) => fetch(`${address}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  try {
    const denied = await post("/register", { name: "Registration Test", email, password: "StrongPassword@123" });
    assert.equal(denied.status, 422);

    const created = await post("/register", {
      name: "Registration Test", email, password: "StrongPassword@123", policyConsent: true,
      company: require("crypto").randomUUID(),
      instanceId: require("crypto").randomUUID(),
    });
    assert.equal(created.status, 201);
    const registration = await created.json();
    assert.equal(registration.token, undefined);
    assert.match(registration.confirmationUrl, /\/confirm-email\?token=/);
    assert.equal(new URL(registration.confirmationUrl).searchParams.has("next"), false);
    const registeredUser = await require("../src/models/User").findOne({ email });
    assert.equal(registeredUser.company_id, null);

    const before = await post("/portal-login", { email, password: "StrongPassword@123" });
    assert.equal(before.status, 401);

    const token = new URL(registration.confirmationUrl).searchParams.get("token");
    const confirmed = await fetch(`${address}/confirm?token=${encodeURIComponent(token)}`);
    assert.equal(confirmed.status, 200);

    const after = await post("/portal-login", { email, password: "StrongPassword@123" });
    assert.equal(after.status, 200);
    const ownerLogin = await after.json();
    assert.equal(ownerLogin.role, "customer");
    const freshUser = await require("../src/models/User").findOne({ email });
    const perms = JSON.parse(JSON.stringify(freshUser.permissions || []));
    if (!perms.includes("itsm.incident.incident.read")) {
      perms.push("itsm.incident.incident.read");
    }
    await require("../src/models/User").updateOne(
      { email }, { $set: { permissions: perms } },
    );

    const instanceRequest = (route, tokenValue, body) => fetch(`${address.replace(/\/auth$/, "/instances")}${route}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenValue}` },
      body: JSON.stringify(body),
    });
    const createdInstance = await instanceRequest("/", ownerLogin.token, {
      name: `Registration Test ${process.pid}`,
      domain: `registration-${process.pid}.example.invalid`,
    });
    const instanceBody = await createdInstance.json();
    assert.equal(createdInstance.status, 201, JSON.stringify(instanceBody));
    const { instance } = instanceBody;
    assert.equal(instance.role, "instance_owner");
    assert.ok(instance.primaryCompany);
    const ownerSelection = await instanceRequest(`/${instance._id}/select`, ownerLogin.token, {});
    assert.equal(ownerSelection.status, 200);
    const ownerSelected = await ownerSelection.json();
    assert.equal(ownerSelected.instance._id, instance._id);
    assert.equal(ownerSelected.permissions.includes("itsm.incident.incident.read"), false);
    assert.equal(ownerSelected.permissions.includes("itsm.knowledge.knowledge_article.read"), true);
    const companiesUrl = `${address.replace(/\/auth$/, "/instances")}/${instance._id}/companies`;
    const companyHeaders = { "content-type": "application/json", authorization: `Bearer ${ownerSelected.token}` };
    const primaryCompanies = await fetch(companiesUrl, { headers: companyHeaders });
    const primaryItems = (await primaryCompanies.json()).items;
    assert.equal(primaryCompanies.status, 200);
    assert.equal(primaryItems.length, 1);
    assert.equal(primaryItems[0].isPrimary, true);
    const extraCompany = await fetch(companiesUrl, {
      method: "POST", headers: companyHeaders,
      body: JSON.stringify({ name: "Regional Company", email: "regional@example.invalid" }),
    });
    const extraBody = await extraCompany.json();
    assert.equal(extraCompany.status, 201, JSON.stringify(extraBody));
    const duplicateCompany = await fetch(companiesUrl, {
      method: "POST", headers: companyHeaders,
      body: JSON.stringify({ name: " regional   company " }),
    });
    assert.equal(duplicateCompany.status, 409);
    const disablePrimary = await fetch(`${companiesUrl}/${primaryItems[0]._id}`, {
      method: "PUT", headers: companyHeaders,
      body: JSON.stringify({ status: "inactive" }),
    });
    assert.equal(disablePrimary.status, 409);
    const updatedCompany = await fetch(`${companiesUrl}/${extraBody.item._id}`, {
      method: "PUT", headers: companyHeaders,
      body: JSON.stringify({ phone: "+1 555 0100", status: "inactive" }),
    });
    assert.equal(updatedCompany.status, 200);
    const deniedIncident = await fetch(`${address.replace(/\/auth$/, "/core/incidents")}`, {
      headers: { authorization: `Bearer ${ownerSelected.token}` },
    });
    assert.equal(deniedIncident.status, 403);
    const dashboard = await fetch(`${address.replace(/\/auth$/, "/tickets")}/dashboard`, {
      headers: { authorization: `Bearer ${ownerSelected.token}` },
    });
    assert.equal(dashboard.status, 200, JSON.stringify(await dashboard.json()));
    const hierarchyBase = `${address.replace(/\/auth$/, "/instances")}/${instance._id}`;
    const hierarchyHeaders = { "content-type": "application/json", authorization: `Bearer ${ownerSelected.token}` };
    const addedType = await fetch(`${hierarchyBase}/organization-unit-types`, {
      method: "POST", headers: hierarchyHeaders,
      body: JSON.stringify({ type: "business_unit", label: "Business Unit" }),
    });
    assert.equal(addedType.status, 201, JSON.stringify(await addedType.json()));
    const addedUnit = await fetch(`${hierarchyBase}/organization-units`, {
      method: "POST", headers: hierarchyHeaders,
      body: JSON.stringify({ name: "Operations", type: "business_unit" }),
    });
    const primaryUnitBody = await addedUnit.json();
    assert.equal(addedUnit.status, 201, JSON.stringify(primaryUnitBody));
    const primaryUnit = primaryUnitBody.item;
    assert.equal(primaryUnit.instanceCompany, primaryItems[0]._id);
    await fetch(`${companiesUrl}/${extraBody.item._id}`, {
      method: "PUT", headers: companyHeaders, body: JSON.stringify({ status: "active" }),
    });
    const secondUnit = await fetch(`${hierarchyBase}/organization-units`, {
      method: "POST", headers: hierarchyHeaders,
      body: JSON.stringify({ name: "Regional", type: "business_unit", instanceCompany: extraBody.item._id }),
    });
    const secondUnitBody = await secondUnit.json();
    assert.equal(secondUnit.status, 201, JSON.stringify(secondUnitBody));
    assert.equal(secondUnitBody.item.instanceCompany, extraBody.item._id);
    const crossCompanyParent = await fetch(`${hierarchyBase}/organization-units`, {
      method: "POST", headers: hierarchyHeaders,
      body: JSON.stringify({ name: "Invalid", type: "business_unit", instanceCompany: extraBody.item._id, parent: primaryUnit._id }),
    });
    assert.equal(crossCompanyParent.status, 422);
    const movedUnit = await fetch(`${hierarchyBase}/organization-units/${secondUnitBody.item._id}`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ instanceCompany: primaryItems[0]._id, parent: primaryUnit._id }),
    });
    assert.equal(movedUnit.status, 200, JSON.stringify(await movedUnit.json()));
    const moveParentWithChild = await fetch(`${hierarchyBase}/organization-units/${primaryUnit._id}`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ instanceCompany: extraBody.item._id }),
    });
    assert.equal(moveParentWithChild.status, 409);
    const listedUnits = await fetch(`${hierarchyBase}/organization-units`, { headers: hierarchyHeaders });
    assert.equal((await listedUnits.json()).items.length, 2);
    const departmentType = await fetch(`${hierarchyBase}/organization-unit-types`, {
      method: "POST", headers: hierarchyHeaders,
      body: JSON.stringify({ type: "department", label: "Department" }),
    });
    assert.equal(departmentType.status, 201);
    const departmentUnitResponse = await fetch(`${hierarchyBase}/organization-units`, {
      method: "POST", headers: hierarchyHeaders,
      body: JSON.stringify({ name: "Support", type: "department", parent: primaryUnit._id }),
    });
    const departmentUnit = (await departmentUnitResponse.json()).item;
    assert.equal(departmentUnitResponse.status, 201);
    const departmentsUrl = `${hierarchyBase}/departments`;
    const departmentList = await fetch(departmentsUrl, { headers: hierarchyHeaders });
    const supportDepartment = (await departmentList.json()).items.find((item) => item.name === "Support");
    assert.ok(supportDepartment);
    const linkedDepartment = await fetch(`${departmentsUrl}/${supportDepartment._id}/organization-unit`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ organizationUnit: departmentUnit._id }),
    });
    assert.equal(linkedDepartment.status, 200);
    const linkWrongType = await fetch(`${departmentsUrl}/${supportDepartment._id}/organization-unit`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ organizationUnit: primaryUnit._id }),
    });
    assert.equal(linkWrongType.status, 422);
    const changeLinkedType = await fetch(`${hierarchyBase}/organization-units/${departmentUnit._id}`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ type: "business_unit" }),
    });
    assert.equal(changeLinkedType.status, 409);
    const duplicateDepartment = (await (await fetch(departmentsUrl, { headers: hierarchyHeaders })).json())
      .items.find((item) => item.name === "Billing");
    const duplicateLink = await fetch(`${departmentsUrl}/${duplicateDepartment._id}/organization-unit`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ organizationUnit: departmentUnit._id }),
    });
    assert.equal(duplicateLink.status, 409);
    const deleteLinkedUnit = await fetch(`${hierarchyBase}/organization-units/${departmentUnit._id}`, {
      method: "DELETE", headers: hierarchyHeaders,
    });
    assert.equal(deleteLinkedUnit.status, 409);
    const unlinkedDepartment = await fetch(`${departmentsUrl}/${supportDepartment._id}/organization-unit`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ organizationUnit: null }),
    });
    assert.equal(unlinkedDepartment.status, 200);
    assert.equal((await unlinkedDepartment.json()).item.organizationUnit, null);
    const deletedUnlinkedUnit = await fetch(`${hierarchyBase}/organization-units/${departmentUnit._id}`, {
      method: "DELETE", headers: hierarchyHeaders,
    });
    assert.equal(deletedUnlinkedUnit.status, 200);
    const teamType = await fetch(`${hierarchyBase}/organization-unit-types`, {
      method: "POST", headers: hierarchyHeaders,
      body: JSON.stringify({ type: "team", label: "Team" }),
    });
    assert.equal(teamType.status, 201);
    const teamUnitResponse = await fetch(`${hierarchyBase}/organization-units`, {
      method: "POST", headers: hierarchyHeaders,
      body: JSON.stringify({ name: "Support Team Node", type: "team", parent: primaryUnit._id }),
    });
    const teamUnit = (await teamUnitResponse.json()).item;
    assert.equal(teamUnitResponse.status, 201);
    const teamsUrl = `${hierarchyBase}/teams`;
    const teamList = await fetch(teamsUrl, { headers: hierarchyHeaders });
    const teamItems = (await teamList.json()).items;
    const supportTeam = teamItems.find((item) => item.name === "Support Team");
    const technicalTeam = teamItems.find((item) => item.name === "Technical Team");
    assert.ok(supportTeam && technicalTeam);
    const linkedTeam = await fetch(`${teamsUrl}/${supportTeam._id}/organization-unit`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ organizationUnit: teamUnit._id }),
    });
    assert.equal(linkedTeam.status, 200);
    const duplicateTeamLink = await fetch(`${teamsUrl}/${technicalTeam._id}/organization-unit`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ organizationUnit: teamUnit._id }),
    });
    assert.equal(duplicateTeamLink.status, 409);
    const wrongTeamType = await fetch(`${teamsUrl}/${technicalTeam._id}/organization-unit`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ organizationUnit: primaryUnit._id }),
    });
    assert.equal(wrongTeamType.status, 422);
    const deleteLinkedTeamUnit = await fetch(`${hierarchyBase}/organization-units/${teamUnit._id}`, {
      method: "DELETE", headers: hierarchyHeaders,
    });
    assert.equal(deleteLinkedTeamUnit.status, 409);
    const changeLinkedTeamUnit = await fetch(`${hierarchyBase}/organization-units/${teamUnit._id}`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ type: "department" }),
    });
    assert.equal(changeLinkedTeamUnit.status, 409);
    const secondInstance = await instanceRequest("/", ownerSelected.token, {
      name: `Second Test ${process.pid}`,
      domain: `second-${process.pid}.example.invalid`,
    });
    assert.equal(secondInstance.status, 201, JSON.stringify(await secondInstance.json()));

    const Company = require("../src/models/Company");
    const OrganizationUnit = require("../src/models/OrganizationUnit");
    const OrganizationUnitLabel = require("../src/models/OrganizationUnitLabel");
    const { migrateDivisionToBusinessUnit } = require("../src/services/organizationTypeMigration.service");
    const User = require("../src/models/User");
    const legacy = await Company.create({
      name: `Legacy Test ${process.pid}`, domain: `legacy-${process.pid}.example.invalid`,
      status: "active", is_instance: true, instance_owner: registeredUser.id,
    });
    const userForMembership = await User.findOne({ _id: registeredUser.id });
    const memberships = JSON.parse(JSON.stringify(userForMembership.instance_memberships || []));
    memberships.push({
      instance: legacy.id, role: "instance_owner", status: "active",
    });
    await User.updateOne({ _id: registeredUser.id }, { $set: { instance_memberships: memberships } });
    const legacyUnit = await OrganizationUnit.create({
      company_id: legacy.id, name: "Legacy Operations", type: "division",
    });
    await OrganizationUnitLabel.create({ company_id: legacy.id, type: "division", label: "Division" });
    const migratedCompanies = await fetch(
      `${address.replace(/\/auth$/, "/instances")}/${legacy._id}/companies`,
      { headers: { authorization: `Bearer ${ownerLogin.token}` } },
    );
    assert.equal(migratedCompanies.status, 200);
    const legacyPrimary = (await migratedCompanies.json()).items[0];
    const legacySelection = await instanceRequest(`/${legacy._id}/select`, ownerLogin.token, {});
    assert.equal(legacySelection.status, 200);
    const legacyToken = (await legacySelection.json()).token;
    const migratedUnits = await fetch(
      `${address.replace(/\/auth$/, "/instances")}/${legacy._id}/organization-units`,
      { headers: { authorization: `Bearer ${legacyToken}` } },
    );
    assert.equal(migratedUnits.status, 200);
    assert.equal((await migratedUnits.json()).items[0].instanceCompany._id, legacyPrimary._id);
    assert.equal(
      String((await OrganizationUnit.findById(legacyUnit.id)).instance_company),
      legacyPrimary.id,
    );
    const previewMigration = await migrateDivisionToBusinessUnit(legacy.id);
    assert.equal(previewMigration.units, 1);
    assert.equal(previewMigration.applied, false);
    assert.equal((await OrganizationUnit.findById(legacyUnit.id)).type, "division");
    const completedMigration = await migrateDivisionToBusinessUnit(legacy.id, { apply: true });
    assert.equal(completedMigration.applied, true);
    assert.equal((await OrganizationUnit.findById(legacyUnit.id)).type, "business_unit");
    assert.equal(await OrganizationUnitLabel.exists({ company_id: legacy.id, type: "division" }), null);
    assert.ok(await OrganizationUnitLabel.exists({ company_id: legacy.id, type: "business_unit" }));
    assert.equal((await migrateDivisionToBusinessUnit(legacy.id, { apply: true })).units, 0);

    const inviteeEmail = `invitee-${process.pid}@example.invalid`;
    const inviteeRegistration = await post("/register", {
      name: "Invitee", email: inviteeEmail, password: "StrongPassword@123", policyConsent: true,
    });
    const inviteeUrl = (await inviteeRegistration.json()).confirmationUrl;
    await fetch(`${address}/confirm?token=${new URL(inviteeUrl).searchParams.get("token")}`);
    const inviteeLogin = await post("/portal-login", { email: inviteeEmail, password: "StrongPassword@123" });
    const inviteeToken = (await inviteeLogin.json()).token;

    const deniedHierarchy = await fetch(`${hierarchyBase}/organization-units`, {
      headers: { authorization: `Bearer ${inviteeToken}` },
    });
    assert.equal(deniedHierarchy.status, 403);
    const deniedDepartments = await fetch(departmentsUrl, {
      headers: { authorization: `Bearer ${inviteeToken}` },
    });
    assert.equal(deniedDepartments.status, 403);
    const deniedTeams = await fetch(teamsUrl, {
      headers: { authorization: `Bearer ${inviteeToken}` },
    });
    assert.equal(deniedTeams.status, 403);
    const deniedCompanies = await fetch(companiesUrl, {
      headers: { authorization: `Bearer ${inviteeToken}` },
    });
    assert.equal(deniedCompanies.status, 403);

    const unselected = await instanceRequest(`/${instance._id}/select`, inviteeToken, {});
    assert.equal(unselected.status, 403);

    const uninvited = await instanceRequest(`/${instance._id}/accept-invitation`, inviteeToken, { token: "0".repeat(64) });
    assert.equal(uninvited.status, 403);
    const deniedPermissionOptions = await fetch(`${hierarchyBase}/permission-options?q=incident.read`, {
      headers: { authorization: `Bearer ${inviteeToken}` },
    });
    assert.equal(deniedPermissionOptions.status, 403);
    const permissionOptions = await fetch(`${hierarchyBase}/permission-options?q=incident.read`, {
      headers: hierarchyHeaders,
    });
    assert.equal(permissionOptions.status, 200);
    assert.ok((await permissionOptions.json()).items.includes("itsm.incident.incident.read"));
    const invalidInvitation = await instanceRequest(`/${instance._id}/invitations`, ownerLogin.token, {
      email: inviteeEmail, role: "agent", permissions: ["saas.admin.manage"],
    });
    assert.equal(invalidInvitation.status, 422);
    const invalidPlacement = await instanceRequest(`/${instance._id}/invitations`, ownerLogin.token, {
      email: inviteeEmail, role: "agent", organizationUnit: require("crypto").randomUUID(),
    });
    assert.equal(invalidPlacement.status, 422);
    const invited = await instanceRequest(`/${instance._id}/invitations`, ownerLogin.token, {
      email: inviteeEmail, role: "agent", organizationUnit: secondUnitBody.item._id,
      permissions: ["itsm.incident.incident.read"],
    });
    const invitationBody = await invited.json();
    assert.equal(invited.status, 201, JSON.stringify(invitationBody));
    const pendingInviteDelete = await fetch(`${hierarchyBase}/organization-units/${secondUnitBody.item._id}`, {
      method: "DELETE", headers: hierarchyHeaders,
    });
    assert.equal(pendingInviteDelete.status, 409);
    assert.match((await pendingInviteDelete.json()).message, /invitation/i);
    const invitationUrl = invitationBody.invitationUrl;
    const accepted = await instanceRequest(`/${instance._id}/accept-invitation`, inviteeToken, {
      token: new URL(invitationUrl).searchParams.get("token"),
    });
    const acceptedBody = await accepted.json();
    assert.equal(accepted.status, 200, JSON.stringify(acceptedBody));
    const selected = await instanceRequest(`/${instance._id}/select`, inviteeToken, {});
    assert.equal(selected.status, 200);
    const selectedToken = (await selected.json()).token;
    const inviteeMembership = (await require("../src/models/User").findOne({ email: inviteeEmail }))
      .instance_memberships.find((item) => String(item.instance) === instance.id);
    assert.equal(String(inviteeMembership.organizationUnit), secondUnitBody.item.id);
    assert.ok(inviteeMembership.permissions.includes("itsm.incident.incident.read"));
    const memberUrl = `${hierarchyBase}/members`;
    const inviteeUser = await require("../src/models/User").findOne({ email: inviteeEmail });
    const deniedMemberList = await fetch(memberUrl, { headers: { authorization: `Bearer ${selectedToken}` } });
    assert.equal(deniedMemberList.status, 403);
    const membersBefore = await fetch(memberUrl, { headers: hierarchyHeaders });
    assert.equal(membersBefore.status, 200);
    assert.equal((await membersBefore.json()).items.length, 2);
    const crossInstancePlacement = await fetch(`${memberUrl}/${inviteeUser._id}/organization-unit`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ organizationUnit: require("crypto").randomUUID() }),
    });
    assert.equal(crossInstancePlacement.status, 422);
    const placed = await fetch(`${memberUrl}/${inviteeUser._id}/organization-unit`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ organizationUnit: secondUnitBody.item._id }),
    });
    assert.equal(placed.status, 200, JSON.stringify(await placed.json()));
    const placedUser = await require("../src/models/User").findById(inviteeUser.id);
    assert.equal(String(placedUser.instance_memberships.find((item) => String(item.instance) === instance.id).organizationUnit), secondUnitBody.item.id);
    const blockedDelete = await fetch(`${hierarchyBase}/organization-units/${secondUnitBody.item._id}`, {
      method: "DELETE", headers: hierarchyHeaders,
    });
    assert.equal(blockedDelete.status, 409);
    assert.match((await blockedDelete.json()).message, /members/i);
    const cleared = await fetch(`${memberUrl}/${inviteeUser._id}/organization-unit`, {
      method: "PUT", headers: hierarchyHeaders,
      body: JSON.stringify({ organizationUnit: null }),
    });
    assert.equal(cleared.status, 200);
    const membershipCheck = await fetch(`${address.replace(/\/auth$/, "/instances")}/my-instances`, {
      headers: { authorization: `Bearer ${selectedToken}` },
    });
    assert.equal(membershipCheck.status, 200);
    assert.equal((await membershipCheck.json()).instances.length, 1);

    const newEmail = `new-invitee-${process.pid}@example.invalid`;
    const newInvitation = await instanceRequest(`/${instance._id}/invitations`, ownerLogin.token, {
      email: newEmail, role: "requester",
    });
    assert.equal(newInvitation.status, 201);
    const newInvitationUrl = (await newInvitation.json()).invitationUrl;
    const returnTo = new URL(newInvitationUrl).pathname + new URL(newInvitationUrl).search;
    const newRegistration = await post("/register", {
      name: "New Invitee", email: newEmail, password: "StrongPassword@123",
      policyConsent: true, returnTo,
    });
    assert.equal(newRegistration.status, 201);
    const newConfirmationUrl = (await newRegistration.json()).confirmationUrl;
    assert.equal(new URL(newConfirmationUrl).searchParams.get("next"), returnTo);
    await fetch(`${address}/confirm?token=${new URL(newConfirmationUrl).searchParams.get("token")}`);
    const newLogin = await post("/portal-login", { email: newEmail, password: "StrongPassword@123" });
    const newToken = (await newLogin.json()).token;
    const newAcceptance = await instanceRequest(`/${instance._id}/accept-invitation`, newToken, {
      token: new URL(newInvitationUrl).searchParams.get("token"),
    });
    assert.equal(newAcceptance.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    const db = getDB();
    const tables = await db.raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public'").then(r => r.rows.map(t => t.tablename));
    for (const t of tables.filter((name) => !["knex_migrations", "knex_migrations_lock"].includes(name))) {
      await db.raw("TRUNCATE TABLE ?? CASCADE", [t]);
    }
    await getDB().destroy();
  }
  console.log("Platform registration flow passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
