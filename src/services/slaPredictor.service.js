const Ticket = require('../models/helpdesk/tickets/Ticket');

const clamp = (v) => Math.max(0, Math.min(1, v));

function priorityPenalty(priority) {
  const p = String(priority || '').toLowerCase();
  if (p === 'critical') return 0.1;
  if (p === 'high') return 0.05;
  return 0;
}

function categoryFor(risk) {
  if (risk >= 0.7) return 'at_risk';
  if (risk >= 0.4) return 'watching';
  return 'green';
}

function etaLabel(remainingMs) {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'overdue';
  const ms = remainingMs;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `~${days}d ${hours}h ${minutes}m remaining`;
  if (hours > 0) return `~${hours}h ${minutes}m remaining`;
  return `~${minutes}m remaining`;
}

async function predictTicket(ticket) {
  // Tickets use separate resolution/response clocks; older records use
  // `dueDate`. `slaDueAt` was never a Ticket schema field, so relying on it
  // made this monitor silently return an empty result set.
  const dueAt = ticket?.resolutionDueAt || ticket?.dueDate || ticket?.slaDueAt;
  if (!ticket || !dueAt) return null;
  const now = Date.now();
  const slaDue = new Date(dueAt).getTime();
  const created = new Date(ticket.createdAt).getTime();
  const remainingMs = slaDue - now;
  const totalWindowMs = slaDue - created;
  if (!Number.isFinite(totalWindowMs) || totalWindowMs <= 0) return null;
  const elapsedRatio = 1 - remainingMs / totalWindowMs;
  const risk = clamp(elapsedRatio * 1.4 + priorityPenalty(ticket.priority));
  const category = categoryFor(risk);
  return {
    ticketId: ticket._id,
    number: ticket.number,
    subject: ticket.subject,
    priority: ticket.priority,
    slaDueAt: slaDue,
    remainingMs,
    elapsedRatio,
    risk,
    category,
    etaLabel: etaLabel(remainingMs),
  };
}

async function predictBreach({ company, ticketId }) {
  const ticket = await Ticket.findById(ticketId)
    .where('company', company)
    .lean();
  return predictTicket(ticket);
}

// `scope` is supplied by the caller after its record-scope policy has been
// evaluated.  Keeping it in this service prevents dashboard-style callers
// from accidentally widening a tenant query to every ticket.
async function predictBreachMany({ company, limit = 50, scope = {} }) {
  const tickets = await Ticket.find({
    ...scope,
    company,
    status: { $nin: ['resolved', 'closed', 'cancelled', 'rejected', 'duplicate', 'spam', 'archived', 'deleted'] },
    $or: [
      { resolutionDueAt: { $ne: null } },
      { dueDate: { $ne: null } },
    ],
  })
    .sort({ slaDueAt: 1 })
    .limit(limit)
    .lean();

  const predictions = [];
  for (const ticket of tickets) {
    const result = await predictTicket(ticket);
    if (result) predictions.push(result);
  }

  return {
    atRisk: predictions.filter((p) => p.category === 'at_risk'),
    watching: predictions.filter((p) => p.category === 'watching'),
    green: predictions.filter((p) => p.category === 'green'),
    generatedAt: new Date(),
  };
}

module.exports = { predictBreach, predictBreachMany };
