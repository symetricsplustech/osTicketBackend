/* eslint-disable no-console */
const connectDB = require("../src/config/db");
const { getDB } = require("../src/config/db");
const app = require("../src/app");
const Company = require("../src/models/Company");
const Agent = require("../src/models/Agent");
const User = require("../src/models/User");
const Department = require("../src/models/Department");
const Ticket = require("../src/models/helpdesk/tickets/Ticket");
const TicketThread = require("../src/models/helpdesk/tickets/TicketThread");

const port = 5108;
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
  let owner1;
  let owner2;
  let emp;
  let adminA;
  let agentA;
  let agentOtherDept;
  let agentB;
  const suffix = Date.now();
  try {
    await connectDB();
    server = app.listen(port);
    [coA, coB] = await Promise.all([
      Company.create({ name: `Read A ${suffix}`, status: "active" }),
      Company.create({ name: `Read B ${suffix}`, status: "active" }),
    ]);
    const db = getDB();
    const now = new Date();
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
    const [deptA1, deptA2, deptB] = await Promise.all([
      Department.create({ name: `Read A1 ${suffix}`, company_id: coA.id }),
      Department.create({ name: `Read A2 ${suffix}`, company_id: coA.id }),
      Department.create({ name: `Read B ${suffix}`, company_id: coB.id }),
    ]);
    [owner1, owner2, emp] = await Promise.all([
      User.create({
        name: "Read owner 1",
        email: `read-owner1-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: coA.id,
        is_registered: true,
        status: "active",
      }),
      User.create({
        name: "Read owner 2",
        email: `read-owner2-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: coA.id,
        is_registered: true,
        status: "active",
      }),
      User.create({
        name: "Read emp",
        email: `read-emp-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: coB.id,
        is_registered: true,
        status: "active",
      }),
    ]);
    [adminA, agentA, agentOtherDept, agentB] = await Promise.all([
      Agent.create({
        name: "Read admin A",
        email: `read-admina-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: coA.id,
        is_admin: true,
        is_active: true,
        departments: [{ department: deptA1.id, isPrimary: true }],
      }),
      Agent.create({
        name: "Read agent A",
        email: `read-agenta-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: coA.id,
        is_active: true,
        departments: [{ department: deptA1.id, isPrimary: true }],
      }),
      Agent.create({
        name: "Read agent other",
        email: `read-othera-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: coA.id,
        is_active: true,
        departments: [{ department: deptA2.id, isPrimary: true }],
      }),
      Agent.create({
        name: "Read agent B",
        email: `read-agentb-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: coB.id,
        is_active: true,
        departments: [{ department: deptB.id, isPrimary: true }],
      }),
    ]);

    const ticket = await Ticket.create({
      number: `RD-${suffix}`,
      company_id: coA.id,
      user_id: owner1.id,
      dept_id: deptA1.id,
      agent_id: agentA.id,
      subject: "Read access ticket",
      priority: "Normal",
      status: "assigned",
    });
    await TicketThread.create({
      ticket_id: ticket.id,
      type: "message",
      user_id: owner1.id,
      body: "public message",
    });
    await TicketThread.create({
      ticket_id: ticket.id,
      type: "note",
      agent_id: agentA.id,
      body: "PRIVATE work note - must not leak",
    });
    const login = async (path, body) => {
      const r = await request("POST", path, { body });
      return r.data.token;
    };
    const tokenOwner1 = await login("/auth/portal-login", {
      email: owner1.email,
      password: "Pass@1234",
    });
    const tokenOwner2 = await login("/auth/portal-login", {
      email: owner2.email,
      password: "Pass@1234",
    });
    const tokenEmpB = await login("/auth/portal-login", {
      email: emp.email,
      password: "Pass@1234",
    });
    const tokenAdminA = await login("/auth/agent/login", {
      email: adminA.email,
      password: "Pass@1234",
    });
    const tokenAgentA = await login("/auth/agent/login", {
      email: agentA.email,
      password: "Pass@1234",
    });
    const tokenAgentOther = await login("/auth/agent/login", {
      email: agentOtherDept.email,
      password: "Pass@1234",
    });
    const tokenAgentB = await login("/auth/agent/login", {
      email: agentB.email,
      password: "Pass@1234",
    });

    // --- Requester read ---
    const anon = await request("GET", `/tickets/${ticket.number}`);
    assert(anon.status === 401, "anonymous requester ticket read is denied");
    const ownerRead = await request("GET", `/tickets/${ticket.number}`, {
      token: tokenOwner1,
    });
    assert(
      ownerRead.status === 200 &&
        ownerRead.data.ticket.subject === "Read access ticket",
      "owner can read their own ticket",
    );
    assert(
      ownerRead.data.threads.length === 1 &&
        ownerRead.data.threads[0].body === "public message",
      "requester sees only public messages",
    );
    assert(
      !ownerRead.data.threads.some((t) => t.body.includes("PRIVATE")),
      "requester is never returned private work notes",
    );
    assert(
      ownerRead.data.threads.every((t) => t.type !== "note"),
      "requester threads contain no private work-note type",
    );

    const otherUser = await request("GET", `/tickets/${ticket.number}`, {
      token: tokenOwner2,
    });
    assert(
      otherUser.status === 403,
      "a different requester in the same tenant cannot read another requester ticket",
    );
    const crossTenantUser = await request("GET", `/tickets/${ticket.number}`, {
      token: tokenEmpB,
    });
    assert(
      [403, 404].includes(crossTenantUser.status),
      "a requester from another tenant cannot read the ticket (cross-tenant denial)",
    );

    // Requester list is own-ticket scoped
    const ownerList = await request("GET", "/tickets", { token: tokenOwner1 });
    assert(
      ownerList.status === 200 &&
        ownerList.data.items.every(
          (t) => String(t.user_id) === String(owner1.id),
        ),
      "requester ticket list returns only their own tickets",
    );

    // --- Agent read ---
    const agentRead = await request("GET", `/agent/tickets/${ticket.number}`, {
      token: tokenAgentA,
    });
    assert(
      agentRead.status === 200 &&
        agentRead.data.ticket.subject === "Read access ticket",
      "assigned agent can read the ticket",
    );

    const outOfScope = await request("GET", `/agent/tickets/${ticket.number}`, {
      token: tokenAgentOther,
    });
    assert(
      outOfScope.status === 403,
      "agent outside assigned team/department cannot read the ticket",
    );
    const agentCrossTenant = await request(
      "GET",
      `/agent/tickets/${ticket.number}`,
      { token: tokenAgentB },
    );
    assert(
      [403, 404].includes(agentCrossTenant.status),
      "agent from another tenant cannot read the ticket (cross-tenant denial)",
    );

    // Agent list is scoped to agent/team/department
    const agentList = await request("GET", "/agent/tickets", {
      token: tokenAgentA,
    });
    assert(
      agentList.status === 200 &&
        agentList.data.items.some((t) => String(t.id) === String(ticket.id)),
      "in-scope agent list includes the ticket",
    );
    const otherList = await request("GET", "/agent/tickets", {
      token: tokenAgentOther,
    });
    assert(
      otherList.status === 200 &&
        !otherList.data.items.some((t) => String(t.id) === String(ticket.id)),
      "out-of-scope agent list excludes the ticket",
    );

    // Admin can read any ticket in tenant but not cross-tenant
    const adminRead = await request("GET", `/agent/tickets/${ticket.number}`, {
      token: tokenAdminA,
    });
    assert(
      adminRead.status === 200 &&
        adminRead.data.ticket.subject === "Read access ticket",
      "tenant admin can read any in-tenant ticket",
    );

    console.log("ITSM-01.02 TICKET READ TESTS PASSED");
  } catch (error) {
    console.error("ITSM-01.02 TICKET READ TEST FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    const corps = [coA?.id, coB?.id].filter(Boolean);
    if (corps.length) {
      const db = getDB();
      await db("tenant_modules").whereIn("tenant_id", corps).del();
      await db("ticket_threads").whereIn("ticket_id", function () {
        this.select("id").from("tickets").whereIn("company_id", corps);
      }).del();
      await db("tickets").whereIn("company_id", corps).del();
      await db("departments").whereIn("company_id", corps).del();
      await db("users").whereIn("company_id", corps).del();
      await db("agents").whereIn("company_id", corps).del();
      await db("companies").whereIn("id", corps).del();
    }
    await getDB().destroy();
  }
})();
