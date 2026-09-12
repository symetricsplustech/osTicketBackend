// Gap-fill surface #2: closure codes & trash/restore, MTT metrics, OLA
// breaches, assignment routing, catalog bundles, approval chains, change
// blackouts, shift handovers and KB publish sweeps. Thin, tenant-scoped.
const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { protectTenantPrincipal } = require("../middleware/auth");

const router = express.Router();
router.use(protectTenantPrincipal);

const tenantOf = (req) => req.companyId || req.tenantId || null;
const actorId = (req) => req.user?._id || req.agent?._id || null;
const objectId = (v) => require("mongoose").Types.ObjectId.isValid(v) ? require("mongoose").Types.ObjectId(v) : null;

const getSetting = async (key, fallback) => {
  const SystemSetting = require("mongoose").model("SystemSetting");
  let s = await SystemSetting.findOne({ key });
  if (!s) {
    s = await SystemSetting.create({ key, value: fallback });
  }
  return s.value;
};

const DEFAULT_CLOSURE_CODES = {
  resolutionCodes: [
    "Resolved",
    "Closed",
    "Workaround Provided",
    "No Issue Found",
    "Duplicate",
    "Referred",
    "Escalated",
    "Cancelled",
  ],
  closureCodes: [
    "Fully Resolved",
    "Resolved with Workaround",
    "Auto-Closed",
    "Vendor Resolved",
    "Out of Scope",
    "Abandoned",
  ],
};

// ── Closure codes ───────────────────────────────────────────────────────
router.get(
  "/closure-codes",
  asyncHandler(async (req, res) => {
    const value = await getSetting("helpdesk.closureCodes", DEFAULT_CLOSURE_CODES);
    res.json({
      success: true,
      resolutionCodes: value.resolutionCodes || DEFAULT_CLOSURE_CODES.resolutionCodes,
      closureCodes: value.closureCodes || DEFAULT_CLOSURE_CODES.closureCodes,
    });
  }),
);

router.put(
  "/tickets/:number/closure",
  asyncHandler(async (req, res) => {
    const Ticket = require("mongoose").model("Ticket");
    const doc = await Ticket.findOneAndUpdate(
      { number: req.params.number, company: tenantOf(req) },
      {
        $set: {
          resolution: {
            code: req.body.resolutionCode || "",
            solution: "",
            rootCause: "",
          },
          "customData.closureCode": req.body.closureCode || "",
        },
      },
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, error: "Ticket not found" });
    res.json({ success: true, ticketNumber: doc.number });
  }),
);

// ── Soft-deleted trash & restore ────────────────────────────────────────
router.get(
  "/tickets-trash",
  asyncHandler(async (req, res) => {
    const Ticket = require("mongoose").model("Ticket");
    const q = tenantOf(req) ? { company: tenantOf(req) } : {};
    const trash = await Ticket.find({ ...q, status: "deleted" })
      .sort({ updatedAt: -1 })
      .limit(200)
      .select("number updatedAt resolution customData subject");
    res.json({
      success: true,
      items: trash.map((t) => ({
        ticketNumber: t.number,
        reason: t.customData?.deletedReason || t.resolution?.rootCause || "",
        deletedAt: t.updatedAt || null,
        subject: t.subject,
      })),
    });
  }),
);

router.post(
  "/tickets/:number/restore",
  asyncHandler(async (req, res) => {
    const Ticket = require("mongoose").model("Ticket");
    const doc = await Ticket.findOneAndUpdate(
      { number: req.params.number, company: tenantOf(req), status: "deleted" },
      { $set: { status: "open" } },
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, error: "Deleted ticket not found" });
    res.json({ success: true, ticketNumber: doc.number });
  }),
);

// ── Problem → change generation ─────────────────────────────────────────
router.post(
  "/problems/:id/generate-change",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Problem = mongoose.model("Problem");
    const Change = mongoose.model("Change");
    const t = tenantOf(req);
    const prob = await Problem.findOne({ _id: req.params.id, company: t });
    if (!prob) return res.status(404).json({ success: false, error: "Problem not found" });
    const doc = await Change.create({
      number: `CHG-${Date.now()}`,
      company: t,
      title: `Problem investigation: ${prob.title}`,
      description: prob.description || "",
      type: "normal",
      risk: prob.priority === "high" || prob.priority === "critical" ? "high" : "medium",
      riskScore: prob.priority === "high" || prob.priority === "critical" ? 70 : 35,
      justification: prob.rootCause || "",
      status: "new",
    });
    res.status(201).json({ success: true, change: { _id: doc._id, number: doc.number } });
  }),
);

