const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { protectTenantPrincipal, requirePermission } = require("../middleware/auth");
const reportingService = require("../services/reporting.service");

const router = express.Router();
router.use(protectTenantPrincipal);

const tenantOf = (req) => req.companyId || req.tenantId || null;

// Agent performance metrics
router.get(
  "/agents",
  requirePermission("itsm.reporting_admin.report_definition.read"),
  asyncHandler(async (req, res) => {
    const fromDays = parseInt(req.query.fromDays, 10) || 30;
    const metrics = await reportingService.agentMetrics({
      company: tenantOf(req),
      fromDays,
    });
    res.json({ success: true, ...metrics });
  }),
);

// Department metrics
router.get(
  "/departments",
  requirePermission("itsm.reporting_admin.report_definition.read"),
  asyncHandler(async (req, res) => {
    const fromDays = parseInt(req.query.fromDays, 10) || 30;
    const metrics = await reportingService.departmentMetrics({
      company: tenantOf(req),
      fromDays,
    });
    res.json({ success: true, ...metrics });
  }),
);

// Team metrics
router.get(
  "/teams",
  requirePermission("itsm.reporting_admin.report_definition.read"),
  asyncHandler(async (req, res) => {
    const fromDays = parseInt(req.query.fromDays, 10) || 30;
    const metrics = await reportingService.teamMetrics({
      company: tenantOf(req),
      fromDays,
    });
    res.json({ success: true, ...metrics });
  }),
);

// Customer metrics
router.get(
  "/customers",
  requirePermission("itsm.reporting_admin.report_definition.read"),
  asyncHandler(async (req, res) => {
    const fromDays = parseInt(req.query.fromDays, 10) || 30;
    const limit = parseInt(req.query.limit, 10) || 50;
    const metrics = await reportingService.customerMetrics({
      company: tenantOf(req),
      fromDays,
      limit,
    });
    res.json({ success: true, ...metrics });
  }),
);

// Volume trend
router.get(
  "/volume-trend",
  requirePermission("itsm.reporting_admin.report_definition.read"),
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days, 10) || 30;
    const trend = await reportingService.volumeTrend({
      company: tenantOf(req),
      days,
    });
    res.json({ success: true, trend });
  }),
);

module.exports = router;
