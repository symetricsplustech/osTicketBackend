const express = require("express");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const ticketRoutes = require("./helpdesk/tickets/customer.routes");
const kbRoutes = require("./helpdesk/knowledge");
const agentRoutes = require("./helpdesk/tickets/agent.routes");
const adminRoutes = require("./admin.routes");
const publicRoutes = require("./helpdesk/public");
const rbacRoutes = require("./rbac.routes");
const coreTaskRoutes = require("./core/task");
const coreApprovalRoutes = require("./core/approval");
const coreApprovalEngineRoutes = require("./core/approvalEngine");
const coreAttachmentRoutes = require("./core/attachment");
const coreAuditRoutes = require("./core/auditEvent");
const coreIncidentRoutes = require("./core/incident");
const coreProblemRoutes = require("./core/problem");
const coreChangeRoutes = require("./core/change");
const coreRequestRoutes = require("./core/request");
const coreKnowledgeRoutes = require("./core/knowledge");
const coreSlmRoutes = require("./core/slm");
const coreAssignmentRoutes = require("./core/assignments");
const coreOncallRoutes = require("./core/oncall");
const coreWalkupRoutes = require("./core/walkup");
const coreCmdbRoutes = require("./core/cmdb");
const coreReleaseRoutes = require("./core/release");
const coreImprovementRoutes = require("./core/improvement");
const coreOutageRoutes = require("./core/outage");
const enterpriseRoutes = require("./enterprise.routes");
const extraRoutes = require("./extra.routes");
const gaps2Routes = require("./gaps2.routes");
const gaps3Routes = require("./gaps3.routes");
const instanceRoutes = require("./instance.routes");
const { protectSuperAdmin } = require("../middleware/auth");
const Company = require("../models/Company");
const Agent = require("../models/Agent");
const SuperAdmin = require("../models/SuperAdmin");
const searchRoutes = require("./search.routes");
const correlationId = require("../middleware/correlationId");

const router = express.Router();

router.use(correlationId);

