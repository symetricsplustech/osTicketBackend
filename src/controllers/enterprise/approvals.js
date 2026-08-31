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


exports.listApprovals = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 25, sort: '-createdAt' });
  const query = { ...scope(req) };
  if (req.query.status) query.status = req.query.status;
  if (req.query.refType) query.refType = req.query.refType;
  const [items, total] = await Promise.all([
    Approval.find(query).sort(getSortObj(sort)).skip(skip).limit(limit),
    Approval.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});
exports.getApprovalsForMe = asyncHandler(async (req, res) => {
  const me = String(req.agent._id);
  const approvals = await Approval.find({ ...scope(req), status: 'pending', 'steps.status': 'pending', 'steps.assigneeType': 'agent', 'steps.assignee': me });
  res.json({ success: true, items: approvals });
});
exports.getApproval = asyncHandler(async (req, res) => {
  const approval = await Approval.findOne({ _id: req.params.id, ...scope(req) });
  if (!approval) throw new ApiError(404, 'Approval not found');
  res.json({ success: true, item: approval });
});
exports.createApproval = asyncHandler(async (req, res) => {
  const { title, description, refType, refId, steps, mode, timeoutHours, autoApproveAfterHours } = req.body;
  if (!title) throw new ApiError(422, 'Title is required');
  if (!Array.isArray(steps) || !steps.length) throw new ApiError(422, 'At least one approval step is required');
  const approval = await approvalService.createApproval({
    company: req.companyId,
    title,
    description: description || '',
    refType: refType || 'other',
    refId: refId || null,
    steps,
    mode: mode || 'sequential',
    timeoutHours: timeoutHours || 24,
    autoApproveAfterHours: autoApproveAfterHours || 0,
    initiatedBy: req.agent._id,
    initiatedByName: req.agent.name,
  });
  res.status(201).json({ success: true, item: approval });
});
exports.decideApproval = asyncHandler(async (req, res) => {
  const { decision, comment } = req.body;
  if (!['approve', 'reject'].includes(decision)) throw new ApiError(422, 'Decision must be approve or reject');
  const approval = await approvalService.decide(req.params.id, {
    agentId: req.agent._id,
    agentName: req.agent.name,
    decision,
    comment: comment || '',
  });
  res.json({ success: true, item: approval });
});
exports.delegateApproval = asyncHandler(async (req, res) => {
  const { toAgentId } = req.body;
  if (!toAgentId) throw new ApiError(422, 'Target agent is required');
  const approval = await approvalService.delegate(req.params.id, { fromAgentId: req.agent._id, toAgentId });
  res.json({ success: true, item: approval });
});
