const User = require("../models/User");
const Team = require("../models/Team");
const HelpTopic = require("../models/HelpTopic");
const Department = require("../models/Department");
const Ticket = require("../models/helpdesk/tickets/Ticket");
const Approval = require("../models/Approval");
const {
  notifyAgent,
  notifyUser,
  notifyAdminRoom,
} = require("./notification.service");
const { pauseSla, resumeSla } = require("./sla.service");

const CUSTOMER_APPROVAL_STAGE = "customer_approval";

const needsCustomerApproval = (user) =>
  Boolean(
    user &&
    user.userType === "external" &&
    user.orgRole === "member" &&
    user.organization,
  );

const getOrgManager = async (user) => {
  if (!user?.organization) return null;
  return User.findOne({
    organization: user.organization,
    orgRole: "manager",
    status: "active",
  });
};

const getRequester = async (ticket) => {
  if (ticket.createdBy) {
    const creator = await User.findById(ticket.createdBy);
    if (creator) return creator;
  }
  if (ticket.user) return User.findById(ticket.user);
  return null;
};

const getApprovalDoc = async (ticket) => {
  const approvalId = ticket.customData?.approvalFlow?.approvalId;
  if (!approvalId) return null;
  return Approval.findById(approvalId);
};

/**
 * Data-driven helpdesk team resolution. The team and its designated lead are
 * configured by the tenant (Team.lead / Team.leadTitle) — nothing is
 * hardcoded here. Resolution order: explicit team -> help topic chain
 * (autoAssignTeam) -> department autoAssignTeam.
 */
const resolveHelpdeskTeam = async (ticket) => {
  if (ticket.team) {
    const team = await Team.findById(ticket.team).populate(
      "lead",
      "name email",
    );
    if (team) return team;
  }

  let topic = ticket.topic ? await HelpTopic.findById(ticket.topic) : null;
  let depth = 0;
  while (topic && depth < 5) {
    if (topic.autoAssignTeam) {
      const team = await Team.findById(topic.autoAssignTeam).populate(
        "lead",
        "name email",
      );
      if (team) return team;
    }
    if (topic.parent) {
      topic = await HelpTopic.findById(topic.parent);
    } else {
      topic = null;
    }
    depth += 1;
  }

  if (ticket.dept) {
    const dept = await Department.findById(ticket.dept).populate(
      "autoAssignTeam",
    );
    if (dept?.autoAssignTeam) {
      return Team.findById(dept.autoAssignTeam).populate("lead", "name email");
    }
  }
  return null;
};

const addEvent = async (ticket, message) => {
  const { addSystemEvent } = require("./ticket.service");
  await addSystemEvent({ ticket, message });
};

const isOrgManagerOf = async (user, requester) =>
  Boolean(
    user &&
    requester &&
    user.userType === "external" &&
    user.orgRole === "manager" &&
    user.organization &&
    String(user.organization) === String(requester.organization),
  );

/**
 * Start customer approval gate on a newly created ticket. Unassigns any
 * routing decided during creation (agent/team) until the org manager approves.
 */
const startCustomerApproval = async ({ ticket, user, manager, companyId }) => {
  const requester = user || (await getRequester(ticket));
  const orgManager = manager || (await getOrgManager(requester));
  if (!orgManager) {
    addEvent(
      ticket,
      "Customer approval requested but no organization manager is configured",
    ).catch(() => {});
    return null;
  }

  const approval = await Approval.create({
    company: companyId || ticket.company || null,
    title: `Ticket ${ticket.number} requires approval`,
    description: ticket.subject || "",
    refType: "ticket",
    refId: ticket._id,
    mode: "sequential",
    steps: [
      {
        order: 1,
        assigneeType: "org_manager",
        assignee: orgManager._id,
        mode: "approve",
        status: "pending",
      },
    ],
    initiatedBy: requester?._id || null,
    initiatedByName: requester?.name || "",
    status: "pending",
  });

  ticket.status = Ticket.STATUSES.PENDING_APPROVAL;
  ticket.waitingOn = "approval";
  ticket.agent = null;
  ticket.team = null;
  ticket.customData = {
    ...(ticket.customData || {}),
    approvalFlow: { approvalId: approval._id, stage: CUSTOMER_APPROVAL_STAGE },
  };
  await ticket.save();
  await pauseSla(ticket, "approval");

  await addEvent(
    ticket,
    `Pending approval from ${orgManager.name} (customer organization manager)`,
  );
  await notifyUser({
    userId: orgManager._id,
    company: companyId || ticket.company || null,
    type: "approval_required",
    message: `Ticket ${ticket.number}: ${ticket.subject} requires your approval`,
    link: `/tickets/${ticket.number}`,
    ticket: ticket._id,
  }).catch(() => {});

  return approval;
};

/**
 * Route an approved ticket to the helpdesk team's configured lead
 * (Team.lead + Team.leadTitle). Falls back to OPEN when no team is configured.
 */
