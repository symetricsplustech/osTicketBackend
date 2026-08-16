const Skill = require('../models/Skill');
const Workflow = require('../models/Workflow');
const Approval = require('../models/Approval');
const Incident = require('../models/Incident');
const Problem = require('../models/Problem');
const Change = require('../models/Change');
const Asset = require('../models/Asset');
const Dependency = require('../models/Dependency');
const ServiceCatalogItem = require('../models/ServiceCatalogItem');
const Contract = require('../models/Contract');
const Entitlement = require('../models/Entitlement');
const Survey = require('../models/Survey');
const SurveyResponse = require('../models/SurveyResponse');
const StatusPage = require('../models/StatusPage');
const StatusIncident = require('../models/StatusIncident');
const Webhook = require('../models/Webhook');
const ApiKey = require('../models/ApiKey');
const TicketLink = require('../models/TicketLink');
const Ticket = require('../models/Ticket');
const Agent = require('../models/Agent');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Department = require('../models/Department');
const Team = require('../models/Team');
const CannedResponse = require('../models/CannedResponse');
const CallLog = require('../models/CallLog');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, getSortObj } = require('../utils/pagination');
const approvalService = require('../services/approval.service');
const csatService = require('../services/csat.service');
const healthService = require('../services/health.service');
const statusPageService = require('../services/statusPage.service');
const searchService = require('../services/search.service');
const realtime = require('../services/realtime.service');
const reporting = require('../services/reporting.service');
const chatService = require('../services/chat.service');
const workflowService = require('../services/workflow.service');
const auditService = require('../services/audit.service');

const scope = (req) => (req.companyId ? { company: req.companyId } : {});
const scopeExact = (req) => (req.companyId ? { company: req.companyId } : { company: null });

// ============================== SKILLS ==============================
exports.listSkills = asyncHandler(async (req, res) => {
  const skills = await Skill.find(scopeExact(req)).sort({ name: 1 }).lean();
  res.json({ success: true, items: skills });
});

exports.createSkill = asyncHandler(async (req, res) => {
  const { name, category, description, expertiseLevels } = req.body;
  if (!name) throw new ApiError(422, 'Skill name is required');
  const skill = await Skill.create({ name, company: req.companyId, category: category || '', description: description || '', expertiseLevels: expertiseLevels || undefined });
  res.status(201).json({ success: true, item: skill });
});

exports.updateSkill = asyncHandler(async (req, res) => {
  const skill = await Skill.findById(req.params.id);
  if (!skill) throw new ApiError(404, 'Skill not found');
  if (req.companyId && String(skill.company) !== String(req.companyId)) throw new ApiError(403, 'Access denied');
  const { name, category, description, expertiseLevels, isActive } = req.body;
  if (name) skill.name = name;
  if (category !== undefined) skill.category = category;
  if (description !== undefined) skill.description = description;
  if (expertiseLevels) skill.expertiseLevels = expertiseLevels;
  if (isActive !== undefined) skill.isActive = isActive;
  await skill.save();
  res.json({ success: true, item: skill });
});

exports.deleteSkill = asyncHandler(async (req, res) => {
  const skill = await Skill.findByIdAndDelete(req.params.id);
  if (!skill) throw new ApiError(404, 'Skill not found');
  res.json({ success: true, message: 'Skill deleted' });
});

// ============================== WORKFLOWS ==============================
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
  const Ticket = require('../models/Ticket');
  const ticket = ticketNumber ? await Ticket.findOne({ number: ticketNumber, ...scope(req) }) : null;
  if (ticketNumber && !ticket) throw new ApiError(404, 'Ticket not found');
  const result = await workflowService.runWorkflow(workflow, { company: req.companyId, ticketId: ticket?._id || null, custom: req.body.custom || {} });
  res.json({ success: true, executed: !!result });
});

// ============================== APPROVALS ==============================
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

// ============================== INCIDENTS ==============================
exports.listIncidents = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-startedAt' });
  const query = { ...scope(req) };
  if (req.query.status) query.status = req.query.status;
  if (req.query.severity) query.severity = req.query.severity;
  const [items, total] = await Promise.all([
    Incident.find(query).sort(getSortObj(sort)).skip(skip).limit(limit).populate('commander', 'name').populate('team', 'name'),
    Incident.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.getIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findOne({ _id: req.params.id, ...scope(req) })
    .populate('commander', 'name')
    .populate('team', 'name', 'members')
    .populate('affectedTickets', 'number subject status priority');
  if (!incident) throw new ApiError(404, 'Incident not found');
  res.json({ success: true, item: incident });
});

