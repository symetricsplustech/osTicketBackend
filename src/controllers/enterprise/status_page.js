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


exports.listStatusPages = asyncHandler(async (req, res) => {
  const pages = await StatusPage.find(scope(req));
  res.json({ success: true, items: pages });
});
exports.createStatusPage = asyncHandler(async (req, res) => {
  const { name, slug, description, isPublic, branding, components } = req.body;
  if (!name || !slug) throw new ApiError(422, 'Name and slug are required');
  const exists = await StatusPage.findOne({ slug: slug.toLowerCase() });
  if (exists) throw new ApiError(409, 'Slug already in use');
  const page = await StatusPage.create({
    name,
    company: req.companyId,
    slug: slug.toLowerCase(),
    description: description || '',
    isPublic: isPublic !== false,
    branding: branding || {},
    components: (components || []).map((c, i) => ({ name: c.name, group: c.group || '', status: c.status || 'operational', order: i })),
    createdBy: req.agent._id,
  });
  res.status(201).json({ success: true, item: page });
});
exports.updateStatusPage = asyncHandler(async (req, res) => {
  const page = await StatusPage.findOne({ _id: req.params.id, ...scope(req) });
  if (!page) throw new ApiError(404, 'Status page not found');
  const { name, description, isPublic, branding } = req.body;
  if (name) page.name = name;
  if (description !== undefined) page.description = description;
  if (isPublic !== undefined) page.isPublic = isPublic;
  if (branding) page.branding = { ...page.branding, ...branding };
  await page.save();
  res.json({ success: true, item: page });
});
exports.deleteStatusPage = asyncHandler(async (req, res) => {
  await StatusPage.findByIdAndDelete(req.params.id);
  await StatusIncident.deleteMany({ statusPage: req.params.id });
  res.json({ success: true, message: 'Status page deleted' });
});
exports.updateStatusComponent = asyncHandler(async (req, res) => {
  const page = await statusPageService.updateComponent(req.params.id, req.params.componentId, req.body.status);
  res.json({ success: true, item: page });
});
exports.addStatusComponent = asyncHandler(async (req, res) => {
  const page = await StatusPage.findOne({ _id: req.params.id, ...scope(req) });
  if (!page) throw new ApiError(404, 'Status page not found');
  const { name, group } = req.body;
  if (!name) throw new ApiError(422, 'Component name is required');
  page.components.push({ name, group: group || '', status: 'operational', order: page.components.length });
  await page.save();
  res.json({ success: true, item: page });
});
exports.removeStatusComponent = asyncHandler(async (req, res) => {
  const page = await StatusPage.findOne({ _id: req.params.id, ...scope(req) });
  if (!page) throw new ApiError(404, 'Status page not found');
  page.components = page.components.filter((c) => String(c._id) !== String(req.params.componentId));
  await page.save();
  res.json({ success: true, item: page });
});
exports.listStatusIncidents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req, { page: 1, limit: 25, sort: '-startedAt' });
  const query = { ...scope(req) };
  if (req.query.status) query.status = req.query.status;
  const [items, total] = await Promise.all([
    StatusIncident.find(query).sort({ startedAt: -1 }).skip(skip).limit(limit).populate('linkedIncident', 'number status'),
    StatusIncident.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});
exports.createStatusIncident = asyncHandler(async (req, res) => {
  const { statusPageId, title, body, severity, componentsAffected, notifyCustomers, createLinkedIncident } = req.body;
  if (!title) throw new ApiError(422, 'Title required');
  if (!statusPageId) {
    const page = await StatusPage.findOne(scope(req));
    if (!page) throw new ApiError(422, 'Create a status page first');
    req.body.statusPageId = page._id;
  }
  const incident = await statusPageService.createStatusIncident({
    company: req.companyId,
    statusPageId: req.body.statusPageId,
    title,
    body: body || '',
    severity: severity || 'major',
    componentsAffected: componentsAffected || [],
    notifyCustomers: !!notifyCustomers,
    createLinkedIncident: !!createLinkedIncident,
  });
  res.status(201).json({ success: true, item: incident });
});
exports.updateStatusIncident = asyncHandler(async (req, res) => {
  const { status, message } = req.body;
  const incident = await statusPageService.updateStatusIncident(req.params.id, { status, message });
  res.json({ success: true, item: incident });
});
exports.detectOutageSignals = asyncHandler(async (req, res) => {
  const signals = await statusPageService.detectOutageSignals({ company: req.companyId, minTickets: parseInt(req.query.minTickets, 10) || 5, windowMinutes: parseInt(req.query.windowMinutes, 10) || 60 });
  res.json({ success: true, signals });
});
