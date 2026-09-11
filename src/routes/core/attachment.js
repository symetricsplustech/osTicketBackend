const router = require('express').Router();
const { protectTenantPrincipal } = require('../../middleware/auth');
const ctrl = require('../../controllers/core/attachment.controller');

router.use(protectTenantPrincipal);

router.post('/:taskId', ctrl.upload);
router.get('/:taskId', ctrl.list);
router.get('/:id/download', ctrl.download);
router.delete('/:id', ctrl.remove);

module.exports = router;
