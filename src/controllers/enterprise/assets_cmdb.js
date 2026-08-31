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


exports.listAssets = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: 'name' });
  const query = { ...scope(req) };
  if (req.query.type) query.type = req.query.type;
  if (req.query.environment) query.environment = req.query.environment;
  if (req.query.organization) query.organization = req.query.organization;
  if (req.query.search) query.$or = [{ name: new RegExp(req.query.search, 'i') }, { serial: new RegExp(req.query.search, 'i') }, { ip: new RegExp(req.query.search, 'i') }];
  const [items, total] = await Promise.all([
    Asset.find(query).sort(getSortObj(sort)).skip(skip).limit(limit).populate('organization', 'name'),
    Asset.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});
exports.getAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findOne({ _id: req.params.id, ...scope(req) }).populate('organization', 'name').populate('owner', 'name email');
  if (!asset) throw new ApiError(404, 'Asset not found');
  const tickets = await Ticket.find({ asset: asset._id, status: { $ne: 'deleted' } }).sort({ createdAt: -1 }).limit(20).select('number subject status priority createdAt');
  const deps = await Dependency.find({ company: asset.company, $or: [{ from: asset._id }, { to: asset._id }] }).populate('from', 'name type').populate('to', 'name type');
  res.json({ success: true, item: asset, tickets, dependencies: deps });
});
exports.createAsset = asyncHandler(async (req, res) => {
  const { name, type, serial, ip, hostname, environment, criticality, location, organization, owner, warrantyUntil, tags, customFields, notes, status } = req.body;
  if (!name) throw new ApiError(422, 'Asset name is required');
  const asset = await Asset.create({
    name,
    company: req.companyId,
    organization: organization || null,
    owner: owner || null,
    type: type || 'other',
    serial: serial || '',
    ip: ip || '',
    hostname: hostname || '',
    environment: environment || 'production',
    criticality: criticality || 'medium',
    location: location || '',
    status: status || 'active',
    warrantyUntil: warrantyUntil || null,
    tags: tags || [],
    customFields: customFields || {},
    notes: notes || '',
    createdBy: req.agent._id,
  });
  res.status(201).json({ success: true, item: asset });
});
exports.updateAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findOne({ _id: req.params.id, ...scope(req) });
  if (!asset) throw new ApiError(404, 'Asset not found');
  const KEYS = ['name', 'organization', 'owner', 'type', 'serial', 'ip', 'hostname', 'environment', 'criticality', 'location', 'status', 'warrantyUntil', 'tags', 'customFields', 'notes'];
  for (const key of KEYS) {
    if (req.body[key] !== undefined) asset[key] = req.body[key];
  }
  await asset.save();
  res.json({ success: true, item: asset });
});
exports.deleteAsset = asyncHandler(async (req, res) => {
  await Asset.findByIdAndDelete(req.params.id);
  await Dependency.deleteMany({ company: req.companyId, $or: [{ from: req.params.id }, { to: req.params.id }] });
  res.json({ success: true, message: 'Asset deleted' });
});
exports.listDependencies = asyncHandler(async (req, res) => {
  const items = await Dependency.find(scope(req)).populate('from', 'name type').populate('to', 'name type');
  res.json({ success: true, items });
});
exports.createDependency = asyncHandler(async (req, res) => {
  const { from, to, type, description } = req.body;
  if (!from || !to) throw new ApiError(422, 'from and to asset ids are required');
  const dep = await Dependency.create({ company: req.companyId, from, to, type: type || 'depends_on', description: description || '' });
  res.status(201).json({ success: true, item: dep });
});
exports.deleteDependency = asyncHandler(async (req, res) => {
  await Dependency.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Dependency deleted' });
});
exports.dependencyImpact = asyncHandler(async (req, res) => {
  const assetId = req.params.id;
  const asset = await Asset.findOne({ _id: assetId, ...scope(req) });
  if (!asset) throw new ApiError(404, 'Asset not found');
  const visited = new Set([String(assetId)]);
  const affected = [];
  let frontier = [String(assetId)];
  while (frontier.length) {
    const next = [];
    const deps = await Dependency.find({ company: req.companyId, from: { $in: frontier } }).populate('to', 'name type criticality environment').lean();
    for (const d of deps) {
      const id = String(d.to._id);
      if (!visited.has(id)) {
        visited.add(id);
        affected.push({ asset: d.to, via: d.type });
        next.push(id);
      }
    }
    frontier = next;
  }
  const affectedIds = affected.map((a) => a.asset._id);
  const tickets = await Ticket.find({ asset: { $in: affectedIds }, status: { $nin: ['closed', 'archived', 'deleted'] } })
    .populate('user', 'name email organization')
    .select('number subject status priority');
  res.json({ success: true, asset, downstream: affected, openRelatedTickets: tickets });
});
