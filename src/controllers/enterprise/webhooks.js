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


exports.listWebhooks = asyncHandler(async (req, res) => {
  const webhooks = await Webhook.find(scope(req)).sort({ createdAt: -1 });
  res.json({ success: true, items: webhooks });
});
exports.createWebhook = asyncHandler(async (req, res) => {
  const { name, url, secret, events, isActive } = req.body;
  if (!name || !url) throw new ApiError(422, 'Name and URL are required');
  if (!Array.isArray(events) || !events.length) throw new ApiError(422, 'At least one event is required');
  const webhook = await Webhook.create({ name, company: req.companyId, url, secret: secret || '', events, isActive: isActive !== false, createdBy: req.agent._id });
  res.status(201).json({ success: true, item: webhook });
});
exports.updateWebhook = asyncHandler(async (req, res) => {
  const webhook = await Webhook.findOne({ _id: req.params.id, ...scope(req) });
  if (!webhook) throw new ApiError(404, 'Webhook not found');
  const { name, url, secret, events, isActive } = req.body;
  if (name) webhook.name = name;
  if (url) webhook.url = url;
  if (secret !== undefined) webhook.secret = secret;
  if (events) webhook.events = events;
  if (isActive !== undefined) webhook.isActive = isActive;
  await webhook.save();
  res.json({ success: true, item: webhook });
});
exports.deleteWebhook = asyncHandler(async (req, res) => {
  await Webhook.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Webhook deleted' });
});
