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










const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const PrivilegedSession = require('../../models/PrivilegedSession');

const SESSION_TTL_MIN = 15;
const SESSION_TTL_MAX_MIN = 60;

const sessionToken = (adminId, sessionId, ttlMin) =>
  jwt.sign({ id: adminId, type: 'agent', sid: sessionId }, config.jwt.secret, { expiresIn: `${ttlMin}m` });

const newSession = async ({ kind, req, company, admin, reason, ttlMin, breakGlass }) => {
  const ttl = Math.min(Math.max(Number(ttlMin) || SESSION_TTL_MIN, 1), SESSION_TTL_MAX_MIN);
  const sessionId = `ps_${crypto.randomBytes(12).toString('hex')}`;
  const session = await PrivilegedSession.create({
    sessionId,
    kind,
    realActor: req.superAdmin._id,
    realActorEmail: req.superAdmin.email || '',
    effectiveActor: admin ? admin._id : null,
    targetTenant: company ? company._id : null,
    targetUser: admin ? admin.email : '',
    reason,
    breakGlass: !!breakGlass,
    approvedBy: breakGlass ? `self:${req.superAdmin.email || req.superAdmin._id}` : '',
    expiresAt: new Date(Date.now() + ttl * 60000),
    ip: req.ip || '',
    userAgent: req.get('user-agent') || '',
    correlationId: `corr_${crypto.randomBytes(8).toString('hex')}`,
  });
  return { session, ttl };
};

exports.impersonateCompanyAdmin = asyncHandler(async (req, res) => {
  const { companyId, reason, ttlMinutes } = req.body;
  if (!reason || !String(reason).trim()) throw new ApiError(422, 'A support reason is required for impersonation');
  const company = await Company.findById(companyId);
  if (!company) throw new ApiError(404, 'Company not found');
  const admin = await Agent.findOne({ company: companyId, isAdmin: true, isActive: true }).sort({ createdAt: 1 });
  if (!admin) throw new ApiError(404, 'No admin agent found for this company');
  const { session, ttl } = await newSession({ kind: 'impersonation', req, company, admin, reason: String(reason).trim(), ttlMinutes });
  const token = sessionToken(admin._id, session.sessionId, ttl);
  await log(req, 'impersonation.company_admin', 'Company', companyId, {
    agent: admin.email, sessionId: session.sessionId, reason: session.reason,
    expiresAt: session.expiresAt, realActor: session.realActorEmail, correlationId: session.correlationId,
  });
  res.json({ success: true, token, user: admin, session: { id: session.sessionId, expiresAt: session.expiresAt } });
});

// Emergency break-glass access (MD §83): self-approved, short-lived,
// immutable audit + security notification to all platform operators.
exports.breakGlassAccess = asyncHandler(async (req, res) => {
  const { companyId, reason, ttlMinutes } = req.body;
  if (!reason || !String(reason).trim()) throw new ApiError(422, 'A reason is required for break-glass access');
  const company = await Company.findById(companyId);
  if (!company) throw new ApiError(404, 'Company not found');
  const admin = await Agent.findOne({ company: companyId, isAdmin: true, isActive: true }).sort({ createdAt: 1 });
  if (!admin) throw new ApiError(404, 'No admin agent found for this company');
  const { session, ttl } = await newSession({ kind: 'break_glass', req, company, admin, reason: String(reason).trim(), ttlMinutes, breakGlass: true });
  const token = sessionToken(admin._id, session.sessionId, ttl);
  await log(req, 'security.break_glass', 'Company', companyId, {
    agent: admin.email, sessionId: session.sessionId, reason: session.reason,
    expiresAt: session.expiresAt, realActor: session.realActorEmail, correlationId: session.correlationId,
  });
  await notifyAllSAs({ type: 'break_glass', message: `Break-glass access by ${session.realActorEmail}: ${session.reason}`, companyId });
  res.json({ success: true, token, user: admin, session: { id: session.sessionId, expiresAt: session.expiresAt } });
});

exports.listPrivilegedSessions = asyncHandler(async (req, res) => {
  const { status, companyId } = req.query;
  const q = {};
  if (status) q.status = status;
  if (companyId) q.targetTenant = companyId;
  const sessions = await PrivilegedSession.find(q).sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, data: sessions });
});

exports.revokePrivilegedSession = asyncHandler(async (req, res) => {
  const session = await PrivilegedSession.findOne({ sessionId: req.params.sessionId });
  if (!session) throw new ApiError(404, 'Session not found');
  const { terminationReason } = req.body;
  session.status = 'revoked';
  session.revokedAt = new Date();
  session.terminationReason = terminationReason || 'revoked by platform operator';
  await session.save();
  await log(req, 'impersonation.revoked', 'PrivilegedSession', session.sessionId, { terminationReason: session.terminationReason });
  res.json({ success: true, data: session });
});
exports.listCompanyAdmins = asyncHandler(async (req, res) => {
  const agents = await Agent.find({ company: req.params.id, isAdmin: true })
    .select('name email isActive lastLogin')
    .sort({ createdAt: 1 });
  res.json({ success: true, data: agents });
});
