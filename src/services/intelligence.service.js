const AiSnapshot = require('../models/AiSnapshot');
const Ticket = require('../models/Ticket');
const Faq = require('../models/Faq');
const ai = require('./ai.service');
const sla = require('./sla.service');

const getTicketText = (ticket) => `${ticket.subject} ${ticket.customData?.details || ''} ${ticket.customData?.description || ''}`.trim();

/**
 * Compute (and persist) the full AI intelligence panel for a ticket.
 * Combines: summary, intent/sentiment/urgency/language, entities, category,
 * complexity, suggested dept/priority/sla/tags, similar tickets, KB articles,
 * SLA risk, churn risk, confidence. Emits socket update when done.
 */
async function computeIntelligence(ticketId) {
  try {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return null;
    const text = getTicketText(ticket);

    const analysis = await ai.analyze(text);
    const summary = await ai.summarize(text);
    const [kb, similar, slaRisk] = await Promise.all([
      ai.kbRecommendations(text, ticket.company, 4),
      ai.similarTickets(text, ticket.company, ticket._id, 4),
      sla.predictBreachRisk(ticket),
    ]);

    // Department / priority / SLA suggestions from match data
    let suggestedPriority = analysis.urgency ? { low: 'Low', normal: 'Normal', high: 'High', critical: 'Emergency' }[analysis.urgency] : ticket.priority;
    let suggestedSla = '';
    let suggestedDepartment = '';
    let suggestedAgent = '';
    const HelpTopic = require('../models/HelpTopic');
    if (ticket.topic) {
      const topic = await HelpTopic.findById(ticket.topic).lean();
      if (topic) {
        suggestedDepartment = topic.department ? 'topic.department' : '';
        suggestedSla = topic.sla ? 'topic.sla' : '';
      }
    }

    // churn risk heuristic: negative/frustrated sentiment + repeated contacts
    let churnRisk = 0;
    if (['negative', 'frustrated'].includes(analysis.sentiment)) churnRisk += 35;
    if (ticket.stats && ticket.stats.reopened > 0) churnRisk += Math.min(25, ticket.stats.reopened * 10);
    if (ticket.priority === 'High') churnRisk += 10;
    if (ticket.priority === 'Emergency') churnRisk += 20;
    churnRisk = Math.min(90, churnRisk);

    const confidence = analysis.urgency === 'critical' ? 0.92 : 0.8;

    const snapshot = await AiSnapshot.findOneAndUpdate(
      { ticket: ticket._id },
      {
        company: ticket.company,
        ticket: ticket._id,
        model: ai.aiEnabled() ? 'llm' : 'heuristic',
        provider: ai.aiEnabled() ? configProvider() : 'local',
        summary,
        intent: analysis.intent,
        sentiment: analysis.sentiment,
        urgency: analysis.urgency,
        language: analysis.language,
        entities: analysis.entities || {},
        category: analysis.category || analysis.intent,
        complexity: analysis.complexity || 'medium',
        suggestedDepartment,
        suggestedAgent,
        suggestedPriority,
        suggestedSla,
        suggestedTags: Array.isArray(analysis.tags) ? analysis.tags : [],
        similarTickets: similar,
        kbArticles: kb.map((k) => ({ id: k.id, question: k.question, score: Math.round(k.score * 100) })),
        replySuggestions: await ai.replySuggestions(text),
        slaRisk,
        churnRisk,
        confidence,
      },
      { upsert: true, new: true }
    );

    // Update ticket lightweight fields for queueing/filters
    await Ticket.updateOne(
      { _id: ticket._id },
      {
        $set: {
          intent: analysis.intent || '',
          sentiment: analysis.sentiment || 'neutral',
          urgency: analysis.urgency || 'normal',
          language: analysis.language || '',
          aiSummary: summary || '',
          aiRisk: slaRisk,
          complexity: analysis.complexity || 'medium',
        },
        $addToSet: { tags: { $each: Array.isArray(analysis.tags) ? analysis.tags : [] } },
      }
    );

    const { getIO } = require('../config/socket');
    const io = getIO();
    if (io) io.to(`admin:room`).emit('ticket:intelligence', { ticketId: ticket._id, number: ticket.number });
    return snapshot;
  } catch (err) {
    return null;
  }
}

const configProvider = () => {
  try {
    const config = require('../config/config');
    return config.ai.provider || 'local';
  } catch (err) {
    return 'local';
  }
};

/**
 * Get cached (or freshly computed) intelligence panel.
 */
async function getIntelligence(ticketId) {
  let snap = await AiSnapshot.findOne({ ticket: ticketId });
  if (!snap) snap = await computeIntelligence(ticketId);
  if (snap) {
    const ticket = await Ticket.findById(ticketId).lean();
    if (ticket) {
      snap = snap.toObject();
      snap.slaRisk = ticket.aiRisk ?? snap.slaRisk;
      snap.sentiment = ticket.sentiment || snap.sentiment;
      snap.urgency = ticket.urgency || snap.urgency;
    }
  }
  return snap;
}

/**
 * AI knowledge loop: detect recurring patterns in recently resolved tickets
 * and draft a KB article for agent review.
 */
async function suggestArticlesFromResolved(company, days = 14) {
  const since = new Date(Date.now() - days * 86400000);
  const tickets = await Ticket.find({
    company,
    status: 'closed',
    closedAt: { $gte: since },
    aiSummary: { $ne: '' },
  })
    .sort({ closedAt: -1 })
    .limit(100)
    .lean();

  const buckets = new Map();
  for (const t of tickets) {
    const intent = t.intent || 'general';
    const arr = buckets.get(intent) || [];
    arr.push(t);
    buckets.set(intent, arr);
  }

  const drafts = [];
  for (const [intent, list] of buckets) {
    if (list.length < 3) continue; // need recurring pattern
    const draft = await ai.draftArticleFromTickets(list.slice(0, 5));
    drafts.push({ ...draft, intent, count: list.length, ticketNumbers: list.slice(0, 5).map((t) => t.number) });
  }
  return drafts;
}

module.exports = { computeIntelligence, getIntelligence, suggestArticlesFromResolved }; 