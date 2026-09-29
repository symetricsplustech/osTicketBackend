/* eslint-disable no-console */
const connectDB = require("../src/config/db");
const { getDB } = require("../src/config/db");
const app = require("../src/app");
const Company = require("../src/models/Company");
const User = require("../src/models/User");
const HelpTopic = require("../src/models/HelpTopic");
const Priority = require("../src/models/Priority");
const Ticket = require("../src/models/helpdesk/tickets/Ticket");
const TicketThread = require("../src/models/helpdesk/tickets/TicketThread");
const AuditEvent = require("../src/models/AuditEvent");

const port = 5107;
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
  let companyA;
  let companyB;
  let userA;
  let userB;
  let createdTicket;
  const suffix = Date.now();
  try {
    await connectDB();
    server = app.listen(port);
    [companyA, companyB] = await Promise.all([
      Company.create({ name: `Portal intake A ${suffix}`, status: "active" }),
      Company.create({ name: `Portal intake B ${suffix}`, status: "active" }),
    ]);
    await getDB()("tenant_modules").insert([companyA, companyB].map((company) => ({
      tenant_id: company.id,
      module_key: "helpdesk",
      status: "active",
    })));
    [userA, userB] = await Promise.all([
      User.create({
        name: "Portal requester A",
        email: `portal-a-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: companyA.id,
        is_registered: true,
        status: "active",
      }),
      User.create({
        name: "Portal requester B",
        email: `portal-b-${suffix}@osticket.local`,
        password: "Pass@1234",
        company_id: companyB.id,
        is_registered: true,
        status: "active",
      }),
    ]);
    const [topicA, topicB] = await Promise.all([
      HelpTopic.create({
        company_id: companyA.id,
        name: `Access issue ${suffix}`,
        is_public: true,
        is_active: true,
      }),
      HelpTopic.create({
        company_id: companyB.id,
        name: `Private issue ${suffix}`,
        is_public: true,
        is_active: true,
      }),
    ]);

    const unauthenticatedForm = await request("GET", "/tickets/open-form");
    assert(
      unauthenticatedForm.status === 401,
      "portal intake form requires a signed-in requester",
    );
    const unauthenticatedCreate = await request("POST", "/tickets", {
      body: { subject: "No auth", details: "No auth" },
    });
    assert(
      unauthenticatedCreate.status === 401,
      "anonymous ticket creation is denied",
    );

    const [loginA, loginB] = await Promise.all([
      request("POST", "/auth/portal-login", {
        body: { email: userA.email, password: "Pass@1234" },
      }),
      request("POST", "/auth/portal-login", {
        body: { email: userB.email, password: "Pass@1234" },
      }),
    ]);
    assert(
      loginA.status === 200 && loginA.data.token,
      "registered requester can sign in to the portal",
    );
    assert(
      loginB.status === 200 && loginB.data.token,
      "second-tenant requester can sign in to the portal",
    );

    const formA = await request("GET", "/tickets/open-form", {
      token: loginA.data.token,
    });
    assert(
      formA.status === 200 &&
        formA.data.topics.some(
          (item) => String(item.id) === String(topicA.id),
        ),
      "requester receives their tenant help topics",
    );
    assert(
      !formA.data.topics.some(
        (item) => String(item.id) === String(topicB.id),
      ),
      "requester cannot see another tenant help topics",
    );
    assert(
      formA.data.priorities.some((item) => item.name === "Normal"),
      "portal form supplies tenant priority choices",
    );

    const missingDetails = await request("POST", "/tickets", {
      token: loginA.data.token,
      body: {
        subject: "Missing description",
        topic: String(topicA.id),
        priority: "Normal",
      },
    });
    assert(
      missingDetails.status === 422,
      "subject and details are both required",
    );
    const crossTenantTopic = await request("POST", "/tickets", {
      token: loginA.data.token,
      body: {
        subject: "Cross tenant",
        details: "This must be rejected.",
        topic: String(topicB.id),
        priority: "Normal",
      },
    });
    assert(
      crossTenantTopic.status === 422,
      "cross-tenant help topic is rejected",
    );

    const ticketForm = new FormData();
    ticketForm.append("subject", " Cannot sign in ");
    ticketForm.append("details", " Please reset my account access. ");
    ticketForm.append("topic", String(topicA.id));
    ticketForm.append("priority", "Normal");
    ticketForm.append(
      "files",
      new Blob(["attachment proof"], { type: "text/plain" }),
      "proof.txt",
    );
    const create = await requestForm("/tickets", {
      token: loginA.data.token,
      form: ticketForm,
    });
    assert(
      create.status === 201 && create.data.ticket?.number,
      "requester can create a ticket through the portal",
    );
    createdTicket = create.data.ticket.id;
    const ticket = await Ticket.findById(createdTicket).lean();
    const initialMessage = await TicketThread.findOne({
      ticket_id: createdTicket,
      user_id: userA.id,
      type: "message",
    }).lean();
    assert(
      String(ticket.company_id) === String(companyA.id) &&
        String(ticket.user_id) === String(userA.id),
      "created ticket is owned and tenant-scoped to the requester",
    );
    assert(
      ticket.subject === "Cannot sign in" && ticket.source === "web",
      "ticket preserves normalized portal subject and web source",
    );
    assert(
      initialMessage?.body === "Please reset my account access." &&
        initialMessage.attachments?.[0]?.filename === "proof.txt",
      "ticket creation stores the initial requester message and attachment",
    );
    assert(
      await AuditEvent.exists({
        tenant_id: companyA.id,
        actor_id: userA.id,
        action: "ticket.created",
        resource_id: createdTicket,
      }),
      "ticket creation is audit logged within the tenant",
    );
    console.log("ITSM TICKET PORTAL INTAKE TESTS PASSED");
  } catch (error) {
    console.error("ITSM TICKET PORTAL INTAKE TEST FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    const companies = [companyA?.id, companyB?.id].filter(Boolean);
    if (companies.length) {
      const db = getDB();
      const tickets = await db("tickets")
        .whereIn("company_id", companies)
        .select("id");
      const ticketIds = tickets.map((t) => t.id);
      if (ticketIds.length) {
        await db("ticket_threads").whereIn("ticket_id", ticketIds).del();
      }
      await db("tickets").whereIn("company_id", companies).del();
      await db("help_topics").whereIn("company_id", companies).del();
      await db("priorities").whereIn("company_id", companies).del();
      await db("audit_events").whereIn("tenant_id", companies).del();
      await db("users").whereIn("company_id", companies).del();
      await db("companies").whereIn("id", companies).del();
    }
    await getDB().destroy();
  }
})();
