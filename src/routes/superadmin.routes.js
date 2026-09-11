const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protectSuperAdmin, requirePlatformRole, requirePlatformPermission } = require('../middleware/auth');
const { P } = require('../config/platformPermissions');
const ctrl = require('../controllers/superadmin.controller');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const mongoose = require('mongoose');

const ADMIN = 'platform_administrator';
const SUPPORT = 'platform_support_administrator';
const BILLING = 'platform_billing_administrator';
const SECURITY = 'platform_security_administrator';
const AUDITOR = 'platform_auditor';
const OPS = [ADMIN, SUPPORT]; // tenant/platform operations
const FIN = [ADMIN, BILLING]; // plans, invoices, subscriptions
const SEC = [ADMIN, SECURITY, AUDITOR]; // audit + security (auditor: GET only)

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
router.get('/dashboard', requirePlatformPermission(P.DASHBOARD_READ), ctrl.dashboard);
router.get('/stats', requirePlatformPermission(P.DASHBOARD_READ), ctrl.globalStats);
router.get('/audit-logs', requirePlatformPermission(P.AUDIT_READ), ctrl.auditLogs);

// Notifications (superadmin can always manage their own notifications)
router.get('/notifications', ctrl.notifications);
router.put('/notifications/read', ctrl.markNotificationsRead);
router.put('/notifications/:id/read', ctrl.markNotificationRead);

// Plans
router.get('/plans', requirePlatformPermission(P.PLAN_READ), ctrl.listPlans);
router.post('/plans', requirePlatformPermission(P.PLAN_CREATE), ctrl.createPlan);
router.put('/plans/:id', requirePlatformPermission(P.PLAN_UPDATE), ctrl.updatePlan);
router.delete('/plans/:id', requirePlatformPermission(P.PLAN_DISABLE), ctrl.deletePlan);

// Companies
router.get('/companies', requirePlatformPermission(P.TENANT_READ), ctrl.listCompanies);
router.post('/companies', requirePlatformPermission(P.TENANT_CREATE), ctrl.createCompany);
router.get('/companies/:id', requirePlatformPermission(P.TENANT_READ), ctrl.getCompany);
router.get('/companies/:id/structure', requirePlatformPermission(P.TENANT_READ), ctrl.getCompanyStructure);
router.put('/companies/:id', requirePlatformPermission(P.TENANT_UPDATE), ctrl.updateCompany);
router.delete('/companies/:id', requirePlatformPermission(P.TENANT_TERMINATE), ctrl.deleteCompany);
router.put('/companies/:id/status', requirePlatformPermission(P.TENANT_ACTIVATE, P.TENANT_SUSPEND, P.TENANT_ARCHIVE, P.TENANT_RESTORE), ctrl.changeCompanyStatus);
router.put('/companies/:id/plan', requirePlatformPermission(P.PLAN_ASSIGN), ctrl.changeCompanyPlan);
router.get('/companies/:id/admins', requirePlatformPermission(P.TENANT_MANAGE_ADMIN), ctrl.listCompanyAdmins);
router.post('/companies/:id/admins', requirePlatformPermission(P.TENANT_MANAGE_ADMIN), ctrl.createCompanyAdmin);
router.put('/companies/:id/admins/:adminId', requirePlatformPermission(P.TENANT_MANAGE_ADMIN), ctrl.updateCompanyAdmin);
router.post('/companies/:id/admins/:adminId/reset-password', requirePlatformPermission(P.TENANT_MANAGE_ADMIN), ctrl.resetCompanyAdminPassword);
router.put('/companies/:id/modules', requirePlatformPermission(P.TENANT_MANAGE_MODULES), ctrl.updateCompanyModules);

// Invoices
router.get('/invoices', requirePlatformPermission(P.BILLING_READ), ctrl.listInvoices);
router.get('/subscriptions', requirePlatformPermission(P.BILLING_READ), ctrl.listSubscriptions);
router.put('/subscriptions/:id', requirePlatformPermission(P.BILLING_MANAGE), ctrl.updateSubscription);
router.get('/billing-adjustments', requirePlatformPermission(P.BILLING_READ), ctrl.listBillingAdjustments);
router.post('/billing-adjustments', requirePlatformPermission(P.BILLING_MANAGE), ctrl.createBillingAdjustment);

// Payments
router.post('/checkout', requirePlatformPermission(P.BILLING_MANAGE), ctrl.createCheckoutOrder);
router.post('/payments/verify', requirePlatformPermission(P.BILLING_MANAGE), ctrl.verifyPayment);

// Impersonation + break-glass (audited privileged sessions, MD §8/§83)
router.post('/impersonate', requirePlatformPermission(P.SUPPORT_IMPERSONATE), ctrl.impersonateCompanyAdmin);
router.post('/break-glass', requirePlatformPermission(P.SECURITY_BREAK_GLASS), ctrl.breakGlassAccess);
router.get('/privileged-sessions', requirePlatformPermission(P.SECURITY_READ), ctrl.listPrivilegedSessions);
router.post('/privileged-sessions/:sessionId/revoke', requirePlatformPermission(P.SESSION_REVOKE), ctrl.revokePrivilegedSession);

