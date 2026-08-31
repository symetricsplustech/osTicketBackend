const SuperAdmin = require('../../models/SuperAdmin');
const Company = require('../../models/Company');
const Plan = require('../../models/Plan');
const Invoice = require('../../models/Invoice');
const AuditLog = require('../../models/AuditLog');
const Agent = require('../../models/Agent');
const User = require('../../models/User');
const Ticket = require('../../models/Ticket');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { signToken } = require('../../middleware/auth');
const { getPagination, getSortObj } = require('../../utils/pagination');
const razorpay = require('../../services/razorpay.service');
const config = require('../../config/config');
const Notification = require('../../models/Notification');
const { notifySuperAdmin } = require('../../services/notification.service');
const emailService = require('../../services/email.service');

const notifySA = async ({ superAdminId, type, message, link, companyId }) => {
  try {
    await notifySuperAdmin({ superAdminId, type, message, link, company: companyId });
  } catch (err) {
    // non-blocking
  }
};

const notifyAllSAs = async ({ type, message, link, companyId }) => {
  try {
    const admins = await SuperAdmin.find({ isActive: true }).select('_id');
    for (const a of admins) {
      await notifySA({ superAdminId: a._id, type, message, link, companyId });
    }
  } catch (err) {
    // non-blocking
  }
};

const log = async (req, action, entityType = '', entityId = '', details = {}) => {
  try {
    await AuditLog.create({
      superAdmin: req.superAdmin?._id || null,
      company: req.query.companyId || req.body.companyId || null,
      action,
      entityType,
      entityId: entityId ? String(entityId) : '',
      details,
      ip: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });
  } catch (err) {
    // non-blocking
  }
};

const getCompanyMeta = async (companyId) => {
  if (!companyId) return { users: 0, agents: 0, tickets: 0, openTickets: 0 };
  const [users, agents, tickets, openTickets] = await Promise.all([
    User.countDocuments({ company: companyId }),
    Agent.countDocuments({ company: companyId }),
    Ticket.countDocuments({ company: companyId }),
    Ticket.countDocuments({ company: companyId, status: { $ne: 'closed' } }),
  ]);
  return { users, agents, tickets, openTickets };
};

// ---------------- Auth ----------------









// ---------------- Dashboard ----------------





// ---------------- Plans ----------------









// ---------------- Companies ----------------





// Full company structure: departments -> teams -> agents -> customers, with orgs and roles












// ---------------- Subscriptions & Payments ----------------









// ---------------- Impersonation ----------------





// ---------------- Super Admin management ----------------









// ---------------- Global settings ----------------





// ---------------- Notifications ----------------










exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const superAdmin = await SuperAdmin.findOne({ email: (email || '').toLowerCase() });
  if (!superAdmin || !superAdmin.isActive) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!(await superAdmin.matchPassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  superAdmin.lastLogin = new Date();
  await superAdmin.save();
  const token = signToken({ id: superAdmin._id, type: 'superadmin' });
  res.json({ success: true, token, user: superAdmin });
});
exports.getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.superAdmin });
});
exports.updateMe = asyncHandler(async (req, res) => {
  const { name, role, twoFactorEnabled, allowedIps } = req.body;
  const sa = req.superAdmin;
  if (name) sa.name = name;
  if (role && sa.role === 'super_admin') sa.role = role;
  if (twoFactorEnabled !== undefined) sa.twoFactorEnabled = twoFactorEnabled;
  if (allowedIps !== undefined) sa.allowedIps = allowedIps;
  await sa.save();
  await log(req, 'superadmin.updated', 'SuperAdmin', sa._id, { name: sa.name });
  res.json({ success: true, user: sa });
});
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const sa = req.superAdmin;
  if (!(await sa.matchPassword(currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  sa.password = newPassword;
  await sa.save();
  await log(req, 'superadmin.password_changed', 'SuperAdmin', sa._id);
  res.json({ success: true, message: 'Password updated successfully' });
});
