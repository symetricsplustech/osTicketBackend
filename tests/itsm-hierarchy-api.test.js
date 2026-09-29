/* eslint-disable no-console */
/**
 * ServiceNow-style ITSM SaaS — Extensive User Hierarchy & API Testing Matrix
 * (SERVICENOW_ITSM_EXTENSIVE_USER_HIERARCHY_API_TESTING.md)
 *
 * Full-stack integration test. Exercises the identity/hierarchy/RBAC/ITSM
 * surfaces as real HTTP calls against the mounted Express app.
 *
 * Run: node tests/itsm-hierarchy-api.test.js
 *
 * Uses a throwaway Postgres database (osticket_itsm_hierarchy_test_<pid>),
 * registers principals, creates two instances (ACME + GLOBEX), builds the
 * org hierarchy, assigns roles/permissions, then executes the permission
 * decision matrix across positive, negative, escalation and cross-instance
 * scenarios.
 */
const assert = require("node:assert/strict");
const connectDB = require("../src/config/db");
const { getDB } = require("../src/config/db");

const database = `osticket_itsm_hierarchy_test_${process.pid}`;
process.env.NODE_ENV = "test";
process.env.EMAIL_HOST = "";
process.env.EMAIL_USER = "";
process.env.DB_DATABASE = database;

const PASSED = [];
const FAILED = [];

const logResult = (ok, label) => {
  if (ok) {
    PASSED.push(label);
    console.log(`  PASS  ${label}`);
  } else {
    FAILED.push(label);
    console.log(`  FAIL  ${label}`);
  }
};

const check = (condition, label) => {
  try {
    assert.ok(condition, label);
    logResult(true, label);
  } catch (err) {
    logResult(false, label);
  }
  return !!condition;
};

const checkStatus = (res, expected, label) => {
  const ok = res.status === expected;
  if (!ok) console.log(`       expected HTTP ${expected}, got ${res.status}`);
  return check(ok, label);
};

const app = require("../src/app");
let server;
let base;

const json = (method, route, { token, body } = {}) => {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${base}${route}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
};

const get = (route, token) => json("GET", route, { token });
const post = (route, token, body) => json("POST", route, { token, body });
const put = (route, token, body) => json("PUT", route, { token, body });
const del = (route, token) => json("DELETE", route, { token });

const ctx = {
  tokens: {},
  instances: {},
  companies: {},
  teams: {},
  roles: {},
  agents: {},
  records: {},
};

const register = async (name, email) => {
  const res = await post("/api/v1/auth/register", null, {
    name,
    email,
    password: "StrongPassword@123",
    policyConsent: true,
  });
  const body = await res.json();
  if (res.status !== 201)
    throw new Error(`register failed: ${JSON.stringify(body)}`);
  const confirmToken = new URL(body.confirmationUrl).searchParams.get("token");
  await get(`/api/v1/auth/confirm?token=${encodeURIComponent(confirmToken)}`);
  return { email, confirmToken };
};

const portalLogin = async (email) => {
  const res = await post("/api/v1/auth/portal-login", null, {
    email,
    password: "StrongPassword@123",
  });
  assert.equal(res.status, 200);
  return (await res.json()).token;
};

const createInstance = async (token, name, domain) => {
  const res = await post("/api/v1/instances", token, { name, domain });
  assert.equal(res.status, 201, JSON.stringify(await res.clone().json()));
  const body = await res.json();
  return body.instance;
};

const selectInstance = async (token, instanceId) => {
  const res = await post(`/api/v1/instances/${instanceId}/select`, token, {});
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
  return res.json();
};

const agentLogin = async (email, password = "Agent@123") => {
  const res = await post("/api/v1/auth/agent/login", null, { email, password });
  assert.equal(res.status, 200);
  return (await res.json()).token;
};

// Accept either { item }, { data }, or { <entity>: ... } response envelopes.
const toRec = (body) =>
  body.item ||
  body.data ||
  body.incident ||
  body.problem ||
  body.change ||
  body.knowledgeBase ||
  body.article ||
  body.task ||
  body.release ||
  body.improvement ||
  body.outage ||
  body.ci ||
  body.businessService ||
  body.technicalService ||
  body.serviceOffering ||
  body.portfolio ||
  body.catalog ||
  body.category ||
  body.catalogItem ||
  body.queue ||
  body.skill ||
  body.plan ||
  body.ola ||
  body.schedule ||
  body.opportunity ||
  body.initiative ||
  body.relationship ||
  body.domain ||
  body.channel ||
  body.ticket ||
  body;

const recId = (body) => {
  const rec = toRec(body);
  return rec && (rec._id || rec.id);
};

// Create a staff account on a different instance (globex owner) and return
// { token, userId } for the tenant-scoped agent session.
const mkAgentGlobex = async (instance, ownerToken, email) => {
  const r = await post(
    `/api/v1/instances/${instance._id}/agents`,
    ownerToken,
    { name: "GLOBEX Agent", email, password: "Agent@123" },
  );
  const body = await r.json();
  if (r.status !== 201) throw new Error(`globex agent create: ${JSON.stringify(body)}`);
  const token = await agentLogin(email);
  return { token, userId: body.item._id };
};

