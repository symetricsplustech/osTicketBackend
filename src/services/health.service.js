const HealthScore = require('../models/HealthScore');
const Ticket = require('../models/Ticket');
const Contract = require('../models/Contract');
const Incident = require('../models/Incident');
const SurveyResponse = require('../models/SurveyResponse');
const User = require('../models/User');
const Organization = require('../models/Organization');

const gradeOf = (score) => {
  if (score == null) return 'unknown';
  if (score >= 70) return 'healthy';
  if (score >= 40) return 'at_risk';
  return 'critical';
};

/**
 * Compute a customer health score (0-100) for a user or organization.
 * Signals: open/overdue tickets, SLA breaches, sentiment, CSAT/NPS, incidents,
 * churn signals, renewal proximity.
 */
async function computeHealth({ company, subjectType = 'organization', subjectId }) {
  const comp = { company };
  const orgId = subjectType === 'organization' ? subjectId : null;
  const userId = subjectType === 'user' ? subjectId : null;

  const userQuery = { ...comp, status: { $ne: 'disabled' } };
  if (orgId) {
    const users = await User.find({ ...comp, organization: orgId }).lean();
    userQuery._id = { $in: users.map((u) => u._id) };
    if (!users.length) userQuery._id = { $in: [] };
  } else if (userId) {
    userQuery._id = userId;
  }

  const [open, overdue, all30, incidents, responses, contracts] = await Promise.all([
    Ticket.countDocuments({ ...userQuery, status: { $in: ['open', 'assigned'] } }),
    Ticket.countDocuments({ ...userQuery, status: 'overdue' }),
    Ticket.countDocuments({ ...userQuery, status: { $nin: ['deleted'] }, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }),
    Incident.countDocuments({ ...comp, status: { $nin: ['resolved', 'closed'] } }),
    SurveyResponse.find(userQuery).populate('survey', 'type').lean(),
    orgId ? Contract.find({ ...comp, organization: orgId }).lean() : [],
  ]);

  let score = 100;
  const signals = { openTickets: open, overdueTickets: overdue, slaBreaches: 0, unresolvedPerWeek: Math.round((all30 / 4.3) * 10) / 10, avgSentiment: 'neutral', negativeShare: 0, csatAvg: null, npsAvg: null, incidents, criticalIncidents: 0, churnSignals: [], renewalDays: null };

  score -= Math.min(30, open * 4);
  score -= Math.min(25, overdue * 8);

  const csat = responses.filter((r) => r.survey?.type === 'csat');
  const nps = responses.filter((r) => r.survey?.type === 'nps');
  if (csat.length) {
    signals.csatAvg = Math.round((csat.reduce((a, r) => a + r.rating, 0) / csat.length) * 10) / 10;
    score += signals.csatAvg >= 4.5 ? 5 : signals.csatAvg >= 3.5 ? 0 : -10;
  }
  if (nps.length) {
    signals.npsAvg = Math.round((nps.reduce((a, r) => a + r.rating, 0) / nps.length) * 10) / 10;
    if (signals.npsAvg >= 7) score += 5;
    if (signals.npsAvg < 4) score -= 10;
  }

  if (incidents) score -= Math.min(20, incidents * 5);
  if (overdue) signals.churnSignals.push('overdue tickets');
  if (open >= 10) signals.churnSignals.push('high open volume');

  if (orgId) {
    for (const c of contracts) {
      if (c.status === 'active' && c.endDate) {
        const days = Math.ceil((new Date(c.endDate) - Date.now()) / 86400000);
        signals.renewalDays = days;
        if (days <= 30) {
          signals.churnSignals.push(`renewal in ${days} days`);
          score -= 10;
        }
      }
    }
  }

  score = Math.max(5, Math.min(100, Math.round(score)));
  signals.slaBreaches = overdue;

  const doc = await HealthScore.findOneAndUpdate(
    { company, subjectType, subjectId },
    { company, subjectType, subjectId, score, grade: gradeOf(score), signals, lastComputed: new Date() },
    { upsert: true, new: true }
  );

  // mirror onto entity for quick UI access
  const Model = subjectType === 'organization' ? Organization : User;
  await Model.updateOne({ _id: subjectId }, { $set: { health: { score, signals, lastComputed: new Date() } } }).catch(() => {});

  return doc;
}

async function getHealth({ company, subjectType, subjectId }) {
  const existing = await HealthScore.findOne({ company, subjectType, subjectId });
  if (!existing || Date.now() - new Date(existing.lastComputed).getTime() > 6 * 3600000) {
    return computeHealth({ company, subjectType, subjectId });
  }
  return existing;
}

module.exports = { computeHealth, getHealth, gradeOf };