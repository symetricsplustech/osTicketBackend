const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');
const Ticket = require('../models/Ticket');
const { sendFromTemplate } = require('./email.service');
const { emit } = require('./events');

/**
 * Send a CSAT/NPS/CES survey for a ticket after resolution/closure.
 */
async function sendSurveyForTicket(ticket, opts = {}) {
  try {
    const survey = await Survey.findOne({
      company: ticket.company,
      trigger: opts.trigger || 'on_close',
      isActive: true,
    }).sort({ createdAt: 1 });
    if (!survey) return null;
    if (!ticket.user) return null;

    await sendFromTemplate({
      key: 'csat_survey',
      to: ticket.user.email,
      data: { user: { name: ticket.user.name || '' }, ticketNumber: ticket.number, urls: { ticket: `/tickets/${ticket.number}` } },
      event: 'csat_survey',
      ticket: ticket._id,
      user: ticket.user,
      company: ticket.company,
    }).catch(() => {});

    await Ticket.updateOne({ _id: ticket._id }, { $set: { csatSentAt: new Date() } });
    emit('survey.sent', { company: ticket.company, ticketId: ticket._id, ticketNumber: ticket.number, surveyId: survey._id });
    return survey;
  } catch (err) {
    return null;
  }
}

/**
 * Record a survey response (CSAT rating 1-5 / NPS 0-10 / CES 1-7).
 */
async function submitResponse({ company, surveyId, ticketId, userId, rating, comment = '', metadata = {} }) {
  const survey = await Survey.findById(surveyId);
  if (!survey) throw new Error('Survey not found');

  const ticket = ticketId ? await Ticket.findById(ticketId) : null;
  const existing = ticketId ? await SurveyResponse.findOne({ ticket: ticketId }) : null;
  if (existing) throw new Error('Survey already submitted for this ticket');

  const response = await SurveyResponse.create({
    company,
    survey: survey._id,
    ticket: ticketId || null,
    user: userId || null,
    agent: ticket?.agent || null,
    department: ticket?.dept || null,
    rating,
    comment,
    metadata,
  });

  if (ticket) {
    await Ticket.updateOne({ _id: ticket._id }, { $set: { csatRating: rating, csatComment: comment } });
  }
  emit('csat.submitted', { company, ticketId, ticketNumber: ticket?.number, surveyId: survey._id, rating });
  return response;
}

/**
 * Aggregated survey analytics: overall + by agent + by department.
 */
async function surveyAnalytics({ company, type }) {
  const surveys = await Survey.find({ company, ...(type ? { type } : {}) }).lean();
  const ids = surveys.map((s) => s._id);
  const responses = await SurveyResponse.find({ company, survey: { $in: ids } }).populate('agent', 'name').populate('department', 'name');

  const byType = {};
  for (const s of surveys) {
    const rs = responses.filter((r) => String(r.survey) === String(s._id));
    const avg = rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : null;
    byType[s.type] = {
      surveyId: s._id,
      name: s.name,
      question: s.question,
      responses: rs.length,
      average: avg ? Math.round(avg * 100) / 100 : null,
      distribution: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => ({ rating: r, count: rs.filter((x) => x.rating === r).length })),
      recent: rs.slice(-10).reverse().map((r) => ({ rating: r.rating, comment: r.comment, respondedAt: r.respondedAt })),
    };
  }

  const byAgent = {};
  for (const r of responses) {
    const key = r.agent ? String(r.agent._id) : 'unassigned';
    const name = r.agent?.name || 'Unassigned';
    const entry = (byAgent[key] = byAgent[key] || { agentId: key, name, count: 0, total: 0, comments: [] });
    entry.count += 1;
    entry.total += r.rating;
    if (r.comment) entry.comments.push({ rating: r.rating, comment: r.comment });
  }
  const byDepartment = {};
  for (const r of responses) {
    const key = r.department ? String(r.department._id) : 'none';
    const name = r.department?.name || 'No department';
    const entry = (byDepartment[key] = byDepartment[key] || { deptId: key, name, count: 0, total: 0 });
    entry.count += 1;
    entry.total += r.rating;
  }
  return {
    byType,
    byAgent: Object.values(byAgent).map((a) => ({ ...a, average: a.count ? Math.round((a.total / a.count) * 100) / 100 : null })),
    byDepartment: Object.values(byDepartment).map((d) => ({ ...d, average: d.count ? Math.round((d.total / d.count) * 100) / 100 : null })),
  };
}

module.exports = { sendSurveyForTicket, submitResponse, surveyAnalytics };