// ── MTT metrics ─────────────────────────────────────────────────────────
router.get(
  "/mtt-metrics",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Ticket = mongoose.model("Ticket");
    const t = tenantOf(req);
    const match = t ? { company: objectId(t) } : {};
    const [alertsTracked, ackAgg, mtrAgg] = await Promise.all([
      Ticket.countDocuments({ ...match, responseDueAt: { $ne: null } }),
      Ticket.aggregate([
        { $match: { ...match, "stats.firstResponseAt": { $ne: null } } },
        {
          $project: {
            mins: {
              $divide: [{ $subtract: ["$stats.firstResponseAt", "$createdAt"] }, 60000],
            },
          },
        },
        { $group: { _id: null, avg: { $avg: "$mins" } } },
      ]),
      Ticket.aggregate([
        { $match: { ...match, resolvedAt: { $ne: null } } },
        {
          $project: {
            mins: { $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 60000] },
          },
        },
        { $group: { _id: null, avg: { $avg: "$mins" } } },
      ]),
    ]);
    res.json({
      success: true,
      alertsTracked,
      mttAckMinutes: Math.round(ackAgg[0]?.avg || 0),
      mtrMinutes: Math.round(mtrAgg[0]?.avg || 0),
      note: alertsTracked
        ? `${alertsTracked} SLA clocks currently tracked`
        : "No SLA clocks tracked yet",
    });
  }),
);

// ── Executive report (text/markdown) ────────────────────────────────────
router.get(
  "/reports/major-incidents-exec",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Incident = mongoose.model("Incident");
    const t = tenantOf(req);
    const rows = await Incident.find({
      ...(t ? { company: t } : {}),
      $or: [{ isMajor: true }, { severity: "Sev1" }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("number title severity isMajor status createdAt");
    const lines = [
      "# Major Incident Executive Summary",
      "",
      `Report generated: ${new Date().toISOString()}`,
      `Total (last 50): ${rows.length}`,
      "",
      "## Inventory",
      "",
      ...rows.map(
        (i) =>
          `- [${i.number}] ${i.title} — Se${i.severity}, status ${i.status}, opened ${i.createdAt?.toISOString?.() || ""}`,
      ),
      "",
    ].filter((l) => String(l).length);
    res.type("text/plain").send(lines.join("\n"));
  }),
);

// ── OLA breaches ────────────────────────────────────────────────────────
router.get(
  "/ola-breaches",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Ticket = mongoose.model("Ticket");
    const t = tenantOf(req);
    const q = t ? { company: t } : {};
    const rows = await Ticket.find({
      ...q,
      $or: [{ responseBreached: true }, { resolutionBreached: true }],
    })
      .sort({ updatedAt: -1 })
      .limit(200)
      .select(
        "number responseBreached resolutionBreached slaStartedAt responseDueAt resolutionDueAt createdAt",
      );
    const now = Date.now();
    const breaches = rows.map((tk) => {
      const start = tk.slaStartedAt || tk.createdAt;
      const ageMinutes = start ? Math.max(0, (now - start.getTime()) / 60000) : 0;
      const isResponse = !!tk.responseBreached;
      const due = isResponse ? tk.responseDueAt : tk.resolutionDueAt;
      const allowed = due && start ? Math.max(0, (due.getTime() - start.getTime()) / 60000) : 15;
      return {
        ticket: tk.number,
        ola: isResponse ? "first_response" : "resolution",
        ageMinutes: Math.round(ageMinutes),
        allowed: Math.round(allowed),
      };
    });
    res.json({ success: true, breaches, breachCount: breaches.length });
  }),
);

// ── Assignment routing ──────────────────────────────────────────────────
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

