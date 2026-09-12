const router = require("express").Router();
const {
  protectTenantPrincipal,
  requirePermission,
} = require("../../middleware/auth");
const ctrl = require("../../controllers/core/task.controller");

router.use(protectTenantPrincipal);

router.get("/stats", requirePermission("itsm.core.task.read"), ctrl.stats);

router.post("/", requirePermission("itsm.core.task.create"), ctrl.create);
router.get("/", requirePermission("itsm.core.task.read"), ctrl.list);
router.get("/:id", requirePermission("itsm.core.task.read"), ctrl.getById);
router.put("/:id", requirePermission("itsm.core.task.update"), ctrl.update);
router.delete("/:id", requirePermission("itsm.core.task.delete"), ctrl.delete);
router.post(
  "/:id/restore",
  requirePermission("itsm.core.task.restore"),
  ctrl.restore,
);

router.post(
  "/:id/transition",
  requirePermission("itsm.core.task_update"),
  ctrl.transition,
);
router.get(
  "/:id/transitions",
  requirePermission("itsm.core.task_read"),
  ctrl.allowedTransitions,
);

router.post(
  "/:id/comment",
  requirePermission("itsm.core.work_note_create"),
  ctrl.comment,
);

router.get(
  "/:id/watchers",
  requirePermission("itsm.core.watcher_manage"),
  ctrl.listWatchers,
);
router.post(
  "/:id/watchers",
  requirePermission("itsm.core.watcher_manage"),
  ctrl.addWatcher,
);
router.delete(
  "/:id/watchers/:userId",
  requirePermission("itsm.core.watcher_manage"),
  ctrl.removeWatcher,
);

router.get(
  "/:id/relationships",
  requirePermission("itsm.core.relationship_read"),
  ctrl.listRelationships,
);
router.post(
  "/:id/relationships",
  requirePermission("itsm.core.relationship_manage"),
  ctrl.addRelationship,
);
router.delete(
  "/:id/relationships/:relId",
  requirePermission("itsm.core.relationship_manage"),
  ctrl.removeRelationship,
);

module.exports = router;
