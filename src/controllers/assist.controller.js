const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Ticket = require('../models/Ticket');
const Incident = require('../models/Incident');
const Department = require('../models/Department');
const HelpTopic = require('../models/HelpTopic');
const { fetchTrainingSet, suggest, invalidateTraining } = require('../services/suggestion.service');
const { summarizeThread } = require('../services/ai.service');

// POST /agent/tickets/suggest { subject, details, ticketNumber? }
// Tenant-learned triage: department / topic / priority votes + similar
// resolved tickets, each with confidence scores.
exports.suggestTriage = asyncHandler(async (req, res) => {
  const { subject = '', details = '', ticketNumber = '' } = req.body;
  const text = `${subject}\n${details}`.trim();
  if (!text && !ticketNumber) throw new ApiError(422, 'Provide subject/details or a ticketNumber');
  let queryText = text;
  if (!queryText && ticketNumber) {
    const t = await Ticket.findOne({ number: String(ticketNumber).toUpperCase(), ...(req.companyId ? { company: req.companyId } : {}) }).lean();
    if (!t) throw new ApiError(404, 'Ticket not found');
    queryText = [t.title || t.subject, t.body].filter(Boolean).join('\n');
  }
  const docs = await fetchTrainingSet(req.companyId).catch(() => []);
  const result = suggest({ text: queryText, docs });
  res.json({
    success: true,
    trainedOn: docs.length,
    learned: docs.length > 0,
    note: docs.length ? undefined : 'No resolved tickets yet — suggestions activate as history accumulates',
    ...result,
  });
});

// POST /agent/assist/summarize { ticketNumber?, incidentId?, text? }
exports.summarize = asyncHandler(async (req, res) => {
  const { ticketNumber = '', incidentId = '', text = '' } = req.body;
  let title = '';
  let entries = [];
  if (ticketNumber) {
    const t = await Ticket.findOne({ number: String(ticketNumber).toUpperCase(), ...(req.companyId ? { company: req.companyId } : {}) }).lean();
    if (!t) throw new ApiError(404, 'Ticket not found');
    title = t.title || t.subject || '';
    const thread = t.thread || t.threads || [];
    entries = thread.map((e) => ({
      author: (e.agent && e.agent.name) || (e.user && e.user.name) || e.authorName || 'system',
      type: e.type,
      body: e.body || e.content || e.systemMessage || '',
      createdAt: e.createdAt,
    })).filter((e) => e.body);
    if (!entries.length && t.body) entries = [{ author: 'requester', type: 'message', body: t.body }];
  } else if (incidentId) {
    const Inc = Incident && (Incident.findOne ? Incident : null);
    const inc = Inc ? await Inc.findOne({ _id: incidentId, ...(req.companyId ? { company: req.companyId } : {}) }).lean() : null;
    if (!inc) throw new ApiError(404, 'Incident not found');
    title = inc.title || '';
    entries = [...(inc.timeline || []), ...(inc.updates || [])].map((u) => ({
      author: u.by || 'system', type: 'update', body: u.message || u.status || '', createdAt: u.at,
    })).filter((e) => e.body);
    if (inc.description || inc.summary) entries.unshift({ author: 'system', type: 'update', body: inc.description || inc.summary });
  } else if (text) {
    entries = [{ author: 'requester', type: 'message', body: String(text) }];
  } else {
    throw new ApiError(422, 'Provide ticketNumber, incidentId or text');
  }
  const result = await summarizeThread({ title, entries });
  res.json({ success: true, ...result });
});

// Reference data for suggestion chips.
exports.suggestRefs = asyncHandler(async (req, res) => {
  const comp = req.companyId ? { company: req.companyId } : {};
  const [depts, topics] = await Promise.all([
    Department.find(comp).select('name').sort({ name: 1 }).lean().catch(() => []),
    HelpTopic.find({ status: 'active', ...(req.companyId ? { $or: [{ company: req.companyId }, { company: null }] } : {}) }).select('topic name').sort({ topic: 1 }).lean().catch(() => []),
  ]);
  res.json({ success: true, departments: depts, topics });
});

module.exports.invalidateTraining = invalidateTraining;