router.post(
  "/routing/next-agent",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Agent = mongoose.model("Agent");
    const Ticket = mongoose.model("Ticket");
    const AssignmentEvent = mongoose.model("AssignmentEvent");
    const Skill = mongoose.model("Skill");
    const strategy = req.body.strategy || "round_robin";
    const t = tenantOf(req);
    const skills = await Skill.find({
      name: { $in: (req.body.requiredSkills || []).map((s) => new RegExp(`^${s}$`, "i")) },
    }).select("name");
    const skillIds = skills.map((s) => s._id);
    const agentQuery = { isActive: true };
    if (skillIds.length) agentQuery.skills = { $in: skillIds };
    const agents = await Agent.find(agentQuery).select("name email departments skills");
    if (req.body.departmentKey) {
      const filtered = agents.filter((a) =>
        (a.departments || []).some((d) => String(d.department) === String(req.body.departmentKey)),
      );
      if (filtered.length) agents.splice(0, agents.length, ...filtered);
    }
    const loadMatch = { ...(t ? { company: objectId(t) } : {}), agent: { $ne: null }, status: { $in: openTicketStatuses } };
    const loads = await Ticket.aggregate([
      { $match: loadMatch },
      { $group: { _id: "$agent", n: { $sum: 1 } } },
    ]);
    const loadMap = new Map(loads.map((l) => [String(l._id), l.n]));
    const ranked = [...agents]
      .map((a) => ({ agent: a, openLoad: loadMap.get(String(a._id)) || 0 }))
      .sort((a, b) =>
        strategy === "least_workload"
          ? a.openLoad - b.openLoad || a.agent.name.localeCompare(b.agent.name)
          : a.agent.name.localeCompare(b.agent.name),
      );
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const recentLoads = await AssignmentEvent.aggregate([
      {
        $match: {
          ...(t ? { tenantId: objectId(t) } : {}),
          eventType: "assign",
          createdAt: { $gte: since },
        },
      },
      { $group: { _id: "$toAgent", n: { $sum: 1 } } },
    ]);
    const recentMap = new Map(recentLoads.map((l) => [String(l._id), l.n]));
    const pick = ranked.find((r) => (recentMap.get(String(r.agent._id)) || 0) < 3);
    if (!pick) {
      return res.json({
        success: true,
        overflowQueue: true,
        note: "All agents at capacity — routing to overflow queue",
        strategy,
      });
    }
    const ticket = req.body.ticketNumber
      ? await Ticket.findOne({ number: req.body.ticketNumber, company: t }).select("_id")
      : null;
    if (ticket && t) {
      await AssignmentEvent.create({
        tenantId: objectId(t),
        ticketId: ticket._id,
        ticketNumber: req.body.ticketNumber,
        eventType: "assign",
        toAgent: pick.agent._id,
        method: strategy === "least_workload" ? "least_workload" : "round_robin",
        reason: "Assignment routing",
        performedBy: actorId(req),
      });
    }
    res.json({
      success: true,
      agent: { name: pick.agent.name, openLoad: pick.openLoad },
      strategy,
      overflowQueue: false,
      note: `${pick.agent.name} selected (open load ${pick.openLoad})`,
    });
  }),
);

router.get(
  "/assignments/history/:ticketNumber",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const AssignmentEvent = mongoose.model("AssignmentEvent");
    const t = tenantOf(req);
    const rows = await AssignmentEvent.find({
      ticketNumber: req.params.ticketNumber,
      ...(t ? { tenantId: objectId(t) } : {}),
    })
      .populate("toAgent", "name")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(
      rows.map((h) => ({
        toAgent: h.toAgent ? { name: h.toAgent.name } : null,
        agent: h.toAgent ? { name: h.toAgent.name } : null,
        strategy: h.method || h.reason || "manual",
        at: h.createdAt,
      })),
    );
  }),
);

// ── Catalog bundles ─────────────────────────────────────────────────────
router.get(
  "/catalog/bundles",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const ServiceCatalogItem = mongoose.model("ServiceCatalogItem");
    const t = tenantOf(req);
    const items = await ServiceCatalogItem.find({ ...(t ? { company: t } : {}), visibleInPortal: true })
      .select("name description category")
      .limit(100);
    res.json(
      items.map((i) => ({
        _id: i._id,
        name: i.name,
        description: i.description,
        category: i.category,
      })),
    );
  }),
);

