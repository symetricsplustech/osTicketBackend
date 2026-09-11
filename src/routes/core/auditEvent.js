const router = require('express').Router();
const { protectTenantPrincipal } = require('../../middleware/auth');
const ctrl = require('../../controllers/core/auditEvent.controller');

router.use(protectTenantPrincipal);

router.get('/', ctrl.list);

module.exports = router;
