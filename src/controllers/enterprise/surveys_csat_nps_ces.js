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


exports.listSurveys = asyncHandler(async (req, res) => {
  const items = await Survey.find(scope(req)).sort({ createdAt: -1 });
  res.json({ success: true, items });
});
exports.createSurvey = asyncHandler(async (req, res) => {
  const { name, type, question, scale, trigger, isActive, customMessage, followUpAfterHours } = req.body;
  if (!name) throw new ApiError(422, 'Survey name is required');
  const survey = await Survey.create({
    name,
    company: req.companyId,
    type: type || 'csat',
    question: question || (type === 'nps' ? 'How likely are you to recommend us?' : 'How would you rate your support experience?'),
    scale: scale || 5,
    trigger: trigger || 'on_close',
    isActive: isActive !== false,
    customMessage: customMessage || '',
    followUpAfterHours: followUpAfterHours || 0,
    createdBy: req.agent._id,
  });
  res.status(201).json({ success: true, item: survey });
});
exports.updateSurvey = asyncHandler(async (req, res) => {
  const survey = await Survey.findOne({ _id: req.params.id, ...scope(req) });
  if (!survey) throw new ApiError(404, 'Survey not found');
  const KEYS = ['name', 'type', 'question', 'scale', 'trigger', 'isActive', 'customMessage', 'followUpAfterHours'];
  for (const key of KEYS) {
    if (req.body[key] !== undefined) survey[key] = req.body[key];
  }
  await survey.save();
  res.json({ success: true, item: survey });
});
exports.deleteSurvey = asyncHandler(async (req, res) => {
  await Survey.findByIdAndDelete(req.params.id);
  await SurveyResponse.deleteMany({ survey: req.params.id });
  res.json({ success: true, message: 'Survey deleted' });
});
exports.surveyResults = asyncHandler(async (req, res) => {
  const type = req.query.type || null;
  const analytics = await csatService.surveyAnalytics({ company: req.companyId, type });
  const { page, limit, skip } = getPagination(req, { page: 1, limit: 25, sort: '-respondedAt' });
  const query = { ...scope(req) };
  if (req.query.survey) query.survey = req.query.survey;
  const [items, total] = await Promise.all([
    SurveyResponse.find(query).sort({ respondedAt: -1 }).skip(skip).limit(limit).populate('ticket', 'number subject').populate('user', 'name email').populate('agent', 'name').populate('survey', 'name type'),
    SurveyResponse.countDocuments(query),
  ]);
  res.json({ success: true, analytics, items, total, page, limit, pages: Math.ceil(total / limit) });
});
