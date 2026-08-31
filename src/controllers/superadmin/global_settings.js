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










exports.getSettings = asyncHandler(async (req, res) => {
  const SystemSetting = require('../../models/SystemSetting');
  const settings = await SystemSetting.getSettings();
  res.json({ success: true, data: settings });
});
exports.updateSettings = asyncHandler(async (req, res) => {
  const SystemSetting = require('../../models/SystemSetting');
  const keys = [];
  const flatten = (obj, prefix = '') => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key);
      else keys.push([key, v]);
    }
  };
  flatten(req.body);
  await Promise.all(keys.map(([key, value]) => SystemSetting.setSetting(key, value)));
  await log(req, 'settings.updated');
  const settings = await SystemSetting.getSettings();
  res.json({ success: true, data: settings });
});