router.get("/health", (req, res) =>
  res.json({
    success: true,
    status: "ok",
    time: new Date().toISOString(),
    correlationId: req.correlationId,
  }),
);

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/tickets", ticketRoutes);
router.use("/kb", kbRoutes);
router.use("/agent", agentRoutes);
router.use("/admin", adminRoutes);
router.use("/public", publicRoutes);
router.use("/rbac", rbacRoutes);
router.use("/core/tasks", coreTaskRoutes);
router.use("/core/approvals", coreApprovalRoutes);
router.use("/core/approval-engine", coreApprovalEngineRoutes);
router.use("/core/attachments", coreAttachmentRoutes);
router.use("/core/audit", coreAuditRoutes);
router.use("/core/incidents", coreIncidentRoutes);
router.use("/core/problems", coreProblemRoutes);
router.use("/core/changes", coreChangeRoutes);
router.use("/core/requests", coreRequestRoutes);
router.use("/core/knowledge", coreKnowledgeRoutes);
router.use("/core/slm", coreSlmRoutes);
router.use("/core/assignments", coreAssignmentRoutes);
router.use("/core/oncall", coreOncallRoutes);
router.use("/core/walkup", coreWalkupRoutes);
router.use("/core/cmdb", coreCmdbRoutes);
router.use("/core/release", coreReleaseRoutes);
router.use("/core/improvement", coreImprovementRoutes);
router.use("/core/outage", coreOutageRoutes);
router.use("/enterprise", enterpriseRoutes);
router.use("/extra", extraRoutes);
router.use("/gaps2", gaps2Routes);
router.use("/gaps3", gaps3Routes);
router.use("/instances", instanceRoutes);
router.get("/platform/overview", protectSuperAdmin, async (req, res, next) => {
  try {
    const [companies, agents] = await Promise.all([
      Company.find({})
        .select("name domain status plan billingCycle planExpiresAt createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Agent.countDocuments({ isActive: true }),
    ]);
    const counts = companies.reduce(
      (summary, company) => {
        summary.total += 1;
        summary[company.status] = (summary[company.status] || 0) + 1;
        return summary;
      },
      { total: 0 },
    );
    res.json({
      success: true,
      summary: { ...counts, activeAgents: agents },
      companies,
    });
  } catch (error) {
    next(error);
  }
});
router.patch(
  "/platform/companies/:id/status",
  protectSuperAdmin,
  async (req, res, next) => {
    try {
      const allowed = [
        "pending_verification",
        "trial",
        "active",
        "grace",
        "restricted",
        "suspended",
        "expired",
        "archived",
        "terminated",
      ];
      if (!allowed.includes(req.body.status)) {
        return res
          .status(422)
          .json({ success: false, message: "Invalid organization status" });
      }
      const company = await Company.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status, statusReason: req.body.reason || "" },
        { new: true },
      ).select("name domain status statusReason");
      if (!company)
        return res
          .status(404)
          .json({ success: false, message: "Organization not found" });
      res.json({ success: true, company });
    } catch (error) {
      next(error);
    }
  },
);
router.post(
  "/platform/companies",
  protectSuperAdmin,
  async (req, res, next) => {
    try {
      const { name, domain, email, supportEmail, billingCycle, status } =
        req.body;
      if (!String(name || "").trim()) {
        return res
          .status(422)
          .json({ success: false, message: "Organization name is required" });
      }
      const company = await Company.create({
        name: String(name).trim(),
        domain: String(domain || "")
          .trim()
          .toLowerCase(),
        email: String(email || "")
          .trim()
          .toLowerCase(),
        supportEmail: String(supportEmail || "")
          .trim()
          .toLowerCase(),
        billingCycle: billingCycle === "yearly" ? "yearly" : "monthly",
        status: status || "trial",
        createdBy: req.superAdmin._id,
      });
      res.status(201).json({ success: true, company });
    } catch (error) {
      next(error);
    }
  },
);
router.put(
  "/platform/companies/:id",
  protectSuperAdmin,
  async (req, res, next) => {
    try {
      const allowed = [
        "name",
        "domain",
        "email",
        "supportEmail",
        "billingCycle",
        "planExpiresAt",
      ];
      const updates = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      if (updates.name !== undefined && !String(updates.name).trim()) {
        return res
          .status(422)
          .json({ success: false, message: "Organization name is required" });
      }
      if (updates.domain !== undefined)
        updates.domain = String(updates.domain).trim().toLowerCase();
      const company = await Company.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      });
      if (!company)
        return res
          .status(404)
          .json({ success: false, message: "Organization not found" });
      res.json({ success: true, company });
    } catch (error) {
      next(error);
    }
  },
);
router.delete(
  "/platform/companies/:id",
  protectSuperAdmin,
  async (req, res, next) => {
    try {
      const company = await Company.findByIdAndDelete(req.params.id);
      if (!company)
        return res
          .status(404)
          .json({ success: false, message: "Organization not found" });
      res.json({ success: true, message: "Organization deleted" });
    } catch (error) {
      next(error);
    }
  },
);
router.get("/platform/operators", protectSuperAdmin, async (req, res, next) => {
  try {
    const operators = await SuperAdmin.find({})
      .select(
        "name email role platformRole isActive permissions moduleKeys lastLogin createdAt",
      )
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, operators });
  } catch (error) {
    next(error);
  }
});
router.post(
  "/platform/operators",
  protectSuperAdmin,
  async (req, res, next) => {
    try {
      const { name, email, password, platformRole } = req.body;
      if (!name || !email || !password) {
        return res.status(422).json({
          success: false,
          message: "Name, email, and password are required",
        });
      }
      const operator = await SuperAdmin.create({
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        password,
        platformRole: platformRole || "platform_support_administrator",
        role: "super_admin",
        isActive: true,
      });
      res.status(201).json({ success: true, operator: operator.toJSON() });
    } catch (error) {
      next(error);
    }
  },
);
router.patch(
  "/platform/operators/:id",
  protectSuperAdmin,
  async (req, res, next) => {
    try {
      if (
        String(req.superAdmin._id) === String(req.params.id) &&
        req.body.isActive === false
      ) {
        return res.status(422).json({
          success: false,
          message: "You cannot deactivate your own account",
        });
      }
      const operator = await SuperAdmin.findById(req.params.id);
      if (!operator)
        return res
          .status(404)
          .json({ success: false, message: "Platform operator not found" });
      for (const key of ["name", "email", "platformRole", "isActive"]) {
        if (req.body[key] !== undefined) operator[key] = req.body[key];
      }
      if (req.body.password) operator.password = req.body.password;
      await operator.save();
      res.json({ success: true, operator: operator.toJSON() });
    } catch (error) {
      next(error);
    }
  },
);
router.delete(
  "/platform/operators/:id",
  protectSuperAdmin,
  async (req, res, next) => {
    try {
      if (String(req.superAdmin._id) === String(req.params.id)) {
        return res.status(422).json({
          success: false,
          message: "You cannot delete your own account",
        });
      }
      const result = await SuperAdmin.findByIdAndDelete(req.params.id);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Platform operator not found" });
      res.json({ success: true, message: "Platform operator deleted" });
    } catch (error) {
      next(error);
    }
  },
);
router.get(
  "/platform/companies/:id/modules",
  protectSuperAdmin,
  async (req, res, next) => {
    try {
      const mongoose = require("mongoose");
      const company = await Company.findById(req.params.id).select("name");
      if (!company)
        return res
          .status(404)
          .json({ success: false, message: "Organization not found" });
      const modules = await mongoose.connection.db
        .collection("tenant_modules")
        .find({
          tenantId: new mongoose.Types.ObjectId(req.params.id),
        })
        .toArray();
      res.json({ success: true, company, modules });
    } catch (error) {
      next(error);
    }
  },
);
router.put(
  "/platform/companies/:id/modules",
  protectSuperAdmin,
  async (req, res, next) => {
    try {
      const mongoose = require("mongoose");
      const validModules = [
        "helpdesk",
        "settings",
        "crm",
        "csm",
        "itam",
        "itom",
        "projects",
        "hr",
        "field-service",
        "workflow",
        "analytics",
        "ai",
      ];
      const requested = Array.isArray(req.body.modules) ? req.body.modules : [];
      const active = new Set(
        requested.filter((key) => validModules.includes(key)),
      );
      const tenantId = new mongoose.Types.ObjectId(req.params.id);
      const company = await Company.findById(req.params.id).select("name");
      if (!company)
        return res
          .status(404)
          .json({ success: false, message: "Organization not found" });
      const now = new Date();
      for (const moduleKey of validModules) {
        await mongoose.connection.db.collection("tenant_modules").updateOne(
          { tenantId, moduleKey },
          {
            $set: {
              status: active.has(moduleKey) ? "active" : "inactive",
              updatedAt: now,
            },
            $setOnInsert: { tenantId, moduleKey, createdAt: now },
          },
          { upsert: true },
        );
      }
      res.json({ success: true, modules: [...active] });
    } catch (error) {
      next(error);
    }
  },
);
router.use("/search", searchRoutes);

module.exports = router;