exports.createIncident = asyncHandler(async (req, res) => {
  const { title, summary, severity, commander, teamId } = req.body;
  if (!title) throw new ApiError(422, 'Title is required');
  const count = await Incident.countDocuments(scope(req));
  const incident = await Incident.create({
    number: `INC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
    company: req.companyId,
    title,
    summary: summary || '',
    severity: severity || 'Sev3',
    status: 'investigating',
    commander: commander || null,
    team: teamId || null,
    createdBy: req.agent._id,
  });
  res.status(201).json({ success: true, item: incident });
});

exports.updateIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findOne({ _id: req.params.id, ...scope(req) });
  if (!incident) throw new ApiError(404, 'Incident not found');
  const { summary, severity, status, commander, teamId, resolution, rootCause, workaround, postmortem } = req.body;
  if (summary !== undefined) incident.summary = summary;
  if (severity !== undefined) incident.severity = severity;
  if (commander !== undefined) incident.commander = commander;
  if (teamId !== undefined) incident.team = teamId;
  if (resolution !== undefined) incident.resolution = resolution;
  if (rootCause !== undefined) incident.rootCause = rootCause;
  if (workaround !== undefined) incident.workaround = workaround;
  if (postmortem !== undefined) incident.postmortem = postmortem;
  if (status) {
    incident.status = status;
    if (status === 'resolved') incident.resolvedAt = new Date();
    if (status === 'closed') incident.closedAt = new Date();
  }
  await incident.save();
  res.json({ success: true, item: incident });
});

exports.addIncidentTimeline = asyncHandler(async (req, res) => {
  const incident = await Incident.findOne({ _id: req.params.id, ...scope(req) });
  if (!incident) throw new ApiError(404, 'Incident not found');
  const { message, by } = req.body;
  if (!message) throw new ApiError(422, 'Message is required');
  incident.timeline.push({ at: new Date(), by: by || req.agent.name, message });
  await incident.save();
  res.json({ success: true, item: incident });
});

exports.linkTicketsToIncident = asyncHandler(async (req, res) => {
  const incident = await Incident.findOne({ _id: req.params.id, ...scope(req) });
  if (!incident) throw new ApiError(404, 'Incident not found');
  const { ticketNumbers } = req.body;
  if (!Array.isArray(ticketNumbers)) throw new ApiError(422, 'ticketNumbers array required');
  const tickets = await Ticket.find({ number: { $in: ticketNumbers.map((n) => String(n).toUpperCase()) }, ...scope(req) });
  const ids = tickets.map((t) => t._id);
  for (const t of tickets) {
    await Ticket.updateOne({ _id: t._id }, { $set: { incident: incident._id } });
  }
  incident.affectedTickets = [...new Set([...incident.affectedTickets.map(String), ...ids.map(String)])];
  await incident.save();
  res.json({ success: true, item: incident, linked: tickets.map((t) => t.number) });
});

// ============================== PROBLEMS ==============================
const PROBLEM_FIELDS = ['title', 'description', 'status', 'rootCause', 'workaround', 'permanentSolution', 'postmortem', 'priority', 'assignedTo', 'knownError'];

exports.listProblems = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req, { page: 1, limit: 20, sort: '-createdAt' });
  const query = { ...scope(req) };
  if (req.query.status) query.status = req.query.status;
  const [items, total] = await Promise.all([
    Problem.find(query).sort(getSortObj(sort)).skip(skip).limit(limit).populate('assignedTo', 'name'),
    Problem.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.createProblem = asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title) throw new ApiError(422, 'Title is required');
  const count = await Problem.countDocuments(scope(req));
  const problem = await Problem.create({ number: `PRB-${String(count + 1).padStart(5, '0')}`, company: req.companyId, title, createdBy: req.agent._id });
  res.status(201).json({ success: true, item: problem });
});

exports.getProblem = asyncHandler(async (req, res) => {
  const problem = await Problem.findOne({ _id: req.params.id, ...scope(req) }).populate('linkedIncidents').populate('linkedChanges').populate('assignedTo', 'name');
  if (!problem) throw new ApiError(404, 'Problem not found');
  res.json({ success: true, item: problem });
});

exports.updateProblem = asyncHandler(async (req, res) => {
  const problem = await Problem.findOne({ _id: req.params.id, ...scope(req) });
  if (!problem) throw new ApiError(404, 'Problem not found');
  for (const key of PROBLEM_FIELDS) {
    if (req.body[key] !== undefined) problem[key] = req.body[key];
  }
  if (req.body.linkedIncidents) problem.linkedIncidents = req.body.linkedIncidents;
  if (req.body.linkedTickets) problem.linkedTickets = req.body.linkedTickets;
  if (problem.status === 'closed') problem.closedAt = new Date();
  await problem.save();
  res.json({ success: true, item: problem });
});

exports.deleteProblem = asyncHandler(async (req, res) => {
  await Problem.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Problem deleted' });
});

// ============================== CHANGES ==============================
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

// ============================== ASSETS / CMDB ==============================
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

/**
 * Impact analysis: find all assets that depend (transitively) on a failing asset,
 * plus their open tickets and affected users.
 */
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

// ============================== SERVICE CATALOG ==============================
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

// ============================== CONTRACTS / ENTITLEMENTS ==============================
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

// ============================== SURVEYS (CSAT/NPS/CES) ==============================
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

// ============================== STATUS PAGE ==============================
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

// ============================== WEBHOOKS ==============================
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

// ============================== API KEYS ==============================
exports.listApiKeys = asyncHandler(async (req, res) => {
  const keys = await ApiKey.find(scope(req)).select('name keyPrefix scopes isActive expiresAt lastUsedAt createdAt');
  res.json({ success: true, items: keys });
});

exports.createApiKey = asyncHandler(async (req, res) => {
  const { name, scopes, expiresAt } = req.body;
  if (!name) throw new ApiError(422, 'Key name is required');
  const key = ApiKey.generateKey();
  const apiKey = await ApiKey.create({ name, company: req.companyId, keyHash: ApiKey.hashKey(key.raw), keyPrefix: key.prefix, scopes: scopes || ['tickets:read'], createdBy: req.agent._id, expiresAt: expiresAt || null });
  res.status(201).json({ success: true, item: apiKey, secret: key.raw, note: 'Store this key now — it will not be shown again' });
});

exports.deleteApiKey = asyncHandler(async (req, res) => {
  await ApiKey.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'API key deleted' });
});

// ============================== TICKET RELATIONSHIPS ==============================
exports.listTicketLinks = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne({ number: String(req.params.number).toUpperCase(), ...scope(req) });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  const links = await TicketLink.find({ company: req.companyId, $or: [{ from: ticket._id }, { to: ticket._id }] })
    .populate('from', 'number subject status')
    .populate('to', 'number subject status');
  res.json({ success: true, items: links });
});

exports.addTicketLink = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne({ number: String(req.params.number).toUpperCase(), ...scope(req) });
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  const { targetNumber, type } = req.body;
  if (!targetNumber) throw new ApiError(422, 'Target ticket number is required');
  const target = await Ticket.findOne({ number: String(targetNumber).toUpperCase(), ...scope(req) });
  if (!target) throw new ApiError(404, 'Target ticket not found');
  if (String(target._id) === String(ticket._id)) throw new ApiError(400, 'Cannot link ticket to itself');
  if (!TicketLink.TYPES.includes(type)) throw new ApiError(422, 'Invalid link type');
  let link = await TicketLink.findOne({ company: req.companyId, from: ticket._id, to: target._id });
  if (!link) {
    link = await TicketLink.create({ company: req.companyId, from: ticket._id, to: target._id, type, createdBy: req.agent._id });
  } else {
    link.type = type;
    await link.save();
  }
  res.status(201).json({ success: true, item: link });
});

exports.removeTicketLink = asyncHandler(async (req, res) => {
  await TicketLink.findByIdAndDelete(req.params.linkId);
  res.json({ success: true, message: 'Link removed' });
});

// ============================== CALL LOGS (voice foundation) ==============================
exports.listCallLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req, { page: 1, limit: 25, sort: '-startedAt' });
  const query = { ...scope(req) };
  if (req.query.status) query.status = req.query.status;
  if (req.query.direction) query.direction = req.query.direction;
  const [items, total] = await Promise.all([
    CallLog.find(query).sort({ startedAt: -1 }).skip(skip).limit(limit).populate('agent', 'name').populate('user', 'name email'),
    CallLog.countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.createCallLog = asyncHandler(async (req, res) => {
  const { callId, ticketNumber, userEmail, callerName, callerNumber, agent, direction, status, durationSec, recordingUrl, transcription, callbackScheduled, notes } = req.body;
  let ticket = null;
  if (ticketNumber) {
    const t = await Ticket.findOne({ number: String(ticketNumber).toUpperCase(), ...scope(req) });
    if (t) ticket = t;
  }
  let user = null;
  if (userEmail) {
    const u = await User.findOne({ email: String(userEmail).toLowerCase(), ...scope(req) });
    if (u) user = u;
  }
  const call = await CallLog.create({
    company: req.companyId,
    callId: callId || '',
    ticket: ticket?._id || null,
    user: user?._id || null,
    callerName: callerName || '',
    callerNumber: callerNumber || '',
    agent: agent || null,
    direction: direction || 'inbound',
    status: status || 'completed',
    durationSec: durationSec || 0,
    recordingUrl: recordingUrl || '',
    transcription: transcription || '',
    callbackScheduled: callbackScheduled || null,
    notes: notes || '',
    createdBy: req.agent._id,
  });
  res.status(201).json({ success: true, item: call });
});

exports.updateCallLog = asyncHandler(async (req, res) => {
  const call = await CallLog.findOne({ _id: req.params.id, ...scope(req) });
  if (!call) throw new ApiError(404, 'Call not found');
  const KEYS = ['status', 'durationSec', 'recordingUrl', 'transcription', 'aiSummary', 'callbackScheduled', 'notes', 'agent'];
  for (const key of KEYS) {
    if (req.body[key] !== undefined) call[key] = req.body[key];
  }
  await call.save();
  res.json({ success: true, item: call });
});

// ============================== CHAT (omnichannel inbox) ==============================
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
  const Conversation = require('../models/Conversation');
  const conv = await Conversation.findByIdAndUpdate(req.params.id, { $set: { status: 'closed' } }, { new: true });
  res.json({ success: true, item: conv });
});

// ============================== CSAT (user submit) ==============================
exports.submitCsat = asyncHandler(async (req, res) => {
  const { surveyId, ticketNumber, rating, comment } = req.body;
  if (!surveyId) throw new ApiError(422, 'surveyId is required');
  if (rating == null) throw new ApiError(422, 'Rating is required');
  const ticket = ticketNumber ? await Ticket.findOne({ number: String(ticketNumber).toUpperCase(), ...scope(req) }) : null;
  const response = await csatService.submitResponse({
    company: req.companyId,
    surveyId,
    ticketId: ticket?._id || req.params.ticketId || null,
    userId: req.user?._id || req.agent?._id || null,
    rating,
    comment: comment || '',
  });
  res.status(201).json({ success: true, item: response });
});

// ============================== HEALTH / CUSTOMER 360 ==============================
exports.customer360 = asyncHandler(async (req, res) => {
  const { id, orgId } = req.params;
  const comp = scope(req);
  let user = null;
  let organization = null;

  if (orgId) {
    organization = await Organization.findOne({ _id: orgId, ...comp }).populate('accountManager', 'name');
    if (!organization) throw new ApiError(404, 'Organization not found');
    user = await User.findOne({ organization: organization._id, ...comp }).lean();
  } else {
    user = await User.findOne({ _id: id, ...comp }).lean();
    if (!user) throw new ApiError(404, 'User not found');
    organization = user.organization ? await Organization.findOne({ _id: user.organization, ...comp }).populate('accountManager', 'name').lean() : null;
  }

  const userId = user?._id || null;
  const userQuery = userId ? { user: userId } : {};
  const orgUsers = userId ? { user: { $in: [userId] } } : {};

  const [tickets, organizations, conversations, assets, contracts, health, responses, callLogs] = await Promise.all([
    Ticket.find({ ...comp, ...(userId ? { user: userId } : {}) }).sort({ createdAt: -1 }).limit(50).populate('dept', 'name').populate('agent', 'name').select('number subject status priority dueDate isOverdue createdAt'),
    userId ? null : User.find({ ...comp, organization: orgId }).select('name email phone tier status').lean(),
    require('../models/Conversation').find({ ...comp, ...(userId ? { user: userId } : {}) }).sort({ updatedAt: -1 }).limit(20),
    Asset.find({ ...comp, ...(organization ? { organization: organization._id } : { user: userId }) }).limit(20),
    organization ? Contract.find({ ...comp, organization: organization._id }).sort({ startDate: -1 }) : [],
    healthService.getHealth({ company: req.companyId, subjectType: organization ? 'organization' : 'user', subjectId: organization ? organization._id : userId }),
    SurveyResponse.find({ ...comp, ...(userId ? { user: userId } : {}) }).sort({ respondedAt: -1 }).limit(20).populate('ticket', 'number subject').populate('survey', 'name type'),
    CallLog.find({ ...comp, ...(userId ? { user: userId } : { user: null }) }).sort({ startedAt: -1 }).limit(20),
  ]);

  res.json({
    success: true,
    user: user ? { ...user, health: user.health || null } : null,
    organization,
    organizationUsers: organizations || [],
    tickets,
    conversations,
    assets,
    contracts,
    health,
    responses,
    callLogs,
  });
});

// ============================== SEARCH / AUDIT / REPORTS / REALTIME ==============================
exports.globalSearch = asyncHandler(async (req, res) => {
  const result = await searchService.globalSearch({ company: req.companyId, q: req.query.q || '', type: req.query.type, page: parseInt(req.query.page, 10) || 1, limit: parseInt(req.query.limit, 10) || 20 });
  res.json({ success: true, ...result });
});

exports.auditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req, { page: 1, limit: 30, sort: '-createdAt' });
  const query = { ...scope(req) };
  if (req.query.entityType) query.entityType = req.query.entityType;
  if (req.query.entityId) query.entityId = req.query.entityId;
  if (req.query.action) query.action = new RegExp(req.query.action, 'i');
  if (req.query.actor) query.actorName = new RegExp(req.query.actor, 'i');
  const [items, total] = await Promise.all([
    require('../models/AuditEvent').find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    require('../models/AuditEvent').countDocuments(query),
  ]);
  res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
});

exports.realTimeDashboard = asyncHandler(async (req, res) => {
  const snap = await realtime.computeSnapshot({ company: req.companyId, force: true });
  res.json({ success: true, ...snap });
});

exports.agentMetricsReport = asyncHandler(async (req, res) => {
  const data = await reporting.agentMetrics({ company: req.companyId, fromDays: parseInt(req.query.days, 10) || 30 });
  res.json({ success: true, ...data });
});

exports.departmentMetricsReport = asyncHandler(async (req, res) => {
  const data = await reporting.departmentMetrics({ company: req.companyId, fromDays: parseInt(req.query.days, 10) || 30 });
  res.json({ success: true, ...data });
});

exports.customerMetricsReport = asyncHandler(async (req, res) => {
  const data = await reporting.customerMetrics({ company: req.companyId, fromDays: parseInt(req.query.days, 10) || 30 });
  res.json({ success: true, ...data });
});

exports.volumeTrendReport = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 30;
  const data = await reporting.volumeTrend({ company: req.companyId, days });
  if (req.query.format === 'csv') {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = (data || []).map((r) => [r.date, r.created, r.resolved].map(esc).join(','));
    const csv = [['date', 'created', 'resolved'].join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="volume-trend-${days}d.csv"`);
    return res.send(csv);
  }
  res.json({ success: true, days, trend: data });
});

