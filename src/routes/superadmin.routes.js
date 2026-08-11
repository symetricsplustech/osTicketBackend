const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protectSuperAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/superadmin.controller');

const router = express.Router();

// Public auth
router.post(
  '/auth/login',
  [body('email').isEmail().withMessage('Valid email is required'), body('password').notEmpty().withMessage('Password is required')],
  validate,
  ctrl.login
);

router.post('/webhook/razorpay', ctrl.razorpayWebhook);

// Protected
router.use(protectSuperAdmin);

router.get('/auth/me', ctrl.getMe);
router.put('/auth/me', ctrl.updateMe);
router.put(
  '/auth/password',
  [body('currentPassword').notEmpty().withMessage('Current password is required'), body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')],
  validate,
  ctrl.changePassword
);

// Dashboard
router.get('/dashboard', ctrl.dashboard);
router.get('/stats', ctrl.globalStats);
router.get('/audit-logs', ctrl.auditLogs);

// Notifications
router.get('/notifications', ctrl.notifications);
router.put('/notifications/read', ctrl.markNotificationsRead);
router.put('/notifications/:id/read', ctrl.markNotificationRead);

// Plans
router.get('/plans', ctrl.listPlans);
router.post('/plans', ctrl.createPlan);
router.put('/plans/:id', ctrl.updatePlan);
router.delete('/plans/:id', ctrl.deletePlan);

// Companies
router.get('/companies', ctrl.listCompanies);
router.post('/companies', ctrl.createCompany);
router.get('/companies/:id', ctrl.getCompany);
router.put('/companies/:id', ctrl.updateCompany);
router.delete('/companies/:id', ctrl.deleteCompany);
router.put('/companies/:id/status', ctrl.changeCompanyStatus);
router.put('/companies/:id/plan', ctrl.changeCompanyPlan);
router.get('/companies/:id/admins', ctrl.listCompanyAdmins);

// Invoices
router.get('/invoices', ctrl.listInvoices);

// Payments
router.post('/checkout', ctrl.createCheckoutOrder);
router.post('/payments/verify', ctrl.verifyPayment);

// Impersonation
router.post('/impersonate', ctrl.impersonateCompanyAdmin);

// Super admin management
router.get('/admins', ctrl.listSuperAdmins);
router.post('/admins', ctrl.createSuperAdmin);
router.put('/admins/:id', ctrl.updateSuperAdmin);
router.delete('/admins/:id', ctrl.deleteSuperAdmin);

// Platform settings
router.get('/settings', ctrl.getSettings);
router.put('/settings', ctrl.updateSettings);

module.exports = router;
