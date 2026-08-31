const express = require('express');
const { protectTenantPrincipal } = require('../middleware/auth');
const ctrl = require('../controllers/user.controller');

const router = express.Router();

router.use(protectTenantPrincipal);

router.get('/permissions-meta', ctrl.permissionsMeta);
router.get('/employees', ctrl.listEmployees);
router.post('/employees', ctrl.createEmployee);
router.put('/employees/:id', ctrl.updateEmployee);
router.delete('/employees/:id', ctrl.deleteEmployee);

router.get('/notifications', ctrl.getNotifications);
router.put('/notifications/read', ctrl.markAllNotificationsRead);
router.put('/notifications/:id/read', ctrl.markNotificationRead);

router.put('/me', ctrl.profile);

module.exports = router;
