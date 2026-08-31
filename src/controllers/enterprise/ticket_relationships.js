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


exports.listTicketLinks = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne({ number: String(req.params.number).toUpperCase(), ...scope(req) });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  const links = await TicketLink.find({ company: req.companyId, $or: [{ from: ticket._id }, { to: ticket._id }] })
    .populate('from', 'number subject status')
    .populate('to', 'number subject status');
  res.json({ success: true, items: links });
});
exports.addTicketLink = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne({ number: String(req.params.number).toUpperCase(), ...scope(req) });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  const { targetNumber, type } = req.body;
  if (!targetNumber) throw new ApiError(422, 'Target ticket number is required');
  const target = await Ticket.findOne({ number: String(targetNumber).toUpperCase(), ...scope(req) });
  if (!target) throw new ApiError(404, 'Target ticket not found');
  if (String(target._id) === String(ticket._id)) throw new ApiError(400, 'Cannot link ticket to itself');
  if (!TicketLink.TYPES.includes(type)) throw new ApiError(422, 'Invalid link type');
  let link = await TicketLink.findOne({ company: req.companyId, from: ticket._id, to: target._id });
  if (!link) {
    link = await TicketLink.create({ company: req.companyId, from: ticket._id, to: target._id, type, createdBy: req.agent._id });
  } else {
    link.type = type;
    await link.save();
  }
  res.status(201).json({ success: true, item: link });
});
exports.removeTicketLink = asyncHandler(async (req, res) => {
  await TicketLink.findByIdAndDelete(req.params.linkId);
  res.json({ success: true, message: 'Link removed' });
});
