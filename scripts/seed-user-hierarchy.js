/* eslint-disable no-console */
// Idempotent user-hierarchy seed for the full platform (top level down).
//
// Builds (or refreshes) every level of the hierarchy so you always have
// working logins with known credentials. It NEVER deletes existing data:
// - SuperAdmin: created or password-reset.
// - Agents/Users: found by email, updated in place (password reset to the
//   known value) so logins always work.
//
// Usage:  node scripts/seed-user-hierarchy.js
const mongoose = require("mongoose");
const config = require("../src/config/config");
const SuperAdmin = require("../src/models/SuperAdmin");
const Company = require("../src/models/Company");
const Agent = require("../src/models/Agent");
const Role = require("../src/models/Role");
const Department = require("../src/models/Department");
const Team = require("../src/models/Team");
const Organization = require("../src/models/Organization");
const OrganizationUnit = require("../src/models/OrganizationUnit");
const User = require("../src/models/User");
const HelpTopic = require("../src/models/HelpTopic");

const TENANT_NAME = "Nimbus Technologies";
const TENANT_DOMAIN = "nimbus.osticket.local";

// Modules every tenant gets by default. Helpdesk is the product default, so a
// freshly provisioned tenant (and all of its users) can see the helpdesk UI
// without an admin having to activate anything first.
const DEFAULT_TENANT_MODULES = ["helpdesk", "settings"];

const PLATFORM_OWNER_PERMS = [
  "platform.view_dashboard",
  "platform.view_tenants",
  "platform.view_plans",
  "platform.view_modules",
  "platform.view_operations",
  "platform.view_audit",
  "platform.view_security",
  "platform.view_superadmins",
  "platform.view_platform",
  "platform.view_invoices",
  "platform.manage_dashboard",
  "platform.manage_tenants",
  "platform.manage_plans",
  "platform.manage_modules",
  "platform.manage_operations",
  "platform.manage_audit",
  "platform.manage_security",
  "platform.manage_superadmins",
  "platform.manage_platform",
  "platform.manage_invoices",
  "platform.manage_payments",
  "platform.impersonate",
];

const AGENT_PERMISSIONS = {
  admin: [
    "admin.manage",
    "access.manage",
    "roles.manage",
    "users.manage",
    "tickets.view",
    "tickets.create",
    "tickets.edit",
    "tickets.assign",
    "tickets.transfer",
    "tickets.close",
    "tickets.delete",
    "tickets.reply",
    "tickets.note",
    "tickets.tasks",
    "kb.manage",
    "canned.manage",
    "orgs.manage",
    "escalations.manage",
    "reports.manage",
    "audit.view",
    "modules.manage",
    "organization.manage",
    "organization.units.manage",
  ],
  l1: [
    "tickets.view",
    "tickets.create",
    "tickets.edit",
    "tickets.reply",
    "tickets.note",
    "tickets.close",
    "tickets.tasks",
  ],
  l2: [
    "tickets.view",
    "tickets.create",
    "tickets.edit",
    "tickets.assign",
    "tickets.reply",
    "tickets.note",
    "tickets.close",
    "tickets.tasks",
    "tickets.transfer",
  ],
  l3: [
    "tickets.view",
    "tickets.assign",
    "tickets.transfer",
    "tickets.reply",
    "tickets.note",
    "tickets.close",
    "tickets.tasks",
    "escalations.manage",
    "orgs.manage",
  ],
};

