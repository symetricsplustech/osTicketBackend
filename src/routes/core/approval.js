const router = require("express").Router();
const {
  protectTenantPrincipal,
  requirePermission,
  requireResolvedPermission,
} = require("../../middleware/auth");
const ctrl = require("../../controllers/core/approval.controller");

router.use(protectTenantPrincipal);

router.get(
  "/stats",
  requirePermission("itsm.approval.approval_read"),
  ctrl.stats,
);
router.get(
  "/pending",
  requirePermission("itsm.approval.approval_read"),
  ctrl.pendingForUser,
);
router.post(
  "/",
  requirePermission("itsm.approval.approval_request"),
  ctrl.create,
);
router.post(
  "/:id/decide",
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
  "/:id/cancel",
  requirePermission("itsm.approval.approval_cancel"),
  ctrl.cancel,
);
router.post(
  "/:id/delegate",
  requirePermission("itsm.approval.approval_delegate"),
  ctrl.delegate,
);
router.get(
  "/task/:taskId",
  requirePermission("itsm.approval.approval_read"),
  ctrl.listForTask,
);

module.exports = router;
