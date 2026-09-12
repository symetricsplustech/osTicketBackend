// Extra surface: change calendar, ticket templates, post-implementation
// reviews (PIR) and outage tracking. Thin, tenant-scoped endpoints that feed
// the Helpdesk console; backed by dedicated models.
const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { protectTenantPrincipal } = require("../middleware/auth");

const router = express.Router();
router.use(protectTenantPrincipal);

const tenantOf = (req) => req.companyId || req.tenantId || null;
const actorId = (req) => req.user?._id || req.agent?._id || null;

router.get(
  "/change-calendar",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Change = mongoose.model("Change");
    const BlackoutWindow = mongoose.model("BlackoutWindow");
    const q = { company: tenantOf(req) };
    const [changes, blackouts] = await Promise.all([
      Change.find({ ...q, windowStart: { $ne: null }, windowEnd: { $ne: null } })
        .select("title type windowStart windowEnd")
        .limit(500),
      BlackoutWindow.find({ ...q, isActive: true }).select("name startTime endTime"),
    ]);
    const rows = [
      ...changes.map((c) => ({
        _id: c._id,
        title: c.title,
        start: c.windowStart,
        end: c.windowEnd,
        type: "change",
      })),
      ...blackouts.map((b) => ({
        _id: b._id,
        title: `Blackout: ${b.name}`,
        start: b.startTime,
        end: b.endTime,
        type: "freeze",
      })),
    ].sort((a, b) => new Date(a.start) - new Date(b.start));
    res.json(rows);
  }),
);

// ── Ticket templates ────────────────────────────────────────────────────
router.get(
  "/templates",
  asyncHandler(async (req, res) => {
    const tickets = require("../models/TicketTemplate");
    const models = require("mongoose");
    const TicketTemplate = models.model("TicketTemplate") || tickets;
    const list = await TicketTemplate.find({ company: tenantOf(req) }).sort({ name: 1 });
    res.json(list);
  }),
);

router.post(
  "/templates",
  asyncHandler(async (req, res) => {
    const models = require("mongoose");
    const TicketTemplate = models.model("TicketTemplate") || require("../models/TicketTemplate");
    const doc = await TicketTemplate.create({
      company: tenantOf(req),
      name: req.body.name,
      subject: req.body.subject || "",
      body: req.body.body || "",
      category: req.body.category || "General",
      priority: req.body.priority || "Normal",
      createdBy: actorId(req),
    });
    res.status(201).json(doc);
  }),
);

// ── Post-implementation reviews (PIR) ───────────────────────────────────
const normPir = (p) => ({
  _id: p._id,
  change: p.change
    ? { _id: p.change._id, title: p.change.title || "" }
    : undefined,
  plannedDate: p.plannedDate || null,
  completedDate: p.completedDate || null,
  questions: p.questions || [],
  lessonsLearned: p.lessonsLearned || "",
  outcome: p.outcome || "",
  riskRating: p.riskRating || "medium",
  status: p.status || "draft",
});

router.get(
  "/pir",
  asyncHandler(async (req, res) => {
    const models = require("mongoose");
    const Pir = models.model("Pir") || require("../models/Pir");
    const pirs = await Pir.find({ company: tenantOf(req) })
      .populate("change", "_id title")
      .sort({ createdAt: -1 });
    res.json(pirs.map(normPir));
  }),
);

router.post(
  "/pir",
  asyncHandler(async (req, res) => {
    const models = require("mongoose");
    const Pir = models.model("Pir") || require("../models/Pir");
    const doc = await Pir.create({
      company: tenantOf(req),
      change: req.body.changeId || null,
      plannedDate: req.body.plannedDate || null,
      completedDate: req.body.completedDate || null,
      questions: Array.isArray(req.body.questions) ? req.body.questions : [],
      lessonsLearned: req.body.lessonsLearned || "",
      outcome: req.body.outcome || "",
      riskRating: req.body.riskRating || "medium",
      status: req.body.status || "draft",
    });
    res.status(201).json(normPir(doc));
  }),
);