const AGENTS = [
  {
    name: "Arjun Mehta",
    email: "owner@nimbus.osticket.local",
    password: "Owner@123",
    isAdmin: true,
    level: "L3",
    permissions: AGENT_PERMISSIONS.admin,
    dept: "Support",
    team: "Engineering",
    teams: ["Engineering", "TechLead"],
    role: "Administrator",
    isOwner: true,
    skills: ["Software", "Security"],
  },
  {
    name: "Priya Nair",
    email: "admin@nimbus.osticket.local",
    password: "Admin@123",
    isAdmin: true,
    level: "L3",
    permissions: AGENT_PERMISSIONS.admin,
    dept: "Support",
    team: "Engineering",
    teams: ["Engineering", "Networking Helpdesk"],
    role: "Administrator",
    isDeptManager: true,
    skills: ["Software", "Network"],
  },
  {
    name: "Ravi Kumar",
    email: "l1@nimbus.osticket.local",
    password: "Agent@123",
    isAdmin: false,
    level: "L1",
    permissions: AGENT_PERMISSIONS.l1,
    dept: "Support",
    team: "Frontline",
    teams: ["Frontline", "Networking Helpdesk"],
    role: "Support Agent",
    isDeptManager: true,
    skills: ["Network"],
  },
  {
    name: "Sneha Iyer",
    email: "l2@nimbus.osticket.local",
    password: "Agent@123",
    isAdmin: false,
    level: "L2",
    permissions: AGENT_PERMISSIONS.l2,
    dept: "Technical",
    team: "TechLead",
    teams: ["TechLead", "Engineering"],
    role: "Technician",
    skills: ["Hardware", "Software"],
  },
  {
    name: "Vikram Singh",
    email: "l3@nimbus.osticket.local",
    password: "Agent@123",
    isAdmin: false,
    level: "L3",
    permissions: AGENT_PERMISSIONS.l3,
    dept: "Technical",
    team: "Networking Helpdesk",
    teams: ["Networking Helpdesk", "TechLead"],
    role: "Senior Engineer",
    skills: ["Security", "Network"],
  },
  {
    name: "Meera Joshi",
    email: "billing@nimbus.osticket.local",
    password: "Agent@123",
    isAdmin: false,
    level: "L1",
    permissions: AGENT_PERMISSIONS.l1,
    dept: "Billing",
    team: "BillingOps",
    role: "Support Agent",
    isDeptManager: true,
    skills: ["Billing"],
  },
];

// Team leads are data, not code: any team can designate any agent as its lead,
// and the designation title is whatever the tenant calls it (Team Lead,
// Engineering Manager, Network Team Lead, Billing Coordinator, …).
const TEAM_LEADS = {
  Frontline: { agentEmail: "l1@nimbus.osticket.local", leadTitle: "Team Lead" },
  Engineering: {
    agentEmail: "admin@nimbus.osticket.local",
    leadTitle: "Engineering Manager",
  },
  TechLead: {
    agentEmail: "l2@nimbus.osticket.local",
    leadTitle: "Technical Lead",
  },
  "Networking Helpdesk": {
    agentEmail: "l3@nimbus.osticket.local",
    leadTitle: "Network Team Lead",
  },
  BillingOps: {
    agentEmail: "billing@nimbus.osticket.local",
    leadTitle: "Billing Coordinator",
  },
};

// Category -> sub-category help topics. Each sub-category maps to the team
// that owns it so approval routing lands on that team's configured lead.
const HELPDESK_CATEGORIES = [
  {
    category: "Networking",
    dept: "Technical",
    team: "Networking Helpdesk",
    topics: [
      "LAN Cabling",
      "WiFi / Wireless",
      "Switches / Routing",
      "Firewall / Security",
      "VPN / Remote Access",
    ],
  },
  {
    category: "Hardware",
    dept: "Technical",
    team: "TechLead",
    topics: ["Desktops", "Laptops", "Printers", "Peripherals"],
  },
  {
    category: "Software",
    dept: "Support",
    team: "Engineering",
    topics: ["Email / Collaboration", "ERP / CRM", "OS / Drivers"],
  },
  {
    category: "Billing",
    dept: "Billing",
    team: "BillingOps",
    topics: ["Invoices", "Payments", "Refunds / Credits"],
  },
  {
    category: "General",
    dept: "Support",
    team: "Frontline",
    topics: ["Account Access", "Other Requests"],
  },
];

