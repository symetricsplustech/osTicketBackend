const config = require('../config/config');
const logger = require('../utils/logger');
const Ticket = require('../models/Ticket');
const EscalationRule = require('../models/EscalationRule');
const Agent = require('../models/Agent');
const Team = require('../models/Team');
const ticketService = require('./ticket.service');
const { notifyAgent } = require('./notification.service');
const { emit } = require('./events');

const PRIORITY_RANK = { Low: 1, Normal: 2, High: 3, Emergency: 4 };

const buildRuleMatch = (rule, companyId) => {
  const match = { status: { $in: rule.statuses } };
  if (rule.company) match.company = rule.company;
  else if (companyId) match.company = companyId;
  if (rule.department) match.dept = rule.department;
  if (rule.priority) match.priority = rule.priority;
  if (rule.overdueMinutes > 0) {
    match.dueDate = { $lte: new Date(Date.now() - rule.overdueMinutes * 60 * 1000) };
  }
  return match;
};

const applyRule = async ({ rule, ticket }) => {
  const actions = [];
  const priorityRank = (p) => PRIORITY_RANK[p] || 0;

  if (rule.action.raisePriorityTo && priorityRank(ticket.priority) < priorityRank(rule.action.raisePriorityTo)) {
    ticket.priority = rule.action.raisePriorityTo;
    actions.push(`priority raised to ${rule.action.raisePriorityTo}`);
  }
  if (rule.action.reassignAgent && String(ticket.agent || '') !== String(rule.action.reassignAgent)) {
    const agent = await Agent.findById(rule.action.reassignAgent).select('name');
    ticket.agent = rule.action.reassignAgent;
    if (rule.action.reassignTeam) ticket.team = rule.action.reassignTeam;
    actions.push(`reassigned to ${agent?.name || 'agent'}`);
    ticket.status = Ticket.STATUSES.ASSIGNED;
    ticket.isOverdue = false;
  } else if (rule.action.reassignTeam && String(ticket.team || '') !== String(rule.action.reassignTeam)) {
    const team = await Team.findById(rule.action.reassignTeam).select('name');
    ticket.team = rule.action.reassignTeam;
    actions.push(`reassigned to team ${team?.name || 'team'}`);
    ticket.status = Ticket.STATUSES.ASSIGNED;
    ticket.isOverdue = false;
  }

  if (!actions.length) return 0;
  await ticket.save();
  await ticketService.addSystemEvent({
    ticket,
    message: `Escalation rule "${rule.name}" applied: ${actions.join(', ')}`,
  });

  if (rule.action.notifyAgent) {
    await notifyAgent({
      agentId: rule.action.notifyAgent,
      company: ticket.company,
      type: 'escalation',
      message: `Escalated ticket ${ticket.number}: ${ticket.subject}`,
      link: `/tickets/${ticket.number}`,
      ticket: ticket._id,
    });
  }
  emit('ticket.escalated', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number, ruleId: rule._id });
  return 1;
};

const evaluateRules = async ({ companyId } = {}) => {
  const rules = await EscalationRule.find({ isActive: true, ...(companyId ? { company: companyId } : {}) }).sort({ createdAt: 1 });
  let processed = 0;
  for (const rule of rules) {
    const match = buildRuleMatch(rule, companyId);
    match.escalatedBy = { $ne: rule._id };
    const tickets = await Ticket.find(match);
    for (const ticket of tickets) {
      const applied = await applyRule({ rule, ticket });
      if (applied) {
        await Ticket.updateOne({ _id: ticket._id }, { $addToSet: { escalatedBy: rule._id } });
        processed += 1;
      }
    }
    rule.lastRunAt = new Date();
    await rule.save();
  }
  return { rules: rules.length, processed };
};

const startEscalationRunner = () => {
  if (!config.escalation.enabled) {
    logger.info('Escalation runner disabled (set ESCALATION_ENABLED=true to enable).');
    return;
  }
  const interval = config.escalation.intervalMinutes * 60 * 1000;
  logger.info(`Escalation runner started (every ${config.escalation.intervalMinutes} min)`);
  const run = () => {
    evaluateRules()
      .then((s) => { if (s.processed > 0) logger.info(`Escalation run: ${JSON.stringify(s)}`); })
      .catch((err) => logger.error(`Escalation run failed: ${err.message}`));
  };
  setTimeout(run, 5000);
  setInterval(run, interval);
};

module.exports = { evaluateRules, startEscalationRunner, buildRuleMatch };
