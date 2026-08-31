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


exports.listCatalogItems = asyncHandler(async (req, res) => {
  const query = { ...scope(req) };
  if (req.query.active !== 'false') query.isActive = true;
  const items = await ServiceCatalogItem.find(query)
    .populate('helpTopic', 'topic')
    .populate('department', 'name')
    .populate('sla', 'name')
    .sort({ category: 1, sortOrder: 1 });
  res.json({ success: true, items });
});
exports.createCatalogItem = asyncHandler(async (req, res) => {
  const { name, category, description, icon, visibleInPortal, helpTopic, department, sla, priority, autoAssignAgent, autoAssignTeam, estimatedTime, requiresApproval, approvers, formId, price, needsPayment, isActive } = req.body;
  if (!name) throw new ApiError(422, 'Service name is required');
  const item = await ServiceCatalogItem.create({
    name,
    company: req.companyId,
    category: category || 'General',
    description: description || '',
    icon: icon || '',
    visibleInPortal: visibleInPortal !== false,
    helpTopic: helpTopic || null,
    department: department || null,
    sla: sla || null,
    priority: priority || 'Normal',
    autoAssignAgent: autoAssignAgent || null,
    autoAssignTeam: autoAssignTeam || null,
    estimatedTime: estimatedTime || '',
    requiresApproval: !!requiresApproval,
    approvers: approvers || [],
    formId: formId || null,
    price: price || 0,
    needsPayment: !!needsPayment,
    isActive: isActive !== false,
    createdBy: req.agent._id,
  });
  res.status(201).json({ success: true, item });
});
exports.updateCatalogItem = asyncHandler(async (req, res) => {
  const item = await ServiceCatalogItem.findOne({ _id: req.params.id, ...scope(req) });
  if (!item) throw new ApiError(404, 'Service not found');
  const KEYS = ['name', 'category', 'description', 'icon', 'visibleInPortal', 'helpTopic', 'department', 'sla', 'priority', 'autoAssignAgent', 'autoAssignTeam', 'estimatedTime', 'requiresApproval', 'approvers', 'formId', 'price', 'needsPayment', 'isActive', 'sortOrder'];
  for (const key of KEYS) {
    if (req.body[key] !== undefined) item[key] = req.body[key];
  }
  await item.save();
  res.json({ success: true, item });
});
exports.deleteCatalogItem = asyncHandler(async (req, res) => {
  await ServiceCatalogItem.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Service deleted' });
});