router.put(
  "/pir/:id",
  asyncHandler(async (req, res) => {
    const models = require("mongoose");
    const Pir = models.model("Pir") || require("../models/Pir");
    const update = { $set: {} };
    const m = update.$set;
    if (req.body.changeId !== undefined) m.change = req.body.changeId;
    if (req.body.plannedDate !== undefined) m.plannedDate = req.body.plannedDate;
    if (req.body.completedDate !== undefined) m.completedDate = req.body.completedDate;
    if (req.body.questions !== undefined) m.questions = req.body.questions;
    if (req.body.lessonsLearned !== undefined) m.lessonsLearned = req.body.lessonsLearned;
    if (req.body.outcome !== undefined) m.outcome = req.body.outcome;
    if (req.body.riskRating !== undefined) m.riskRating = req.body.riskRating;
    if (req.body.status !== undefined) m.status = req.body.status;
    const doc = await Pir.findOneAndUpdate(
      { _id: req.params.id, company: tenantOf(req) },
      update,
      { new: true },
    ).populate("change", "_id title");
    if (!doc) return res.status(404).json({ success: false, error: "PIR not found" });
    res.json(normPir(doc));
  }),
);

// ── Outage tracking (uses the core Outage model, scoped by tenantId) ────
const tenantScope = (req) => req.tenantId || req.companyId || null;

const normOutage = (o) => ({
  _id: o._id,
  title: o.title,
  description: o.description,
  status: o.status,
  severity: o.severity,
  impact: o.impact,
  rootCause: o.rootCause,
  timeline: (o.timeline || []).map((t) => ({
    status: t.status || "",
    message: t.message || "",
    createdAt: t.createdAt,
  })),
  startedAt: o.startTime,
  resolvedAt: o.actualRestoration || null,
});

router.get(
  "/outages",
  asyncHandler(async (req, res) => {
    const Outage = require("mongoose").model("Outage");
    const list = await Outage.find({
      tenantId: tenantScope(req),
      isDeleted: { $ne: true },
    }).sort({ startTime: -1 });
    res.json(list.map(normOutage));
  }),
);

router.post(
  "/outages",
  asyncHandler(async (req, res) => {
    const Outage = require("mongoose").model("Outage");
    const doc = await Outage.create({
      tenantId: tenantScope(req),
      number: `OUT-${Date.now()}`,
      title: req.body.title,
      description: req.body.description || "",
      type: "unplanned",
      severity: req.body.severity || "major",
      impact: req.body.impact || "",
      status: "investigating",
      startTime: req.body.startTime || new Date(),
      createdBy: actorId(req),
    });
    res.status(201).json(normOutage(doc));
  }),
);

router.post(
  "/outages/:id/timeline",
  asyncHandler(async (req, res) => {
    const Outage = require("mongoose").model("Outage");
    const entry = {
      status: req.body.status || "investigating",
      message: req.body.message || "",
      authorId: actorId(req),
      createdAt: new Date(),
    };
    const doc = await Outage.findOneAndUpdate(
      { _id: req.params.id, tenantId: tenantScope(req) },
      {
        $push: { timeline: entry },
        $set:
          req.body.status === "resolved"
            ? { status: "resolved", actualRestoration: req.body.resolvedAt || new Date() }
            : { status: req.body.status || "investigating" },
      },
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, error: "Outage not found" });
    res.json(normOutage(doc));
  }),
);

router.put(
  "/outages/:id",
  asyncHandler(async (req, res) => {
    const Outage = require("mongoose").model("Outage");
    const set = { status: req.body.status || "investigating" };
    if (req.body.status === "resolved") set.actualRestoration = req.body.resolvedAt || new Date();
    if (req.body.rootCause !== undefined) set.rootCause = req.body.rootCause;
    const doc = await Outage.findOneAndUpdate(
      { _id: req.params.id, tenantId: tenantScope(req) },
      { $set: set },
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, error: "Outage not found" });
    res.json(normOutage(doc));
  }),
);

module.exports = router;