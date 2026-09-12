const express = require("express");
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const { protectTenantPrincipal } = require("../middleware/auth");
const { getTenantModules, activateModules, deactivateModule } = require("../middleware/module");
const ctrl = require("../controllers/instance.controller");

const router = express.Router();

// All instance routes require authentication
router.use(protectTenantPrincipal);

// Create a new instance
router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Instance name is required"),
    body("domain").notEmpty().withMessage("Domain is required"),
    body("companyName").optional().isString(),
    body("companyEmail").optional().isEmail(),
  ],
  validate,
  ctrl.createInstance
);

// Get current user's instances
router.get("/my-instances", ctrl.getMyInstances);

// Get instance details
router.get("/:instanceId", ctrl.getInstance);

// Accept instance invitation
router.post(
  "/:instanceId/accept-invitation",
  [
    body("role").optional().isString(),
  ],
  validate,
  ctrl.acceptInvitation
);

// Update instance membership (for instance admins)
router.put(
  "/:instanceId/members/:userId",
  [
    body("role").notEmpty().withMessage("Role is required"),
    body("permissions").optional().isArray(),
  ],
  validate,
  ctrl.updateMember
);

// Remove member from instance
router.delete(
  "/:instanceId/members/:userId",
  ctrl.removeMember
);

// Update instance settings
router.put(
  "/:instanceId",
  [
    body("name").optional().isString(),
    body("domain").optional().isString(),
    body("status").optional().isIn(["active", "inactive", "suspended"]),
  ],
  validate,
  ctrl.updateInstance
);

// Activate/deactivate modules for instance
router.get("/:instanceId/modules", getTenantModules);
router.post("/:instanceId/modules", activateModules);
router.delete("/:instanceId/modules/:moduleKey", deactivateModule);

module.exports = router;