const Ticket = require('../models/Ticket');
const TicketThread = require('../models/TicketThread');
const Agent = require('../models/Agent');
const Faq = require('../models/Faq');
const AiSnapshot = require('../models/AiSnapshot');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const ai = require('../services/ai.service');
const intelligence = require('../services/intelligence.service');

const loadTicketForAgent = async (number, agent, company) => {
  const ticket = await Ticket.findOne({ number: String(number).toUpperCase(), company: company || null });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  return ticket;
};

const loadThread = (ticketId) => TicketThread.find({ ticket: ticketId, deletedAt: null }).sort({ createdAt: 1 });

exports.intelligence = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent, req.companyId);
  const snapshot = await intelligence.getIntelligence(ticket._id);
  res.json({ success: true, item: snapshot });
});

exports.refreshIntelligence = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent, req.companyId);
  const snapshot = await intelligence.computeIntelligence(ticket._id);
  res.json({ success: true, item: snapshot });
});

exports.assist = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent, req.companyId);
  const { message } = req.body;
  const thread = await loadThread(ticket._id);
  const history = thread.filter((x) => x.body).slice(-10).map((x) => `[${x.posterType || x.type}] ${x.body}`).join('\n');
  const assist = await ai.agentAssist(ticket, message || ticket.subject, { history });
  res.json({ success: true, ...assist });
});

exports.summarize = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) throw new ApiError(422, 'text required');
  res.json({ success: true, summary: await ai.summarize(text) });
});

exports.analyze = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) throw new ApiError(422, 'text required');
  res.json({ success: true, analysis: await ai.analyze(text) });
});

exports.rewrite = asyncHandler(async (req, res) => {
  const { text, tone } = req.body;
  if (!text) throw new ApiError(422, 'text required');
  res.json({ success: true, text: await ai.rewrite(text, tone || 'professional') });
});

exports.translate = asyncHandler(async (req, res) => {
  const { text, target } = req.body;
  if (!text || !target) throw new ApiError(422, 'text and target required');
  res.json({ success: true, text: await ai.translate(text, target) });
});

exports.handoff = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent, req.companyId);
  const thread = await loadThread(ticket._id);
  res.json({ success: true, handoff: await ai.handoffSummary(ticket, thread) });
});

exports.resolution = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent, req.companyId);
  const thread = await loadThread(ticket._id);
  res.json({ success: true, summary: await ai.resolutionSummary(ticket, thread) });
});

exports.qa = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent, req.companyId);
  const thread = await loadThread(ticket._id);
  const result = await ai.qaEvaluate(thread);
  await AiSnapshot.updateOne(
    { ticket: ticket._id },
    { $set: { qa: { score: result.score, checks: result.checks, evaluatedAt: new Date() } } },
    { upsert: true }
  );
  await Agent.updateOne({ _id: req.agent._id }, { $set: { qaScore: result.score } });
  res.json({ success: true, ...result });
});

exports.replySuggestions = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent, req.companyId);
  const { text } = req.body;
  res.json({ success: true, suggestions: await ai.replySuggestions(text || ticket.subject) });
});

exports.autoResolvePreview = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent, req.companyId);
  const text = `${ticket.subject} ${ticket.customData?.details || ''}`;
  const result = await ai.autoResolve(text, ticket.company);
  res.json({ success: true, result: result || { shouldResolve: false } });
});

exports.autoResolveTicket = asyncHandler(async (req, res) => {
  const ticket = await loadTicketForAgent(req.params.number, req.agent, req.companyId);
  const text = `${ticket.subject} ${ticket.customData?.details || ''}`;
  const result = await ai.autoResolve(text, ticket.company);
  if (!result || !result.shouldResolve) {
    res.json({ success: true, resolved: false, message: 'Confidence too low for auto-resolution' });
    return;
  }
  const ticketService = require('../services/ticket.service');
  await ticketService.addThreadEntry({
    ticket,
    type: 'message',
    posterType: 'agent',
    agent: { _id: req.agent._id },
    body: result.reply,
    title: 'Response',
  });
  const { notifyUser } = require('../services/notification.service');
  await notifyUser({ userId: ticket.user, type: 'reply', message: `A response was posted on ticket #${ticket.number}`, link: `/ticket/${ticket.number}`, ticket: ticket._id, company: ticket.company });
  await ticketService.handleTicketClosed(ticket, { actor: req.agent._id });
  ticket.status = 'closed';
  ticket.closedAt = new Date();
  ticket.closedBy = req.agent._id;
  await ticket.save();
  res.json({ success: true, resolved: true, reply: result.reply, confidence: result.confidence });
});

exports.kbSuggestions = asyncHandler(async (req, res) => {
  const drafts = await intelligence.suggestArticlesFromResolved(req.companyId, parseInt(req.query.days, 10) || 14);
  res.json({ success: true, items: drafts });
});

exports.createDraftArticle = asyncHandler(async (req, res) => {
  const { question, answer, intent, relatedTickets } = req.body;
  if (!question || !answer) throw new ApiError(422, 'question and answer required');
  const FaqCategory = require('../models/FaqCategory');
  let cat = await FaqCategory.findOne({ company: req.companyId, name: new RegExp('^AI Drafts$', 'i') });
  if (!cat) cat = await FaqCategory.create({ name: 'AI Drafts', company: req.companyId, description: 'Auto-generated drafts from AI knowledge loop', isPublic: false });
  const faq = await Faq.create({
    category: cat._id,
    company: req.companyId,
    question,
    answer,
    lifecycle: 'draft',
    isPublished: false,
    createdBy: req.agent._id,
    keywords: [intent || ''].filter(Boolean),
    relatedTickets: relatedTickets || [],
  });
  res.status(201).json({ success: true, item: faq });
});

exports.reviewArticle = asyncHandler(async (req, res) => {
  const { lifecycle } = req.body;
  if (!['draft', 'review', 'approved', 'published', 'archived'].includes(lifecycle)) throw new ApiError(422, 'Invalid lifecycle state');
  const faq = await Faq.findOneAndUpdate({ _id: req.params.id, company: req.companyId }, { $set: { lifecycle, isPublished: lifecycle === 'published', reviewedBy: req.agent._id, reviewedAt: new Date() } }, { new: true });
  if (!faq) throw new ApiError(404, 'Article not found');
  res.json({ success: true, item: faq });
});

exports.qaAgent = asyncHandler(async (req, res) => {
  const agent = await Agent.findById(req.params.id).select('name qaScore presence');
  if (!agent) throw new ApiError(404, 'Agent not found');
  res.json({ success: true, item: agent });
});