const express = require("express");
const { requirePermission } = require("../../../middleware/auth");
const ctrl = require("../../../controllers/helpdesk");

const router = express.Router();

router.get("/users", requirePermission("users.view"), ctrl.listUsers);
router.post("/users", requirePermission("users.manage"), ctrl.createUser);
router.get("/users/:id", requirePermission("users.view"), ctrl.getUser);
router.get("/orgs", ctrl.listOrgs);
router.post("/orgs", ctrl.createOrg);
router.get("/orgs/:id", ctrl.getOrg);

module.exports = router;
