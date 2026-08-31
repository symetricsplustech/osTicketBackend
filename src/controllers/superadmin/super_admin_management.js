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










exports.listSuperAdmins = asyncHandler(async (req, res) => {
  const admins = await SuperAdmin.find().select('-password -twoFactorSecret');
  res.json({ success: true, data: admins });
});
exports.createSuperAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required');
  const exists = await SuperAdmin.findOne({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, 'A super admin with this email already exists');
  const sa = await SuperAdmin.create({ name, email, password, role: role || 'super_admin' });
  await log(req, 'superadmin.created', 'SuperAdmin', sa._id, { name, email });
  res.status(201).json({ success: true, data: sa });
});
exports.updateSuperAdmin = asyncHandler(async (req, res) => {
  const sa = await SuperAdmin.findById(req.params.id);
  if (!sa) throw new ApiError(404, 'Super admin not found');
  const { name, role, isActive, permissions, allowedIps } = req.body;
  if (name) sa.name = name;
  if (role) sa.role = role;
  if (isActive !== undefined) sa.isActive = isActive;
  if (permissions !== undefined) sa.permissions = permissions;
  if (allowedIps !== undefined) sa.allowedIps = allowedIps;
  await sa.save();
  await log(req, 'superadmin.updated', 'SuperAdmin', sa._id, { name: sa.name });
  res.json({ success: true, data: sa });
});
exports.deleteSuperAdmin = asyncHandler(async (req, res) => {
  if (req.params.id === String(req.superAdmin._id)) {
    throw new ApiError(400, 'You cannot delete your own account');
  }
  const sa = await SuperAdmin.findById(req.params.id);
  if (!sa) throw new ApiError(404, 'Super admin not found');
  await sa.deleteOne();
  await log(req, 'superadmin.deleted', 'SuperAdmin', req.params.id, { name: sa.name });
  res.json({ success: true, message: 'Super admin deleted' });
});
