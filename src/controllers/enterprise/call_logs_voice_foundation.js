const Skill = require('../../models/Skill');
const Workflow = require('../../models/Workflow');
const Approval = require('../../models/Approval');
const Incident = require('../../models/helpdesk/incidents/Incident');
const Problem = require('../../models/helpdesk/incidents/Problem');
const Change = require('../../models/helpdesk/incidents/Change');
const Asset = require('../../models/Asset');
const Dependency = require('../../models/Dependency');
const ServiceCatalogItem = require('../../models/ServiceCatalogItem');
const Contract = require('../../models/Contract');
const Entitlement = require('../../models/Entitlement');
const Survey = require('../../models/Survey');
const SurveyResponse = require('../../models/SurveyResponse');
const StatusPage = require('../../models/StatusPage');
const StatusIncident = require('../../models/StatusIncident');
const Webhook = require('../../models/Webhook');
const ApiKey = require('../../models/ApiKey');
const TicketLink = require('../../models/helpdesk/tickets/TicketLink');
const Ticket = require('../../models/helpdesk/tickets/Ticket');
const Agent = require('../../models/Agent');
const User = require('../../models/User');
const Organization = require('../../models/Organization');
const Department = require('../../models/Department');
const Team = require('../../models/Team');
const CannedResponse = require('../../models/helpdesk/knowledge/CannedResponse');
const CallLog = require('../../models/CallLog');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { getPagination, getSortObj } = require('../../utils/pagination');
const approvalService = require('../../services/approval.service');
const csatService = require('../../services/csat.service');
const healthService = require('../../services/health.service');
const statusPageService = require('../../services/statusPage.service');
const searchService = require('../../services/search.service');
const realtime = require('../../services/realtime.service');
const reporting = require('../../services/reporting.service');
const chatService = require('../../services/chat.service');
const workflowService = require('../../services/workflow.service');
const auditService = require('../../services/audit.service');

const scope = (req) => (req.companyId ? { company: req.companyId } : {});
const scopeExact = (req) => (req.companyId ? { company: req.companyId } : { company: null });

// ============================== SKILLS ==============================








// ============================== WORKFLOWS ==============================










// ============================== APPROVALS ==============================












// ============================== INCIDENTS ==============================












// ============================== PROBLEMS ==============================
const PROBLEM_FIELDS = ['title', 'description', 'status', 'rootCause', 'workaround', 'permanentSolution', 'postmortem', 'priority', 'assignedTo', 'knownError'];











// ============================== CHANGES ==============================










// ============================== ASSETS / CMDB ==============================
















/**
 * Impact analysis: find all assets that depend (transitively) on a failing asset,
 * plus their open tickets and affected users.
 */


// ============================== SERVICE CATALOG ==============================








// ============================== CONTRACTS / ENTITLEMENTS ==============================


















// ============================== SURVEYS (CSAT/NPS/CES) ==============================










// ============================== STATUS PAGE ==============================






















// ============================== WEBHOOKS ==============================








// ============================== API KEYS ==============================






// ============================== TICKET RELATIONSHIPS ==============================






// ============================== CALL LOGS (voice foundation) ==============================






// ============================== CHAT (omnichannel inbox) ==============================










// ============================== CSAT (user submit) ==============================


// ============================== HEALTH / CUSTOMER 360 ==============================


// ============================== SEARCH / AUDIT / REPORTS / REALTIME ==============================
















// ============================== OUTAGE SIGNALS → INCIDENT (proactive) ==============================


exports.listCallLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req, { page: 1, limit: 25, sort: '-startedAt' });
  const query = { ...scope(req) };
  if (req.query.status) query.status = req.query.status;
  if (req.query.direction) query.direction = req.query.direction;
  const [items, total] = await Promise.all([
    CallLog.find(query).sort({ startedAt: -1 }).skip(skip).limit(limit).populate('agent', 'name').populate('user', 'name email'),
    CallLog.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});