const EMPLOYEES = [
  {
    name: "Amit Verma",
    email: "amit.verma@nimbus.osticket.local",
    password: "Employee@123",
    orgRole: "member",
    dept: "Engineering",
  },
  {
    name: "Neha Gupta",
    email: "neha.gupta@nimbus.osticket.local",
    password: "Employee@123",
    orgRole: "manager",
    dept: "Marketing",
  },
  {
    name: "Karan Patel",
    email: "karan.patel@nimbus.osticket.local",
    password: "Employee@123",
    orgRole: "member",
    dept: "Sales",
  },
];

// External customer org + end users (Level 4 – customer side)
const EXTERNAL_ORG = {
  name: "Acme Global",
  domain: "acmeglobal.com",
  tier: "enterprise",
};
const CUSTOMER_USER_PERMISSIONS = [
  "ticket_create",
  "ticket_view",
  "ticket_reply",
  "ticket_delete",
];
const EXTERNAL_USERS = [
  {
    name: "David Wilson",
    email: "david@acmeglobal.com",
    password: "Customer@123",
    orgRole: "manager",
    permissions: CUSTOMER_USER_PERMISSIONS,
  },
  {
    name: "Emily Chen",
    email: "emily@acmeglobal.com",
    password: "Customer@123",
    orgRole: "member",
    permissions: CUSTOMER_USER_PERMISSIONS,
  },
];

const upsertUser = async ({ name, email, password, company, extra = {} }) => {
  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    user = await User.create({ name, email, password, company, ...extra });
  } else {
    Object.assign(user, { name, password, company, ...extra });
    user.markModified("password");
    await user.save();
  }
  return user;
};

const upsertSuperAdmin = async ({
  name,
  email,
  password,
  platformRole,
  permissions,
}) => {
  let sa = await SuperAdmin.findOne({ email: email.toLowerCase() });
  if (!sa) {
    sa = await SuperAdmin.create({
      name,
      email,
      password,
      role: "super_admin",
      platformRole,
      permissions,
      isActive: true,
      moduleKeys: [
        "helpdesk",
        "crm",
        "csm",
        "itam",
        "itom",
        "projects",
        "hr",
        "field-service",
        "workflow",
        "analytics",
        "ai",
        "settings",
      ],
    });
  } else {
    Object.assign(sa, {
      name,
      password,
      platformRole,
      permissions,
      role: "super_admin",
      isActive: true,
    });
    sa.markModified("password");
    await sa.save();
  }
  return sa;
};

const findOrCreate = async (Model, query, data) => {
  const doc = await Model.findOne(query);
  return doc ? doc : Model.create(data);
};

