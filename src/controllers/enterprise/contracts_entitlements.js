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


exports.listContracts = asyncHandler(async (req, res) => {
  const query = { ...scope(req) };
  if (req.query.status) query.status = req.query.status;
  const items = await Contract.find(query).populate('organization', 'name').populate('accountManager', 'name').sort({ startDate: -1 });
  res.json({ success: true, items });
});
exports.createContract = asyncHandler(async (req, res) => {
  const { organization, name, startDate, endDate, support24x7, supportHours, includedTicketsPerMonth, slaPlans, entitlements, renewal, accountManager, notes, status } = req.body;
  if (!organization || !name) throw new ApiError(422, 'Organization and contract name are required');
  const count = await Contract.countDocuments(scope(req));
  const contract = await Contract.create({
    number: `CTR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
    company: req.companyId,
    organization,
    name,
    startDate: startDate || null,
    endDate: endDate || null,
    status: status || 'active',
    support24x7: !!support24x7,
    supportHours: supportHours || '',
    includedTicketsPerMonth: includedTicketsPerMonth || 0,
    slaPlans: slaPlans || [],
    entitlements: entitlements || [],
    renewal: renewal || {},
    notes: notes || '',
    accountManager: accountManager || null,
    createdBy: req.agent?._id || null,
  });
  res.status(201).json({ success: true, item: contract });
});
exports.getContract = asyncHandler(async (req, res) => {
  const contract = await Contract.findOne({ _id: req.params.id, ...scope(req) }).populate('organization', 'name').populate('slaPlans', 'name schedule');
  if (!contract) throw new ApiError(404, 'Contract not found');
  const entitlements = await Entitlement.find({ company: req.companyId, contract: contract._id });
  res.json({ success: true, item: contract, entitlements });
});
exports.updateContract = asyncHandler(async (req, res) => {
  const contract = await Contract.findOne({ _id: req.params.id, ...scope(req) });
  if (!contract) throw new ApiError(404, 'Contract not found');
  const KEYS = ['organization', 'name', 'startDate', 'endDate', 'status', 'support24x7', 'supportHours', 'includedTicketsPerMonth', 'slaPlans', 'entitlements', 'renewal', 'notes', 'accountManager'];
  for (const key of KEYS) {
    if (req.body[key] !== undefined) contract[key] = req.body[key];
  }
  await contract.save();
  res.json({ success: true, item: contract });
});
exports.deleteContract = asyncHandler(async (req, res) => {
  await Contract.findByIdAndDelete(req.params.id);
  await Entitlement.deleteMany({ company: req.companyId, contract: req.params.id });
  res.json({ success: true, message: 'Contract deleted' });
});
exports.listEntitlements = asyncHandler(async (req, res) => {
  const items = await Entitlement.find(scope(req)).populate('contract', 'number name').populate('organization', 'name').populate('slaOverride', 'name');
  res.json({ success: true, items });
});
exports.createEntitlement = asyncHandler(async (req, res) => {
  const { contract, organization, service, serviceType, scope, limitType, limitValue, timespanDays, queue, slaOverride, isActive } = req.body;
  if (!contract) throw new ApiError(422, 'Contract is required');
  const entitlement = await Entitlement.create({
    company: req.companyId,
    contract,
    organization: organization || null,
    service: service || '',
    serviceType: serviceType || 'any',
    scope: scope || 'included',
    limitType: limitType || 'unlimited',
    limitValue: limitValue || 0,
    timespanDays: timespanDays || 30,
    queue: queue || '',
    slaOverride: slaOverride || null,
    isActive: isActive !== false,
  });
  res.status(201).json({ success: true, item: entitlement });
});
exports.updateEntitlement = asyncHandler(async (req, res) => {
  const entitlement = await Entitlement.findOne({ _id: req.params.id, ...scope(req) });
  if (!entitlement) throw new ApiError(404, 'Entitlement not found');
  const KEYS = ['contract', 'organization', 'service', 'serviceType', 'scope', 'limitType', 'limitValue', 'timespanDays', 'queue', 'slaOverride', 'isActive'];
  for (const key of KEYS) {
    if (req.body[key] !== undefined) entitlement[key] = req.body[key];
  }
  await entitlement.save();
  res.json({ success: true, item: entitlement });
});
exports.deleteEntitlement = asyncHandler(async (req, res) => {
  await Entitlement.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Entitlement deleted' });
});
