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


exports.listChanges = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-createdAt' });
  const query = { ...scope(req) };
  if (req.query.status) query.status = req.query.status;
  if (req.query.type) query.type = req.query.type;
  const [items, total] = await Promise.all([
    Change.find(query).sort(getSortObj(sort)).skip(skip).limit(limit).populate('submittedBy', 'name'),
    Change.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});
exports.createChange = asyncHandler(async (req, res) => {
  const { title, type, risk, implementationPlan, rollbackPlan, windowStart, windowEnd } = req.body;
  if (!title) throw new ApiError(422, 'Title is required');
  const count = await Change.countDocuments(scope(req));
  const riskScore = { low: 10, medium: 40, high: 70, critical: 95 }[risk] || 40;
  const change = await Change.create({
    number: `CHG-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
    company: req.companyId,
    title,
    type: type || 'normal',
    risk: risk || 'medium',
    riskScore,
    implementationPlan: implementationPlan || '',
    rollbackPlan: rollbackPlan || '',
    windowStart: windowStart || null,
    windowEnd: windowEnd || null,
    status: type === 'emergency' ? 'requested' : 'draft',
    submittedBy: req.agent._id,
    submittedAt: new Date(),
  });
  res.status(201).json({ success: true, item: change });
});
exports.getChange = asyncHandler(async (req, res) => {
  const change = await Change.findOne({ _id: req.params.id, ...scope(req) }).populate('approval').populate('linkedTickets', 'number subject').populate('linkedAssets', 'name serial ip');
  if (!change) throw new ApiError(404, 'Change not found');
  res.json({ success: true, item: change });
});
exports.updateChange = asyncHandler(async (req, res) => {
  const change = await Change.findOne({ _id: req.params.id, ...scope(req) });
  if (!change) throw new ApiError(404, 'Change not found');
  const KEYS = ['title', 'type', 'risk', 'status', 'implementationPlan', 'rollbackPlan', 'validationPlan', 'cab', 'windowStart', 'windowEnd', 'maintenanceWindow'];
  for (const key of KEYS) {
    if (req.body[key] !== undefined) change[key] = req.body[key];
  }
  if (req.body.risk && req.body.risk !== change.risk) {
    change.riskScore = { low: 10, medium: 40, high: 70, critical: 95 }[req.body.risk] || 40;
  }
  if (req.body.linkedTickets) change.linkedTickets = req.body.linkedTickets;
  if (req.body.linkedAssets) change.linkedAssets = req.body.linkedAssets;
  if (req.body.status === 'implementing') change.implementedAt = new Date();
  if (req.body.status === 'closed') change.closedAt = new Date();
  await change.save();
  res.json({ success: true, item: change });
});
exports.submitChangeForApproval = asyncHandler(async (req, res) => {
  const change = await Change.findOne({ _id: req.params.id, ...scope(req) });
  if (!change) throw new ApiError(404, 'Change not found');
  const { approvers } = req.body;
  if (!Array.isArray(approvers) || !approvers.length) throw new ApiError(422, 'At least one approver (agent id) is required');
  const approval = await approvalService.createApproval({
    company: req.companyId,
    title: `Change approval: ${change.number} ${change.title}`,
    description: `Approval for change ${change.number}${change.implementationPlan ? `\nPlan: ${change.implementationPlan}` : ''}`,
    refType: 'change',
    refId: change._id,
    steps: approvers.map((a) => ({ assigneeType: 'agent', assignee: a, mode: 'approve' })),
    mode: 'sequential',
    timeoutHours: 48,
    autoApproveAfterHours: 0,
    initiatedBy: req.agent._id,
    initiatedByName: req.agent.name,
  });
  change.approval = approval._id;
  change.status = 'for_approval';
  change.submittedAt = new Date();
  await change.save();
  res.json({ success: true, item: change, approval });
});
