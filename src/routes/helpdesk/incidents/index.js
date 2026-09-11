const express = require('express');
const { requirePermission } = require('../../../middleware/auth');
const ctrl = require('../../../controllers/helpdesk');

const router = express.Router();

router.get('/workload', ctrl.workload);
router.get('/escalations', ctrl.listEscalations);
router.post('/escalations', requirePermission('escalations.manage'), ctrl.createEscalation);
router.put('/escalations/:id', requirePermission('escalations.manage'), ctrl.updateEscalation);
router.delete('/escalations/:id', requirePermission('escalations.manage'), ctrl.deleteEscalation);

module.exports = router;
