/**
 * Phase 16 Outage & Service Status — HTTP contract test.
 *
 * outage-engine.test.js covers the service layer directly. This exercises the
 * same surface through the real Express app so the router, the permission gate,
 * the controller adapters and the response envelope are all under test, plus
 * tenant isolation.
 *
 * Run with: DB_MAX_POOL=4 node tests/outage-api.test.js
 */
const connectDB = require("../src/config/db");
const { getDB } = require("../src/config/db");
const app = require("../src/app");
const { model } = require("../src/models/compat");

const Company = model("companies", {
  instanceMethods: {
    isActive() {
      return this.status === "active" || this.status === "trial";
    },
  },
});
const User = model("users");

// Oldest child first so the deletes never trip a foreign key. The outage and
// CMDB tables plus the rows the relationship routes need.
//
// The Phase 16 schema is not uniformly scoped: outages, outage_cis,
// outage_services, availability_records, business_services and
// configuration_items carry tenant_id, while incidents carry company_id.
// OWNER_COLUMN records which is which, so a cleanup never guesses and a missing
// column cannot turn a passing run into a failure.
const CHILD_TABLES = [
  "availability_records",
  "outage_cis",
  "outage_services",
  "outage_relations",
  "outages",
  "incidents",
  "business_services",
  "configuration_items",
];
const OWNER_COLUMN = {
  availability_records: "tenant_id",
  outage_cis: "tenant_id",
  outage_services: "tenant_id",
  outage_relations: "tenant_id",
  outages: "tenant_id",
  incidents: "company_id",
  business_services: "tenant_id",
  configuration_items: "tenant_id",
};
const owned = (table) => ({ [OWNER_COLUMN[table]]: tenantId });

let passed = 0;
const ok = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  passed++;
  console.log(`PASS ${message}`);
};
const section = (name) => console.log(`\n=== ${name} ===`);

// Every key the generated catalog exposes for the outage namespace, so this
// test does not have to be edited every time a Phase 16 key is added.
const OUTAGE_PERMISSIONS = (() => {
  const keys = [];
  const walk = (node) => {
    for (const value of Object.values(node || {})) {
      if (typeof value === "string" && value.startsWith("itsm.outage.")) keys.push(value);
      else if (value && typeof value === "object") walk(value);
    }
  };
  walk(require("../src/permissions/itsmCatalogData").outage);
  return keys;
})();

let adminToken;
let plainToken;
let tenantId;
const stamp = Date.now();

let baseUrl = "";
const call = async (method, path, token, body) => {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_) {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed || {} };
};
// `.send()` mirrors the supertest call sites used elsewhere in tests/; the
// payload is captured here and passed by send().
const api = (method, path, token) => ({
  send: (body) => call(method, `/core/outage${path}`, token, body),
  then: (...a) => call(method, `/core/outage${path}`, token, undefined).then(...a),
});

async function setup() {
  const company = await Company.create({
    name: "Outage API Tenant",
    domain: `outage-api-${stamp}.example.invalid`,
    status: "active",
    is_instance: true,
    instance_code: `outage-api-${stamp}`,
  });
  tenantId = String(company.id ?? company._id);

  // Permissions are resolved from the selected instance membership, and
  // membership grants are filtered to fully-qualified keys (no wildcards), so
  // the outage manager is granted every generated itsm.outage.* key.
  const admin = await User.create({
    name: "Outage API Admin",
    email: `outage-api-admin-${stamp}@example.invalid`,
    password: "password123",
    company_id: tenantId,
    status: "active",
    instance_memberships: [
      { instance: tenantId, role: "instance_admin", status: "active", permissions: OUTAGE_PERMISSIONS },
    ],
  });
  const plain = await User.create({
    name: "Outage API Agent",
    email: `outage-api-agent-${stamp}@example.invalid`,
    password: "password123",
    company_id: tenantId,
    status: "active",
    instance_memberships: [{ instance: tenantId, role: "member", status: "active", permissions: [] }],
  });

  // Membership permissions only reach the principal on an instance-scoped
  // token, so each user logs in and then selects the instance.
  const loginAndSelect = async (user) => {
    const login = await call("POST", "/auth/login", null, { email: user.email, password: "password123" });
    if (!login.body.token) return null;
    const selected = await call("POST", `/instances/${tenantId}/select`, login.body.token);
    return selected.body.token || null;
  };

  adminToken = await loginAndSelect(admin);
  plainToken = await loginAndSelect(plain);

  ok(Boolean(adminToken), "the outage admin can log in and select the instance");
  ok(Boolean(plainToken), "the outage agent can log in and select the instance");
}

