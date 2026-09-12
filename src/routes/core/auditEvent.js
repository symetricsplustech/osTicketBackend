const router = require("express").Router();
const {
  protectTenantPrincipal,
  requirePermission,
} = require("../../middleware/auth");
const ctrl = require("../../controllers/core/auditEvent.controller");

router.use(protectTenantPrincipal);

router.get("/", requirePermission("itsm.core.audit_read"), ctrl.list);

module.exports = router;
