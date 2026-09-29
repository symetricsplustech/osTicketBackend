const router = require("express").Router();
const { protectTenantPrincipal, requirePermission } = require("../../middleware/auth");
const controller = require("../../controllers/core/universalRequest.controller");

router.use(protectTenantPrincipal);
router.get("/", requirePermission("itsm.universal_request.request.read"), controller.list);
router.post("/", requirePermission("itsm.universal_request.request.create"), controller.create);
router.get("/:id", requirePermission("itsm.universal_request.request.read"), controller.get);
router.put("/:id", requirePermission("itsm.universal_request.request.update"), controller.update);
router.post("/:id/transition", requirePermission("itsm.universal_request.request.update"), controller.transition);
router.delete("/:id", requirePermission("itsm.universal_request.request.delete"), controller.remove);

module.exports = router;
