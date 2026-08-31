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










exports.dashboard = asyncHandler(async (req, res) => {
  const [companies, activeCompanies, revenueAgg, plans, pendingInvoices, tickets, users, agents] =
    await Promise.all([
      Company.countDocuments(),
      Company.countDocuments({ status: 'active' }),
      Invoice.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Plan.countDocuments({ isActive: true }),
      Invoice.countDocuments({ status: 'pending' }),
      Ticket.countDocuments(),
      User.countDocuments(),
      Agent.countDocuments(),
    ]);

  const recentCompanies = await Company.find()
    .populate('plan', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

  const recentInvoices = await Invoice.find()
    .populate('company', 'name')
    .populate('plan', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

  const plansList = await Plan.find({ isActive: true }).sort({ priceMonthly: 1 });

  const companyDistribution = [];
  for (const p of plansList) {
    const count = await Company.countDocuments({ plan: p._id });
    companyDistribution.push({ plan: p.name, count });
  }

  res.json({
    success: true,
    data: {
      counts: {
        companies,
        activeCompanies,
        totalRevenue: revenueAgg.length ? revenueAgg[0].total : 0,
        pendingInvoices,
        plans,
        tickets,
        users,
        agents,
      },
      companyDistribution,
      recentCompanies,
      recentInvoices,
    },
  });
});
exports.auditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req);
  const q = {};
  if (req.query.action) q.action = { $regex: String(req.query.action), $options: 'i' };
  if (req.query.companyId) q.company = req.query.companyId;
  if (req.query.search) {
    const re = new RegExp(String(req.query.search), 'i');
    q.$or = [{ action: re }, { entityType: re }, { actorName: re }, { 'details.name': re }];
  }
  const sortObj = getSortObj(sort);

  // Pull from both AuditLog (superadmin platform logs) and AuditEvent (tenant-level logs)
  const [saLogs, saTotal, eventLogs, eventTotal] = await Promise.all([
    AuditLog.find(q).populate('superAdmin', 'name email').populate('company', 'name').sort(sortObj).skip(skip).limit(limit),
    AuditLog.countDocuments(q),
    require('../../models/AuditEvent').find(q)
      .populate('company', 'name')
      .sort(sortObj).skip(skip).limit(limit),
    require('../../models/AuditEvent').countDocuments(q),
  ]);

  // Normalize both into a unified shape and merge
  const normalizeSA = (log) => ({
    _id: log._id,
    source: 'platform',
    action: log.action,
    entityType: log.entityType || '',
    entityId: log.entityId || '',
    actorName: log.superAdmin?.name || log.superAdmin?.email || '',
    actorType: 'superadmin',
    company: log.company?.name || '',
    companyId: log.company?._id || null,
    details: log.details || {},
    ip: log.ip || '',
    createdAt: log.createdAt,
  });

  const normalizeEvent = (evt) => ({
    _id: evt._id,
    source: 'tenant',
    action: evt.action,
    entityType: evt.entityType || '',
    entityId: evt.entityId ? String(evt.entityId) : '',
    actorName: evt.actorName || '',
    actorType: evt.actorType || 'system',
    company: evt.company?.name || '',
    companyId: evt.company?._id || null,
    details: evt.after || evt.metadata || {},
    ip: evt.ip || '',
    createdAt: evt.createdAt,
  });

  let combined = [...saLogs.map(normalizeSA), ...eventLogs.map(normalizeEvent)];
  combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  combined = combined.slice(0, limit);

  const total = saTotal + eventTotal;
  res.json({
    success: true,
    data: combined,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
