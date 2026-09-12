// Enterprise surface: thin, tenant-scoped endpoints that aggregate the core
// HelpDesk models (tickets, incidents, problems, changes, assets, audit) for
// the Helmdesk-only product. All handlers return the exact envelopes the
// Helpdesk frontend expects.
const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { protectTenantPrincipal } = require("../middleware/auth");

const router = express.Router();
router.use(protectTenantPrincipal);

const tenantOf = (req) => req.companyId || req.tenantId || null;
const actorId = (req) => req.user?._id || req.agent?._id || null;
const scoped = (req) => {
  const t = tenantOf(req);
  return t ? { company: t } : {};
};

const incStatusEnum = [
  "new",
  "in_progress",
  "on_hold_caller",
  "on_hold_change",
  "on_hold_problem",
  "on_hold_vendor",
  "resolved",
  "closed",
  "canceled",
  "investigating",
  "identified",
  "monitoring",
];
const openTicketStatuses = [
  "new",
  "open",
  "triaged",
  "assigned",
  "in_progress",
  "pending_customer",
  "pending_vendor",
  "pending_approval",
  "on_hold",
  "escalated",
  "overdue",
  "verification",
];

// ── Reports ─────────────────────────────────────────────────────────────
router.get(
  "/reports/overview",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Ticket = mongoose.model("Ticket");
    const q = { company: tenantOf(req) };
    const [total, resolved, open] = await Promise.all([
      Ticket.countDocuments(q),
      Ticket.countDocuments({
        ...q,
        status: { $in: ["resolved", "closed", "verification"] },
      }),
      Ticket.countDocuments({ ...q, status: { $in: openTicketStatuses } }),
    ]);
    res.json({
      success: true,
      overview: {
        total,
        resolved,
        open,
        resolutionRate: total
          ? Math.round((resolved / total) * 100)
          : 0,
      },
    });
  }),
);

router.get(
  "/realtime",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Ticket = mongoose.model("Ticket");
    const Incident = mongoose.model("Incident");
    const Change = mongoose.model("Change");
    const q = { company: tenantOf(req) };
    const [openTickets, openIncidents, pendingChanges] = await Promise.all([
      Ticket.countDocuments({ ...q, status: { $in: openTicketStatuses } }),
      Incident.countDocuments({
        ...q,
        status: { $in: ["new", "in_progress", "investigating", "identified", "monitoring"] },
      }),
      Change.countDocuments({ ...q, status: { $in: ["new", "assess", "authorize", "scheduled"] } }),
    ]);
    res.json({
      success: true,
      stats: { openTickets, openIncidents, pendingChanges },
    });
  }),
);

// ── Assets / CMDB ───────────────────────────────────────────────────────
const normAsset = (a) => ({
  _id: a._id,
  assetId: a.serial || "",
  name: a.name,
  type: a.type || "hardware",
  status: a.status,
  ip: a.ip || "",
  environment: a.environment || "",
  location: a.location || "",
  serialNumber: a.serial || "",
  createdAt: a.createdAt,
});

router.get(
  "/assets",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Asset = mongoose.model("Asset");
    const filter = scoped(req);
    if (req.query.search) filter.$or = [
      { name: new RegExp(req.query.search, "i") },
      { serial: new RegExp(req.query.search, "i") },
      { hostname: new RegExp(req.query.search, "i") },
      { ip: new RegExp(req.query.search, "i") },
    ];
    if (req.query.type) filter.type = req.query.type;
    const assets = await Asset.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, assets: assets.map(normAsset) });
  }),
);

router.get(
  "/assets/:id",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Asset = mongoose.model("Asset");
    const asset = await Asset.findOne({ _id: req.params.id, ...scoped(req) });
    res.json({ success: true, asset: asset ? normAsset(asset) : null });
  }),
);

router.post(
  "/assets",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Asset = mongoose.model("Asset");
    const doc = await Asset.create({
      company: tenantOf(req),
      name: req.body.name,
      serial: req.body.serial || req.body.serialNumber || "",
      hostname: req.body.hostname || "",
      ip: req.body.ip || "",
      type: req.body.type || "hardware",
      environment: req.body.environment || "",
      location: req.body.location || "",
      status: req.body.status || "active",
    });
    res.status(201).json({ success: true, asset: normAsset(doc) });
  }),
);