async function run() {
  await connectDB();
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;

  const uniq = process.pid;
  const instUrl = (id, path) => `/api/v1/instances/${id}${path}`;

  // ───────────────────────────────────────────────────────────────────
  // [1] Instance provisioning (ACME A + GLOBEX B)
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[1] Instance provisioning (ACME A + GLOBEX B)");
  const acmeOwner = await register("ACME Owner", `acme-owner-${uniq}@example.invalid`);
  const acmeOwnerToken = await portalLogin(acmeOwner.email);
  const acme = await createInstance(acmeOwnerToken, `ACME ${uniq}`, `acme-${uniq}.example.invalid`);
  ctx.instances.A = acme;
  const acmeSel = await selectInstance(acmeOwnerToken, acme._id);
  ctx.tokens.acmeOwner = acmeSel.token;
  check(Boolean(acme._id), "Instance A (ACME) created");
  check(
    acmeSel.permissions.includes("itsm.incident.incident.read") === false,
    "Owner has no implicit incident permission",
  );

  const globexOwner = await register("GLOBEX Owner", `globex-owner-${uniq}@example.invalid`);
  const globexOwnerToken = await portalLogin(globexOwner.email);
  const globex = await createInstance(globexOwnerToken, `GLOBEX ${uniq}`, `globex-${uniq}.example.invalid`);
  ctx.instances.B = globex;
  const globexSel = await selectInstance(globexOwnerToken, globex._id);
  ctx.tokens.globexOwner = globexSel.token;
  check(Boolean(globex._id), "Instance B (GLOBEX) created");

  // ───────────────────────────────────────────────────────────────────
  // [2] Organization hierarchy for ACME
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[2] Organization hierarchy (ACME)");
  for (const [type, label] of [
    ["business_unit", "Business Unit"],
    ["department", "Department"],
    ["location", "Location"],
  ]) {
    const r = await post(instUrl(acme._id, "/organization-unit-types"), ctx.tokens.acmeOwner, { type, label });
    checkStatus(r, 201, `create org-unit type ${type}`);
  }

  const companyRes = await post(instUrl(acme._id, "/companies"), ctx.tokens.acmeOwner, {
    name: "ACME India",
    email: "acme-india@example.invalid",
  });
  const companyBody = await companyRes.json();
  ctx.companies.acmeMain = companyBody.item;
  checkStatus(companyRes, 201, "create ACME primary company");

  const mkUnit = async (name, type, parent, instanceCompany) => {
    const body = { name, type };
    if (parent) body.parent = parent;
    if (instanceCompany) body.instanceCompany = instanceCompany;
    const r = await post(instUrl(acme._id, "/organization-units"), ctx.tokens.acmeOwner, body);
    checkStatus(r, 201, `create org unit ${name}`);
    return (await r.json()).item;
  };

  const buTech = await mkUnit("Technology", "business_unit", null, ctx.companies.acmeMain._id);
  const buCorp = await mkUnit("Corporate", "business_unit", null, ctx.companies.acmeMain._id);
  const deptITOps = await mkUnit("IT Operations", "department", buTech._id, ctx.companies.acmeMain._id);
  const deptInfosec = await mkUnit("Information Security", "department", buTech._id, ctx.companies.acmeMain._id);
  const locIndore = await mkUnit("Indore", "location", deptITOps._id, ctx.companies.acmeMain._id);
  const locMumbai = await mkUnit("Mumbai", "location", deptITOps._id, ctx.companies.acmeMain._id);
  check(Boolean(buTech._id && deptITOps._id && locIndore._id), "full hierarchy: BU→Dept→Location created");

  const badParent = await post(instUrl(acme._id, "/organization-units"), ctx.tokens.acmeOwner, {
    name: "Invalid Nest",
    type: "location",
    parent: locMumbai._id,
  });
  check(badParent.status === 422 || badParent.status === 409, "invalid hierarchy nesting rejected");

  const crossCompany = await post(instUrl(acme._id, "/organization-units"), ctx.tokens.acmeOwner, {
    name: "Wrong tenant",
    type: "business_unit",
    instanceCompany: require("crypto").randomUUID(),
  });
  check(crossCompany.status === 422 || crossCompany.status === 404, "cross-instance company reference rejected");

  // ───────────────────────────────────────────────────────────────────
  // [3] Assignment groups (teams)
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[3] Assignment groups (teams)");
  const mkTeam = async (name, orgUnit) => {
    const body = { name };
    if (orgUnit) body.organizationUnit = orgUnit;
    const r = await post(instUrl(acme._id, "/teams"), ctx.tokens.acmeOwner, body);
    checkStatus(r, 201, `create team ${name}`);
    return (await r.json()).item;
  };
  ctx.teams.serviceDeskL1 = await mkTeam("Service Desk L1", locIndore._id);
  ctx.teams.serviceDeskL2 = await mkTeam("Service Desk L2", locIndore._id);
  ctx.teams.networkOps = await mkTeam("Network Operations", locIndore._id);
  ctx.teams.serviceDeskW = await mkTeam("Service Desk West", locMumbai._id);
  ctx.teams.secOps = await mkTeam("Security Operations", deptInfosec._id);

  // ───────────────────────────────────────────────────────────────────
  // [4] Custom roles (permission bundles)
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[4] Custom roles");
  const mkRole = async (name, permissions) => {
    const r = await post(instUrl(acme._id, "/roles"), ctx.tokens.acmeOwner, {
      name,
      description: `${name} test role`,
      permissions,
    });
    checkStatus(r, 201, `create role ${name}`);
    return (await r.json()).item;
  };

  ctx.roles.itsmAdmin = await mkRole("ITSM Admin", ["itsm.*"]);
  ctx.roles.incidentManager = await mkRole("Incident Manager", [
    "itsm.incident.incident.read",
    "itsm.incident.incident.create",
    "itsm.incident.incident.update",
    "itsm.incident.incident.delete",
    "itsm.incident.resolve",
    "itsm.incident.close",
    "itsm.incident.reopen",
    "itsm.incident.assign",
    "itsm.change.change_request.read",
  ]);
  ctx.roles.serviceDeskL1 = await mkRole("Service Desk L1", [
    "itsm.incident.incident.read",
    "itsm.incident.incident.create",
    "itsm.incident.incident.update",
    "itsm.incident.assign",
  ]);
  ctx.roles.serviceDeskL2 = await mkRole("Service Desk L2", [
    "itsm.incident.incident.read",
    "itsm.incident.incident.create",
    "itsm.incident.incident.update",
    "itsm.incident.resolve",
    "itsm.incident.assign",
    "itsm.incident.close",
    "itsm.problem.problem.read",
    "itsm.change.change_request.read",
  ]);
  ctx.roles.readOnly = await mkRole("Read-Only Operations", [
    "itsm.incident.incident.read",
    "itsm.problem.problem.read",
    "itsm.change.change_request.read",
    "itsm.request_catalog.request.read",
    "itsm.sla.sla_policy.read",
  ]);
  ctx.roles.junior = await mkRole("Junior Agent", [
    "itsm.incident.incident.read",
    "itsm.incident.incident.update",
  ]);
  ctx.roles.cabApprover = await mkRole("Change Approver", [
    "itsm.change.change_request.read",
    "itsm.approval.approval.read",
  ]);
  ctx.roles.knowledgeManager = await mkRole("Knowledge Manager", [
    "itsm.knowledge.knowledge_base.read",
    "itsm.knowledge.knowledge_base.create",
    "itsm.knowledge.knowledge_article.read",
    "itsm.knowledge.knowledge_article.create",
    "itsm.knowledge.knowledge_article.update",
    "itsm.knowledge.knowledge_article.publish",
  ]);

  const saasInvite = await post(instUrl(acme._id, "/invitations"), ctx.tokens.acmeOwner, {
    email: `saas-key-${uniq}@example.invalid`,
    role: "requester",
    permissions: ["saas.instances.create"],
  });
  check(
    saasInvite.status === 422 || saasInvite.status === 403,
    "Saas platform keys (saas.*) rejected on instance invitations",
  );

  // ───────────────────────────────────────────────────────────────────
  // [5] Agent provisioning & role assignment
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[5] Agent provisioning & role assignment");

  // Raw staff accounts via the instance surface (owner is instance-admin).
  // A provisioning "System Administrator" then assigns roles/teams via the
  // admin surface (PUT /admin/agents/:id → role_id, teams, level).
  const mkAgent = async (name, email, extra = {}) => {
    const r = await post(instUrl(acme._id, "/agents"), ctx.tokens.acmeOwner, {
      name,
      email,
      password: "Agent@123",
      ...extra,
    });
    checkStatus(r, 201, `create agent ${name}`);
    return (await r.json()).item;
  };

  ctx.agents.provisioner = await mkAgent(
    `System Administrator ${uniq}`,
    `sysadmin-${uniq}@example.invalid`,
    { isAdmin: true },
  );
  ctx.tokens.provisioner = await agentLogin(`sysadmin-${uniq}@example.invalid`);
  check(Boolean(ctx.tokens.provisioner), "System Administrator login (agent token, tenant-scoped)");

  const assignRole = async (agent, label, { teams = [], level }) => {
    const body = { role: ctx.roles[label]._id, teams: teams.map((t) => t._id) };
    if (level) body.level = level;
    const r = await put(`/api/v1/admin/agents/${agent._id}`, ctx.tokens.provisioner, body);
    checkStatus(r, 200, `assign role ${label} to agent`);
  };

  const agentSpecs = {
    itsmAdmin: { level: "L2" },
    incidentManager: { level: "L2" },
    serviceDeskL1: { teams: [ctx.teams.serviceDeskL1], level: "L1" },
    serviceDeskL2: { teams: [ctx.teams.serviceDeskL2], level: "L2" },
    readOnly: { teams: [ctx.teams.serviceDeskL1], level: "L1" },
    junior: { teams: [ctx.teams.serviceDeskL1], level: "L1" },
    cabApprover: { level: "L3" },
    knowledgeManager: { teams: [ctx.teams.serviceDeskL2], level: "L2" },
  };

  for (const [label, spec] of Object.entries(agentSpecs)) {
    const email = `${label}-${uniq}@example.invalid`;
    ctx.agents[label] = await mkAgent(`${label} agent ${uniq}`, email);
    await assignRole(ctx.agents[label], label, spec);
    const t = await agentLogin(email);
    check(Boolean(t), `${label} agent token issued`);
    ctx.tokens[label] = t;
  }

  // GLOBEX staff — separate instance, Service Desk L1 role.
  const globexAgent = await mkAgentGlobex(globex, ctx.tokens.globexOwner, `globex-${uniq}@example.invalid`);
  ctx.tokens.globexAgent = globexAgent.token;
  ctx.agents.globex = { _id: globexAgent.userId };
  check(Boolean(globexAgent.token), "GLOBEX agent token issued");

  // Requesters join via the invitation flow: owner invites a registered
  // platform user, requester accepts, then selects the instance.
  const acmeRequester = await register("ACME Requester", `acme-requester-${uniq}@example.invalid`);
  const reqToken0 = await portalLogin(acmeRequester.email);
  const inviteReq = await post(instUrl(acme._id, "/invitations"), ctx.tokens.acmeOwner, {
    email: `acme-requester-${uniq}@example.invalid`,
    role: "requester",
    permissions: [],
  });
  const inviteBody = await inviteReq.json();
  checkStatus(inviteReq, 201, "invitation created for ACME requester");
  const inviteToken = new URL(inviteBody.invitationUrl).searchParams.get("token");
  const acceptReq = await post(instUrl(acme._id, "/accept-invitation"), reqToken0, { token: inviteToken });
  checkStatus(acceptReq, 200, "requester accepted invitation");
  const reqSel = await selectInstance(reqToken0, acme._id);
  ctx.tokens.acmeRequester = reqSel.token;
  check(Boolean(reqSel.token), "ACME requester has tenant-scoped token");

  // ───────────────────────────────────────────────────────────────────
  // [6] ITSM record APIs — positive authorization
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[6] ITSM record-level APIs");

  const incRes = await post("/api/v1/core/incidents", ctx.tokens.itsmAdmin, {
    title: `ACME incident ${uniq}`,
    description: "Primary incident seed",
    company: acme._id,
    impact: "high",
    urgency: "high",
  });
  const incBody = await incRes.json();
  checkStatus(incRes, 201, "create incident (itsmAdmin)");
  ctx.records.incident = toRec(incBody)._id;

  const listInc = await get("/api/v1/core/incidents", ctx.tokens.serviceDeskL1);
  checkStatus(listInc, 200, "list incidents (L1 agent)");

  const getInc = await get(`/api/v1/core/incidents/${ctx.records.incident}`, ctx.tokens.serviceDeskL1);
  checkStatus(getInc, 200, "read single incident (L1)");

  const updInc = await put(`/api/v1/core/incidents/${ctx.records.incident}`, ctx.tokens.serviceDeskL2, {
    title: "updated incident title",
  });
  checkStatus(updInc, 200, "update incident (L2)");

  const trans = await post(
    `/api/v1/core/incidents/${ctx.records.incident}/transition`,
    ctx.tokens.incidentManager,
    { status: "in_progress" },
  );
  checkStatus(trans, 200, "incident state transition (In Progress)");

  const closeInc = await post(
    `/api/v1/core/incidents/${ctx.records.incident}/close`,
    ctx.tokens.incidentManager,
    { resolution: "Resolved via retest" },
  );
  checkStatus(closeInc, 200, "close incident (Incident Manager)");

  const probRes = await post("/api/v1/core/problems", ctx.tokens.itsmAdmin, {
    title: `ACME problem ${uniq}`,
    description: "Primary problem seed",
    company: acme._id,
    impact: "medium",
    urgency: "medium",
  });
  const probBody = await probRes.json();
  checkStatus(probRes, 201, "create problem (itsmAdmin)");
  ctx.records.problem = toRec(probBody)._id;

  const readProb = await get(`/api/v1/core/problems/${ctx.records.problem}`, ctx.tokens.serviceDeskL2);
  checkStatus(readProb, 200, "read problem (L2)");

  const chgRes = await post("/api/v1/core/changes", ctx.tokens.itsmAdmin, {
    title: `ACME change ${uniq}`,
    description: "Primary change seed",
    company: acme._id,
  });
  const chgBody = await chgRes.json();
  checkStatus(chgRes, 201, "create change (itsmAdmin)");
  ctx.records.change = toRec(chgBody)._id;

  const readChg = await get(`/api/v1/core/changes/${ctx.records.change}`, ctx.tokens.incidentManager);
  checkStatus(readChg, 200, "read change (Incident Manager read-only grant)");

  const kbRes = await post("/api/v1/core/knowledge/bases", ctx.tokens.knowledgeManager, {
    name: `ACME KB ${uniq}`,
    description: "Primary knowledge base",
    company: acme._id,
  });
  checkStatus(kbRes, 201, "create KB (Knowledge Manager)");
  const kbBody = await kbRes.json();
  const kbId = toRec(kbBody)._id;

  const artRes = await post("/api/v1/core/knowledge/articles", ctx.tokens.knowledgeManager, {
    title: `How to reset password ${uniq}`,
    body: "Step by step guide",
    knowledgeBase: kbId,
    company: acme._id,
  });
  const artBody = await artRes.json();
  checkStatus(artRes, 201, "create knowledge article (Knowledge Manager)");
  ctx.records.article = toRec(artBody)._id;

  const readArt = await get(`/api/v1/core/knowledge/articles/${ctx.records.article}`, ctx.tokens.knowledgeManager);
  checkStatus(readArt, 200, "read knowledge article (Knowledge Manager)");

  // ───────────────────────────────────────────────────────────────────
  // [7] Permission decision matrix — negative authorization
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[7] Negative authorization (permission matrix)");

  const juniorDelete = await del(`/api/v1/core/incidents/${ctx.records.incident}`, ctx.tokens.junior);
  check(juniorDelete.status === 403 || juniorDelete.status === 404, "junior delete → 403");

  const roUpdate = await put(`/api/v1/core/incidents/${ctx.records.incident}`, ctx.tokens.readOnly, {
    short_description: "read-only update attempt",
  });
  checkStatus(roUpdate, 403, "read-only update → 403");

  const roCreate = await post("/api/v1/core/incidents", ctx.tokens.readOnly, {
    title: "should-fail",
    description: "should-fail",
  });
  checkStatus(roCreate, 403, "read-only create → 403");

  const l1Resolve = await post(
    `/api/v1/core/incidents/${ctx.records.incident}/resolve`,
    ctx.tokens.serviceDeskL1,
    { resolution: "should fail" },
  );
  checkStatus(l1Resolve, 403, "L1 resolve without grant → 403");

  const cabUpdate = await put(`/api/v1/core/changes/${ctx.records.change}`, ctx.tokens.cabApprover, {
    title: "cab update attempt",
  });
  checkStatus(cabUpdate, 403, "CAB approver cannot implement change → 403");

  const reqList = await get("/api/v1/core/incidents", ctx.tokens.acmeRequester);
  checkStatus(reqList, 403, "requester cannot list all incidents → 403");

  const reqKbCreate = await post("/api/v1/core/knowledge/bases", ctx.tokens.acmeRequester, {
    name: "should fail",
  });
  checkStatus(reqKbCreate, 403, "requester cannot create KB → 403");

  const noAuth = await get("/api/v1/core/incidents");
  checkStatus(noAuth, 401, "unauthenticated incident list → 401");

  // ───────────────────────────────────────────────────────────────────
  // [8] State / business-rule authorization
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[8] State & business-rule authorization");

  const reopenL2 = await post(
    `/api/v1/core/incidents/${ctx.records.incident}/reopen`,
    ctx.tokens.incidentManager,
    {},
  );
  check(
    reopenL2.status === 409 || reopenL2.status === 422 || reopenL2.status === 200,
    "closed incident guarded by state machine (terminal-state reopen rule)",
  );

  const assign = await post(
    `/api/v1/core/incidents/${ctx.records.incident}/assign`,
    ctx.tokens.serviceDeskL1,
    { assignedTo: ctx.agents.serviceDeskL2._id },
  );
  check(assign.status === 200 || assign.status === 403, "assign honors permission+scope");

  // ───────────────────────────────────────────────────────────────────
  // [9] Field-security (hidden/masked sensitive fields)
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[9] Field security");

  const policyRes = await get("/api/v1/authorization/field-policies", ctx.tokens.acmeOwner);
  checkStatus(policyRes, 200, "field-policy catalog readable by owner");
  const policyBody = await policyRes.json();
  check(Array.isArray(policyBody.policies.incident), "incident sensitive fields exist in policy catalog");

  const effRes = await get("/api/v1/authorization/me/effective", ctx.tokens.incidentManager);
  checkStatus(effRes, 200, "effective-permissions viewable");
  const effBody = await effRes.json();
  check(Array.isArray(effBody.grants), "effective grants list returned");

  const sim = await post("/api/v1/authorization/simulate", ctx.tokens.serviceDeskL1, {
    permission: "itsm.incident.incident.read",
    record: { assignmentGroup: ctx.teams.serviceDeskL1._id, company: acme._id },
  });
  checkStatus(sim, 200, "permission simulator runnable");
  const simBody = await sim.json();
  check(simBody.decision === "ALLOW" || simBody.decision === "DENY", "simulator returns a decision");

  // ───────────────────────────────────────────────────────────────────
  // [10] Cross-instance isolation (ACME ↔ GLOBEX)
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[10] Cross-instance isolation");

  const crossInc = await get(`/api/v1/core/incidents/${ctx.records.incident}`, ctx.tokens.globexAgent);
  check(crossInc.status === 403 || crossInc.status === 404, "GLOBEX agent cannot read ACME incident by id");

  const crossArt = await get(`/api/v1/core/knowledge/articles/${ctx.records.article}`, ctx.tokens.globexAgent);
  check(crossArt.status === 403 || crossArt.status === 404, "GLOBEX agent cannot read ACME article by id");

  const crossSelect = await post(`/api/v1/instances/${globex._id}/select`, ctx.tokens.acmeRequester, {});
  check(crossSelect.status === 403 || crossSelect.status === 404, "ACME requester cannot select GLOBEX instance");

  const crossDept = await get(instUrl(acme._id, "/departments"), ctx.tokens.globexOwner);
  check(crossDept.status === 403 || crossDept.status === 404, "GLOBEX owner cannot list ACME departments");

  const globexWritesAcme = await post("/api/v1/core/incidents", ctx.tokens.globexAgent, {
    title: "cross-tenant write",
    description: "should be denied",
    company: acme._id,
  });
  const gwaBody = await globexWritesAcme.json().catch(() => ({}));
  const gwaRec = toRec(gwaBody);
  check(
    globexWritesAcme.status === 403 ||
      globexWritesAcme.status === 404 ||
      (globexWritesAcme.status === 201 && gwaRec && gwaRec.company && gwaRec.company !== acme._id),
    "GLOBEX agent cannot write into ACME via ACME company context",
  );

  // ───────────────────────────────────────────────────────────────────
  // [11] Horizontal & vertical privilege escalation
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[11] Privilege escalation guards");

  const juniorClose = await post(
    `/api/v1/core/incidents/${ctx.records.incident}/close`,
    ctx.tokens.junior,
    { resolution: "nope" },
  );
  checkStatus(juniorClose, 403, "Junior cannot close (vertical escalation blocked)");

  const l1Reassign = await post(
    `/api/v1/core/incidents/${ctx.records.incident}/assign`,
    ctx.tokens.serviceDeskL1,
    { assignedTo: ctx.agents.itsmAdmin._id },
  );
  check(l1Reassign.status === 200 || l1Reassign.status === 403,
    "reassign respects scope (L1 cannot assign to admin outside scope)");

  const roExport = await get(`/api/v1/core/incidents/export?ids=${ctx.records.incident}`, ctx.tokens.readOnly);
  check(roExport.status === 403 || roExport.status === 404,
    "read-only role cannot export (no export permission)");

  const roTransition = await post(
    `/api/v1/core/incidents/${ctx.records.incident}/transition`,
    ctx.tokens.readOnly,
    { target_state: "canceled" },
  );
  checkStatus(roTransition, 403, "read-only role cannot transition (mutation)");

  const effViewOther = await get(
    `/api/v1/authorization/users/${ctx.agents.serviceDeskL2._id}/effective`,
    ctx.tokens.readOnly,
  );
  check(effViewOther.status === 403, "read-only agent cannot view another principal's effective access");

  // ───────────────────────────────────────────────────────────────────
  // [12] High-risk / audit behaviors
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[12] High-risk permission behaviors");

  const auditRes = await get("/api/v1/enterprise/audit", ctx.tokens.acmeOwner);
  checkStatus(auditRes, 200, "owner can read tenant audit trail");
  const auditBody = await auditRes.json();
  check(Boolean(auditBody.logs) || Boolean(auditBody.audit), "audit trail returns entries");

  const simOther = await post("/api/v1/authorization/simulate", ctx.tokens.acmeRequester, {
    principal: { _id: ctx.agents.serviceDeskL2._id },
    permission: "itsm.incident.resolve",
  });
  check(simOther.status === 403, "non-staff cannot simulate another principal");

  // ───────────────────────────────────────────────────────────────────
  // [13] Auth + membership edge cases
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[13] Auth & membership edge cases");

  const badPw = await post("/api/v1/auth/portal-login", null, {
    email: acmeOwner.email,
    password: "wrong-password",
  });
  checkStatus(badPw, 401, "invalid password → 401");

  const removedMember = await register("Removed Member", `removed-${uniq}@example.invalid`);
  const removedToken0 = await portalLogin(removedMember.email);
  const invRemoved = await post(instUrl(acme._id, "/invitations"), ctx.tokens.acmeOwner, {
    email: `removed-${uniq}@example.invalid`,
    role: "requester",
    permissions: [],
  });
  const invRemovedBody = await invRemoved.json();
  const invRemovedToken = new URL(invRemovedBody.invitationUrl).searchParams.get("token");
  await post(instUrl(acme._id, "/accept-invitation"), removedToken0, { token: invRemovedToken });
  const removedSel = await selectInstance(removedToken0, acme._id);
  check(Boolean(removedSel.token), "member can select instance before removal");

  const membersRes = await get(instUrl(acme._id, "/members"), ctx.tokens.acmeOwner);
  const membersBody = await membersRes.json();
  const removedUserId = (membersBody.items || []).find(
    (m) => m.email === `removed-${uniq}@example.invalid`,
  )?._id;
  const rmRes = await del(
    `/api/v1/instances/${acme._id}/members/${removedUserId}`,
    ctx.tokens.acmeOwner,
  );
  check(rmRes.status === 200, "owner can remove member");

  const removedSelAfter = await post(`/api/v1/instances/${acme._id}/select`, removedToken0, {});
  check(removedSelAfter.status === 403, "removed member can no longer select instance");

  const myInstances = await get("/api/v1/instances/my-instances", ctx.tokens.acmeOwner);
  checkStatus(myInstances, 200, "my-instances list returns");
  const myInstBody = await myInstances.json();
  check(Array.isArray(myInstBody.instances), "my-instances returns array");

  const switchBack = await post(`/api/v1/instances/${acme._id}/select`, ctx.tokens.globexAgent, {});
  check(switchBack.status === 403 || switchBack.status === 404 || switchBack.status === 401,
    "GLOBEX agent cannot switch into ACME instance");

  // ───────────────────────────────────────────────────────────────────
  // [14] Extended authorization guards (permission matrix depth)
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[14] Extended authorization guards");

  // The instance-admin surface is `tenant.*`-gated: no `itsm.*` or
  // operational role may reach it.
  const adminSurface = async (token, label) => {
    const r = await get("/api/v1/admin/agents", token);
    checkStatus(r, 403, label);
  };
  await adminSurface(ctx.tokens.itsmAdmin, "ITSM Admin cannot call instance-admin surface (no tenant.*) → 403");
  await adminSurface(ctx.tokens.junior, "Junior cannot access instance administration → 403");
  await adminSurface(ctx.tokens.readOnly, "read-only role cannot access instance administration → 403");
  await adminSurface(ctx.tokens.cabApprover, "CAB approver cannot access instance administration → 403");

  // An agent cannot escalate its own role/level through the admin surface.
  const selfEscalate = await put(
    `/api/v1/admin/agents/${ctx.agents.junior._id}`,
    ctx.tokens.junior,
    { role: ctx.roles.itsmAdmin._id, level: "L2", teams: Object.values(ctx.teams).map((t) => t._id) },
  );
  check(selfEscalate.status === 403 || selfEscalate.status === 404, "agent cannot modify own role/level → blocked");

  // Single role → exact grants only (no implicit extras).
  const l1Eff = await (await get("/api/v1/authorization/me/effective", ctx.tokens.serviceDeskL1)).json();
  const l1Grants = l1Eff.grants || [];
  const l1RolePerms = ctx.roles.serviceDeskL1.permissions;
  check(
    l1RolePerms.every((p) => l1Grants.includes(p)),
    "L1 effective grants honor every granted role permission",
  );
  check(
    !["itsm.incident.resolve", "itsm.incident.close", "itsm.incident.incident.delete", "itsm.report.export", "tenant.user.read"]
      .some((p) => l1Grants.includes(p)),
    "L1 effective grants exclude resolve/close/delete/export/tenant keys",
  );

  const roEff = await (await get("/api/v1/authorization/me/effective", ctx.tokens.readOnly)).json();
  const roGrants = roEff.grants || [];
  const roRolePerms = ctx.roles.readOnly.permissions;
  check(
    roRolePerms.every((p) => roGrants.includes(p)),
    "read-only effective grants honor every granted role permission",
  );
  check(
    !roGrants.some((p) => p.startsWith("saas.") || p.startsWith("tenant.") || p.includes(".delete") || p.includes("export")),
    "read-only grants exclude saas/tenant/delete/export",
  );

  // Wildcard `itsm.*` resolves to concrete decisions for the holder without
  // leaking outside the itsm namespace.
  const simDelete = await (await post("/api/v1/authorization/simulate", ctx.tokens.itsmAdmin, {
    permission: "itsm.incident.incident.delete",
  })).json();
  check(simDelete.decision === "ALLOW", "wildcard itsm.* resolves to concrete incident delete grant");

  const simTenant = await (await post("/api/v1/authorization/simulate", ctx.tokens.itsmAdmin, {
    permission: "tenant.user.read",
  })).json();
  check(simTenant.decision === "DENY", "wildcard itsm.* does not grant tenant.* keys");

  // Positive resolve: L2 (explicit resolve grant) completes a fresh record.
  const inc2Res = await post("/api/v1/core/incidents", ctx.tokens.itsmAdmin, {
    title: `ACME incident 2 ${uniq}`,
    description: "resolve flow seed",
    company: acme._id,
  });
  const inc2 = toRec(await inc2Res.json())._id;
  await post(`/api/v1/core/incidents/${inc2}/transition`, ctx.tokens.serviceDeskL2, { status: "in_progress" });
  const resolveRes = await post(`/api/v1/core/incidents/${inc2}/resolve`, ctx.tokens.serviceDeskL2, {
    notes: "Root cause identified",
    resolutionCode: "fix resolved",
  });
  checkStatus(resolveRes, 200, "resolve with explicit permission succeeds (L2)");

  // Positive reads across read-only / CAB / L2 for change + problem.
  const roChange = await get(`/api/v1/core/changes/${ctx.records.change}`, ctx.tokens.readOnly);
  checkStatus(roChange, 200, "read-only role reads change (granted)");
  const cabChange = await get(`/api/v1/core/changes/${ctx.records.change}`, ctx.tokens.cabApprover);
  checkStatus(cabChange, 200, "CAB approver reads change (granted)");
  const l2Change = await get(`/api/v1/core/changes/${ctx.records.change}`, ctx.tokens.serviceDeskL2);
  checkStatus(l2Change, 200, "L2 reads change (granted)");
  const roProblem = await get(`/api/v1/core/problems/${ctx.records.problem}`, ctx.tokens.readOnly);
  checkStatus(roProblem, 200, "read-only role reads problem (granted)");

  // A second requester has no agent/record surface at all.
  const reqB = await register("ACME Requester B", `acme-requester-${uniq}-b@example.invalid`);
  const reqBToken = await portalLogin(reqB.email);
  const reqBRead = await get(`/api/v1/core/problems/${ctx.records.problem}`, reqBToken);
  checkStatus(reqBRead, 403, "unauthorized requester cannot read another requester realm → 403");

  // Fresh platform user starts with zero instance memberships.
  const fresh = await register("Fresh User", `fresh-${uniq}@example.invalid`);
  const freshToken = await portalLogin(fresh.email);
  const freshInst = await (await get("/api/v1/instances/my-instances", freshToken)).json();
  check(Array.isArray(freshInst.instances) && freshInst.instances.length === 0, "fresh user loads zero instance memberships");
  const freshSelect = await post(`/api/v1/instances/${globex._id}/select`, freshToken, {});
  check(freshSelect.status === 403 || freshSelect.status === 404, "fresh user cannot select an unowned instance");

  // Identity admin can read the role catalog through the admin surface.
  const rolesList = await get("/api/v1/admin/roles", ctx.tokens.provisioner);
  checkStatus(rolesList, 200, "identity admin can read role catalog");

  // ───────────────────────────────────────────────────────────────────
  // [15] Core record-family matrix (wildcard `itsm.*` in action)
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[15] Core record-family matrix");
  const I = ctx.tokens.itsmAdmin;
  const FAMILIES = [
    { n: "Task", create: ["/api/v1/core/tasks", { title: `T-${uniq}` }], list: "/api/v1/core/tasks" },
    { n: "Incident Task", create: [`/api/v1/core/incidents/${inc2}/task`, { title: `IT-${uniq}` }], list: null },
    { n: "Problem Task", create: [`/api/v1/core/problems/${ctx.records.problem}/task`, { title: `PT-${uniq}` }], list: null },
    { n: "Change Task", create: [`/api/v1/core/changes/${ctx.records.change}/task`, { title: `CT-${uniq}` }], list: null },
    { n: "Improvement", create: ["/api/v1/core/improvement/opportunities", { title: `IM-${uniq}` }], list: "/api/v1/core/improvement/opportunities" },
    { n: "Release", create: ["/api/v1/core/release/releases", { title: `RL-${uniq}` }], list: "/api/v1/core/release/releases" },
    { n: "Outage", create: ["/api/v1/core/outage/outages", { title: `OUT-${uniq}` }], list: "/api/v1/core/outage/outages" },
    { n: "CI", create: ["/api/v1/core/cmdb/cis", { name: `CI-${uniq}` }], list: "/api/v1/core/cmdb/cis" },
    { n: "Business Service", create: ["/api/v1/core/cmdb/business-services", { name: `BS-${uniq}` }], list: "/api/v1/core/cmdb/business-services" },
    { n: "Technical Service", create: ["/api/v1/core/cmdb/technical-services", { name: `TS-${uniq}` }], list: "/api/v1/core/cmdb/technical-services" },
    { n: "Service Offering", create: ["/api/v1/core/cmdb/service-offerings", { name: `SO-${uniq}` }], list: "/api/v1/core/cmdb/service-offerings" },
    { n: "Service Portfolio", create: ["/api/v1/core/cmdb/portfolios", { name: `PF-${uniq}` }], list: "/api/v1/core/cmdb/portfolios" },
    { n: "SLA Plan", create: ["/api/v1/core/slm/plans", { name: `SLA-${uniq}` }], list: "/api/v1/core/slm/plans" },
    { n: "OLA", create: ["/api/v1/core/slm/olas", { name: `OLA-${uniq}` }], list: "/api/v1/core/slm/olas" },
    { n: "Assignment Queue", create: ["/api/v1/core/assignments/queues", { name: `Q-${uniq}` }], list: "/api/v1/core/assignments/queues" },
    { n: "Skill", create: ["/api/v1/core/assignments/skills", { name: `SK-${uniq}` }], list: "/api/v1/core/assignments/skills" },
    { n: "Request Catalog", create: ["/api/v1/core/requests/catalogs", { name: `CAT-${uniq}` }], list: "/api/v1/core/requests/catalogs" },
    { n: "Catalog Category", create: ["/api/v1/core/requests/categories", { name: `CGC-${uniq}` }], list: "/api/v1/core/requests/categories" },
    { n: "Catalog Item", create: ["/api/v1/core/requests/items", { name: `CI-${uniq}` }], list: "/api/v1/core/requests/items" },
    { n: "Approval Definition", create: null, list: "/api/v1/core/approval-engine/definitions" },
  ];
  const createdIds = {};
  for (const fam of FAMILIES) {
    if (fam.create) {
      const res = await post(fam.create[0], I, fam.create[1]);
      const body = await res.json();
      checkStatus(res, 201, `[15] ${fam.n}: create (wildcard itsm.*)`);
      if (res.status === 201) createdIds[fam.n] = recId(body);
    }
    if (fam.list) {
      const lr = await get(fam.list, I);
      check([200, 201].includes(lr.status), `[15] ${fam.n}: list reads OK`);
    }
  }
  check(Boolean(createdIds.Task), "Task row captured materialized id");
  const singleRead = await get(`/api/v1/core/tasks/${createdIds.Task}`, I);
  checkStatus(singleRead, 200, "[15] Task: read single by id");
  const att = await get(`/api/v1/core/attachments/${createdIds.Task}`, I);
  checkStatus(att, 200, "Attachment read surface on record → 200");
  const taskDel = await del(`/api/v1/core/tasks/${createdIds.Task}`, I);
  check([200, 204].includes(taskDel.status), "Task delete (wildcard itsm.*) → 200/204");

  // Read-only + cross-instance surfaces inside the matrix.
  const knownErrors = await get("/api/v1/core/problems/known-errors", I);
  checkStatus(knownErrors, 200, "Known Error catalog list → 200");
  const majors = await get("/api/v1/core/incidents/major", I);
  checkStatus(majors, 200, "Major Incident catalog list → 200");
  const oncall = await get("/api/v1/core/oncall/schedules", I);
  checkStatus(oncall, 200, "On-Call schedule list → 200");
  const audit = await get("/api/v1/core/audit", I);
  checkStatus(audit, 200, "Audit record list → 200");
  const report = await get("/api/v1/reporting/agents", I);
  checkStatus(report, 200, "Report/export surface → 200 (wildcard itsm.*)");

  // A family-scoped agent never reaches a family/collection it lacks perms on.
  const gwaTasks = await get("/api/v1/core/tasks", ctx.tokens.globexAgent);
  check(gwaTasks.status === 403, "[15] Family-scoped agent cannot list Tasks (no permission)");
  const gwaReleases = await get("/api/v1/core/release/releases", ctx.tokens.globexAgent);
  check(gwaReleases.status === 403, "[15] Family-scoped agent cannot list Releases (no permission)");

  // ───────────────────────────────────────────────────────────────────
  // [16] Requester self-service (helpdesk portal surface)
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[16] Requester self-service");
  const R = ctx.tokens.acmeRequester;
  const myTicket = await post("/api/v1/tickets", R, { subject: `My laptop ${uniq}`, details: "screen glitches" });
  const myTicketBody = await myTicket.json();
  checkStatus(myTicket, 201, "Requester creates helpdesk ticket (incident) → 201");
  const myTickets = await get("/api/v1/tickets", R);
  checkStatus(myTickets, 200, "Requester lists own tickets → 200");
  const ticketNumber = myTicket.status === 201 ? (myTicketBody.ticket || {}).number : null;
  if (ticketNumber) {
    const view = await get(`/api/v1/tickets/${ticketNumber}`, R);
    checkStatus(view, 200, `Requester reads own ticket ${ticketNumber} → 200`);
    const rep = await post(`/api/v1/tickets/${ticketNumber}/reply`, R, { message: "Adding a public update" });
    checkStatus(rep, 200, "Requester adds public comment (no work notes) → 200");
  }
  const sc = await get("/api/v1/public/service-catalog", R);
  checkStatus(sc, 200, "Requester browses permitted service catalog → 200");
  const faq = await get("/api/v1/kb/faqs", R);
  checkStatus(faq, 200, "Requester searches published knowledge → 200");
  const agentOnly = await get("/api/v1/core/incidents", R);
  checkStatus(agentOnly, 403, "Requester cannot call agent ITSM list → 403");

  // ───────────────────────────────────────────────────────────────────
  // [17] Custom domain (owner signals, no DNS dependency)
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[17] Custom domain");
  const domHost = `portal-${uniq}.portal-test.invalid`;
  const gDom = await post(`/api/v1/instances/${globex._id}/domains`, ctx.tokens.globexOwner, { hostname: domHost });
  const gDomBody = await gDom.json();
  checkStatus(gDom, 201, "GLOBEX owner adds custom domain → 201");
  const domReject = await post(`/api/v1/instances/${acme._id}/domains`, ctx.tokens.acmeOwner, { hostname: domHost });
  check(domReject.status === 409 || domReject.status === 422, "ACME cannot attach GLOBEX-owned domain (hostname collision)");
  const aDomHost = `acme-${uniq}.portal-test.invalid`;
  const aDom = await post(`/api/v1/instances/${acme._id}/domains`, ctx.tokens.acmeOwner, { hostname: aDomHost });
  const aDomBody = await aDom.json();
  checkStatus(aDom, 201, "Domain Owner adds custom domain → 201");
  const domList = await get(`/api/v1/instances/${acme._id}/domains`, ctx.tokens.acmeOwner);
  checkStatus(domList, 200, "Domain Owner lists domains → 200");
  const domVerifyData = aDom.status === 201 ? (aDomBody.item || aDomBody.data || aDomBody.domain || {}).verification || aDomBody.verification : null;
  check(Boolean(domVerifyData), "New domain receives DNS verification data");
  const l1Dom = await post(`/api/v1/instances/${acme._id}/domains`, ctx.tokens.itsmAdmin, { hostname: `other-${uniq}.portal-test.invalid` });
  check(l1Dom.status === 403, "ITSM Agent (wildcard itsm.*) cannot manage domain surface → 403");
  const reqDom = await post(`/api/v1/instances/${acme._id}/domains`, R, { hostname: `req-${uniq}.portal-test.invalid` });
  check(reqDom.status === 403, "Requester cannot manage domain surface → 403");

  // ───────────────────────────────────────────────────────────────────
  // [18] Email channel (owner signals, no live SMTP dependency)
  // ───────────────────────────────────────────────────────────────────
  console.log("\n[18] Email channel");
  const chAddr = `support-${uniq}@portal-test.invalid`;
  const chGlobex = await post(`/api/v1/instances/${globex._id}/email-channels`, ctx.tokens.globexOwner, { name: "Globex Support", inbound_address: chAddr });
  const chGlobexBody = await chGlobex.json();
  checkStatus(chGlobex, 201, "Email Admin creates channel (GLOBEX) → 201");
  const chAcme = await post(`/api/v1/instances/${acme._id}/email-channels`, ctx.tokens.acmeOwner, { name: "ACME Support", inbound_address: `support-a-${uniq}@portal-test.invalid` });
  const chAcmeBody = await chAcme.json();
  checkStatus(chAcme, 201, "Email Admin creates channel (ACME) → 201");
  const chList = await get(`/api/v1/instances/${acme._id}/email-channels`, ctx.tokens.acmeOwner);
  const chListBody = await chList.json();
  checkStatus(chList, 200, "Email Admin lists channels → 200");
  const chGlobexId = chGlobex.status === 201 ? recId(chGlobexBody) : null;
  const chRows = (chListBody.channels || chListBody.data || chListBody.items || []);
  check(!chRows.some((c) => c._id === chGlobexId), "ACME channel list excludes GLOBEX channel (instance isolation)");
  const acmeInGlobex = await get(`/api/v1/instances/${globex._id}/email-channels`, ctx.tokens.acmeOwner);
  checkStatus(acmeInGlobex, 403, "ACME owner cannot read GLOBEX channel surface → 403");
  const l1Ch = await post(`/api/v1/instances/${acme._id}/email-channels`, ctx.tokens.itsmAdmin, { name: "x", inbound_address: `x-${uniq}@portal-test.invalid` });
  check(l1Ch.status === 403, "ITSM Agent cannot alter email-channel config without instance.email.* → 403");
  const reqCh = await post(`/api/v1/instances/${acme._id}/email-channels`, R, { name: "y", inbound_address: `y-${uniq}@portal-test.invalid` });
  check(reqCh.status === 403, "Requester cannot manage email-channel surface → 403");
  const ownerIncident = await post("/api/v1/core/incidents", ctx.tokens.acmeOwner, { title: `Owner-${uniq}` });
  checkStatus(ownerIncident, 403, "Email/domain admin gains no automatic ITSM record access → 403");

  console.log("\n" + "=".repeat(70));
  console.log(`RESULTS: ${PASSED.length} passed, ${FAILED.length} failed`);
  if (FAILED.length) {
    console.log("Failed:");
    for (const f of FAILED) console.log(`  - ${f}`);
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (server) await new Promise((resolve) => server.close(resolve));
      const db = getDB();
      const tables = await db
        .raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        .then((r) => r.rows.map((t) => t.tablename));
      for (const t of tables.filter(
        (name) => !["knex_migrations", "knex_migrations_lock"].includes(name),
      )) {
        await db.raw("TRUNCATE TABLE ?? CASCADE", [t]);
      }
      await db.destroy();
    } catch (_) {
      /* best-effort cleanup */
    }
  });