const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const database = `osticket_platform_registration_test_${process.pid}`;
const uri = `mongodb://127.0.0.1:27017/${database}`;
process.env.MONGODB_URI = uri;
process.env.NODE_ENV = "test";
process.env.EMAIL_HOST = "";
process.env.EMAIL_USER = "";

async function run() {
  await mongoose.connect(uri);
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
    });
    assert.equal(created.status, 201);
    const registration = await created.json();
    assert.equal(registration.token, undefined);
    assert.match(registration.confirmationUrl, /\/confirm-email\?token=/);

    const before = await post("/portal-login", { email, password: "StrongPassword@123" });
    assert.equal(before.status, 401);

    const token = new URL(registration.confirmationUrl).searchParams.get("token");
    const confirmed = await fetch(`${address}/confirm?token=${encodeURIComponent(token)}`);
    assert.equal(confirmed.status, 200);

    const after = await post("/portal-login", { email, password: "StrongPassword@123" });
    assert.equal(after.status, 200);
    const ownerLogin = await after.json();
    assert.equal(ownerLogin.role, "customer");

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
    const ownerSelection = await instanceRequest(`/${instance._id}/select`, ownerLogin.token, {});
    assert.equal(ownerSelection.status, 200);
    const ownerSelected = await ownerSelection.json();
    assert.equal(ownerSelected.instance._id, instance._id);
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
    assert.equal(addedUnit.status, 201, JSON.stringify(await addedUnit.json()));
    const listedUnits = await fetch(`${hierarchyBase}/organization-units`, { headers: hierarchyHeaders });
    assert.equal((await listedUnits.json()).items.length, 1);
    const secondInstance = await instanceRequest("/", ownerSelected.token, {
      name: `Second Test ${process.pid}`,
      domain: `second-${process.pid}.example.invalid`,
    });
    assert.equal(secondInstance.status, 201, JSON.stringify(await secondInstance.json()));

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

    const unselected = await instanceRequest(`/${instance._id}/select`, inviteeToken, {});
    assert.equal(unselected.status, 403);

    const uninvited = await instanceRequest(`/${instance._id}/accept-invitation`, inviteeToken, { token: "0".repeat(64) });
    assert.equal(uninvited.status, 403);
    const invited = await instanceRequest(`/${instance._id}/invitations`, ownerLogin.token, {
      email: inviteeEmail, role: "agent",
    });
    const invitationBody = await invited.json();
    assert.equal(invited.status, 201, JSON.stringify(invitationBody));
    const invitationUrl = invitationBody.invitationUrl;
    const accepted = await instanceRequest(`/${instance._id}/accept-invitation`, inviteeToken, {
      token: new URL(invitationUrl).searchParams.get("token"),
    });
    const acceptedBody = await accepted.json();
    assert.equal(accepted.status, 200, JSON.stringify(acceptedBody));
    const selected = await instanceRequest(`/${instance._id}/select`, inviteeToken, {});
    assert.equal(selected.status, 200);
    const selectedToken = (await selected.json()).token;
    const memberships = await fetch(`${address.replace(/\/auth$/, "/instances")}/my-instances`, {
      headers: { authorization: `Bearer ${selectedToken}` },
    });
    assert.equal(memberships.status, 200);
    assert.equal((await memberships.json()).instances.length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  console.log("Platform registration flow passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