router.get(
  "/cmdb/health",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Asset = mongoose.model("Asset");
    const q = scoped(req);
    const total = await Asset.countDocuments(q);
    const staleSince = new Date(Date.now() - 90 * 24 * 3600 * 1000);
    const [stale, uncertified, noOwner] = await Promise.all([
      Asset.countDocuments({ ...q, updatedAt: { $lt: staleSince } }),
      Asset.countDocuments({ ...q, $or: [{ serial: "" }, { serial: { $exists: false } }] }),
      Asset.countDocuments({ ...q, company: { $in: [null] } }),
    ]);
    const pct = (n) => (total ? (n / total) * 100 : 0);
    const healthScore = Math.max(
      0,
      Math.round(100 - pct(stale) * 0.5 - pct(uncertified) * 0.3 - pct(noOwner) * 0.2),
    );
    res.json({
      success: true,
      total,
      stale,
      uncertified,
      noOwner,
      healthScore,
    });
  }),
);

router.get(
  "/cmdb/cis/:ciId/impact",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Asset = mongoose.model("Asset");
    const ci = await Asset.findOne({ _id: req.params.ciId, ...scoped(req) });
    if (!ci) {
      return res.json({
        success: true,
        ciId: req.params.ciId,
        impactedCIs: [],
        totalImpacted: 0,
      });
    }
    const related = (ci.ip || ci.hostname)
      ? await Asset.find({
          _id: { $ne: ci._id },
          ...scoped(req),
          $or: [
            ...(ci.ip ? [{ ip: ci.ip }] : []),
            ...(ci.hostname ? [{ hostname: ci.hostname }] : []),
          ],
        }).limit(50)
      : [];
    const impactedCIs = related.map((a) => ({
      _id: a._id,
      name: a.name,
      ciClass: a.type || "hardware",
      criticality: a.type === "server" ? "high" : "medium",
      status: a.status,
    }));
    res.json({
      success: true,
      ciId: req.params.ciId,
      impactedCIs,
      totalImpacted: impactedCIs.length,
    });
  }),
);

// ── Problems ────────────────────────────────────────────────────────────
const normProblem = (p) => ({
  _id: p._id,
  title: p.title,
  description: p.description || "",
  status: p.status,
  priority: p.priority || "medium",
  impact: p.impact || "",
  rootCause: p.rootCause || "",
  workaround: p.workaround || "",
  assignedTo: p.assignedTo ? { name: p.assignedTo.name } : undefined,
  linkedIncidents: p.linkedIncidents || [],
  createdAt: p.createdAt,
});

router.get(
  "/problems",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Problem = mongoose.model("Problem");
    const problems = await Problem.find(scoped(req))
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, problems: problems.map(normProblem) });
  }),
);

router.post(
  "/problems",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Problem = mongoose.model("Problem");
    const doc = await Problem.create({
      company: tenantOf(req),
      title: req.body.title,
      description: req.body.description || "",
      priority: req.body.priority || "medium",
      rootCause: req.body.rootCause || "",
      workaround: req.body.workaround || "",
    });
    res.status(201).json({ success: true, problem: normProblem(doc) });
  }),
);

// ── Changes ─────────────────────────────────────────────────────────────
const riskScores = { low: 10, medium: 35, high: 70, critical: 90 };
const normChange = (c) => ({
  _id: c._id,
  number: c.number,
  title: c.title,
  description: c.description || "",
  type: c.type || "normal",
  status: c.status,
  risk: c.risk || "medium",
  riskLevel: c.risk || "medium",
  riskScore: c.riskScore || riskScores[c.risk] || 35,
  reason: c.justification || "",
  plan: c.implementationPlan || "",
  rollbackPlan: c.rollbackPlan || "",
  windowStart: c.windowStart || null,
  windowEnd: c.windowEnd || null,
  assignedTo: c.assignedTo ? { name: c.assignedTo.name } : undefined,
  createdAt: c.createdAt,
});

const findConflicts = async (req, { start, end, excludeId }) => {
  const mongoose = require("mongoose");
  const Change = mongoose.model("Change");
  const BlackoutWindow = mongoose.model("BlackoutWindow");
  const q = { company: tenantOf(req) };
  if (start || end) {
    q.windowStart = { $ne: null };
    q.windowStart = start ? { $gte: new Date(start), $lte: new Date(end || start) } : { $lte: new Date(end) };
  }
  if (excludeId) q._id = { $ne: excludeId };
  const changes = await Change.find(q)
    .select("number title status windowStart windowEnd")
    .limit(100);
  const overlapping = changes
    .filter((c) => c.windowStart && c.windowEnd)
    .map((c) => ({ id: c._id, number: c.number, title: c.title, status: c.status }));
  const blackoutQ = { ...scoped(req), isActive: true };
  if (start || end) {
    blackoutQ.startTime = { $lte: new Date(end || Date.now() + 30 * 24 * 3600 * 1000) };
    blackoutQ.endTime = { $gte: new Date(start || 0) };
  }
  const blackouts = await BlackoutWindow.find(blackoutQ).select("name").limit(100);
  return {
    conflicts: {
      overlapping,
      blackouts: blackouts.map((b) => ({ id: b._id, name: b.name })),
    },
  };
};

