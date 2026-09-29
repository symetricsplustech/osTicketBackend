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

const port = 5105;
const base = `http://127.0.0.1:${port}/api/v1`;
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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
  let company;
  let admin;
  let assignee;
  let requester;
  let sourceDept;
  let targetDept;
  let ticket;
  const suffix = Date.now();
  try {
    await connectDB();
    server = app.listen(port);
    company = await Company.create({
      name: `Helpdesk Contract ${suffix}`,
      status: "active",
    });
    [sourceDept, targetDept] = await Promise.all([
      Department.create({
        name: `Helpdesk Source ${suffix}`,
        company_id: company.id,
      }),
      Department.create({
        name: `Helpdesk Target ${suffix}`,
        company_id: company.id,
      }),
    ]);
    [admin, assignee, requester] = await Promise.all([
      Agent.create({
        name: "Helpdesk admin",
        email: `helpdesk-admin-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: company.id,
        is_admin: true,
        is_active: true,
        departments: [{ department: sourceDept.id, isPrimary: true }],
      }),
      Agent.create({
        name: "Helpdesk assignee",
        email: `helpdesk-assignee-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: company.id,
        is_active: true,
        departments: [{ department: targetDept.id, isPrimary: true }],
      }),
      User.create({
        name: "Helpdesk requester",
        email: `helpdesk-requester-${suffix}@osticket.local`,
        company_id: company.id,
      }),
    ]);
    ticket = await Ticket.create({
      number: `HD-${suffix}`,
      company_id: company.id,
      user_id: requester.id,
      dept_id: sourceDept.id,
      subject: "Contract test ticket",
      priority: "Normal",
    });
    const login = await request("POST", "/auth/agent/login", {
      body: { email: admin.email, password: "Pass@1234" },
    });
    assert(
      login.status === 200 && login.data.token,
      "agent authentication succeeds",
    );
    const token = login.data.token;

    const note = await request("POST", `/agent/tickets/${ticket.number}/note`, {
      token,
      body: { message: "Internal contract note" },
    });
    assert(
      note.status === 200,
      "agent note uses POST /note with message payload",
    );
    const assigned = await request(
      "POST",
      `/agent/tickets/${ticket.number}/assign`,
      { token, body: { agentId: assignee.id } },
    );
    assert(
      assigned.status === 200 &&
        String(assigned.data.ticket.agent_id) === String(assignee.id),
      "agent assignment uses POST and persists the selected agent",
    );
    const transferred = await request(
      "POST",
      `/agent/tickets/${ticket.number}/transfer`,
      { token, body: { deptId: targetDept.id } },
    );
    assert(
      transferred.status === 200 &&
        String(transferred.data.ticket.dept_id) === String(targetDept.id),
      "department transfer uses POST and deptId payload",
    );
    const status = await request(
      "POST",
      `/agent/tickets/${ticket.number}/status`,
      { token, body: { status: "closed" } },
    );
    assert(
      status.status === 200 && status.data.ticket.status === "closed",
      "ticket status uses POST and validates a lifecycle status",
    );
    const detail = await request("GET", `/agent/tickets/${ticket.number}`, {
      token,
    });
    assert(
      detail.status === 200 &&
        detail.data.ticket.subject === "Contract test ticket",
      "ticket detail returns the ticket domain record",
    );
    assert(
      Array.isArray(detail.data.threads) &&
        detail.data.threads.some(
          (thread) => thread.body === "Internal contract note",
        ),
      "ticket detail returns thread records separately from the ticket",
    );
    console.log("HELPDESK AGENT CONTRACT TESTS PASSED");
  } catch (error) {
    console.error("HELPDESK AGENT CONTRACT TEST FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (ticket) await TicketThread.deleteMany({ ticket_id: ticket.id });
    if (ticket) await Ticket.deleteOne({ id: ticket.id });
    if (admin) await Agent.deleteOne({ id: admin.id });
    if (assignee) await Agent.deleteOne({ id: assignee.id });
    if (requester) await User.deleteOne({ id: requester.id });
    if (sourceDept) await Department.deleteOne({ id: sourceDept.id });
    if (targetDept) await Department.deleteOne({ id: targetDept.id });
    if (company) await Company.deleteOne({ id: company.id });
    await getDB().destroy();
  }
})();
