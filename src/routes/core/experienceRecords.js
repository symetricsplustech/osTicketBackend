const router = require("express").Router();
const controller = require("../../controllers/core/experienceRecords.controller");
const { protectTenantPrincipal, requirePermission } = require("../../middleware/auth");

router.use(protectTenantPrincipal);
router.get("/:domain/:resource", requirePermission("itsm.experience.operational_record.read"), controller.list);
router.get("/:domain/:resource/:id", requirePermission("itsm.experience.operational_record.read"), controller.get);
router.post("/:domain/:resource", requirePermission("itsm.experience.operational_record.create"), controller.create);
router.put("/:domain/:resource/:id", requirePermission("itsm.experience.operational_record.update"), controller.update);
router.post("/:domain/:resource/:id/transition", requirePermission("itsm.experience.operational_record.update"), controller.transition);
router.delete("/:domain/:resource/:id", requirePermission("itsm.experience.operational_record.delete"), controller.remove);

module.exports = router;
