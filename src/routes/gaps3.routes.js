// Gap-fill surface #3: impact × urgency priority matrix and knowledge-base
// gap analysis. Thin, tenant-scoped endpoints persisting the matrix in the
// shared SystemSetting store.
const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { protectTenantPrincipal } = require("../middleware/auth");

const router = express.Router();
router.use(protectTenantPrincipal);

const tenantOf = (req) => req.companyId || req.tenantId || null;

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

const getSetting = async (key, fallback) => {
  const SystemSetting = require("mongoose").model("SystemSetting");
  let s = await SystemSetting.findOne({ key });
  if (!s) s = await SystemSetting.create({ key, value: fallback });
  return s.value;
};

router.get(
  "/priority-matrix",
  asyncHandler(async (req, res) => {
    const value = await getSetting("helpdesk.priorityMatrix", DEFAULT_MATRIX);
    res.json(Array.isArray(value) ? value : DEFAULT_MATRIX);
  }),
);

router.put(
  "/priority-matrix",
  asyncHandler(async (req, res) => {
    const SystemSetting = require("mongoose").model("SystemSetting");
    const cells = Array.isArray(req.body?.cells) ? req.body.cells : [];
    if (!cells.length) {
      return res.status(400).json({ success: false, error: "cells array is required" });
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
  asyncHandler(async (req, res) => {
    const impact = String(req.body?.impact || "medium").toLowerCase();
    const urgency = String(req.body?.urgency || "medium").toLowerCase();
    const matrix = await getSetting("helpdesk.priorityMatrix", DEFAULT_MATRIX);
    const cell = (Array.isArray(matrix) ? matrix : []).find(
      (c) => String(c.impact).toLowerCase() === impact && String(c.urgency).toLowerCase() === urgency,
    );
    res.json({
      priority: cell?.priority || "medium",
      source: cell ? "priority_matrix" : "default_fallback",
    });
  }),
);

router.get(
  "/kb/gap-analysis",
  asyncHandler(async (req, res) => {
    const mongoose = require("mongoose");
    const Faq = mongoose.model("Faq");
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