exports.reportOverview = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 30;
  const SurveyResponse = require('../models/SurveyResponse');
  const from = new Date(Date.now() - days * 86400000);
  const [agents, departments, customers, volume, csatRows, live] = await Promise.all([
    reporting.agentMetrics({ company: req.companyId, fromDays: days }),
    reporting.departmentMetrics({ company: req.companyId, fromDays: days }),
    reporting.customerMetrics({ company: req.companyId, fromDays: days }),
    reporting.volumeTrend({ company: req.companyId, days }),
    SurveyResponse.find({ company: req.companyId, respondedAt: { $gte: from } }).lean(),
    realtime.computeSnapshot({ company: req.companyId, force: true }),
  ]);
  const n = csatRows.length;
  const avgRating = n ? csatRows.reduce((a, r) => a + (r.rating || 0), 0) / n : 0;
  const csat = {
    responses: n,
    avgRating: Math.round(avgRating * 100) / 100,
    positive: csatRows.filter((r) => (r.rating || 0) >= 4).length,
    negative: csatRows.filter((r) => (r.rating || 0) <= 2).length,
  };
  res.json({ success: true, days, agents, departments, customers, volume, csat, live });
});

// ============================== OUTAGE SIGNALS → INCIDENT (proactive) ==============================
exports.promoteSignalsToIncident = asyncHandler(async (req, res) => {
  const { signals } = req.body;
  if (!Array.isArray(signals) || !signals.length) throw new ApiError(422, 'signals array required');
  const signal = signals[0];
  const statusPage = await StatusPage.findOne(scope(req));
  const incident = await statusPageService.createStatusIncident({
    company: req.companyId,
    statusPageId: statusPage?._id || null,
    title: `${signal.keyword ? `Outage: ${signal.keyword} reported` : 'Possible service outage'}`,
    body: `Proactive detection: ${signal.count} tickets in the last window share a root cause (${signal.intent}${signal.keyword ? `, keyword: ${signal.keyword}` : ''}).`,
    severity: 'major',
    componentsAffected: [signal.keyword || 'Service'],
    createLinkedIncident: true,
  });
  res.status(201).json({ success: true, item: incident });
});