// Super admin management (platform owner only)
router.get('/admins', requirePlatformPermission(P.ADMIN_MANAGE), ctrl.listSuperAdmins);
router.post('/admins', requirePlatformPermission(P.ADMIN_MANAGE), ctrl.createSuperAdmin);
router.put('/admins/:id', requirePlatformPermission(P.ADMIN_MANAGE), ctrl.updateSuperAdmin);
router.delete('/admins/:id', requirePlatformPermission(P.ADMIN_MANAGE), ctrl.deleteSuperAdmin);

// Platform settings
router.get('/settings', requirePlatformPermission(P.PLATFORM_CONFIGURE), ctrl.getSettings);
router.put('/settings', requirePlatformPermission(P.PLATFORM_CONFIGURE), ctrl.updateSettings);

// ─── Platform Operations ────────────────────────────────────────────────
router.get('/operations/health', requirePlatformPermission(P.OPERATIONS_READ), asyncHandler(async (req, res) => {
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

router.get('/operations/jobs', requirePlatformPermission(P.OPERATIONS_READ), asyncHandler(async (req, res) => {
  const AuditLog = require('../models/AuditLog');
  const { page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    AuditLog.find({}).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    AuditLog.countDocuments({}),
  ]);
  res.json({ success: true, data: items, meta: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
}));

// ─── Module Management ─────────────────────────────────────────────────
router.get('/modules', requirePlatformPermission(P.MODULE_READ), asyncHandler(async (req, res) => {
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

router.put('/modules/:moduleKey/status', requirePlatformPermission(P.MODULE_CONFIGURE), asyncHandler(async (req, res) => {
  const { moduleKey } = req.params;
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) throw new ApiError(400, 'Status must be active or inactive');
  const db = mongoose.connection.db;
  const result = await db.collection('tenant_modules').updateMany({ moduleKey }, { $set: { status, updatedAt: new Date() } });
  res.json({ success: true, data: { moduleKey, status, affectedTenants: result.modifiedCount } });
}));

// ─── Security ──────────────────────────────────────────────────────────
router.get('/security/privileged-roles', requirePlatformPermission(P.SECURITY_READ), asyncHandler(async (req, res) => {
  const Agent = require('../models/Agent');
  const Role = require('../models/Role');
  const admins = await Agent.find({ isActive: true, $or: [{ isAdmin: true }, { 'role.isAdmin': true }] })
    .populate('role', 'name isAdmin permissions')
    .select('name email isAdmin role company lastLogin')
    .limit(100);
  res.json({ success: true, data: admins });
}));

router.post('/security/revoke-session', requirePlatformPermission(P.SESSION_REVOKE), asyncHandler(async (req, res) => {
  const { sessionId, reason } = req.body;
  if (!sessionId || !reason) throw new ApiError(422, 'sessionId and reason are required');
  const PrivilegedSession = require('../models/PrivilegedSession');
  const session = await PrivilegedSession.findOneAndUpdate(
    { sessionId, status: 'active' },
    { $set: { status: 'revoked', revokedAt: new Date(), terminationReason: reason } },
    { new: true }
  );
  if (!session) throw new ApiError(404, 'Active session not found');
  const AuditLog = require('../../models/AuditLog');
  await AuditLog.create({ superAdmin: req.superAdmin._id, company: session.targetTenant, action: 'security.session_revoked', entityType: 'PrivilegedSession', entityId: sessionId, details: { reason }, ip: req.ip || '', userAgent: req.get('user-agent') || '' });
  res.json({ success: true, data: session, message: 'Session revoked successfully' });
}));

router.post('/security/force-logout', requirePlatformPermission(P.SESSION_REVOKE), asyncHandler(async (req, res) => {
  const { userId, reason, principalType } = req.body;
  if (!userId || !reason) throw new ApiError(422, 'userId and reason are required');
  if (!mongoose.isValidObjectId(userId)) throw new ApiError(422, 'Invalid userId');
  const models = {
    user: require('../models/User'),
    agent: require('../models/Agent'),
    superadmin: require('../models/SuperAdmin'),
  };
  const candidates = principalType ? [[principalType, models[principalType]]] : Object.entries(models);
  let matchedType = '';
  for (const [type, Model] of candidates) {
    if (!Model) continue;
    const result = await Model.updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } });
    if (result.matchedCount) { matchedType = type; break; }
  }
  if (!matchedType) throw new ApiError(404, 'Principal not found');
  const PrivilegedSession = require('../models/PrivilegedSession');
  await PrivilegedSession.updateMany({ effectiveActor: userId, status: 'active' }, { $set: { status: 'revoked', revokedAt: new Date(), terminationReason: reason } });
  const AuditLog = require('../models/AuditLog');
  await AuditLog.create({ superAdmin: req.superAdmin._id, action: 'security.force_logout', entityType: matchedType, entityId: userId, details: { reason }, ip: req.ip || '', userAgent: req.get('user-agent') || '' });
  res.json({ success: true, message: `All ${matchedType} sessions revoked`, reason });
}));

// ─── Audit Export ──────────────────────────────────────────────────────
router.get('/audit-logs/export', requirePlatformPermission(P.AUDIT_EXPORT), asyncHandler(async (req, res) => {
  const AuditLog = require('../models/AuditLog');
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