async function cleanup() {
  const db = getDB();
  for (const table of CHILD_TABLES) {
    await db(table).where(owned(table)).del();
  }
  await User.deleteMany({ email: { $regex: `outage-api-${stamp}` } });
  await Company.deleteMany({ domain: `outage-api-${stamp}.example.invalid` });
  await db("counters").where({ id: { $like: `${tenantId}:%` } }).del();
}

// ─── authentication and permissions ────────────────────────────────────

async function testAuth() {
  section("AUTHENTICATION AND PERMISSION GATING");

  const anon = await call("GET", "/core/outage/outages", null);
  ok(anon.status === 401, `an outage list without a token is rejected (got ${anon.status})`);

  const forbidden = await api("get", "/outages", plainToken).send();
  ok(forbidden.status === 403, `an agent without outage permissions cannot list outages (got ${forbidden.status})`);

  const allowed = await api("get", "/outages", adminToken).send();
  ok(allowed.status === 200 && allowed.body.success === true, "an admin can list outages");
}

// ─── 16.1 outages ─────────────────────────────────────────────────────

let outageId;

async function testOutages() {
  section("16.1 OUTAGES");

  const created = await api("post", "/outages", adminToken).send({
    title: "Checkout latency spike",
    description: "p99 latency above 3s",
    severity: "major",
    type: "unplanned",
    status: "investigating",
    startTime: new Date().toISOString(),
  });
  ok(created.status === 201, `an outage is created (got ${created.status})`);
  const outage = created.body.data;
  outageId = outage?._id ?? outage?.id;
  ok(Boolean(outageId), "the created outage is returned with an id");
  ok(Boolean(outage?.number), "the outage is numbered");

  const missing = await api("post", "/outages", adminToken).send({ description: "no title" });
  ok(
    missing.status === 422 || missing.status === 400,
    `an outage without a title is rejected with a client error (got ${missing.status})`,
  );

  const badId = await api("get", "/outages/not-a-uuid", adminToken).send();
  ok(
    badId.status === 404 || badId.status === 422,
    `a malformed outage id is rejected (got ${badId.status})`,
  );

  const fetched = await api("get", `/outages/${outageId}`, adminToken).send();
  ok(fetched.status === 200, `the outage reads back by id (got ${fetched.status})`);

  const detail = await api("get", `/outages/${outageId}/detail`, adminToken).send();
  ok(detail.status === 200 && Boolean(detail.body.data), "the outage detail bundle is returned");

  const updated = await api("put", `/outages/${outageId}`, adminToken).send({ description: "p99 above 5s" });
  ok(updated.status === 200, `the outage is updated (got ${updated.status})`);

  const illegal = await api("post", `/outages/${outageId}/transition`, adminToken).send({ status: "closed" });
  // 422 matches the established convention in improvementService, releaseService and outageService.
  ok(illegal.status === 422, `an illegal outage transition is refused (got ${illegal.status})`);

  const legal = await api("post", `/outages/${outageId}/transition`, adminToken).send({ status: "identified" });
  ok(legal.status === 200, `a legal outage transition is accepted (got ${legal.status})`);

  const byStatus = await api("get", "/outages?status=identified", adminToken).send();
  ok(
    byStatus.status === 200 && Array.isArray(byStatus.body.data) && byStatus.body.data.length === 1,
    "the outage list filters by status",
  );

  // The Active Outages screen spans three statuses, which a single value could
  // not express before the list accepted a comma separated set.
  const activeList = await api("get", "/outages?status=investigating,identified,monitoring", adminToken).send();
  const activeStatuses = Array.isArray(activeList.body.data) ? activeList.body.data.map((row) => row.status) : [];
  ok(
    activeList.status === 200 && activeStatuses.length > 0 && activeStatuses.every((st) => ["investigating", "identified", "monitoring"].includes(st)),
    `a comma separated status filter matches the active set (got ${JSON.stringify(activeStatuses)})`,
  );

  const searched = await api("get", "/outages?search=Checkout", adminToken).send();
  ok(
    searched.status === 200 && Array.isArray(searched.body.data) && searched.body.data.length === 1,
    "the outage list searches by title",
  );

  const dashboard = await api("get", "/dashboard", adminToken).send();
  ok(dashboard.status === 200, `the outage dashboard is returned (got ${dashboard.status})`);
}