router.get(
  "/changes/conflicts",
  asyncHandler(async (req, res) => {
    const result = await findConflicts(req, req.query);
    res.json({ success: true, ...result });
  }),
);

router.get(
  "/changes",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Change = mongoose.model("Change");
    const changes = await Change.find(scoped(req))
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, changes: changes.map(normChange) });
  }),
);

router.post(
  "/changes",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Change = mongoose.model("Change");
    const risk = req.body.risk || "medium";
    const riskScore = riskScores[risk] || 35;
    const windowStart = req.body.windowStart
      ? new Date(req.body.windowStart)
      : new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const windowEnd = req.body.windowEnd
      ? new Date(req.body.windowEnd)
      : new Date(windowStart.getTime() + 24 * 3600 * 1000);
    const doc = await Change.create({
      number: `CHG-${Date.now()}`,
      company: tenantOf(req),
      title: req.body.title,
      description: req.body.description || "",
      type: req.body.type || "normal",
      risk,
      riskScore,
      justification: req.body.reason || "",
      implementationPlan: req.body.plan || "",
      rollbackPlan: req.body.rollbackPlan || "",
      windowStart,
      windowEnd,
      status: "new",
    });
    const conflicts = await findConflicts(req, { start: windowStart, end: windowEnd, excludeId: doc._id });
    res.status(201).json({
      success: true,
      change: { _id: doc._id, riskScore },
      ...conflicts,
    });
  }),
);

router.put(
  "/changes/:id",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Change = mongoose.model("Change");
    const update = { status: req.body.status || "review" };
    if (req.body.cabDecision) update.customData = { cabDecision: req.body.cabDecision };
    if (req.body.decidedAt) update.decidedAt = req.body.decidedAt;
    if (req.body.emergencyJustification) update.justification = req.body.emergencyJustification;
    if (req.body.status === "approved") update.status = "authorize";
    else if (req.body.status === "rejected") update.status = "canceled";
    else update.status = req.body.status;
    const doc = await Change.findOneAndUpdate(
      { _id: req.params.id, ...scoped(req) },
      { $set: update },
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, error: "Change not found" });
    res.json({ success: true, change: normChange(doc) });
  }),
);

// ── Incidents ───────────────────────────────────────────────────────────
const mapSev = (s) =>
  ({ critical: "Sev1", high: "Sev2", major: "Sev2", medium: "Sev3", low: "Sev4" }[s] || "Sev3");
const normIncident = (i) => ({
  _id: i._id,
  number: i.number,
  title: i.title,
  description: i.description || "",
  status: i.status,
  severity: i.severity || "Sev3",
  priority: i.priority || i.severity,
  isMajor: i.isMajor || i.severity === "Sev1",
  commander:
    i.commander && typeof i.commander === "object" ? { name: i.commander.name } : i.commander,
  team: i.team || "",
  createdAt: i.createdAt,
  resolvedAt: i.resolution?.resolvedAt || i.resolvedAt || null,
});

router.get(
  "/incidents",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Incident = mongoose.model("Incident");
    const incidents = await Incident.find(scoped(req))
      .populate("commander", "name")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, incidents: incidents.map(normIncident) });
  }),
);

router.post(
  "/incidents",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Incident = mongoose.model("Incident");
    const doc = await Incident.create({
      number: `INC-${Date.now()}`,
      company: tenantOf(req),
      title: req.body.title,
      description: req.body.description || "",
      severity: mapSev(req.body.severity),
      status: "new",
      isMajor: false,
    });
    res.status(201).json({ success: true, incident: { _id: doc._id } });
  }),
);

router.put(
  "/incidents/:id",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Incident = mongoose.model("Incident");
    const update = { status: req.body.status };
    if (req.body.resolvedAt) {
      update.resolvedAt = req.body.resolvedAt;
      update.resolution = { resolvedAt: req.body.resolvedAt };
    }
    const doc = await Incident.findOneAndUpdate(
      { _id: req.params.id, ...scoped(req) },
      { $set: update },
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, error: "Incident not found" });
    res.json({ success: true, incident: normIncident(doc) });
  }),
);

router.post(
  "/incidents/:id/major",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Incident = mongoose.model("Incident");
    const MajorIncident = mongoose.model("MajorIncident");
    const incident = await Incident.findOneAndUpdate(
      { _id: req.params.id, ...scoped(req) },
      { $set: { isMajor: true, severity: "Sev1" } },
      { new: true },
    );
    if (!incident) return res.status(404).json({ success: false, error: "Incident not found" });
    await MajorIncident.findOneAndUpdate(
      { incident: incident._id },
      { $set: { incident: incident._id, status: "active", reason: req.body.reason || "" } },
      { upsert: true, new: true },
    );
    res.status(201).json({ success: true, incident: { _id: incident._id } });
  }),
);

