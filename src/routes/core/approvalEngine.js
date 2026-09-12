const router = require("express").Router();
const ctrl = require("../../controllers/core/approvalEngine.controller");
const {
  protectTenantPrincipal,
  requirePermission,
  requireResolvedPermission,
} = require("../../middleware/auth");

// ─── Definitions ────────────────────────────────────────────────────────
router.get(
  "/definitions",
  protectTenantPrincipal,
  requirePermission("itsm.approval.policy_read"),
  ctrl.listDefinitions,
);
router.get(
  "/definitions/:id",
  protectTenantPrincipal,
  requirePermission("itsm.approval.policy_read"),
  ctrl.getDefinition,
);
router.post(
  "/definitions",
  protectTenantPrincipal,
  requirePermission("itsm.approval.policy_create"),
  ctrl.createDefinition,
);
router.put(
  "/definitions/:id",
  protectTenantPrincipal,
  requirePermission("itsm.approval.policy_update"),
  ctrl.updateDefinition,
);
router.delete(
  "/definitions/:id",
  protectTenantPrincipal,
  requirePermission("itsm.approval.approval_definition.delete"),
  ctrl.deleteDefinition,
);
router.post(
  "/evaluate",
  protectTenantPrincipal,
  requirePermission("itsm.approval.policy_test"),
  ctrl.evaluatePolicy,
);

// ─── Instances ──────────────────────────────────────────────────────────
router.get(
  "/instances",
  protectTenantPrincipal,
  requirePermission("itsm.approval.approval_read"),
  ctrl.listInstances,
);
router.get(
  "/instances/:id",
  protectTenantPrincipal,
  requirePermission("itsm.approval.approval_read"),
  ctrl.getInstance,
);
router.get(
  "/instances/:id/detail",
  protectTenantPrincipal,
  requirePermission("itsm.approval.approval_read"),
  ctrl.getInstanceWithSteps,
);
router.post(
  "/instances",
  protectTenantPrincipal,
  requirePermission("itsm.approval.approval_request"),
  ctrl.createInstance,
);
router.post(
  "/instances/:id/steps/:stepId/decide",
  protectTenantPrincipal,
  requireResolvedPermission((req) =>
    req.body.decision === "rejected"
      ? "itsm.approval.approval_reject"
      : req.body.decision === "approved"
        ? "itsm.approval.approval_approve"
        : null,
  ),
  ctrl.decide,
);
router.post(
  "/instances/:id/batch-decide",
  protectTenantPrincipal,
  requirePermission("itsm.approval.approval_override"),
  ctrl.batchDecide,
);

// ─── Delegations ────────────────────────────────────────────────────────
router.get(
  "/delegations",
  protectTenantPrincipal,
  requirePermission("itsm.approval.delegation_read_own"),
  ctrl.listDelegations,
);
router.post(
  "/delegations",
  protectTenantPrincipal,
  requirePermission("itsm.approval.delegation_create_own"),
  ctrl.createDelegation,
);
router.put(
  "/delegations/:id",
  protectTenantPrincipal,
  requirePermission("itsm.approval.delegation_update_own"),
  ctrl.updateDelegation,
);
router.delete(
  "/delegations/:id",
  protectTenantPrincipal,
  requirePermission("itsm.approval.delegation_cancel_own"),
  ctrl.deleteDelegation,
);

// ─── Decisions / History ────────────────────────────────────────────────
router.get(
  "/instances/:instanceId/decisions",
  protectTenantPrincipal,
  requirePermission("itsm.approval.approval_view_history"),
  ctrl.getDecisionHistory,
);
router.get(
  "/decisions",
  protectTenantPrincipal,
  requirePermission("itsm.approval.approval_view_history"),
  ctrl.getRecentDecisions,
);

// ─── Pending / Dashboard / Stats ────────────────────────────────────────
router.get(
  "/pending",
  protectTenantPrincipal,
  requirePermission("itsm.approval.approval_read"),
  ctrl.getPendingForUser,
);
router.get(
  "/dashboard",
  protectTenantPrincipal,
  requirePermission("itsm.approval.approval_read"),
  ctrl.getDashboard,
);
router.get(
  "/stats",
  protectTenantPrincipal,
  requirePermission("itsm.approval.approval_read"),
  ctrl.getStats,
);

// ─── Admin triggers ─────────────────────────────────────────────────────
router.post(
  "/process-timeouts",
  protectTenantPrincipal,
  requirePermission("itsm.approval.automation.expiry.manage"),
  ctrl.processTimeouts,
);
router.post(
  "/process-escalations",
  protectTenantPrincipal,
  requirePermission("itsm.approval.automation.escalation.manage"),
  ctrl.processEscalations,
);

module.exports = router;
