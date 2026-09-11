const router = require('express').Router();
const { protectTenantPrincipal } = require('../../middleware/auth');
const ctrl = require('../../controllers/core/task.controller');

router.use(protectTenantPrincipal);

router.get('/stats', ctrl.stats);

router.post('/', ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.delete);
router.post('/:id/restore', ctrl.restore);

router.post('/:id/transition', ctrl.transition);
router.get('/:id/transitions', ctrl.allowedTransitions);

router.post('/:id/comment', ctrl.comment);

router.get('/:id/watchers', ctrl.listWatchers);
router.post('/:id/watchers', ctrl.addWatcher);
router.delete('/:id/watchers/:userId', ctrl.removeWatcher);

router.get('/:id/relationships', ctrl.listRelationships);
router.post('/:id/relationships', ctrl.addRelationship);
router.delete('/:id/relationships/:relId', ctrl.removeRelationship);

module.exports = router;