// ─── 16.2 impact ───────────────────────────────────────────────────────

let ciId;
let serviceId;
let ciLinkId;
let serviceLinkId;

async function testImpact() {
  section("16.2 OUTAGE IMPACT");

  const db = getDB();
  [{ id: ciId }] = await db("configuration_items")
    .insert({ tenant_id: tenantId, name: "Checkout API", ci_class: "application", status: "active" })
    .returning("id");
  [{ id: serviceId }] = await db("business_services")
    .insert({ tenant_id: tenantId, name: "Checkout", status: "active" })
    .returning("id");

  const addedCi = await api("post", `/outages/${outageId}/cis`, adminToken).send({
    ciId,
    role: "primary",
    impact: "degraded",
  });
  ok(addedCi.status === 201 || addedCi.status === 200, `a CI is associated (got ${addedCi.status})`);
  const ciLink = addedCi.body.data;
  ciLinkId = ciLink?._id ?? ciLink?.id;

  const badCi = await api("post", `/outages/${outageId}/cis`, adminToken).send({ role: "primary" });
  ok(
    badCi.status === 422 || badCi.status === 400,
    `a CI association without a ciId is rejected (got ${badCi.status})`,
  );

  const cis = await api("get", `/outages/${outageId}/cis`, adminToken).send();
  ok(cis.status === 200 && Array.isArray(cis.body.data) && cis.body.data.length === 1, "the outage CIs are listed");

  const patchedCi = await api("put", `/outages/${outageId}/cis/${ciLinkId}`, adminToken).send({ impact: "outage" });
  ok(patchedCi.status === 200, `the CI association is updated (got ${patchedCi.status})`);

  const addedService = await api("post", `/outages/${outageId}/services`, adminToken).send({
    serviceId,
    role: "primary",
    impact: "partial_outage",
  });
  ok(addedService.status === 201 || addedService.status === 200, `a service is associated (got ${addedService.status})`);
  const serviceLink = addedService.body.data;
  serviceLinkId = serviceLink?._id ?? serviceLink?.id;

  const services = await api("get", `/outages/${outageId}/services`, adminToken).send();
  ok(
    services.status === 200 && Array.isArray(services.body.data) && services.body.data.length === 1,
    "the outage services are listed",
  );

  const patchedService = await api("put", `/outages/${outageId}/services/${serviceLinkId}`, adminToken).send({
    impact: "full_outage",
  });
  ok(patchedService.status === 200, `the service association is updated (got ${patchedService.status})`);
}

// ─── 16.3 timeline ─────────────────────────────────────────────────────

async function testTimeline() {
  section("16.2 IMPACT TIMELINE");

  const added = await api("post", `/outages/${outageId}/timeline`, adminToken).send({
    message: "Rolled back the pricing change",
    status: "monitoring",
  });
  ok(added.status === 200 || added.status === 201, `a timeline entry is appended (got ${added.status})`);

  const timeline = await api("get", `/outages/${outageId}/timeline`, adminToken).send();
  ok(
    timeline.status === 200 && Array.isArray(timeline.body.data) && timeline.body.data.length >= 2,
    "the timeline keeps the creation entry plus the new one",
  );
}

// ─── 16.4 communications ───────────────────────────────────────────────

async function testCommunications() {
  section("16.4 COMMUNICATIONS");

  const plan = await api("put", `/outages/${outageId}/communication-plan`, adminToken).send({
    cadenceMinutes: 30,
    channels: ["email", "status_page"],
  });
  ok(plan.status === 200, `the communication plan is saved (got ${plan.status})`);

  const recorded = await api("post", `/outages/${outageId}/communication`, adminToken).send({
    channel: "status_page",
    message: "We are investigating elevated checkout latency.",
    audience: "public",
  });
  ok(recorded.status === 200 || recorded.status === 201, `a communication is recorded (got ${recorded.status})`);

  const cadence = await api("post", "/communication-cadence", adminToken).send({});
  ok(cadence.status === 200, `the communication cadence job runs (got ${cadence.status})`);
}

// ─── 16.5 relationships ────────────────────────────────────────────────