exports.createCallLog = asyncHandler(async (req, res) => {
  const { callId, ticketNumber, userEmail, callerName, callerNumber, agent, direction, status, durationSec, recordingUrl, transcription, callbackScheduled, notes } = req.body;
  let ticket = null;
  if (ticketNumber) {
    const t = await Ticket.findOne({ number: String(ticketNumber).toUpperCase(), ...scope(req) });
    if (!t) throw new ApiError(404, 'Ticket not found in this tenant');
    ticket = t;
  }
  let user = null;
  if (userEmail) {
    const u = await User.findOne({ email: String(userEmail).toLowerCase(), ...scope(req) });
    if (!u) throw new ApiError(404, 'User not found in this tenant');
    user = u;
  }
  if (agent && !(await Agent.exists({ _id: agent, ...scope(req), isActive: true }))) throw new ApiError(404, 'Agent not found in this tenant');
  if (direction !== undefined && !['inbound', 'outbound'].includes(direction)) throw new ApiError(422, 'Invalid call direction');
  if (status !== undefined && !['ringing', 'in_progress', 'completed', 'missed', 'failed', 'cancelled'].includes(status)) throw new ApiError(422, 'Invalid call status');
  if (durationSec !== undefined && (!Number.isFinite(Number(durationSec)) || Number(durationSec) < 0)) throw new ApiError(422, 'durationSec must be a non-negative number');
  const call = await CallLog.create({
    company: req.companyId,
    callId: callId || '',
    ticket: ticket?._id || null,
    user: user?._id || null,
    callerName: callerName || '',
    callerNumber: callerNumber || '',
    agent: agent || null,
    direction: direction || 'inbound',
    status: status || 'completed',
    durationSec: durationSec === undefined ? 0 : Number(durationSec),
    recordingUrl: recordingUrl || '',
    transcription: transcription || '',
    callbackScheduled: callbackScheduled || null,
    notes: notes || '',
    createdBy: req.agent._id,
  });
  await auditService.auditRequired({ company: call.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'call.created', entityType: 'call', entityId: call._id, after: { ticket: call.ticket, user: call.user, agent: call.agent, direction: call.direction, status: call.status, durationSec: call.durationSec }, req });
  res.status(201).json({ success: true, item: call });
});
exports.updateCallLog = asyncHandler(async (req, res) => {
  const call = await CallLog.findOne({ _id: req.params.id, ...scope(req) });
  if (!call) throw new ApiError(404, 'Call not found');
  const KEYS = ['status', 'durationSec', 'recordingUrl', 'transcription', 'aiSummary', 'callbackScheduled', 'notes', 'agent'];
  const before = { status: call.status, durationSec: call.durationSec, recordingUrl: call.recordingUrl, transcription: call.transcription, aiSummary: call.aiSummary, callbackScheduled: call.callbackScheduled, notes: call.notes, agent: call.agent };
  if (req.body.status !== undefined && !['ringing', 'in_progress', 'completed', 'missed', 'failed', 'cancelled'].includes(req.body.status)) throw new ApiError(422, 'Invalid call status');
  if (req.body.durationSec !== undefined && (!Number.isFinite(Number(req.body.durationSec)) || Number(req.body.durationSec) < 0)) throw new ApiError(422, 'durationSec must be a non-negative number');
  if (req.body.agent !== undefined && req.body.agent !== null && !(await Agent.exists({ _id: req.body.agent, ...scope(req), isActive: true }))) throw new ApiError(404, 'Agent not found in this tenant');
  for (const key of KEYS) {
    if (req.body[key] !== undefined) call[key] = req.body[key];
  }
  await call.save();
  await auditService.auditRequired({ company: call.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'call.updated', entityType: 'call', entityId: call._id, before, after: { status: call.status, durationSec: call.durationSec, recordingUrl: call.recordingUrl, transcription: call.transcription, aiSummary: call.aiSummary, callbackScheduled: call.callbackScheduled, notes: call.notes, agent: call.agent }, req });
  res.json({ success: true, item: call });
});

/**
 * Phone channel (§8): log a call onto a ticket thread. The transcription /
 * AI summary becomes an internal note by default, or a public agent reply
 * when `publicReply: true` (emailed to the customer like any reply).
 */
exports.logCallToTicket = asyncHandler(async (req, res) => {
  const call = await CallLog.findOne({ _id: req.params.id, ...scope(req) });
  if (!call) throw new ApiError(404, 'Call not found');
  const { ticketNumber, publicReply } = req.body;
  if (!ticketNumber) throw new ApiError(422, 'ticketNumber is required');
  const ticket = await Ticket.findOne({ number: String(ticketNumber).trim().toUpperCase(), ...scope(req) });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  const ticketService = require('../../services/ticket.service');
  const body = [
    `Phone call (${call.direction || 'inbound'}) ${call.callerNumber ? `from ${call.callerNumber}` : ''} — ${call.durationSec || 0}s.`,
    call.aiSummary ? `Summary: ${call.aiSummary}` : '',
    call.transcription ? `Transcript: ${String(call.transcription).slice(0, 3000)}` : '',
  ].filter(Boolean).join('\n');
  const agent = req.agent || { _id: call.agent || null, name: 'Phone system' };
  if (publicReply) {
    await ticketService.addThreadEntry({ ticket, type: 'message', posterType: 'agent', agent: agent._id ? agent : null, body });
    try {
      const ctx = await ticketService.buildTicketContext(ticket);
      const emailService = require('../../services/email.service');
      if (ctx.user.email) {
        await emailService.sendFromTemplate({ key: 'ticket_response', to: ctx.user.email, data: ctx, event: 'ticket_response', ticket: ticket._id, user: ticket.user, company: ticket.company });
      }
    } catch (_) { /* non-blocking */ }
  } else {
    await ticketService.addThreadEntry({ ticket, type: 'note', posterType: 'agent', agent: agent._id ? agent : null, title: 'Call note', body });
  }
  call.ticket = ticket._id;
  await call.save();
  await auditService.auditRequired({ company: call.company, actorType: 'agent', actor: req.agent._id, actorName: req.agent.name, action: 'call.logged_to_ticket', entityType: 'call', entityId: call._id, after: { ticket: ticket._id, publicReply: !!publicReply }, req });
  res.json({ success: true, ticketNumber: ticket.number, public: !!publicReply });
});
