const Skill = require('../../models/Skill');
const Workflow = require('../../models/Workflow');
const Approval = require('../../models/Approval');
const Incident = require('../../models/Incident');
const Problem = require('../../models/Problem');
const Change = require('../../models/Change');
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
const TicketLink = require('../../models/TicketLink');
const Ticket = require('../../models/Ticket');
const Agent = require('../../models/Agent');
const User = require('../../models/User');
const Organization = require('../../models/Organization');
const Department = require('../../models/Department');
const Team = require('../../models/Team');
const CannedResponse = require('../../models/CannedResponse');
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
    if (t) ticket = t;
  }
  let user = null;
  if (userEmail) {
    const u = await User.findOne({ email: String(userEmail).toLowerCase(), ...scope(req) });
    if (u) user = u;
  }
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
    durationSec: durationSec || 0,
    recordingUrl: recordingUrl || '',
    transcription: transcription || '',
    callbackScheduled: callbackScheduled || null,
    notes: notes || '',
    createdBy: req.agent._id,
  });
  res.status(201).json({ success: true, item: call });
});
exports.updateCallLog = asyncHandler(async (req, res) => {
  const call = await CallLog.findOne({ _id: req.params.id, ...scope(req) });
  if (!call) throw new ApiError(404, 'Call not found');
  const KEYS = ['status', 'durationSec', 'recordingUrl', 'transcription', 'aiSummary', 'callbackScheduled', 'notes', 'agent'];
  for (const key of KEYS) {
    if (req.body[key] !== undefined) call[key] = req.body[key];
  }
  await call.save();
  res.json({ success: true, item: call });
});
