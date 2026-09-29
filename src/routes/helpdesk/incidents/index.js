const express = require("express");
const { requirePermission } = require("../../../middleware/auth");
const ctrl = require("../../../controllers/helpdesk");

const router = express.Router();

router.get("/workload", ctrl.workload);
router.get("/escalations", ctrl.listEscalations);
router.post(
  "/escalations",
  requirePermission("itsm.incident.automation.sla_escalation.manage"),
  ctrl.createEscalation,
);
router.put(
  "/escalations/:id",
  requirePermission("itsm.incident.automation.sla_escalation.manage"),
  ctrl.updateEscalation,
);
router.delete(
  "/escalations/:id",
  requirePermission("itsm.incident.automation.sla_escalation.manage"),
  ctrl.deleteEscalation,
);

module.exports = router;
