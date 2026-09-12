const config = require("../config/config");
const logger = require("../utils/logger");
const Ticket = require("../models/helpdesk/tickets/Ticket");
const EscalationRule = require("../models/helpdesk/incidents/EscalationRule");
const Agent = require("../models/Agent");
const Team = require("../models/Team");
const ticketService = require("./ticket.service");
const { notifyAgent } = require("./notification.service");
const { emit } = require("./events");

const PRIORITY_RANK = { Low: 1, Normal: 2, High: 3, Emergency: 4 };

const buildRuleMatch = (rule, companyId) => {
  const match = { status: { $in: rule.statuses } };
  if (rule.company) match.company = rule.company;
  else if (companyId) match.company = companyId;
  if (rule.department) match.dept = rule.department;
  if (rule.priority) match.priority = rule.priority;
  if (rule.overdueMinutes > 0) {
    match.dueDate = {
      $lte: new Date(Date.now() - rule.overdueMinutes * 60 * 1000),
    };
  }
  return match;
};

const applyRule = async ({ rule, ticket }) => {
  const actions = [];
  const priorityRank = (p) => PRIORITY_RANK[p] || 0;

  if (
    rule.action.raisePriorityTo &&
    priorityRank(ticket.priority) < priorityRank(rule.action.raisePriorityTo)
  ) {
    ticket.priority = rule.action.raisePriorityTo;
    actions.push(`priority raised to ${rule.action.raisePriorityTo}`);
  }
  if (
    rule.action.reassignAgent &&
    String(ticket.agent || "") !== String(rule.action.reassignAgent)
  ) {
    const agent = await Agent.findById(rule.action.reassignAgent).select(
      "name",
    );
    ticket.agent = rule.action.reassignAgent;
    if (rule.action.reassignTeam) ticket.team = rule.action.reassignTeam;
    actions.push(`reassigned to ${agent?.name || "agent"}`);
    ticket.status = Ticket.STATUSES.ASSIGNED;
    ticket.isOverdue = false;
  } else if (
    rule.action.reassignTeam &&
    String(ticket.team || "") !== String(rule.action.reassignTeam)
  ) {
    const team = await Team.findById(rule.action.reassignTeam).select(
      "name lead",
    );
    ticket.team = rule.action.reassignTeam;
    actions.push(`reassigned to team ${team?.name || "team"}`);
    ticket.status = Ticket.STATUSES.ASSIGNED;
    ticket.isOverdue = false;
    // Hierarchy: team-routed escalations land on the team lead when the
    // ticket has no owner, so escalated work always has a named human.
    // The lead is always notified.
    if (team && team.lead) {
      if (!ticket.agent) {
        const lead = await Agent.findOne({ _id: team.lead, isActive: true })
          .select("name")
          .lean();
        if (lead) {
          ticket.agent = lead._id;
          actions.push(`owner set to team lead ${lead.name}`);
        }
      }
      await notifyAgent({
        agentId: team.lead,
        company: ticket.company,
        type: "escalation",
        message: `Escalated ticket ${ticket.number} routed to your team (${team.name})`,
        link: `/tickets/${ticket.number}`,
        ticket: ticket._id,
      }).catch(() => {});
    }
  }

  if (!actions.length && !rule.action.setStatus) return 0;
  await ticket.save();
  await ticketService.addSystemEvent({
    ticket,
    message: `Escalation rule "${rule.name}" applied: ${actions.join(", ") || "status change"}`,
  });

  // Optional terminal action: move the ticket (e.g. to `escalated`) with full
  // transition validation, SLA handling and audit via the shared applier.
  if (rule.action.setStatus && ticket.status !== rule.action.setStatus) {
    try {
      await ticketService.applyStatusChange(ticket, rule.action.setStatus, {
        actorType: "system",
        actorId: null,
        actorName: `Escalation rule "${rule.name}"`,
        reason: "escalation",
      });
    } catch (err) {
      logger.error(
        `Escalation setStatus failed for ${ticket.number}: ${err.message}`,
      );
    }
  }

  if (rule.action.notifyAgent) {
    await notifyAgent({
      agentId: rule.action.notifyAgent,
      company: ticket.company,
      type: "escalation",
      message: `Escalated ticket ${ticket.number}: ${ticket.subject}`,
      link: `/tickets/${ticket.number}`,
      ticket: ticket._id,
    });
  }
  emit("ticket.escalated", {
    company: ticket.company,
    ticketId: ticket._id,
    ticketNumber: ticket.number,
    ruleId: rule._id,
  });
  return 1;
};

