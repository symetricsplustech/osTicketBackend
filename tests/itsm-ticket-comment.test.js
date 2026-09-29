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
const AuditEvent = require("../src/models/AuditEvent");

const port = 5109;
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
const requestForm = async (path, { token, form }) => {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
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
  let otherUser;
  let adminA;
  let agentA;
  let deptA1;
  let ticket;
  const suffix = Date.now();
  try {
    await connectDB();
    server = app.listen(port);
    coA = await Company.create({
      name: `Comment A ${suffix}`,
      status: "active",
    });
    coB = await Company.create({
      name: `Comment B ${suffix}`,
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
      name: `Comment A1 ${suffix}`,
      company_id: coA.id,
    });
    [owner, otherUser] = await Promise.all([
      User.create({
        name: "Comment owner",
        email: `cmt-owner-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: coA.id,
        is_registered: true,
        status: "active",
      }),
      User.create({
        name: "Comment other",
        email: `cmt-other-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: coA.id,
        is_registered: true,
        status: "active",
      }),
    ]);
    [adminA, agentA] = await Promise.all([
      Agent.create({
        name: "Comment admin",
        email: `cmt-admin-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: coA.id,
        is_admin: true,
        is_active: true,
        departments: [{ department: deptA1.id, isPrimary: true }],
      }),
      Agent.create({
        name: "Comment agent",
        email: `cmt-agent-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: coA.id,
        is_active: true,
        departments: [{ department: deptA1.id, isPrimary: true }],
        permissions: ["tickets.reply", "tickets.note"],
      }),
    ]);
    ticket = await Ticket.create({
      number: `CMT-${suffix}`,
      company_id: coA.id,
      user_id: owner.id,
      dept_id: deptA1.id,
      agent_id: agentA.id,
      subject: "Comment ticket",
      priority: "Normal",
      status: "assigned",
    });

    const login = async (path, body) => {
      const r = await request("POST", path, { body });
      return r.data.token;
    };
    const tokenOwner = await login("/auth/portal-login", {
      email: owner.email,
      password: "Pass@1234",
    });
    const tokenOther = await login("/auth/portal-login", {
      email: otherUser.email,
      password: "Pass@1234",
    });
    const tokenAgent = await login("/auth/agent/login", {
      email: agentA.email,
      password: "Pass@1234",
    });

    // --- Denials ---
    const anonReply = await request("POST", `/tickets/${ticket.number}/reply`, {
      body: { message: "anon" },
    });
    assert(anonReply.status === 401, "anonymous comment is denied");
    const anonNote = await request(
      "POST",
      `/agent/tickets/${ticket.number}/note`,
      { body: { message: "anon" } },
    );
    assert(anonNote.status === 401, "anonymous work note is denied");
    const crossUserReply = await request(
      "POST",
      `/tickets/${ticket.number}/reply`,
      { token: tokenOther, body: { message: "not mine" } },
    );
    assert(
      [403, 404].includes(crossUserReply.status),
      "a requester cannot comment on another requester ticket",
    );
    const requesterNoteAttempt = await request(
      "POST",
      `/tickets/${ticket.number}/note`,
      { token: tokenOwner, body: { message: "attempt note" } },
    );
    assert(
      [403, 404, 405].includes(requesterNoteAttempt.status),
      "a requester cannot create a private work note (no requester note route)",
    );

    // --- Requester public comment (with attachment) ---
    const commentForm = new FormData();
    commentForm.append("message", " please help me with this ");
    commentForm.append(
      "files",
      new Blob(["screen"], { type: "text/plain" }),
      "screen.txt",
    );
    const comment = await requestForm(`/tickets/${ticket.number}/reply`, {
      token: tokenOwner,
      form: commentForm,
    });
    assert(
      comment.status === 200,
      "owner can post a public comment with attachment",
    );
    const requesterView = await request("GET", `/tickets/${ticket.number}`, {
      token: tokenOwner,
    });
    assert(
      requesterView.data.threads.some(
        (t) =>
          t.type === "message" &&
          t.body.includes("please help me with this") &&
          t.attachments?.[0]?.filename === "screen.txt",
      ),
      "public comment and its attachment are visible to the requester",
    );
    assert(
      !requesterView.data.threads.some((t) => t.type === "note"),
      "requester view still excludes all private work notes",
    );

    // --- Agent public reply ---
    const agentReply = await request(
      "POST",
      `/agent/tickets/${ticket.number}/reply`,
      { token: tokenAgent, body: { message: "We are on it" } },
    );
    assert(agentReply.status === 200, "agent can post a public reply");
    const requesterView2 = await request("GET", `/tickets/${ticket.number}`, {
      token: tokenOwner,
    });
    assert(
      requesterView2.data.threads.some(
        (t) => t.type === "message" && t.body === "We are on it",
      ),
      "agent public reply is visible to the requester",
    );

    // --- Agent private work note ---
    const note = await request("POST", `/agent/tickets/${ticket.number}/note`, {
      token: tokenAgent,
      body: { message: "Internal pricing sensitive detail" },
    });
    assert(note.status === 200, "agent can post a private work note");

    // Private note visible to agent, but NOT to requester
    const agentView = await request("GET", `/agent/tickets/${ticket.number}`, {
      token: tokenAgent,
    });
    assert(
      agentView.data.threads.some(
        (t) =>
          t.type === "note" && t.body === "Internal pricing sensitive detail",
      ),
      "private work note is visible to the agent",
    );
    const requesterView3 = await request("GET", `/tickets/${ticket.number}`, {
      token: tokenOwner,
    });
    assert(
      !requesterView3.data.threads.some(
        (t) =>
          t.type === "note" || (t.body && t.body.includes("pricing sensitive")),
      ),
      "private work note never leaks to the requester",
    );

    // --- Audit ---
    assert(
      await AuditEvent.exists({
        tenant_id: coA.id,
        action: "ticket.comment_added",
        resource_id: ticket.id,
      }),
      "requester public comment is audit logged",
    );
    assert(
      await AuditEvent.exists({
        tenant_id: coA.id,
        action: "ticket.replied",
        resource_id: ticket.id,
      }),
      "agent public reply is audit logged",
    );
    assert(
      await AuditEvent.exists({
        tenant_id: coA.id,
        action: "ticket.note_added",
        resource_id: ticket.id,
      }),
      "private work note is audit logged",
    );

    console.log("ITSM-01.03 TICKET COMMENT & WORK NOTE TESTS PASSED");
  } catch (error) {
    console.error(
      "ITSM-01.03 TICKET COMMENT & WORK NOTE TEST FAILED:",
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
      await db("departments").whereIn("company_id", corps).del();
      await db("users").whereIn("company_id", corps).del();
      await db("agents").whereIn("company_id", corps).del();
      await db("companies").whereIn("id", corps).del();
    }
    await getDB().destroy();
  }
})();
