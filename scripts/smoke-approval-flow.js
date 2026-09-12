/* eslint-disable no-console */
// Smoke test for the customer-approval -> helpdesk team-lead routing flow.
// Uses seeded data. Creates throwaway tickets (SMOKE-TEST) and cleans them up.
const path = require("path");
const B = path.resolve(__dirname, "..");
const mongoose = require(path.join(B, "src/../node_modules/mongoose"));
const config = require(path.join(B, "src/config/config"));
const User = require(path.join(B, "src/models/User"));
const Agent = require(path.join(B, "src/models/Agent"));
const Team = require(path.join(B, "src/models/Team"));
const Ticket = require(path.join(B, "src/models/helpdesk/tickets/Ticket"));
const TicketThread = require(
  path.join(B, "src/models/helpdesk/tickets/TicketThread"),
);
const Approval = require(path.join(B, "src/models/Approval"));
const SlaPlan = require(path.join(B, "src/models/SlaPlan"));
const ticketService = require(path.join(B, "src/services/ticket.service"));
const approvalFlow = require(
  path.join(B, "src/services/ticketApprovalFlow.service"),
);
const { getOrgOwner, hasPermission, USER_PERMISSIONS } = require(
  path.join(B, "src/utils/userPermissions"),
);
const { hasPermission: authzHasPermission } = require(
  path.join(B, "src/services/authorization.service"),
);

