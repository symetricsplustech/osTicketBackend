const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { protectTenantPrincipal, requirePermission } = require("../middleware/auth");
const Workflow = require("../models/Workflow");
const workflowService = require("../services/workflow.service");

const router = express.Router();
router.use(protectTenantPrincipal);

const tenantOf = (req) => req.companyId || req.tenantId || null;

// List workflows
router.get(
  "/",
  requirePermission("itsm.core.automation.workflow.manage"),
  asyncHandler(async (req, res) => {
    const filter = tenantOf(req) ? { company: tenantOf(req) } : {};
    if (req.query.event) filter.event = req.query.event;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";
    const workflows = await Workflow.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, workflows });
  }),
);

// Get single workflow
router.get(
  "/:id",
  requirePermission("itsm.core.automation.workflow.manage"),
  asyncHandler(async (req, res) => {
    const workflow = await Workflow.findOne({
      _id: req.params.id,
      ...(tenantOf(req) ? { company: tenantOf(req) } : {}),
    });
    if (!workflow) return res.status(404).json({ success: false, error: "Workflow not found" });
    res.json({ success: true, workflow });
  }),
);

// Create workflow
router.post(
  "/",
  requirePermission("itsm.core.automation.workflow.manage"),
  asyncHandler(async (req, res) => {
    const doc = await Workflow.create({
      company: tenantOf(req),
      name: req.body.name,
      description: req.body.description || "",
      event: req.body.event,
      triggerFilters: req.body.triggerFilters || {},
      conditions: req.body.conditions || [],
      actions: req.body.actions || [],
      isActive: req.body.isActive !== false,
      priority: req.body.priority || 100,
    });
    res.status(201).json({ success: true, workflow: doc });
  }),
);

// Update workflow
router.put(
  "/:id",
  requirePermission("itsm.core.automation.workflow.manage"),
  asyncHandler(async (req, res) => {
    const update = {};
    for (const key of ["name", "description", "event", "triggerFilters", "conditions", "actions", "isActive", "priority"]) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const doc = await Workflow.findOneAndUpdate(
      { _id: req.params.id, ...(tenantOf(req) ? { company: tenantOf(req) } : {}) },
      { $set: update },
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, error: "Workflow not found" });
    res.json({ success: true, workflow: doc });
  }),
);

// Delete workflow
router.delete(
  "/:id",
  requirePermission("itsm.core.automation.workflow.manage"),
  asyncHandler(async (req, res) => {
    const doc = await Workflow.findOneAndDelete({
      _id: req.params.id,
      ...(tenantOf(req) ? { company: tenantOf(req) } : {}),
    });
    if (!doc) return res.status(404).json({ success: false, error: "Workflow not found" });
    res.json({ success: true, message: "Workflow deleted" });
  }),
);

// Manual trigger
router.post(
  "/:id/trigger",
  requirePermission("itsm.core.automation.workflow.manage"),
  asyncHandler(async (req, res) => {
    const workflow = await Workflow.findOne({
      _id: req.params.id,
      ...(tenantOf(req) ? { company: tenantOf(req) } : {}),
    });
    if (!workflow) return res.status(404).json({ success: false, error: "Workflow not found" });
    await workflowService.runWorkflow(workflow, {
      company: tenantOf(req),
      ticketId: req.body.ticketId,
      custom: req.body.context || {},
    });
    res.json({ success: true, message: "Workflow triggered" });
  }),
);

// Get available events and actions
router.get(
  "/meta/events",
  requirePermission("itsm.core.automation.workflow.manage"),
  asyncHandler(async (req, res) => {
    res.json({ success: true, events: Workflow.EVENTS, actions: Workflow.ACTIONS });
  }),
);

module.exports = router;
