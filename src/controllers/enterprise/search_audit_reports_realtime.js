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
    require('../../models/AuditEvent').find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    require('../../models/AuditEvent').countDocuments(query),
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
  const SurveyResponse = require('../../models/SurveyResponse');
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
