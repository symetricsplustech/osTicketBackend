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


exports.listWorkflows = asyncHandler(async (req, res) => {
  const items = await Workflow.find(scopeExact(req)).sort({ createdAt: 1 }).lean();
  res.json({ success: true, items });
});
exports.createWorkflow = asyncHandler(async (req, res) => {
  const { name, description, event, triggerFilters, conditions, actions, isActive } = req.body;
  if (!name || !event) throw new ApiError(422, 'Name and trigger event are required');
  if (!Array.isArray(actions) || !actions.length) throw new ApiError(422, 'At least one action is required');
  const workflow = await Workflow.create({
    name,
    company: req.companyId,
    description: description || '',
    event,
    triggerFilters: triggerFilters || {},
    conditions: Array.isArray(conditions) ? conditions : [],
    actions,
    isActive: isActive !== false,
    createdBy: req.agent?._id || null,
  });
  res.status(201).json({ success: true, item: workflow });
});
exports.updateWorkflow = asyncHandler(async (req, res) => {
  const workflow = await Workflow.findById(req.params.id);
  if (!workflow) throw new ApiError(404, 'Workflow not found');
  if (req.companyId && String(workflow.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, description, event, triggerFilters, conditions, actions, isActive } = req.body;
  if (name) workflow.name = name;
  if (description !== undefined) workflow.description = description;
  if (event) workflow.event = event;
  if (triggerFilters) workflow.triggerFilters = triggerFilters;
  if (conditions) workflow.conditions = conditions;
  if (actions) workflow.actions = actions;
  if (isActive !== undefined) workflow.isActive = isActive;
  await workflow.save();
  res.json({ success: true, item: workflow });
});
exports.deleteWorkflow = asyncHandler(async (req, res) => {
  await Workflow.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Workflow deleted' });
});
exports.testWorkflow = asyncHandler(async (req, res) => {
  const workflow = await Workflow.findById(req.params.id);
  if (!workflow) throw new ApiError(404, 'Workflow not found');
  const { ticketNumber } = req.body;
  const Ticket = require('../../models/Ticket');
  const ticket = ticketNumber ? await Ticket.findOne({ number: ticketNumber, ...scope(req) }) : null;
  if (ticketNumber && !ticket) throw new ApiError(404, 'Ticket not found');
  const result = await workflowService.runWorkflow(workflow, { company: req.companyId, ticketId: ticket?._id || null, custom: req.body.custom || {} });
  res.json({ success: true, executed: !!result });
});
