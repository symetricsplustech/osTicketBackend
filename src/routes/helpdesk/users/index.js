const express = require("express");
const { requirePermission } = require("../../../middleware/auth");
const ctrl = require("../../../controllers/helpdesk");

const router = express.Router();

router.get("/users", requirePermission("tenant.user.read"), ctrl.listUsers);
router.post("/users", requirePermission("tenant.user.create"), ctrl.createUser);
router.get("/users/:id", requirePermission("tenant.user.read"), ctrl.getUser);
router.get("/orgs", ctrl.listOrgs);
router.post("/orgs", ctrl.createOrg);
router.get("/orgs/:id", ctrl.getOrg);

module.exports = router;
