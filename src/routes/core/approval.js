const router = require('express').Router();
const { protectTenantPrincipal } = require('../../middleware/auth');
const ctrl = require('../../controllers/core/approval.controller');

router.use(protectTenantPrincipal);

router.get('/stats', ctrl.stats);
router.get('/pending', ctrl.pendingForUser);
router.post('/', ctrl.create);
router.post('/:id/decide', ctrl.decide);
router.post('/:id/cancel', ctrl.cancel);
router.post('/:id/delegate', ctrl.delegate);
router.get('/task/:taskId', ctrl.listForTask);

module.exports = router;