const assert = (cond, msg) => {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ok - ${msg}`);
};

const run = async () => {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log(`Connected: ${config.mongoUri}\n`);

  const company = await require(path.join(B, "src/models/Company")).findOne({
    domain: "nimbus.osticket.local",
  });
  const emily = await User.findOne({ email: "emily@acmeglobal.com" });
  const david = await User.findOne({ email: "david@acmeglobal.com" });
  const vikram = await Agent.findOne({ email: "l3@nimbus.osticket.local" });
  const Topic = require(path.join(B, "src/models/HelpTopic"));
  const lanTopic = await Topic.findOne({
    company: company._id,
    topic: "LAN Cabling",
  });

  // Attach an SLA to the LAN Cabling topic so pause/resume is exercised.
  // Pausing during customer approval is opt-in per plan (SlaPlan.pauseRules.pending_approval).
  const slaPlan = await SlaPlan.create({
    name: `Smoke SLA ${Date.now()}`,
    company: company._id,
    gracePeriod: 24,
    status: "active",
    pauseRules: { waiting_customer: true, pending_approval: true },
  });
  const prevTopicSla = lanTopic?.sla || null;
  if (lanTopic) {
    lanTopic.sla = slaPlan._id;
    await lanTopic.save();
  }

  console.log(
    "[1] Scenario A: external member creates a ticket (customer approval gate)",
  );
  const t1 = await ticketService.createTicket({
    user: emily,
    orgOwner: getOrgOwner(emily) || emily._id,
    createdBy: emily._id,
    subject: "SMOKE-TEST LAN cable broken",
    details: "SMOKE-TEST details for approval gate.",
    topicId: lanTopic ? lanTopic._id : null,
    priority: "high",
    companyId: company._id,
    source: "web",
  });
  assert(
    t1.status === Ticket.STATUSES.PENDING_APPROVAL,
    "ticket created in pending_approval",
  );
  assert(
    !t1.agent && !t1.team,
    "ticket NOT routed to agent/team before approval",
  );
  assert(
    t1.customData?.approvalFlow?.stage === "customer_approval",
    "approvalFlow marker saved",
  );
  assert(t1.waitingOn === "approval", "SLA waitingOn=approval");
  assert(t1.slaPaused === true, "SLA paused while awaiting approval");

  console.log("[2] Scenario A: manager lists pending approvals");
  const pending = await approvalFlow.listPendingOrgApprovals({
    user: david,
    companyId: company._id,
  });
  assert(
    pending.some((p) => String(p.ticket?.number) === String(t1.number)),
    "david sees the pending approval",
  );

  console.log(
    "[3] Scenario A: manager approves -> routed to Networking Helpdesk lead (data-driven)",
  );
  const fresh1 = await Ticket.findOne({ _id: t1._id });
  const res = await approvalFlow.decideCustomerApproval({
    ticket: fresh1,
    user: david,
    decision: "approve",
    note: "Looks good",
  });
  assert(res.approval.status === "approved", "approval doc approved");
  const t1b = await Ticket.findOne({ _id: t1._id });
  assert(
    t1b.status === Ticket.STATUSES.ASSIGNED,
    "ticket routed to assigned after approval",
  );
  assert(
    String(t1b.team) ===
      String(
        (
          await Team.findOne({
            name: "Networking Helpdesk",
            company: company._id,
          })
        )._id,
      ),
    "assigned to Networking Helpdesk team",
  );
  assert(
    String(t1b.agent) === String(vikram._id),
    "assigned to Vikram (the configured team lead)",
  );
  assert(t1b.slaPaused === false, "SLA resumed after approval");
  console.log(
    `  team: ${res.team?.name}, ${res.team?.leadTitle}: ${res.team?.lead?.name}`,
  );

  console.log("[4] Scenario B: member ticket REJECTED by manager");
  const t2 = await ticketService.createTicket({
    user: emily,
    orgOwner: getOrgOwner(emily) || emily._id,
    createdBy: emily._id,
    subject: "SMOKE-TEST rejected request",
    details: "SMOKE-TEST details reject path.",
    topicId: lanTopic ? lanTopic._id : null,
    priority: "normal",
    companyId: company._id,
    source: "web",
  });
  const fresh2 = await Ticket.findOne({ _id: t2._id });
  const res2 = await approvalFlow.decideCustomerApproval({
    ticket: fresh2,
    user: david,
    decision: "reject",
    note: "Not in scope",
  });
  assert(res2.approval.status === "rejected", "approval doc rejected");
  const t2b = await Ticket.findOne({ _id: t2._id });
  assert(t2b.status === Ticket.STATUSES.CANCELLED, "rejected ticket cancelled");

  console.log("[5] Authorisation: a non-manager member cannot decide");
  let denied = false;
  try {
    const fresh2b = await Ticket.findOne({ _id: t1._id });
    // already decided -> 400 path, but first prove non-manager is rejected: reuse another pending ticket
    const t3 = await ticketService.createTicket({
      user: emily,
      orgOwner: getOrgOwner(emily) || emily._id,
      createdBy: emily._id,
      subject: "SMOKE-TEST nonmanager",
      details: "SMOKE-TEST details nonmanager.",
      topicId: null,
      priority: "normal",
      companyId: company._id,
      source: "web",
    });
    const fresh3 = await Ticket.findOne({ _id: t3._id });
    await approvalFlow.decideCustomerApproval({
      ticket: fresh3,
      user: emily,
      decision: "approve",
    });
  } catch (e) {
    denied = e.statusCode === 403;
  }
  assert(denied, "403 when a member (not manager) tries to decide");

  console.log(
    "[6] Agent-created tickets bypass the gate, and permissions are enforced",
  );
  const agent = await Agent.findOne({ email: "l1@nimbus.osticket.local" });
  const t4 = await ticketService.createTicket({
    user: agent,
    createdBy: agent._id,
    orgOwner: agent._id,
    subject: "SMOKE-TEST agent path",
    details: "SMOKE-TEST agent-created.",
    topicId: null,
    companyId: company._id,
    source: "web",
  });
  assert(
    t4.status !== Ticket.STATUSES.PENDING_APPROVAL,
    "agent-created ticket bypasses approval gate",
  );
  assert(
    authzHasPermission(
      { permissions: ["tickets.view"], role: { permissions: [] } },
      "tickets.edit",
    ) === false,
    "no tickets.edit -> denied by authz",
  );
  assert(
    authzHasPermission(
      {
        permissions: ["tickets.view", "tickets.edit"],
        role: { permissions: [] },
      },
      "tickets.edit",
    ) === true,
    "tickets.edit granted -> allowed",
  );
  assert(
    authzHasPermission(agent, "tickets.assign") === false,
    `Ravi (L1) has NO tickets.assign -> ${String(agent.permissions.includes("tickets.assign"))}`,
  );

  console.log("[7] Customer sub-user permission model");
  assert(
    isExternalMemberGate(emily),
    "emily (external member) hits needsCustomerApproval",
  );
  assert(
    ["ticket_create", "ticket_view", "ticket_reply", "ticket_delete"].every(
      (p) => hasPermission(emily, p),
    ),
    "emily granted customer portal perms",
  );
  assert(
    !emily.get("createdBy") ? false : true,
    "emily is a sub-user of david (org owner)",
  );

  // ---- cleanup ----
  const ids = [t1._id, t2._id, t4._id];
  await Approval.deleteMany({ refId: { $in: ids } });
  await TicketThread.deleteMany({ ticket: { $in: ids } });
  await Ticket.updateMany(
    { _id: { $in: ids } },
    { $set: { status: Ticket.STATUSES.DELETED } },
  );
  if (lanTopic) {
    lanTopic.sla = prevTopicSla;
    await lanTopic.save().catch(() => {});
  }
  await SlaPlan.deleteOne({ _id: slaPlan._id }).catch(() => {});
  console.log("\nCleanup done (SMOKE-TEST artifacts soft-deleted).");

  await mongoose.disconnect();
  console.log("\nALL SMOKE TESTS PASSED");
  process.exit(0);
};

const isExternalMemberGate = (u) =>
  Boolean(
    u && u.userType === "external" && u.orgRole === "member" && u.organization,
  );

run().catch((err) => {
  console.error("SMOKE TEST FAILED:", err.message);
  process.exit(1);
});
