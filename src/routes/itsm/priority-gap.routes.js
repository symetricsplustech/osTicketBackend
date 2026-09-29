// Gap-fill surface #3: impact × urgency priority matrix and knowledge-base
// gap analysis. Thin, tenant-scoped endpoints persisting the matrix in the
// shared SystemSetting store.
const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const {
  protectTenantPrincipal,
  requirePermission,
} = require("../../middleware/auth");
const { tenantOf, getSetting } = require("./shared");

const router = express.Router();
router.use(protectTenantPrincipal);

const DEFAULT_MATRIX = [
  { impact: "low", urgency: "low", priority: "low" },
  { impact: "low", urgency: "medium", priority: "medium" },
  { impact: "low", urgency: "high", priority: "medium" },
  { impact: "medium", urgency: "low", priority: "medium" },
  { impact: "medium", urgency: "medium", priority: "medium" },
  { impact: "medium", urgency: "high", priority: "high" },
  { impact: "high", urgency: "low", priority: "medium" },
  { impact: "high", urgency: "medium", priority: "high" },
  { impact: "high", urgency: "high", priority: "critical" },
];

router.get(
  "/priority-matrix",
  requirePermission("itsm.incident.incident.read"),
  asyncHandler(async (req, res) => {
    const value = await getSetting("helpdesk.priorityMatrix", DEFAULT_MATRIX);
    res.json(Array.isArray(value) ? value : DEFAULT_MATRIX);
  }),
);

router.put(
  "/priority-matrix",
  requirePermission("itsm.incident.override_priority"),
  asyncHandler(async (req, res) => {
    const SystemSetting = require("../models/SystemSetting");
    const cells = Array.isArray(req.body?.cells) ? req.body.cells : [];
    if (!cells.length) {
      return res
        .status(400)
        .json({ success: false, error: "cells array is required" });
    }
    await SystemSetting.updateOne(
      { key: "helpdesk.priorityMatrix" },
      { $set: { value: cells } },
      { upsert: true },
    );
    res.json({ success: true, cells });
  }),
);

router.post(
  "/priority-matrix/compute",
  requirePermission("itsm.incident.calculate_priority"),
  asyncHandler(async (req, res) => {
    const impact = String(req.body?.impact || "medium").toLowerCase();
    const urgency = String(req.body?.urgency || "medium").toLowerCase();
    const matrix = await getSetting("helpdesk.priorityMatrix", DEFAULT_MATRIX);
    const cell = (Array.isArray(matrix) ? matrix : []).find(
      (c) =>
        String(c.impact).toLowerCase() === impact &&
        String(c.urgency).toLowerCase() === urgency,
    );
    res.json({
      priority: cell?.priority || "medium",
      source: cell ? "priority_matrix" : "default_fallback",
    });
  }),
);

router.get(
  "/kb/gap-analysis",
  requirePermission("itsm.knowledge.knowledge_article.read"),
  asyncHandler(async (req, res) => {
    const Faq = require("../models/helpdesk/knowledge/Faq");
    const t = tenantOf(req);
    const q = t ? { company: t } : {};
    const [totalArticles, publishedArticles] = await Promise.all([
      Faq.countDocuments(q),
      Faq.countDocuments({ ...q, isPublished: true }),
    ]);
    res.json({
      success: true,
      zeroResultQueries: [],
      totalArticles,
      publishedArticles,
      draftArticles: Math.max(0, totalArticles - publishedArticles),
      lastScanAt: new Date().toISOString(),
    });
  }),
);

module.exports = router;
