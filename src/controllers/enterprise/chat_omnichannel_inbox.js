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


exports.listConversations = asyncHandler(async (req, res) => {
  const data = await chatService.listConversations({
    company: req.companyId,
    status: req.query.status,
    channel: req.query.channel,
    agentId: req.query.mine === 'true' ? req.agent._id : null,
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 20,
  });
  res.json({ success: true, ...data });
});
exports.getConversation = asyncHandler(async (req, res) => {
  const conv = await chatService.conversationDetail(req.params.id);
  if (!conv || (req.companyId && conv.conversation.company && String(conv.conversation.company) !== String(req.companyId))) {
    throw new ApiError(404, 'Conversation not found');
  }
  await chatService.markConversationRead({ conversationId: req.params.id, by: 'agent' });
  res.json({ success: true, ...conv });
});
exports.agentPostMessage = asyncHandler(async (req, res) => {
  const { body } = req.body;
  const message = await chatService.postMessage({ company: req.companyId, conversationId: req.params.id, sender: 'agent', agentId: req.agent._id, body });
  res.status(201).json({ success: true, item: message });
});
exports.assignConversation = asyncHandler(async (req, res) => {
  const { agentId } = req.body;
  const conv = await chatService.assignConversation({ conversationId: req.params.id, agentId: agentId || req.agent._id });
  res.json({ success: true, item: conv });
});
exports.closeConversation = asyncHandler(async (req, res) => {
  const Conversation = require('../../models/Conversation');
  const conv = await Conversation.findByIdAndUpdate(req.params.id, { $set: { status: 'closed' } }, { new: true });
  res.json({ success: true, item: conv });
});