const postTierWebhook = async (url, payload) => {
  if (!url) return;
  try {
    await fetch(String(url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "ticket.escalated",
        data: payload,
        sentAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    logger.error(`Escalation webhook failed: ${err.message}`);
  }
};

/**
 * Tiered timeline evaluation (§16). Tiers are relative to SLA start and fire
 * once per (rule, ticket, tier), independent of the one-shot legacy action.
 */
const applyTiers = async ({ rule, ticket }) => {
  if (!rule.tiers?.length) return 0;
  const base = new Date(ticket.slaStartedAt || ticket.createdAt).getTime();
  const elapsedMin = (Date.now() - base) / 60000;
  const fired = new Set(
    (ticket.escalationTiersFired || [])
      .filter((f) => String(f.rule) === String(rule._id))
      .map((f) => f.tier),
  );
  let applied = 0;
  const tiers = [...rule.tiers].sort((a, b) => a.afterMinutes - b.afterMinutes);
  for (let idx = 0; idx < tiers.length; idx += 1) {
    const tier = tiers[idx];
    if (elapsedMin < (tier.afterMinutes || 0) || fired.has(idx)) continue;
    const actions = [];
    const priorityRank = (p) => PRIORITY_RANK[p] || 0;
    if (
      tier.raisePriorityTo &&
      priorityRank(ticket.priority) < priorityRank(tier.raisePriorityTo)
    ) {
      ticket.priority = tier.raisePriorityTo;
      actions.push(`priority raised to ${tier.raisePriorityTo}`);
    }
    if (
      tier.reassignAgent &&
      String(ticket.agent || "") !== String(tier.reassignAgent)
    ) {
      const agent = await Agent.findById(tier.reassignAgent).select("name");
      ticket.agent = tier.reassignAgent;
      actions.push(`reassigned to ${agent?.name || "agent"}`);
    }
    if (
      tier.reassignTeam &&
      String(ticket.team || "") !== String(tier.reassignTeam)
    ) {
      const team = await Team.findById(tier.reassignTeam).select("name lead");
      ticket.team = tier.reassignTeam;
      actions.push(`reassigned to team ${team?.name || "team"}`);
      if (team?.lead) {
        await notifyAgent({
          agentId: team.lead,
          company: ticket.company,
          type: "escalation",
          message: `Escalation tier ${idx + 1} (${rule.name}): ticket ${ticket.number} routed to your team`,
          link: `/tickets/${ticket.number}`,
          ticket: ticket._id,
        }).catch(() => {});
      }
    }
    await ticket.save();
    await ticketService.addSystemEvent({
      ticket,
      message: `Escalation "${rule.name}" tier ${idx + 1} (after ${tier.afterMinutes}m): ${actions.join(", ") || "status change"}`,
    });
    if (tier.setStatus && ticket.status !== tier.setStatus) {
      try {
        await ticketService.applyStatusChange(ticket, tier.setStatus, {
          actorType: "system",
          actorId: null,
          actorName: `Escalation "${rule.name}" tier ${idx + 1}`,
          reason: "escalation",
        });
      } catch (err) {
        logger.error(
          `Escalation tier setStatus failed for ${ticket.number}: ${err.message}`,
        );
      }
    }
    if (tier.notifyAgent) {
      await notifyAgent({
        agentId: tier.notifyAgent,
        company: ticket.company,
        type: "escalation",
        message: `Escalation tier ${idx + 1} (${rule.name}): ticket ${ticket.number} breached ${tier.afterMinutes}m`,
        link: `/tickets/${ticket.number}`,
        ticket: ticket._id,
      }).catch(() => {});
    }
    if (tier.webhookUrl) {
      await postTierWebhook(tier.webhookUrl, {
        company: ticket.company,
        ticketId: ticket._id,
        ticketNumber: ticket.number,
        ruleId: rule._id,
        tier: idx,
        subject: ticket.subject,
        priority: ticket.priority,
        status: ticket.status,
      });
    }
    await Ticket.updateOne(
      { _id: ticket._id },
      {
        $push: {
          escalationTiersFired: { rule: rule._id, tier: idx, at: new Date() },
        },
      },
    );
    ticket.escalationTiersFired = [
      ...(ticket.escalationTiersFired || []),
      { rule: rule._id, tier: idx, at: new Date() },
    ];
    emit("ticket.escalated", {
      company: ticket.company,
      ticketId: ticket._id,
      ticketNumber: ticket.number,
      ruleId: rule._id,
      tier: idx,
    });
    applied += 1;
  }
  return applied;
};

const evaluateRules = async ({ companyId } = {}) => {
  const rules = await EscalationRule.find({
    isActive: true,
    ...(companyId ? { company: companyId } : {}),
  }).sort({ createdAt: 1 });
  let processed = 0;
  for (const rule of rules) {
    // Tiered timeline runs on its own per-tier tracking (not the one-shot
    // escalatedBy guard), so both can coexist on one rule.
    if (rule.tiers?.length) {
      const tierMatch = { status: { $in: rule.statuses } };
      if (rule.company) tierMatch.company = rule.company;
      else if (companyId) tierMatch.company = companyId;
      if (rule.department) tierMatch.dept = rule.department;
      if (rule.priority) tierMatch.priority = rule.priority;
      const tierTickets = await Ticket.find(tierMatch);
      for (const ticket of tierTickets) {
        try {
          processed += await applyTiers({ rule, ticket });
        } catch (err) {
          logger.error(
            `Escalation tiers "${rule.name}" failed for ticket ${ticket.number}: ${err.message}`,
          );
        }
      }
    }
    const match = buildRuleMatch(rule, companyId);
    match.escalatedBy = { $ne: rule._id };
    const tickets = await Ticket.find(match);
    for (const ticket of tickets) {
      try {
        const applied = await applyRule({ rule, ticket });
        if (applied) {
          await Ticket.updateOne(
            { _id: ticket._id },
            { $addToSet: { escalatedBy: rule._id } },
          );
          processed += 1;
        }
      } catch (err) {
        logger.error(
          `Escalation rule "${rule.name}" failed for ticket ${ticket.number}: ${err.message}`,
        );
      }
    }
    rule.lastRunAt = new Date();
    await rule.save();
  }
  return { rules: rules.length, processed };
};

const startEscalationRunner = () => {
  if (!config.escalation.enabled) {
    logger.info(
      "Escalation runner disabled (set ESCALATION_ENABLED=true to enable).",
    );
    return;
  }
  const interval = config.escalation.intervalMinutes * 60 * 1000;
  logger.info(
    `Escalation runner started (every ${config.escalation.intervalMinutes} min)`,
  );
  const run = () => {
    evaluateRules()
      .then((s) => {
        if (s.processed > 0)
          logger.info(`Escalation run: ${JSON.stringify(s)}`);
      })
      .catch((err) => logger.error(`Escalation run failed: ${err.message}`));
  };
  setTimeout(run, 5000);
  setInterval(run, interval);
};

module.exports = { evaluateRules, startEscalationRunner, buildRuleMatch };