const run = async () => {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log(`Connected to MongoDB: ${config.mongoUri}`);

  const results = {
    superAdmins: [],
    agents: [],
    employees: [],
    externalUsers: [],
    orgStructure: [],
  };

  // ---------------- Level 0: SaaS platform ----------------
  const saOwner = await upsertSuperAdmin({
    name: "Platform Super Admin",
    email: "superadmin@osticket.local",
    password: "SuperAdmin@123",
    platformRole: "platform_owner",
    permissions: PLATFORM_OWNER_PERMS,
  });
  results.superAdmins.push({
    id: String(saOwner._id),
    name: saOwner.name,
    email: saOwner.email,
    password: "SuperAdmin@123",
    platformRole: "platform_owner",
  });

  const saRoot = await upsertSuperAdmin({
    name: "Platform Owner (root)",
    email: "root@platform.local",
    password: "Platform@123",
    platformRole: "platform_owner",
    permissions: PLATFORM_OWNER_PERMS,
  });
  results.superAdmins.push({
    id: String(saRoot._id),
    name: saRoot.name,
    email: saRoot.email,
    password: "Platform@123",
    platformRole: "platform_owner",
  });

  // ---------------- Tenant: Nimbus Technologies ----------------
  let company = await Company.findOne({ domain: TENANT_DOMAIN });
  if (!company) {
    company = await Company.create({
      name: TENANT_NAME,
      email: "support@" + TENANT_DOMAIN,
      supportEmail: "help@" + TENANT_DOMAIN,
      domain: TENANT_DOMAIN,
      status: "active",
      billingCycle: "monthly",
    });
    console.log(`Created tenant: ${company.name} (${company._id})`);
  } else {
    company.status = "active";
    await company.save();
  }

  // Activate default modules (helpdesk first) so every user of the tenant
  // sees helpdesk in the sidebar by default.
  const db = mongoose.connection.db;
  const tenantObjectId = company._id;
  const now = new Date();
  for (const key of DEFAULT_TENANT_MODULES) {
    await db
      .collection("tenant_modules")
      .updateOne(
        { tenantId: tenantObjectId, moduleKey: key },
        {
          $set: { status: "active", activatedAt: now, updatedAt: now },
          $setOnInsert: {
            tenantId: tenantObjectId,
            moduleKey: key,
            createdAt: now,
          },
        },
        { upsert: true },
      );
  }

  // ---------------- Role / Department / Team catalog ----------------
  const roles = {};
  for (const r of [
    {
      name: "Administrator",
      isAdmin: true,
      permissions: AGENT_PERMISSIONS.admin,
    },
    {
      name: "Support Agent",
      isAdmin: false,
      permissions: AGENT_PERMISSIONS.l1,
    },
    { name: "Technician", isAdmin: false, permissions: AGENT_PERMISSIONS.l2 },
    {
      name: "Senior Engineer",
      isAdmin: false,
      permissions: AGENT_PERMISSIONS.l3,
    },
  ]) {
    roles[r.name] = await findOrCreate(
      Role,
      { company: company._id, name: r.name },
      { ...r, company: company._id, scope: "tenant" },
    );
  }

  const depts = {};
  for (const d of ["Support", "Billing", "Technical", "Sales"]) {
    depts[d] = await findOrCreate(
      Department,
      { company: company._id, name: d },
      { name: d, company: company._id, isPublic: true },
    );
  }

  const teams = {};
  for (const t of [
    "Frontline",
    "Engineering",
    "TechLead",
    "BillingOps",
    "Networking Helpdesk",
  ]) {
    teams[t] = await findOrCreate(
      Team,
      { company: company._id, name: t },
      { name: t, company: company._id },
    );
  }

  // Org tree: Division -> Departments (OrganizationUnit hierarchy)
  const divCore = await findOrCreate(
    OrganizationUnit,
    { company: company._id, name: "Core Operations" },
    { company: company._id, type: "division", name: "Core Operations" },
  );
  for (const [name, type] of [
    ["Support", "department"],
    ["Engineering", "team"],
    ["Knowledge", "team"],
  ]) {
    await findOrCreate(
      OrganizationUnit,
      { company: company._id, parent: divCore._id, name },
      { company: company._id, parent: divCore._id, type, name },
    );
    results.orgStructure.push(`${type}:${name} -> division:Core Operations`);
  }

  // ---------------- Level 1-3: company agents ----------------
  for (const a of AGENTS) {
    const role = roles[a.role];
    const d = depts[a.dept];
    const t = teams[a.team];
    const teamIds = (a.teams || (t ? [a.team] : [])).map((nm) => {
      if (!teams[nm]) throw new Error(`Unknown team in seed: ${nm}`);
      return teams[nm]._id;
    });
    let agent = await Agent.findOne({ email: a.email.toLowerCase() });
    if (!agent) {
      agent = await Agent.create({
        name: a.name,
        email: a.email,
        password: a.password,
        company: company._id,
        isAdmin: a.isAdmin,
        isActive: true,
        level: a.level,
        role: role ? role._id : null,
        permissions: a.permissions,
        departments: [{ department: d ? d._id : null, isPrimary: true }],
        teams: teamIds,
      });
    } else {
      Object.assign(agent, {
        name: a.name,
        password: a.password,
        company: company._id,
        isAdmin: a.isAdmin,
        isActive: true,
        level: a.level,
        role: role ? role._id : null,
        permissions: a.permissions,
        departments: [{ department: d ? d._id : null, isPrimary: true }],
        teams: teamIds,
      });
      agent.markModified("password");
      await agent.save();
    }
    if (a.isOwner) company.ownerId = agent._id;
    if (a.isDeptManager && d) {
      d.manager = agent._id;
      await d.save();
    }
    results.agents.push({
      id: String(agent._id),
      name: agent.name,
      email: agent.email,
      password: a.password,
      level: a.level,
      isAdmin: agent.isAdmin,
      role: a.role,
    });
  }

  // Team leads + memberships: designated by data (TEAM_LEADS), never hardcoded.
  const agentsByEmail = new Map(results.agents.map((a) => [a.email, a]));
  for (const [teamName, cfg] of Object.entries(TEAM_LEADS)) {
    const team = teams[teamName];
    if (!team) continue;
    const leadAgent = await Agent.findOne({
      email: cfg.agentEmail.toLowerCase(),
    });
    if (leadAgent) {
      team.lead = leadAgent._id;
      team.leadTitle = cfg.leadTitle;
      team.members = team.members || [];
      if (!team.members.some((m) => String(m) === String(leadAgent._id)))
        team.members.push(leadAgent._id);
    }
    await team.save();
  }

  // Fill every department-manager seat so each Level 2 node has a person.
  // Explicit mapping (email -> dept) is authoritative; the isDeptManager flag
  // above is only a seed-time hint for backward compat.
  const DEPT_MANAGERS = {
    Support: "l1@nimbus.osticket.local",
    Technical: "admin@nimbus.osticket.local",
    Billing: "billing@nimbus.osticket.local",
    Sales: "billing@nimbus.osticket.local",
  };
  for (const [deptName, mgrEmail] of Object.entries(DEPT_MANAGERS)) {
    const dept = depts[deptName];
    const mgr = await Agent.findOne({ email: mgrEmail });
    if (dept && mgr) {
      dept.manager = mgr._id;
      await dept.save();
    }
  }

  // Help topic categories + sub-categories routed to their owning team.
  for (const cat of HELPDESK_CATEGORIES) {
    const dept = depts[cat.dept];
    const team = teams[cat.team];
    const parent = await findOrCreate(
      HelpTopic,
      { company: company._id, topic: cat.category },
      {
        topic: cat.category,
        category: cat.category,
        company: company._id,
        department: dept ? dept._id : null,
        autoAssignTeam: team ? team._id : null,
        isPublic: true,
        status: "active",
        notes: `Category: ${cat.category}`,
      },
    );
    parent.department = dept ? dept._id : null;
    parent.autoAssignTeam = team ? team._id : null;
    parent.status = "active";
    parent.isPublic = true;
    await parent.save();
    for (const sub of cat.topics) {
      await findOrCreate(
        HelpTopic,
        { company: company._id, topic: sub },
        {
          topic: sub,
          category: cat.category,
          company: company._id,
          parent: parent._id,
          department: dept ? dept._id : null,
          autoAssignTeam: team ? team._id : null,
          isPublic: true,
          status: "active",
        },
      );
    }
  }
  console.log(
    "Help topics seeded: categories -> owning team (autoAssignTeam).",
  );
  await company.save();
  console.log("Org tree + agents seeded.");

  // ---------------- Level 4: employees ----------------
  for (const e of EMPLOYEES) {
    const u = await upsertUser({
      ...e,
      company: company._id,
      extra: {
        status: "active",
        isRegistered: true,
        emailConfirmed: true,
        userType: "employee",
      },
    });
    results.employees.push({
      id: String(u._id),
      name: u.name,
      email: u.email,
      password: e.password,
      userType: "employee",
    });
  }

  // ---------------- Level 4: external customer org ----------------
  let org = await Organization.findOne({
    company: company._id,
    name: EXTERNAL_ORG.name,
  });
  if (!org) {
    org = await Organization.create({
      company: company._id,
      name: EXTERNAL_ORG.name,
      domain: EXTERNAL_ORG.domain,
      tier: EXTERNAL_ORG.tier,
      status: "active",
    });
  }
  const externalIds = {};
  let orgManagerUserId = null;
  for (const eu of EXTERNAL_USERS) {
    const extra = {
      status: "active",
      isRegistered: true,
      emailConfirmed: true,
      userType: "external",
      organization: org._id,
      orgRole: eu.orgRole,
      permissions: eu.permissions || [],
    };
    // Members are sub-users of the org manager (createdBy), so their tickets
    // are owned by the org owner and the manager can review/approve them.
    if (eu.orgRole === "member" && orgManagerUserId)
      extra.createdBy = orgManagerUserId;
    const u = await upsertUser({ ...eu, company: company._id, extra });
    externalIds[eu.email] = u;
    if (eu.orgRole === "manager") orgManagerUserId = u._id;
    results.externalUsers.push({
      id: String(u._id),
      name: u.name,
      email: u.email,
      password: eu.password,
      orgRole: eu.orgRole,
      org: org.name,
    });
  }
  // Org manager -> accountManager
  const orgManager = await User.findOne({ email: EXTERNAL_USERS[0].email });
  org.accountManager = orgManager ? orgManager._id : org.accountManager;
  await org.save();

  console.log("");
  console.log("============================================================");
  console.log("USER HIERARCHY SEEDED — credentials");
  console.log("============================================================");
  const line = (x) =>
    console.log(`  ${String(x).padEnd(44)} ${String(x[0]).padEnd(24)} ${x[1]}`);
  const roleOf = (x) => x.role || x.orgRole || x.platformRole || "user";

  console.log("\n[SUPER ADMINS]");
  for (const s of results.superAdmins)
    console.log(
      `  ID ${s.id}\n    ${s.name}  (platform_owner)\n    email: ${s.email}\n    password: ${s.password}\n    role: ${s.platformRole}`,
    );

  console.log("\n[AGENTS / ENGINEERS]");
  for (const a of results.agents)
    console.log(
      `  ID ${a.id}\n    ${a.name}  (${a.level}${a.isAdmin ? " · admin" : ""})\n    email: ${a.email}\n    password: ${a.password}\n    role: ${a.role}`,
    );

  console.log("\n[EMPLOYEES]");
  for (const e of results.employees)
    console.log(
      `  ID ${e.id}\n    ${e.name}\n    email: ${e.email}\n    password: ${e.password}\n    userType: employee`,
    );

  console.log("\n[EXTERNAL CUSTOMERS]");
  for (const e of results.externalUsers)
    console.log(
      `  ID ${e.id}\n    ${e.name}\n    email: ${e.email}\n    password: ${e.password}\n    orgRole: ${e.orgRole} (${e.org})`,
    );

  console.log("\n[TEAMS & LEADS]");
  const agentNameById = new Map(results.agents.map((a) => [a.id, a.name]));
  for (const name of Object.keys(teams)) {
    const t = teams[name];
    const leadName = t.lead
      ? agentNameById.get(String(t.lead)) || String(t.lead)
      : "Unassigned";
    console.log(
      `  ${name.padEnd(20)} ${String(t.leadTitle || "Team Lead").padEnd(22)} ${leadName}`,
    );
  }

  console.log("\n[HELP TOPICS]");
  for (const cat of HELPDESK_CATEGORIES) {
    console.log(
      `  ${cat.category} -> ${cat.dept} / ${cat.team}  [${cat.topics.join(", ")}]`,
    );
  }

  console.log("\nTenant:", company.name, `(${company._id})`);
  console.log("============================================================");
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
