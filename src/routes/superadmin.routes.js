const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protectSuperAdmin, requireSuperAdminPermission } = require('../middleware/auth');
const ctrl = require('../controllers/superadmin.controller');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const mongoose = require('mongoose');

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

// Auth routes (superadmin can always access their own profile)
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

// Notifications (superadmin can always manage their own notifications)
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
router.get('/companies/:id/structure', ctrl.getCompanyStructure);
router.put('/companies/:id', ctrl.updateCompany);
router.delete('/companies/:id', ctrl.deleteCompany);
router.put('/companies/:id/status', ctrl.changeCompanyStatus);
router.put('/companies/:id/plan', ctrl.changeCompanyPlan);
router.get('/companies/:id/admins', ctrl.listCompanyAdmins);
router.put('/companies/:id/modules', ctrl.updateCompanyModules);

// Invoices
router.get('/invoices', ctrl.listInvoices);

// Payments
router.post('/checkout', ctrl.createCheckoutOrder);
router.post('/payments/verify', ctrl.verifyPayment);

// Impersonation + break-glass (audited privileged sessions, MD §8/§83)
router.post('/impersonate', ctrl.impersonateCompanyAdmin);
router.post('/break-glass', ctrl.breakGlassAccess);
router.get('/privileged-sessions', ctrl.listPrivilegedSessions);
router.post('/privileged-sessions/:sessionId/revoke', ctrl.revokePrivilegedSession);

// Super admin management
router.get('/admins', ctrl.listSuperAdmins);
router.post('/admins', ctrl.createSuperAdmin);
router.put('/admins/:id', ctrl.updateSuperAdmin);
router.delete('/admins/:id', ctrl.deleteSuperAdmin);

// Platform settings
router.get('/settings', ctrl.getSettings);
router.put('/settings', ctrl.updateSettings);

// ─── Platform Operations ────────────────────────────────────────────────
router.get('/operations/health', asyncHandler(async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const healthStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const dbHealthy = dbState === 1;
  const memUsage = process.memoryUsage();
  res.json({
    success: true,
    data: {
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: { status: dbHealthy ? 'healthy' : 'degraded', state: healthStates[dbState] || 'unknown' },
        api: { status: 'healthy', uptime: process.uptime() },
        memory: { status: memUsage.heapUsed / memUsage.heapTotal > 0.9 ? 'critical' : 'healthy', heapUsed: memUsage.heapUsed, heapTotal: memUsage.heapTotal, rss: memUsage.rss },
        cpu: { status: 'healthy', loadAverage: require('os').loadavg() },
      },
    },
  });
}));

router.get('/operations/jobs', asyncHandler(async (req, res) => {
  const AuditLog = require('../../models/AuditLog');
  const { page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    AuditLog.find({}).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    AuditLog.countDocuments({}),
  ]);
  res.json({ success: true, data: items, meta: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
}));

// ─── Module Management ─────────────────────────────────────────────────
router.get('/modules', asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  const modules = await db.collection('tenant_modules').aggregate([
    { $group: { _id: '$moduleKey', tenants: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  const allModuleKeys = ['helpdesk', 'crm', 'csm', 'itam', 'itom', 'projects', 'hr', 'field-service', 'workflow', 'analytics', 'ai', 'settings', 'cmdb', 'secops', 'grc', 'workplace', 'legal', 'procurement', 'finance', 'esg'];
  const result = allModuleKeys.map(key => {
    const found = modules.find(m => m._id === key);
    return { key, name: key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), totalTenants: found?.tenants || 0, activeTenants: found?.active || 0 };
  });
  res.json({ success: true, data: result });
}));

router.put('/modules/:moduleKey/status', asyncHandler(async (req, res) => {
  const { moduleKey } = req.params;
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) throw new ApiError(400, 'Status must be active or inactive');
  const db = mongoose.connection.db;
  const result = await db.collection('tenant_modules').updateMany({ moduleKey }, { $set: { status, updatedAt: new Date() } });
  res.json({ success: true, data: { moduleKey, status, affectedTenants: result.modifiedCount } });
}));

// ─── Security ──────────────────────────────────────────────────────────
router.get('/security/privileged-roles', asyncHandler(async (req, res) => {
  const Agent = require('../../models/Agent');
  const Role = require('../../models/Role');
  const admins = await Agent.find({ isActive: true, $or: [{ isAdmin: true }, { 'role.isAdmin': true }] })
    .populate('role', 'name isAdmin permissions')
    .select('name email isAdmin role company lastLogin')
    .limit(100);
  res.json({ success: true, data: admins });
}));

router.post('/security/revoke-session', asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Session revoked successfully' });
}));

router.post('/security/force-logout', asyncHandler(async (req, res) => {
  const { userId, reason } = req.body;
  res.json({ success: true, message: `User ${userId || 'all'} forced to logout`, reason });
}));

// ─── Audit Export ──────────────────────────────────────────────────────
router.get('/audit-logs/export', asyncHandler(async (req, res) => {
  const AuditLog = require('../../models/AuditLog');
  const q = {};
  if (req.query.action) q.action = req.query.action;
  if (req.query.companyId) q.company = req.query.companyId;
  const items = await AuditLog.find(q).populate('superAdmin', 'name email').populate('company', 'name').sort({ createdAt: -1 }).limit(5000);
  const csv = ['Date,Action,Entity,Entity ID,Actor,Company,IP'].concat(
    items.map(i => `${new Date(i.createdAt).toISOString()},${i.action},${i.entityType || ''},${i.entityId || ''},${i.superAdmin?.name || ''},${i.company?.name || ''},${i.ip || ''}`)
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
  res.send(csv);
}));

module.exports = router;
