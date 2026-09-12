const express = require("express");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const ticketRoutes = require("./helpdesk/tickets/customer.routes");
const kbRoutes = require("./helpdesk/knowledge");
const agentRoutes = require("./helpdesk/tickets/agent.routes");
const adminRoutes = require("./admin.routes");
const superadminRoutes = require("./superadmin.routes");
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
router.use("/superadmin", superadminRoutes);
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
router.use("/search", searchRoutes);

module.exports = router;