router.put(
  "/incidents/:id/communication-plan",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Incident = mongoose.model("Incident");
    const MajorIncident = mongoose.model("MajorIncident");
    const CommunicationPlan = mongoose.model("CommunicationPlan");
    const incident = await Incident.findOne({ _id: req.params.id, ...scoped(req) });
    if (!incident) return res.status(404).json({ success: false, error: "Incident not found" });
    let mi = await MajorIncident.findOne({ incident: incident._id });
    if (!mi) {
      mi = await MajorIncident.create({ incident: incident._id, status: "active" });
    }
    const cadence = req.body.cadenceMinutes || 30;
    const plan = await CommunicationPlan.findOneAndUpdate(
      { majorIncidentId: mi._id },
      {
        $set: {
          majorIncidentId: mi._id,
          internal: {
            enabled: true,
            cadenceMinutes: cadence,
            channels: (req.body.audience || []).map((a) => String(a)),
          },
        },
      },
      { upsert: true, new: true },
    );
    res.json({ success: true, plan });
  }),
);

// ── ITOM Alerts ─────────────────────────────────────────────────────────
router.get(
  "/itom/alerts",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const ItomAlert = mongoose.model("ItomAlert");
    const filter = scoped(req);
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.status) filter.status = req.query.status;
    const alerts = await ItomAlert.find(filter)
      .populate("resource", "name")
      .sort({ firedAt: -1 })
      .limit(200);
    res.json({
      success: true,
      alerts: alerts.map((a) => ({
        _id: a._id,
        title: a.title,
        severity: a.severity,
        status: a.status,
        source: a.source,
        resource: a.resource ? { name: a.resource.name } : undefined,
        count: a.count,
        createdAt: a.firedAt,
      })),
    });
  }),
);

router.put(
  "/itom/alerts/:id",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const ItomAlert = mongoose.model("ItomAlert");
    const update = { status: req.body.status };
    if (req.body.status === "resolved") update.resolvedAt = new Date();
    const doc = await ItomAlert.findOneAndUpdate(
      { _id: req.params.id, ...scoped(req) },
      { $set: update },
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, error: "Alert not found" });
    res.json({ success: true, alert: doc });
  }),
);

// ── Audit ───────────────────────────────────────────────────────────────
router.get(
  "/audit",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const AuditEvent = require("../models/core/AuditEvent");
    const AuditEventModel =
      typeof AuditEvent === "function" ? AuditEvent : mongoose.model("AuditEvent");
    const t = tenantOf(req);
    const filter = t ? { $or: [{ company: t }, { tenantId: t }] } : {};
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const [logs, total] = await Promise.all([
      AuditEventModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AuditEventModel.countDocuments(filter),
    ]);
    const norm = (l) => ({
      _id: l._id,
      actor: l.actor
        ? { name: l.actor?.name || l.actorName || String(l.actor), email: l.actor?.email || "" }
        : { name: l.actorName || String(l.actorUserId || ""), email: "" },
      action: l.action || l.event || "",
      entity: l.entity || l.entityType || l.resourceType || "",
      entityId: l.entityId || l.resourceId || "",
      ip: l.ip || "",
      createdAt: l.createdAt,
    });
    res.json({ success: true, logs: logs.map(norm), total, audit: logs });
  }),
);

// ── Service request cart ────────────────────────────────────────────────
router.post(
  "/requests/cart",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const ServiceRequest = mongoose.model("ServiceRequest");
    const ServiceCatalogItem = mongoose.model("ServiceCatalogItem");
    const requester = actorId(req);
    const fulfilledFor = req.body.fulfilledFor || requester;
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const ids = items.map((i) => i.catalogItemId).filter(Boolean);
    const catalog = await ServiceCatalogItem.find({ _id: { $in: ids } }).select("name description");
    const requestedItems = items.map((i) => {
      const c = catalog.find((k) => String(k._id) === String(i.catalogItemId));
      return {
        catalogItem: i.catalogItemId,
        name: c?.name || i.catalogItemId,
        quantity: i.quantity || 1,
      };
    });
    const sr = await ServiceRequest.create({
      number: `SR-${Date.now()}`,
      company: tenantOf(req),
      requester,
      fulfilledFor,
      status: "pending",
      requestedItems,
    });
    res.status(201).json({
      success: true,
      children: requestedItems,
      requestedItems,
      request: { _id: sr._id, number: sr.number },
    });
  }),
);

module.exports = router;