/* eslint-disable no-console */
const connectDB = require("../src/config/db");
const { getDB } = require("../src/config/db");
const app = require("../src/app");
const Company = require("../src/models/Company");
const Agent = require("../src/models/Agent");
const User = require("../src/models/User");
const Department = require("../src/models/Department");
const Team = require("../src/models/Team");
const Ticket = require("../src/models/helpdesk/tickets/Ticket");
const TicketThread = require("../src/models/helpdesk/tickets/TicketThread");
const AuditEvent = require("../src/models/AuditEvent");

const port = 5110;
const base = `http://127.0.0.1:${port}/api/v1`;
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    data: await response.json().catch(() => ({})),
  };
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
};

(async () => {
  let server;
  let coA;
  let coB;
  let owner;
  let deptA1;
  let deptB1;
  let teamA;
  let adminA;
  let agentA1;
  let agentA2;
  let agentB1;
  let agentNoPerm;
  let ticket;
  const suffix = Date.now();
  try {
    await connectDB();
    server = app.listen(port);
    coA = await Company.create({
      name: `Assign A ${suffix}`,
      status: "active",
    });
    coB = await Company.create({
      name: `Assign B ${suffix}`,
      status: "active",
    });
    const now = new Date();
    const db = getDB();
    for (const c of [coA, coB]) {
      await db("tenant_modules")
        .where({ tenant_id: c.id, module_key: "helpdesk" })
        .update({
          status: "active",
          activated_at: now,
          updated_at: now,
          module_key: "helpdesk",
          created_at: now,
        })
        .then(rows => rows.length ? rows : db("tenant_modules").insert({
          tenant_id: c.id,
          module_key: "helpdesk",
          status: "active",
          activated_at: now,
          updated_at: now,
          created_at: now,
        }));
    }
    deptA1 = await Department.create({
      name: `Assign A1 ${suffix}`,
      company_id: coA.id,
    });
    deptB1 = await Department.create({
      name: `Assign B1 ${suffix}`,
      company_id: coB.id,
    });
    teamA = await Team.create({
      name: `Assign TeamA ${suffix}`,
      company_id: coA.id,
      is_active: true,
    });
    owner = await User.create({
      name: "Assign owner",
      email: `asg-owner-${suffix}@osticket.local`,
      password: "Pass@1234",
      company_id: coA.id,
      is_registered: true,
      status: "active",
    });
    const mkAgent = (name, company_id, departments, permissions) =>
      Agent.create({
        name,
        email: `${name.toLowerCase().replace(/\s+/g, "-")}-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id,
        is_active: true,
        departments,
        permissions,
        is_admin: false,
      });
    adminA = await Agent.create({
      name: "Assign admin",
      email: `asg-admin-${suffix}@osticket.local`,
      password: "Pass@1234",
      company_id: coA.id,
      is_admin: true,
      is_active: true,
    });
    agentA1 = await mkAgent(
      "Assign A1",
      coA.id,
      [{ department: deptA1.id, isPrimary: true }],
      ["tickets.assign", "tickets.transfer", "tickets.reply", "tickets.note"],
    );
    agentA2 = await mkAgent(
      "Assign A2",
      coA.id,
      [{ department: deptA1.id, isPrimary: true }],
      [],
    );
    agentB1 = await mkAgent(
      "Assign B1",
      coB.id,
      [{ department: deptB1.id, isPrimary: true }],
      [],
    );
    agentNoPerm = await mkAgent(
      "Assign NoPerm",
      coA.id,
      [{ department: deptA1.id, isPrimary: true }],
      [],
    );
    ticket = await Ticket.create({
      number: `ASG-${suffix}`,
      company_id: coA.id,
      user_id: owner.id,
      dept_id: deptA1.id,
      subject: "Assignment ticket",
      priority: "Normal",
      status: "open",
    });

    const login = async (path, body) => {
      const r = await request("POST", path, { body });
      return r.data.token;
    };
    const tokenA1 = await login("/auth/agent/login", {
      email: agentA1.email,
      password: "Pass@1234",
    });
    const tokenNoPerm = await login("/auth/agent/login", {
      email: agentNoPerm.email,
      password: "Pass@1234",
    });
    const tokenB1 = await login("/auth/agent/login", {
      email: agentB1.email,
      password: "Pass@1234",
    });

    // --- Denial: no permission ---
    const noPermAssign = await request(
      "POST",
      `/agent/tickets/${ticket.number}/assign`,
      { token: tokenNoPerm, body: { agentId: String(agentA2.id) } },
    );
    assert(
      noPermAssign.status === 403,
      "an agent without tickets.assign is denied",
    );
    // cross-tenant agent cannot assign or read the A-ticket at all (403/404)
    const crossTenantAssign = await request(
      "POST",
      `/agent/tickets/${ticket.number}/assign`,
      { token: tokenB1, body: { agentId: String(agentB1.id) } },
    );
    assert(
      [403, 404].includes(crossTenantAssign.status),
      "a B-tenant agent cannot assign the A-ticket",
    );

    // --- Assign in-tenant agent (A1 -> A2) ---
    const assign = await request(
      "POST",
      `/agent/tickets/${ticket.number}/assign`,
      { token: tokenA1, body: { agentId: String(agentA2.id) } },
    );
    assert(assign.status === 200, "scoped agent can assign an in-tenant agent");
    const reloaded = await Ticket.findById(ticket.id);
    assert(
      String(reloaded.agent_id) === String(agentA2.id),
      "ticket is assigned to the target agent",
    );
    assert(reloaded.status === "assigned", "ticket status becomes assigned");
    assert(
      await AuditEvent.exists({
        tenant_id: coA.id,
        action: "ticket.assigned",
        resource_id: ticket.id,
      }),
      "assignment is audit logged",
    );
    assert(
      await TicketThread.exists({ ticket_id: ticket.id, type: "system" }),
      "assignment system-event history is recorded",
    );

    // --- Cross-tenant assign scope denial (assign A-ticket to a B-tenant agent) ---
    const crossTenantTarget = await request(
      "POST",
      `/agent/tickets/${ticket.number}/assign`,
      { token: tokenA1, body: { agentId: String(agentB1.id) } },
    );
    assert(
      [403, 404].includes(crossTenantTarget.status),
      "cannot assign an in-tenant ticket to an out-of-tenant agent",
    );
    const stillA2 = await Ticket.findById(ticket.id);
    assert(
      String(stillA2.agent_id) === String(agentA2.id),
      "ticket assignment unchanged after cross-tenant assign attempt",
    );

    // --- Assignment to team ---
    const toTeam = await request(
      "POST",
      `/agent/tickets/${ticket.number}/assign`,
      { token: tokenA1, body: { teamId: String(teamA.id) } },
    );
    assert(toTeam.status === 200, "scoped agent can assign an in-tenant team");
    const withTeam = await Ticket.findById(ticket.id);
    assert(
      String(withTeam.team_id) === String(teamA.id),
      "ticket is assigned to the target team",
    );

    // --- Claim / takeover ---
    const unassigned = await Ticket.create({
      number: `ASG-CLM-${suffix}`,
      company_id: coA.id,
      user_id: owner.id,
      dept_id: deptA1.id,
      subject: "Claim ticket",
      priority: "Normal",
      status: "open",
    });
    const claim = await request(
      "POST",
      `/agent/tickets/${unassigned.number}/claim`,
      { token: tokenA1 },
    );
    assert(
      claim.status === 200,
      "agent can claim an unassigned in-tenant ticket",
    );
    const claimedTicket = await Ticket.findById(unassigned.id);
    assert(
      String(claimedTicket.agent_id) === String(agentA1.id),
      "claimed ticket is assigned to the claiming agent",
    );
    assert(
      await AuditEvent.exists({
        tenant_id: coA.id,
        action: "ticket.claimed",
        resource_id: unassigned.id,
      }),
      "claim is audit logged",
    );
    const claimTaken = await request(
      "POST",
      `/agent/tickets/${unassigned.number}/claim`,
      {
        token: await login("/auth/agent/login", {
          email: adminA.email,
          password: "Pass@1234",
        }),
      },
    );
    assert(
      claimTaken.status === 409,
      "a second agent cannot take over an already-claimed ticket",
    );

    // --- Assign in-tenant agent A2 -> A1 (reassignment) ---
    const reassign = await request(
      "POST",
      `/agent/tickets/${ticket.number}/assign`,
      { token: tokenA1, body: { agentId: String(agentA1.id) } },
    );
    assert(
      reassign.status === 200,
      "scoped agent can reassign an in-tenant agent",
    );
    assert(
      (await AuditEvent.countDocuments({
        tenant_id: coA.id,
        action: "ticket.assigned",
        resource_id: ticket.id,
      })) >= 2,
      "reassignment appends assignment history",
    );

    // --- Cross-tenant transfer scope denial (A-ticket to B dept) ---
    const crossTransfer = await request(
      "POST",
      `/agent/tickets/${ticket.number}/transfer`,
      { token: tokenA1, body: { deptId: String(deptB1.id) } },
    );
    assert(
      [403, 404].includes(crossTransfer.status),
      "cannot transfer an in-tenant ticket to an out-of-tenant department",
    );
    const stillDeptA = await Ticket.findById(ticket.id);
    assert(
      String(stillDeptA.dept_id) === String(deptA1.id),
      "ticket department unchanged after cross-tenant transfer attempt",
    );

    // --- In-tenant transfer + audit ---
    const transfer = await request(
      "POST",
      `/agent/tickets/${ticket.number}/transfer`,
      { token: tokenA1, body: { deptId: String(deptA1.id) } },
    );
    assert(
      transfer.status === 200,
      "scoped agent can transfer to an in-tenant department",
    );
    assert(
      await AuditEvent.exists({
        tenant_id: coA.id,
        action: "ticket.transferred",
        resource_id: ticket.id,
      }),
      "transfer is audit logged",
    );

    console.log(
      "ITSM-01.04 TICKET ASSIGNMENT / CLAIM / REASSIGNMENT TESTS PASSED",
    );
  } catch (error) {
    console.error(
      "ITSM-01.04 TICKET ASSIGNMENT / CLAIM / REASSIGNMENT TEST FAILED:",
      error.message,
    );
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    const corps = [coA?.id, coB?.id].filter(Boolean);
    if (corps.length) {
      const db = getDB();
      await db("tenant_modules").whereIn("tenant_id", corps).del();
      await db("audit_events").whereIn("tenant_id", corps).del();
      await db("ticket_threads").whereIn("ticket_id", function () {
        this.select("id").from("tickets").whereIn("company_id", corps);
      }).del();
      await db("tickets").whereIn("company_id", corps).del();
      await db("teams").whereIn("company_id", corps).del();
      await db("departments").whereIn("company_id", corps).del();
      await db("users").whereIn("company_id", corps).del();
      await db("agents").whereIn("company_id", corps).del();
      await db("companies").whereIn("id", corps).del();
    }
    await getDB().destroy();
  }
})();