async function testRelationships() {
  section("16.3 OUTAGE RELATIONSHIPS");

  const db = getDB();
  const [incident] = await db("incidents")
    .insert({ company_id: tenantId, number: "INC-OUT-1", title: "Checkout errors", status: "open" })
    .returning("id");
  // Changes live in change_requests; there is no `changes` table.
  const [change] = await db("change_requests")
    .insert({ company_id: tenantId, number: "CHG-OUT-1", title: "Pricing deploy", status: "scheduled" })
    .returning("id");

  const linkedIncident = await api("post", `/outages/${outageId}/incidents`, adminToken).send({ incidentId: incident.id, role: "cause" });
  ok(linkedIncident.status === 201, `an incident is linked (got ${linkedIncident.status})`);
  ok(Boolean(linkedIncident.body.data?.id ?? linkedIncident.body.data?._id), "the linked incident is returned");

  const badIncident = await api("post", `/outages/${outageId}/incidents`, adminToken).send({});
  ok(badIncident.status === 422, `linking without an incidentId is rejected (got ${badIncident.status})`);

  const badTarget = await api("post", `/outages/${outageId}/incidents`, adminToken).send({ incidentId: "not-a-uuid" });
  ok(badTarget.status === 422, `linking a malformed incidentId is rejected (got ${badTarget.status})`);

  const missingTarget = await api("post", `/outages/${outageId}/incidents`, adminToken).send({
    incidentId: "11111111-1111-4111-8111-111111111111",
  });
  ok(missingTarget.status === 404, `linking an incident that does not exist is a 404 (got ${missingTarget.status})`);

  const relinked = await api("post", `/outages/${outageId}/incidents`, adminToken).send({ incidentId: incident.id, role: "trigger" });
  ok(relinked.status === 201, `re-linking the same incident updates the link (got ${relinked.status})`);
  ok(
    (relinked.body.data?.role ?? relinked.body.data?.role) === "trigger",
    "re-linking updates the existing row rather than duplicating it",
  );

  const linkedChange = await api("post", `/outages/${outageId}/changes`, adminToken).send({ changeId: change.id });
  ok(linkedChange.status === 201, `a change is linked (got ${linkedChange.status})`);

  const badChange = await api("post", `/outages/${outageId}/changes`, adminToken).send({});
  ok(badChange.status === 422, `linking without a changeId is rejected (got ${badChange.status})`);

  // 16.3 was previously a stub that verified the target and discarded the link,
  // so the list is the assertion that actually proves it is stored.
  const relations = await api("get", `/outages/${outageId}/relations`, adminToken).send();
  const rows = Array.isArray(relations.body.data) ? relations.body.data : [];
  ok(relations.status === 200, `the relationships are listed (got ${relations.status})`);
  ok(rows.length === 2, `both relationships are persisted (got ${rows.length})`);
  ok(
    rows.every((row) => row.relationType === "incident" || row.relationType === "change"),
    "each relationship records its type",
  );
  ok(rows.some((row) => row.title === "Pricing deploy"), "the change title is captured for the list");

  const filtered = await api("get", `/outages/${outageId}/relations?relationType=change`, adminToken).send();
  ok(
    filtered.status === 200 && filtered.body.data.length === 1,
    `the relationship list filters by type (got ${Array.isArray(filtered.body.data) ? filtered.body.data.length : "n/a"})`,
  );

  const relationId = rows.find((row) => row.relationType === "change")?.id ?? rows.find((row) => row.relationType === "change")?._id;
  const unlinked = await api("delete", `/outages/${outageId}/relations/${relationId}`, adminToken).send();
  ok(unlinked.status === 200, `a relationship is unlinked (got ${unlinked.status})`);

  const afterUnlink = await api("get", `/outages/${outageId}/relations`, adminToken).send();
  ok(
    afterUnlink.status === 200 && afterUnlink.body.data.length === 1,
    "an unlinked relationship drops out of the list",
  );
}

// ─── availability ──────────────────────────────────────────────────────

async function testAvailability() {
  section("16.1 SERVICE AVAILABILITY");

  const calculated = await api("post", "/availability/calculate", adminToken).send({
    entityType: "service",
    entityId: serviceId,
    periodStart: new Date(Date.now() - 86400000).toISOString(),
    periodEnd: new Date().toISOString(),
  });
  ok(calculated.status === 200 || calculated.status === 201, `availability is calculated (got ${calculated.status})`);

  const invalid = await api("post", "/availability/calculate", adminToken).send({ entityType: "service" });
  ok(
    invalid.status === 422 || invalid.status === 400,
    `an availability calculation without a period is rejected (got ${invalid.status})`,
  );

  const records = await api("get", "/availability/records", adminToken).send();
  ok(records.status === 200, `availability records are listed (got ${records.status})`);

  const forService = await api("get", `/availability/services/${serviceId}`, adminToken).send();
  ok(forService.status === 200, `per-service availability is returned (got ${forService.status})`);
}

