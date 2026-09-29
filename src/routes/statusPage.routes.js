const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { protectTenantPrincipal, requirePermission } = require("../middleware/auth");

const router = express.Router();
router.use(protectTenantPrincipal);

const tenantOf = (req) => req.companyId || req.tenantId || null;

// List status pages
router.get(
  "/",
  requirePermission("itsm.core.audit_event.read"),
  asyncHandler(async (req, res) => {
    const StatusPage = require("../models/StatusPage");
    const filter = tenantOf(req) ? { company: tenantOf(req) } : {};
    const pages = await StatusPage.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, pages });
  }),
);

// Get single status page
router.get(
  "/:id",
  requirePermission("itsm.core.audit_event.read"),
  asyncHandler(async (req, res) => {
    const StatusPage = require("../models/StatusPage");
    const page = await StatusPage.findOne({
      _id: req.params.id,
      ...(tenantOf(req) ? { company: tenantOf(req) } : {}),
    });
    if (!page) return res.status(404).json({ success: false, error: "Status page not found" });
    res.json({ success: true, page });
  }),
);

// Create status page
router.post(
  "/",
  requirePermission("itsm.core.audit_event.read"),
  asyncHandler(async (req, res) => {
    const StatusPage = require("../models/StatusPage");
    const doc = await StatusPage.create({
      company: tenantOf(req),
      name: req.body.name,
      slug: req.body.slug || req.body.name?.toLowerCase().replace(/\s+/g, "-"),
      description: req.body.description || "",
      isPublic: req.body.isPublic !== false,
      components: req.body.components || [],
      status: req.body.status || "operational",
    });
    res.status(201).json({ success: true, page: doc });
  }),
);

// Update status page
router.put(
  "/:id",
  requirePermission("itsm.core.audit_event.read"),
  asyncHandler(async (req, res) => {
    const StatusPage = require("../models/StatusPage");
    const update = {};
    for (const key of ["name", "slug", "description", "isPublic", "components", "status"]) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const doc = await StatusPage.findOneAndUpdate(
      { _id: req.params.id, ...(tenantOf(req) ? { company: tenantOf(req) } : {}) },
      { $set: update },
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, error: "Status page not found" });
    res.json({ success: true, page: doc });
  }),
);

// Delete status page
router.delete(
  "/:id",
  requirePermission("itsm.core.audit_event.read"),
  asyncHandler(async (req, res) => {
    const StatusPage = require("../models/StatusPage");
    const doc = await StatusPage.findOneAndDelete({
      _id: req.params.id,
      ...(tenantOf(req) ? { company: tenantOf(req) } : {}),
    });
    if (!doc) return res.status(404).json({ success: false, error: "Status page not found" });
    res.json({ success: true, message: "Status page deleted" });
  }),
);

module.exports = router;
