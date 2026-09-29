/* eslint-disable no-console */
const crypto = require("crypto");
const connectDB = require("./src/config/db");
const { getDB } = require("./src/config/db");
const app = require("./src/app");

const Company = require("./src/models/Company");
const User = require("./src/models/User");
const Agent = require("./src/models/Agent");
const Department = require("./src/models/Department");
const Team = require("./src/models/Team");
const Role = require("./src/models/Role");
const Ticket = require("./src/models/helpdesk/tickets/Ticket");
const TicketThread = require("./src/models/helpdesk/tickets/TicketThread");
const OrganizationUnit = require("./src/models/OrganizationUnit");
const OrganizationUnitLabel = require("./src/models/OrganizationUnitLabel");
const InstanceInvitation = require("./src/models/InstanceInvitation");
const HelpTopic = require("./src/models/HelpTopic");
const SlaPlan = require("./src/models/SlaPlan");
const CustomField = require("./src/models/CustomField");
const KnowledgeBase = require("./src/models/helpdesk/knowledge/KnowledgeBase");
const CannedResponse = require("./src/models/helpdesk/knowledge/CannedResponse");
const SuperAdmin = require("./src/models/SuperAdmin");

const port = 5105;
const base = `http://127.0.0.1:${port}/api/v1`;
let server;

const request = async (method, path, { token, body, headers = {} } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    data: await response.json().catch(() => ({})),
    headers: Object.fromEntries(response.headers.entries()),
  };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`✓ PASS ${message}`);
};

