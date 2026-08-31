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


exports.listIncidents = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-startedAt' });
  const query = { ...scope(req) };
  if (req.query.status) query.status = req.query.status;
  if (req.query.severity) query.severity = req.query.severity;
  const [items, total] = await Promise.all([
    Incident.find(query).sort(getSortObj(sort)).skip(skip).limit(limit).populate('commander', 'name').populate('team', 'name'),
    Incident.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});
exports.getIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findOne({ _id: req.params.id, ...scope(req) })
    .populate('commander', 'name')
    .populate('team', 'name', 'members')
    .populate('affectedTickets', 'number subject status priority');
  if (!incident) throw new ApiError(404, 'Incident not found');
  res.json({ success: true, item: incident });
});
exports.createIncident = asyncHandler(async (req, res) => {
  const { title, summary, severity, commander, teamId } = req.body;
  if (!title) throw new ApiError(422, 'Title is required');
  const count = await Incident.countDocuments(scope(req));
  const incident = await Incident.create({
    number: `INC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
    company: req.companyId,
    title,
    summary: summary || '',
    severity: severity || 'Sev3',
    status: 'investigating',
    commander: commander || null,
    team: teamId || null,
    createdBy: req.agent._id,
  });
  res.status(201).json({ success: true, item: incident });
});
exports.updateIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findOne({ _id: req.params.id, ...scope(req) });
  if (!incident) throw new ApiError(404, 'Incident not found');
  const { summary, severity, status, commander, teamId, resolution, rootCause, workaround, postmortem } = req.body;
  if (summary !== undefined) incident.summary = summary;
  if (severity !== undefined) incident.severity = severity;
  if (commander !== undefined) incident.commander = commander;
  if (teamId !== undefined) incident.team = teamId;
  if (resolution !== undefined) incident.resolution = resolution;
  if (rootCause !== undefined) incident.rootCause = rootCause;
  if (workaround !== undefined) incident.workaround = workaround;
  if (postmortem !== undefined) incident.postmortem = postmortem;
  if (status) {
    incident.status = status;
    if (status === 'resolved') incident.resolvedAt = new Date();
    if (status === 'closed') incident.closedAt = new Date();
  }
  await incident.save();
  res.json({ success: true, item: incident });
});
exports.addIncidentTimeline = asyncHandler(async (req, res) => {
  const incident = await Incident.findOne({ _id: req.params.id, ...scope(req) });
  if (!incident) throw new ApiError(404, 'Incident not found');
  const { message, by } = req.body;
  if (!message) throw new ApiError(422, 'Message is required');
  incident.timeline.push({ at: new Date(), by: by || req.agent.name, message });
  await incident.save();
  res.json({ success: true, item: incident });
});
exports.linkTicketsToIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findOne({ _id: req.params.id, ...scope(req) });
  if (!incident) throw new ApiError(404, 'Incident not found');
  const { ticketNumbers } = req.body;
  if (!Array.isArray(ticketNumbers)) throw new ApiError(422, 'ticketNumbers array required');
  const tickets = await Ticket.find({ number: { $in: ticketNumbers.map((n) => String(n).toUpperCase()) }, ...scope(req) });
  const ids = tickets.map((t) => t._id);
  for (const t of tickets) {
    await Ticket.updateOne({ _id: t._id }, { $set: { incident: incident._id } });
  }
  incident.affectedTickets = [...new Set([...incident.affectedTickets.map(String), ...ids.map(String)])];
  await incident.save();
  res.json({ success: true, item: incident, linked: tickets.map((t) => t.number) });
});