const routeToHelpdeskTeam = async ({ ticket, decision, note }) => {
  const team = await resolveHelpdeskTeam(ticket);
  const requester = await getRequester(ticket);

  if (decision !== "approve") {
    ticket.status = Ticket.STATUSES.CANCELLED;
    ticket.waitingOn = "none";
    await ticket.save();
    await resumeSla(ticket);
    await addEvent(ticket, `Ticket rejected${note ? `: ${note}` : ""}`);
    if (requester) {
      await notifyUser({
        userId: requester._id,
        company: ticket.company || null,
        type: "ticket_rejected",
        message: `Ticket ${ticket.number} was rejected${note ? ` (${note})` : ""}`,
        link: `/tickets/${ticket.number}`,
        ticket: ticket._id,
      }).catch(() => {});
    }
    return { team: null, assignedLead: null };
  }

  if (team && team.lead) {
    ticket.agent = team.lead._id;
    ticket.team = team._id;
    ticket.status = Ticket.STATUSES.ASSIGNED;
    ticket.waitingOn = "none";
    await ticket.save();
    await resumeSla(ticket);
    await addEvent(
      ticket,
      `Approved by customer ${team.leadTitle || "manager"}. Routed to ${team.name} (${team.leadTitle || "team lead"}: ${team.lead.name}).`,
    );
    await notifyAgent({
      agentId: team.lead._id,
      company: ticket.company || null,
      type: "new_ticket",
      message: `Ticket ${ticket.number} approved and assigned to you as ${team.leadTitle || "team lead"}: ${ticket.subject}`,
      link: `/tickets/${ticket.number}`,
      ticket: ticket._id,
    }).catch(() => {});
    await notifyAdminRoom({
      type: "ticket_arrived",
      message: `Ticket ${ticket.number} approved and routed to ${team.name}`,
      link: `/tickets/${ticket.number}`,
      ticket: ticket._id,
      company: ticket.company || null,
    }).catch(() => {});
    if (requester) {
      await notifyUser({
        userId: requester._id,
        company: ticket.company || null,
        type: "ticket_routed",
        message: `Ticket ${ticket.number} was approved and routed to the ${team.name} team`,
        link: `/tickets/${ticket.number}`,
        ticket: ticket._id,
      }).catch(() => {});
    }
    return { team, assignedLead: team.lead };
  }

  ticket.status = Ticket.STATUSES.OPEN;
  ticket.waitingOn = "none";
  await ticket.save();
  await resumeSla(ticket);
  await addEvent(
    ticket,
    "Approved by customer, but no helpdesk team is configured for this ticket.",
  );
  return { team: null, assignedLead: null };
};

/**
 * Approve/reject a ticket that is waiting for customer approval.
 * Only the requester's organization manager may decide.
 */
const decideCustomerApproval = async ({ ticket, user, decision, note }) => {
  if (ticket.status !== Ticket.STATUSES.PENDING_APPROVAL) {
    throw Object.assign(new Error("Ticket is not waiting for approval"), {
      statusCode: 400,
    });
  }

  const approval = await getApprovalDoc(ticket);
  if (!approval || approval.status !== "pending") {
    throw Object.assign(new Error("No active approval found for this ticket"), {
      statusCode: 400,
    });
  }

  const requester = await getRequester(ticket);
  const step = approval.steps && approval.steps[0];
  const isAssignedManager = step && String(step.assignee) === String(user._id);
  if (!isAssignedManager && !(await isOrgManagerOf(user, requester))) {
    throw Object.assign(
      new Error("Only the organization manager can approve this ticket"),
      { statusCode: 403 },
    );
  }

  const outcome = decision === "approve" ? "approved" : "rejected";
  if (step) {
    step.status = outcome;
    step.decidedBy = user._id;
    step.decidedByName = user.name || "";
    step.decidedAt = new Date();
    step.comment = note || "";
  }
  approval.status = outcome;
  approval.result = outcome;
  approval.completedAt = new Date();
  await approval.save();

  const result = await routeToHelpdeskTeam({ ticket, decision, note });
  return { approval, ...result };
};

const listPendingOrgApprovals = async ({ user, companyId }) => {
  const approvals = await Approval.find({
    company: companyId || null,
    status: "pending",
    refType: "ticket",
    steps: { $elemMatch: { assigneeType: "org_manager", assignee: user._id } },
  })
    .sort({ createdAt: -1 })
    .lean();

  const ticketIds = approvals.map((a) => a.refId).filter(Boolean);
  const tickets = ticketIds.length
    ? await Ticket.find({ _id: { $in: ticketIds } })
        .select("number subject status createdAt dept")
        .populate("dept", "name")
    : [];
  const byId = new Map(tickets.map((t) => [String(t._id), t]));

  return approvals.map((a) => ({
    approvalId: a._id,
    status: a.status,
    initiatedByName: a.initiatedByName,
    createdAt: a.createdAt,
    ticket: byId.get(String(a.refId))
      ? {
          number: byId.get(String(a.refId)).number,
          subject: byId.get(String(a.refId)).subject,
          status: byId.get(String(a.refId)).status,
          dept: byId.get(String(a.refId)).dept,
          createdAt: byId.get(String(a.refId)).createdAt,
        }
      : null,
  }));
};

module.exports = {
  CUSTOMER_APPROVAL_STAGE,
  needsCustomerApproval,
  getOrgManager,
  getRequester,
  resolveHelpdeskTeam,
  startCustomerApproval,
  routeToHelpdeskTeam,
  decideCustomerApproval,
  listPendingOrgApprovals,
  isOrgManagerOf,
};