// ─── deletion ──────────────────────────────────────────────────────────

async function testDeletion() {
  section("DELETION");

  const removedService = await api("delete", `/outages/${outageId}/services/${serviceLinkId}`, adminToken).send();
  ok(removedService.status === 200 || removedService.status === 204, `a service association is removed (got ${removedService.status})`);

  const removedCi = await api("delete", `/outages/${outageId}/cis/${ciLinkId}`, adminToken).send();
  ok(removedCi.status === 200 || removedCi.status === 204, `a CI association is removed (got ${removedCi.status})`);

  const removed = await api("delete", `/outages/${outageId}`, adminToken).send();
  ok(removed.status === 200 || removed.status === 204, `the outage is deleted (got ${removed.status})`);

  const gone = await api("get", `/outages/${outageId}`, adminToken).send();
  ok(gone.status === 404, `a deleted outage is no longer readable (got ${gone.status})`);
}

// ─── cross-tenant ──────────────────────────────────────────────────────

async function testCrossTenant() {
  section("CROSS-TENANT ISOLATION");

  const db = getDB();
  const [other] = await db("companies")
    .insert({
      name: "Outage Other Tenant",
      domain: `outage-api-other-${stamp}.example.invalid`,
      status: "active",
      is_instance: true,
      instance_code: `outage-api-other-${stamp}`,
    })
    .returning("*");
  const otherId = other.id;

  const [foreignOutage] = await db("outages")
    .insert({ tenant_id: otherId, title: "Foreign outage", status: "investigating", severity: "minor" })
    .returning("*");

  const listed = await api("get", "/outages", adminToken).send();
  const rows = Array.isArray(listed.body.data) ? listed.body.data : [];
  ok(
    !rows.some((row) => (row._id ?? row.id) === foreignOutage.id),
    "another tenant's outage is not visible in the list",
  );

  const fetched = await api("get", `/outages/${foreignOutage.id}`, adminToken).send();
  ok(fetched.status === 404, `another tenant's outage cannot be read by id (got ${fetched.status})`);

  const updated = await api("put", `/outages/${foreignOutage.id}`, adminToken).send({ title: "Hijacked" });
  ok(updated.status === 404, `another tenant's outage cannot be updated (got ${updated.status})`);

  const moved = await api("post", `/outages/${foreignOutage.id}/transition`, adminToken).send({ status: "identified" });
  ok(moved.status === 404, `another tenant's outage cannot be transitioned (got ${moved.status})`);

  const timeline = await api("get", `/outages/${foreignOutage.id}/timeline`, adminToken).send();
  ok(timeline.status === 404, `another tenant's outage timeline is not readable (got ${timeline.status})`);

  await db("outages").where({ id: foreignOutage.id }).del();
  await db("companies").where({ id: otherId }).del();
}

// ─── runner ───────────────────────────────────────────────────────────

(async () => {
  await connectDB();
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await setup();
  try {
    await testAuth();
    await testOutages();
    await testImpact();
    await testTimeline();
    await testCommunications();
    await testRelationships();
    await testAvailability();
    await testDeletion();
    await testCrossTenant();
    section("CLEANUP");
    await cleanup();
    const leftovers = {};
    for (const table of CHILD_TABLES) {
      const rows = await getDB()(table).where(owned(table)).select("*");
      if (rows.length) leftovers[table] = rows.length;
    }
    ok(
      Object.keys(leftovers).length === 0,
      `cleanup removed every row this test created (${passed} checks passed)` +
        (Object.keys(leftovers).length ? `; left behind: ${JSON.stringify(leftovers)}` : ""),
    );
    console.log(`\nPHASE 16 OUTAGE API TESTS PASSED (${passed} checks)`);
  } catch (error) {
    console.error(`\n${error.message}`);
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error(`cleanup also failed: ${cleanupError.message}`);
    }
    process.exitCode = 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await getDB().destroy();
  }
})();