(async () => {
  try {
    await connectDB();
    server = app.listen(port);
    console.log(`\n=== API Test Server started on port ${port} ===\n`);

    // ============================================================
    // SETUP: Create full hierarchy (SuperAdmin → Company → Dept → Agent/User)
    // ============================================================
    console.log("=== SETUP: Creating hierarchy ===");
    
    const suffix = Date.now();
    const password = "Test@1234";
    
    // Super Admin User (for company instance_owner reference)
    const superAdminUser = await User.create({
      name: "Super Admin",
      email: `superadmin-${suffix}@example.invalid`,
      password,
      is_registered: true,
      email_confirmed: true,
      user_type: "employee",
      status: "active",
      permissions: ["*"],
    });
    
    // Super Admin for platform login
    const superAdminPlatform = await SuperAdmin.create({
      name: "Super Admin",
      email: `superadmin-${suffix}@example.invalid`,
      password,
      isActive: true,
      platformRole: "platform_owner",
      permissions: ["*"],
    });
    
    // Super Admin Company
    const superAdmin = await Company.create({
      name: `SuperAdmin ${suffix}`,
      domain: `superadmin-${suffix}.example.invalid`,
      status: "active",
      is_instance: true,
      instance_owner: superAdminUser.id,
    });
    
    // Platform Company (Tenant)
    const tenant = await Company.create({
      name: `Tenant ${suffix}`,
      domain: `tenant-${suffix}.example.invalid`,
      status: "active",
      is_instance: true,
      instance_owner: superAdminUser.id,
    });
    
    // Activate helpdesk module for tenant
    const { getDB } = require("./src/config/db");
    const now = new Date();
    await getDB()("tenant_modules").insert({
      tenant_id: tenant.id,
      module_key: "helpdesk",
      status: "active",
      activated_at: now,
      updated_at: now,
      created_at: now,
    }).onConflict(["tenant_id", "module_key"]).merge({
      status: "active",
      activated_at: now,
      updated_at: now,
    });
    
    // Tenant Admin User (as Agent for agent login)
    const tenantAdmin = await Agent.create({
      name: "Tenant Admin",
      email: `tenantadmin-${suffix}@example.invalid`,
      password,
      company_id: tenant.id,
      is_active: true,
      is_admin: true,
      instance_memberships: [{ instance: tenant.id, role: "instance_owner", status: "active", joinedAt: new Date() }],
    });
    
    // Agent User
    const agent = await Agent.create({
      name: "Test Agent",
      email: `agent-${suffix}@example.invalid`,
      password,
      company_id: tenant.id,
      is_active: true,
      is_admin: false,
    });
    
    // Requester User
    const requester = await User.create({
      name: "Test Requester",
      email: `requester-${suffix}@example.invalid`,
      password,
      company_id: tenant.id,
      is_registered: true,
      email_confirmed: true,
      user_type: "external",
      status: "active",
    });
    
    // Department
    const dept = await Department.create({
      name: "IT Support",
      company_id: tenant.id,
      is_active: true,
    });
    
    // Team
    const team = await Team.create({
      name: "Support Team",
      company_id: tenant.id,
      members: [agent.id],
    });
    
    // SLA Plan
    const sla = await SlaPlan.create({
      name: "Standard SLA",
      company_id: tenant.id,
      grace_period: 300,
    });
    
    // Help Topic
    const topic = await HelpTopic.create({
      name: "Technical Support",
      company_id: tenant.id,
      is_active: true,
    });
    
    // Ticket
    const ticket = await Ticket.create({
      number: `HD-${suffix}`,
      company_id: tenant.id,
      user_id: requester.id,
      dept_id: dept.id,
      topic_id: topic.id,
      sla_id: sla.id,
      subject: "Test Ticket",
      priority: "Normal",
      status: "open",
    });
    
    // Organization Units
    const orgUnit = await OrganizationUnit.create({
      company_id: tenant.id,
      name: "IT Department",
      type: "department",
    });
    
    await OrganizationUnitLabel.create({
      company_id: tenant.id,
      type: "department",
      label: "Department",
    });
    
    // Ensure primary company exists
    const InstanceCompany = require("./src/models/InstanceCompany");
    const createdPrimaryCompany = await InstanceCompany.create({
      tenantId: tenant.id,
      name: tenant.name,
      nameKey: tenant.name.toLowerCase().replace(/\s+/g, " "),
      domain: tenant.domain,
      email: tenant.email || "",
      isPrimary: true,
      ownerUser: superAdminUser.id,
    });
    console.log("Primary company created:", createdPrimaryCompany.id);
    
    // Invitation
    const invitation = await InstanceInvitation.create({
      instance: tenant.id,
      email: `invitee-${suffix}@example.invalid`,
      role: "agent",
      tokenHash: crypto.createHash("sha256").update(`testtoken-${suffix}`).digest("hex"),
      expiresAt: new Date(Date.now() + 86400000),
      invitedBy: superAdminUser.id,
    });
    
    console.log("✓ Hierarchy created\n");
    
    // ============================================================
    // LOGIN & TOKENS
    // ============================================================
    console.log("=== AUTHENTICATION ===");
    
    const superAdminLogin = await request("POST", "/auth/portal-login", {
      body: { email: superAdminPlatform.email, password },
    });
    assert(superAdminLogin.status === 200, "SuperAdmin login");
    const superAdminToken = superAdminLogin.data.token;
    
    const tenantLogin = await request("POST", "/auth/agent/login", {
      body: { email: tenantAdmin.email, password },
    });
    assert(tenantLogin.status === 200, "TenantAdmin login");
    const tenantToken = tenantLogin.data.token;
    
    const agentLogin = await request("POST", "/auth/agent/login", {
      body: { email: agent.email, password },
    });
    assert(agentLogin.status === 200, "Agent login");
    const agentToken = agentLogin.data.token;
    
    const requesterLogin = await request("POST", "/auth/portal-login", {
      body: { email: requester.email, password },
    });
    assert(requesterLogin.status === 200, "Requester login");
    const requesterToken = requesterLogin.data.token;
    
    console.log("✓ All users logged in\n");
    
    // ============================================================
    // AUTH APIs
    // ============================================================
    console.log("=== AUTH APIs ===");
    
    const me = await request("GET", "/auth/me", { token: tenantToken });
    assert(me.status === 200, "GET /auth/me");
    
    console.log("✓ Auth APIs\n");
    
    // ============================================================
    // COMPANY / INSTANCE APIs
    // ============================================================
    console.log("=== COMPANY / INSTANCE APIs ===");
    
    const myInstances = await request("GET", "/instances/my-instances", { token: tenantToken });
    assert(myInstances.status === 200, "GET /instances/my-instances");
    
    const companies = await request("GET", `/instances/${tenant.id}/companies`, { token: tenantToken });
    assert(companies.status === 200, "GET /instances/:id/companies");
    
    // Get primary company
    const primaryCompany = companies.data.items.find(c => c.isPrimary);
    assert(primaryCompany, "Primary company exists");
    
    const company = await request("GET", `/instances/${tenant.id}/companies/${primaryCompany.id}`, { token: tenantToken });
    assert(company.status === 200, "GET /instances/:id/companies/:id");
    
    const updateCompany = await request("PUT", `/instances/${tenant.id}/companies/${primaryCompany.id}`, {
      token: tenantToken,
      body: { name: `Updated Tenant ${suffix}` },
    });
    assert(updateCompany.status === 200, "PUT /instances/:id/companies/:id");
    
    console.log("✓ Company/Instance APIs\n");
    
    // ============================================================
    // DEPARTMENT APIs
    // ============================================================
    console.log("=== DEPARTMENT APIs ===");
    
    const departments = await request("GET", `/instances/${tenant.id}/departments`, { token: tenantToken });
    assert(departments.status === 200, "GET /instances/:id/departments");
    
    const newDept = await request("POST", `/instances/${tenant.id}/departments`, {
      token: tenantToken,
      body: { name: "Engineering", status: "active" },
    });
    assert(newDept.status === 201, "POST /instances/:id/departments");
    const newDeptId = newDept.data.item.id;
    
    const getDept = await request("GET", `/instances/${tenant.id}/departments/${newDeptId}`, { token: tenantToken });
    assert(getDept.status === 200, "GET /instances/:id/departments/:id");
    
    const updateDept = await request("PUT", `/instances/${tenant.id}/departments/${newDeptId}`, {
      token: tenantToken,
      body: { name: "Engineering Team", status: "active" },
    });
    assert(updateDept.status === 200, "PUT /instances/:id/departments/:id");
    
    const deleteDept = await request("DELETE", `/instances/${tenant.id}/departments/${newDeptId}`, { token: tenantToken });
    assert(deleteDept.status === 200, "DELETE /instances/:id/departments/:id");
    
    console.log("✓ Department APIs\n");
    
    // ============================================================
    // TEAM APIs
    // ============================================================
    console.log("=== TEAM APIs ===");
    
    const teams = await request("GET", `/instances/${tenant.id}/teams`, { token: tenantToken });
    assert(teams.status === 200, "GET /instances/:id/teams");
    
    const newTeam = await request("POST", `/instances/${tenant.id}/teams`, {
      token: tenantToken,
      body: { name: "DevOps Team", members: [agent.id] },
    });
    assert(newTeam.status === 201, "POST /instances/:id/teams");
    
    console.log("✓ Team APIs\n");
    
    // ============================================================
    // ROLE APIs
    // ============================================================
    console.log("=== ROLE APIs ===");
    
    const roles = await request("GET", `/instances/${tenant.id}/roles`, { token: tenantToken });
    assert(roles.status === 200, "GET /instances/:id/roles");
    
    console.log("✓ Role APIs\n");
    
    // ============================================================
    // AGENT APIs
    // ============================================================
    console.log("=== AGENT APIs ===");
    
    const agents = await request("GET", `/instances/${tenant.id}/agents`, { token: tenantToken });
    assert(agents.status === 200, "GET /instances/:id/agents");
    
    const agentProfile = await request("GET", `/auth/agent/me`, { token: agentToken });
    assert(agentProfile.status === 200, "GET /auth/agent/me");
    
    console.log("✓ Agent APIs\n");
    
    // ============================================================
    // USER APIs (Customer Portal)
    // ============================================================
    console.log("=== USER PORTAL APIs ===");
    
    const userProfile = await request("GET", "/auth/me", { token: requesterToken });
    assert(userProfile.status === 200, "GET /auth/me");
    
    const userTickets = await request("GET", "/tickets", { token: requesterToken });
    assert(userTickets.status === 200, "GET /tickets");
    
    console.log("✓ User Portal APIs\n");
    
    // ============================================================
    // TICKET APIs (Helpdesk)
    // ============================================================
    console.log("=== TICKET APIs ===");
    
    // Agent ticket operations
    const agentTickets = await request("GET", `/agent/tickets`, { token: agentToken });
    assert(agentTickets.status === 200, "GET /agent/tickets");
    
    const agentTicket = await request("GET", `/agent/tickets/${ticket.number}`, { token: agentToken });
    assert(agentTicket.status === 200, "GET /agent/tickets/:number");
    
    const reply = await request("POST", `/agent/tickets/${ticket.number}/reply`, {
      token: agentToken,
      body: { message: "Agent reply", isInternal: false },
    });
    assert(reply.status === 200, "POST /agent/tickets/:number/reply");
    
    const note = await request("POST", `/agent/tickets/${ticket.number}/note`, {
      token: agentToken,
      body: { message: "Internal note", isInternal: true },
    });
    assert(note.status === 200, "POST /agent/tickets/:number/note");
    
    const assign = await request("POST", `/agent/tickets/${ticket.number}/assign`, {
      token: agentToken,
      body: { agentId: agent.id },
    });
    assert(assign.status === 200, "POST /agent/tickets/:number/assign");
    
    const statusChange = await request("POST", `/agent/tickets/${ticket.number}/status`, {
      token: agentToken,
      body: { status: "in_progress" },
    });
    assert(statusChange.status === 200, "POST /agent/tickets/:number/status");
    
    // Customer ticket operations
    const myTicket = await request("GET", `/tickets/${ticket.number}`, { token: requesterToken });
    assert(myTicket.status === 200, "GET /tickets/:number");
    
    const customerReply = await request("POST", `/tickets/${ticket.number}/reply`, {
      token: requesterToken,
      body: { message: "Customer reply" },
    });
    assert(customerReply.status === 200, "POST /tickets/:number/reply");
    
    console.log("✓ Ticket APIs\n");
    
    // ============================================================
    // SLA APIs
    // ============================================================
    console.log("=== SLA APIs ===");
    
    const slas = await request("GET", `/instances/${tenant.id}/sla-plans`, { token: tenantToken });
    assert(slas.status === 200, "GET /instances/:id/sla-plans");
    
    console.log("✓ SLA APIs\n");
    
    // ============================================================
    // HELP TOPIC APIs
    // ============================================================
    console.log("=== HELP TOPIC APIs ===");
    
    const topics = await request("GET", `/instances/${tenant.id}/help-topics`, { token: tenantToken });
    assert(topics.status === 200, "GET /instances/:id/help-topics");
    
    console.log("✓ Help Topic APIs\n");
    
    // ============================================================
    // ORGANIZATION UNIT APIs
    // ============================================================
    console.log("=== ORGANIZATION UNIT APIs ===");
    
    const orgUnits = await request("GET", `/instances/${tenant.id}/organization-units`, { token: tenantToken });
    assert(orgUnits.status === 200, "GET /instances/:id/organization-units");
    
    const orgUnitTypes = await request("GET", `/instances/${tenant.id}/organization-unit-types`, { token: tenantToken });
    assert(orgUnitTypes.status === 200, "GET /instances/:id/organization-unit-types");
    
    const newOrgUnit = await request("POST", `/instances/${tenant.id}/organization-units`, {
      token: tenantToken,
      body: { name: "Dev Team", type: "team", parent: orgUnit.id },
    });
    assert(newOrgUnit.status === 201, "POST /instances/:id/organization-units");
    
    console.log("✓ Organization Unit APIs\n");
    
    // ============================================================
    // KNOWLEDGE BASE APIs
    // ============================================================
    console.log("=== KNOWLEDGE BASE APIs ===");
    
    const articles = await request("GET", `/instances/${tenant.id}/knowledge/articles`, { token: tenantToken });
    assert(articles.status === 200, "GET /instances/:id/knowledge/articles");
    
    const canned = await request("GET", `/instances/${tenant.id}/canned-responses`, { token: tenantToken });
    assert(canned.status === 200, "GET /instances/:id/canned-responses");
    
    console.log("✓ Knowledge Base APIs\n");
    
    // ============================================================
    // INVITATION APIs
    // ============================================================
    console.log("=== INVITATION APIs ===");
    
    const invitations = await request("GET", `/instances/${tenant.id}/invitations`, { token: tenantToken });
    assert(invitations.status === 200, "GET /instances/:id/invitations");
    
    console.log("✓ Invitation APIs\n");
    
    // ============================================================
    // TASK APIs
    // ============================================================
    console.log("=== TASK APIs ===");
    
    const tasks = await request("GET", `/instances/${tenant.id}/tasks`, { token: agentToken });
    assert(tasks.status === 200, "GET /instances/:id/tasks");
    
    console.log("✓ Task APIs\n");
    
    // ============================================================
    // RBAC / PERMISSION APIs
    // ============================================================
    console.log("=== RBAC / PERMISSION APIs ===");
    
    const permissions = await request("GET", `/instances/${tenant.id}/permission-options?q=incident`, { token: tenantToken });
    assert(permissions.status === 200, "GET /instances/:id/permission-options");
    
    console.log("✓ RBAC APIs\n");
    
    // ============================================================
    // AUDIT / ACTIVITY APIs
    // ============================================================
    console.log("=== AUDIT / ACTIVITY APIs ===");
    
    const audit = await request("GET", `/instances/${tenant.id}/audit`, { token: tenantToken });
    assert(audit.status === 200, "GET /instances/:id/audit");
    
    console.log("✓ Audit APIs\n");
    
    // ============================================================
    // REPORTING APIs
    // ============================================================
    console.log("=== REPORTING APIs ===");
    
    const reports = await request("GET", `/instances/${tenant.id}/reports/dashboard`, { token: tenantToken });
    assert(reports.status === 200, "GET /instances/:id/reports/dashboard");
    
    console.log("✓ Reporting APIs\n");
    
    // ============================================================
    // WORKFLOW APIs
    // ============================================================
    console.log("=== WORKFLOW APIs ===");
    
    const workflows = await request("GET", `/instances/${tenant.id}/workflows`, { token: tenantToken });
    assert(workflows.status === 200, "GET /instances/:id/workflows");
    
    console.log("✓ Workflow APIs\n");
    
    // ============================================================
    // CUSTOM FIELD APIs
    // ============================================================
    console.log("=== CUSTOM FIELD APIs ===");
    
    const fields = await request("GET", `/instances/${tenant.id}/custom-fields`, { token: tenantToken });
    assert(fields.status === 200, "GET /instances/:id/custom-fields");
    
    console.log("✓ Custom Field APIs\n");
    
    // ============================================================
    // EMAIL TEMPLATE APIs
    // ============================================================
    console.log("=== EMAIL TEMPLATE APIs ===");
    
    const templates = await request("GET", `/instances/${tenant.id}/email-templates`, { token: tenantToken });
    assert(templates.status === 200, "GET /instances/:id/email-templates");
    
    console.log("✓ Email Template APIs\n");
    
    // ============================================================
    // ANNOUNCEMENT APIs
    // ============================================================
    console.log("=== ANNOUNCEMENT APIs ===");
    
    const announcements = await request("GET", `/instances/${tenant.id}/announcements`, { token: tenantToken });
    assert(announcements.status === 200, "GET /instances/:id/announcements");
    
    console.log("✓ Announcement APIs\n");
    
    // ============================================================
    // CLEANUP
    // ============================================================
    console.log("=== CLEANUP ===");
    await server.close();
    console.log("\n=== ALL API TESTS PASSED ===");
    process.exit(0);
    
  } catch (e) {
    console.error("\n✗ TEST FAILED:", e.message);
    console.error(e.stack);
    if (server) await server.close();
    process.exit(1);
  }
})();