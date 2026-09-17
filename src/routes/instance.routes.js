const express = require("express");
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const { protectTenantPrincipal } = require("../middleware/auth");
const { getTenantModules, activateModules, deactivateModule } = require("../middleware/module");
const ctrl = require("../controllers/instance.controller");
const companies = require("../controllers/instance/companies");
const departments = require("../controllers/instance/departments");
const teams = require("../controllers/instance/teams");
const members = require("../controllers/instance/members");
const organizationUnits = require("../controllers/admin/organizationUnits");

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
router.post("/:instanceId/select", ctrl.selectInstance);
router.get("/:instanceId/companies", companies.list);
router.post("/:instanceId/companies", [
  body("name").isString().trim().notEmpty(),
  body("email").optional({ values: "falsy" }).isEmail(),
  body("domain").optional().isString(),
  body("phone").optional().isString(),
  body("address").optional().isString(),
], validate, companies.create);
router.put("/:instanceId/companies/:companyId", [
  body("name").optional().isString().trim().notEmpty(),
  body("email").optional({ values: "falsy" }).isEmail(),
  body("domain").optional().isString(),
  body("phone").optional().isString(),
  body("address").optional().isString(),
  body("status").optional().isIn(["active", "inactive"]),
], validate, companies.update);

const requireOrganizationAdmin = (req, res, next) => {
  const membership = req.user?.instanceMemberships?.find(
    (item) => String(item.instance) === req.params.instanceId && item.status === "active",
  );
  if (String(req.companyId) !== req.params.instanceId ||
      !["instance_owner", "instance_admin"].includes(membership?.role)) {
    return res.status(403).json({ success: false, message: "Instance admin membership required" });
  }
  next();
};

router.use("/:instanceId/departments", requireOrganizationAdmin);
router.get("/:instanceId/departments", departments.list);
router.put("/:instanceId/departments/:departmentId/organization-unit", [
  body("organizationUnit").optional({ nullable: true }).isMongoId(),
], validate, departments.linkUnit);

router.use("/:instanceId/teams", requireOrganizationAdmin);
router.get("/:instanceId/teams", teams.list);
router.put("/:instanceId/teams/:teamId/organization-unit", [
  body("organizationUnit").optional({ nullable: true }).isMongoId(),
], validate, teams.linkUnit);

router.use("/:instanceId/organization-unit-types", requireOrganizationAdmin);
router.get("/:instanceId/organization-unit-types", organizationUnits.listTypes);
router.post("/:instanceId/organization-unit-types", organizationUnits.createType);
router.delete("/:instanceId/organization-unit-types/:type", organizationUnits.removeType);
router.use("/:instanceId/organization-units", requireOrganizationAdmin);
router.get("/:instanceId/organization-units", organizationUnits.list);
router.post("/:instanceId/organization-units", organizationUnits.create);
router.put("/:instanceId/organization-units/:id", organizationUnits.update);
router.delete("/:instanceId/organization-units/:id", organizationUnits.remove);
router.use("/:instanceId/members", requireOrganizationAdmin);
router.get("/:instanceId/members", members.list);
router.put("/:instanceId/members/:userId/organization-unit", [
  body("organizationUnit").optional({ nullable: true }).isMongoId(),
], validate, members.place);

// Get instance details
router.get("/:instanceId", ctrl.getInstance);

// Accept instance invitation
router.post(
  "/:instanceId/invitations",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("role").isIn(["instance_admin", "agent", "requester"]),
  ],
  validate,
  ctrl.createInvitation,
);

router.post(
  "/:instanceId/accept-invitation",
  [
    body("token").isHexadecimal().isLength({ min: 64, max: 64 }),
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