// ── Approval chains ─────────────────────────────────────────────────────
router.get(
  "/approval-chains",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Approval = mongoose.model("Approval");
    const t = tenantOf(req);
    const rows = await Approval.find({ ...(t ? { company: t } : {}) })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(
      rows.map((a) => ({
        _id: a._id,
        subject: a.title,
        title: a.title,
        mode: a.mode || "sequential",
        status: a.status || "pending",
        steps: (a.steps || []).map((s) => ({
          approver: s.decidedByName || s.assignee || null,
          decision:
            s.status === "approved"
              ? "approved"
              : s.status === "rejected"
                ? "rejected"
                : s.decidedAt
                  ? s.status
                  : null,
          decidedAt: s.decidedAt || null,
        })),
        createdAt: a.createdAt,
      })),
    );
  }),
);

router.post(
  "/approval-chains/:id/decide",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Approval = mongoose.model("Approval");
    const decision = req.body.decision === "approved" ? "approved" : "rejected";
    const doc = await Approval.findOneAndUpdate(
      { _id: req.params.id, ...(tenantOf(req) ? { company: tenantOf(req) } : {}) },
      {
        $set: {
          status: decision,
          "steps.$[elem].status": decision,
          "steps.$[elem].decidedAt": new Date(),
          "steps.$[elem].decidedByName": req.user?.name || req.agent?.name || "",
        },
        arrayFilters: [{ "elem.status": { $in: ["pending", "in_progress"] } }],
      },
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, error: "Approval not found" });
    res.json({ success: true, approval: doc });
  }),
);

// ── Change blackout windows ─────────────────────────────────────────────
router.get(
  "/blackout-windows",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const BlackoutWindow = mongoose.model("BlackoutWindow");
    const t = tenantOf(req);
    const rows = await BlackoutWindow.find({
      ...(t ? { company: t } : {}),
      isActive: true,
    }).sort({ startTime: 1 });
    res.json(
      rows.map((b) => ({
        _id: b._id,
        name: b.name,
        title: b.name,
        startsAt: b.startTime,
        endsAt: b.endTime,
        reason: b.reason,
      })),
    );
  }),
);

router.post(
  "/blackout-windows",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const BlackoutWindow = mongoose.model("BlackoutWindow");
    const doc = await BlackoutWindow.create({
      name: req.body.name,
      company: tenantOf(req),
      description: req.body.reason || "",
      startTime: req.body.startsAt,
      endTime: req.body.endsAt,
      reason: req.body.reason || "",
      createdBy: actorId(req),
      isActive: true,
    });
    res.status(201).json({ success: true, blackoutWindow: doc });
  }),
);

// ── Shift handover notes ────────────────────────────────────────────────
router.get(
  "/handover-notes",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const HandoverNote = mongoose.model("HandoverNote");
    const t = tenantOf(req);
    const rows = await HandoverNote.find({ ...(t ? { company: t } : {}) })
      .sort({ shiftDate: -1 })
      .limit(100);
    res.json(rows);
  }),
);

router.post(
  "/handover-notes",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const HandoverNote = mongoose.model("HandoverNote");
    const doc = await HandoverNote.create({
      company: tenantOf(req),
      shiftDate: req.body.shiftDate || new Date(),
      pendingTickets: Array.isArray(req.body.pendingTickets) ? req.body.pendingTickets : [],
      risks: req.body.risks || "",
      notes: req.body.notes || "",
      acknowledged: false,
      createdBy: actorId(req),
    });
    res.status(201).json(doc);
  }),
);

// ── KB publish sweep ────────────────────────────────────────────────────
router.post(
  "/kb/publish-sweep",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Faq = mongoose.model("Faq");
    const t = tenantOf(req);
    const q = { isPublished: false, ...(t ? { company: t } : {}) };
    const pending = await Faq.countDocuments(q);
    const result = await Faq.updateMany(q, { $set: { isPublished: true } });
    res.json({
      success: true,
      publishedNow: result.modifiedCount || 0,
      skipped: pending - (result.modifiedCount || 0),
    });
  }),
);

module.exports = router;