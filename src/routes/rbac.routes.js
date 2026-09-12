const express = require('express');
const { protectAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/rbac.controller');
const router = express.Router();
router.use(protectAdmin);
router.get('/permissions/tree', (req, res) => {
  const catalog = require('../permissions/itsmCatalog');
  res.json({ success: true, modules: catalog.tree(), total: catalog.allItsmKeys().length });
});
router.get('/permissions/catalog', (req, res) => {
  const catalog = require('../permissions/itsmCatalog');
  res.json({ success: true, modules: catalog.ITSM_DATA, total: catalog.allItsmKeys().length });
});
router.get('/units', ctrl.listUnits);
router.get('/units/tree', ctrl.getUnitTree);
router.get('/unit-labels', ctrl.listUnitLabels);
router.put('/unit-labels/:type', ctrl.updateUnitLabel);
router.post('/units', ctrl.createUnit);
router.put('/units/:id', ctrl.updateUnit);
router.get('/assignments', ctrl.listAssignments);
router.post('/assignments', ctrl.createAssignment);
router.put('/assignments/:id', ctrl.updateAssignment);
module.exports = router;
