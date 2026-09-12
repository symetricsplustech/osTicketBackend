const router = require('express').Router();
const { protectTenantPrincipal, requirePermission } = require('../../middleware/auth');
const ctrl = require('../../controllers/core/attachment.controller');

router.use(protectTenantPrincipal);

router.post('/:taskId', requirePermission('itsm.core.attachment_upload'), ctrl.upload);
router.get('/:taskId', requirePermission('itsm.core.attachment_read'), ctrl.list);
router.get('/:id/download', requirePermission('itsm.core.attachment_read'), ctrl.download);
router.delete('/:id', requirePermission('itsm.core.attachment_delete'), ctrl.remove);

module.exports = router;
