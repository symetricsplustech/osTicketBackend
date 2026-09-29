const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { protectTenantPrincipal, requirePermission } = require("../middleware/auth");

const router = express.Router();
router.use(protectTenantPrincipal);

const tenantOf = (req) => req.companyId || req.tenantId || null;

// List surveys
router.get(
  "/surveys",
  requirePermission("itsm.core.audit_event.read"),
  asyncHandler(async (req, res) => {
    const Survey = require("../models/Survey");
    const filter = tenantOf(req) ? { company: tenantOf(req) } : {};
    const surveys = await Survey.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, surveys });
  }),
);

// Create survey
router.post(
  "/surveys",
  requirePermission("itsm.core.audit_event.read"),
  asyncHandler(async (req, res) => {
    const Survey = require("../models/Survey");
    const doc = await Survey.create({
      company: tenantOf(req),
      name: req.body.name,
      questions: req.body.questions || [],
      isActive: req.body.isActive !== false,
    });
    res.status(201).json({ success: true, survey: doc });
  }),
);

// Update survey
router.put(
  "/surveys/:id",
  requirePermission("itsm.core.audit_event.read"),
  asyncHandler(async (req, res) => {
    const Survey = require("../models/Survey");
    const update = {};
    for (const key of ["name", "questions", "isActive"]) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const doc = await Survey.findOneAndUpdate(
      { _id: req.params.id, ...(tenantOf(req) ? { company: tenantOf(req) } : {}) },
      { $set: update },
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, error: "Survey not found" });
    res.json({ success: true, survey: doc });
  }),
);

// List survey responses
router.get(
  "/responses",
  requirePermission("itsm.core.audit_event.read"),
  asyncHandler(async (req, res) => {
    const SurveyResponse = require("../models/SurveyResponse");
    const filter = tenantOf(req) ? { company: tenantOf(req) } : {};
    if (req.query.surveyId) filter.survey = req.query.surveyId;
    const responses = await SurveyResponse.find(filter)
      .populate("survey", "name")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, responses });
  }),
);

// CSAT summary stats
router.get(
  "/summary",
  requirePermission("itsm.reporting_admin.report_definition.read"),
  asyncHandler(async (req, res) => {
    const SurveyResponse = require("../models/SurveyResponse");
    const filter = tenantOf(req) ? { company: tenantOf(req) } : {};
    const [total, avgScore] = await Promise.all([
      SurveyResponse.countDocuments(filter),
      SurveyResponse.aggregate([
        { $match: filter },
        { $group: { _id: null, avg: { $avg: "$score" } } },
      ]),
    ]);
    res.json({
      success: true,
      totalResponses: total,
      averageScore: Math.round((avgScore[0]?.avg || 0) * 100) / 100,
    });
  }),
);

module.exports = router;
