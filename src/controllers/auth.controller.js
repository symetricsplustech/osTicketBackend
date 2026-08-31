const User = require('../models/User');
const Agent = require('../models/Agent');
const SuperAdmin = require('../models/SuperAdmin');
const Ticket = require('../models/Ticket');
const SystemSetting = require('../models/SystemSetting');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../middleware/auth');
const { findOrCreateUser, buildTicketContext } = require('../services/ticket.service');
const emailService = require('../services/email.service');
const { generateConfirmationToken } = require('../utils/generators');
const config = require('../config/config');
const Company = require('../models/Company');
const mongoose = require('mongoose');

const sendTokenResponse = (user, type, res, status = 200) => {
  const token = signToken({ id: user._id, type });
  return res.status(status).json({
    success: true,
    token,
    user,
  });
};

const auditLogin = ({ actorType, actor, actorName, company, req, action }) => {
  try {
    const { audit } = require('../services/audit.service');
    audit({ company, actorType, actor, actorName, action, entityType: actorType, entityId: actor, source: 'login', req }).catch(() => {});
  } catch (err) {
    // ignore
  }
};

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, company } = req.body;
  const companyId = company || req.companyId;
  if (!companyId || !mongoose.isValidObjectId(companyId)) throw new ApiError(422, 'A valid tenant invitation or company identifier is required');
  const activeCompany = await Company.findById(companyId).select('_id status');
  if (!activeCompany || !activeCompany.isActive()) throw new ApiError(422, 'The selected tenant is not active');
  const userQuery = { email: (email || '').toLowerCase() };
  if (companyId) userQuery.company = companyId;
  else userQuery.company = null;
  let user = await User.findOne(userQuery);
  if (user && user.isRegistered) {
    throw new ApiError(409, 'An account with this email already exists. Please login.');
  }
  user = await findOrCreateUser({
    name,
    email,
    phone,
    registerPassword: password,
    company: companyId,
  });
  user.isRegistered = true;
  user.emailConfirmed = true;
  user.status = 'active';
  await user.save();

  const companyCtx = await emailService.getCompanyContext();
  const ctx = { user: { name: user.name, email: user.email, first: user.name?.split(' ')[0] }, urls: { home: config.urls.client }, ...companyCtx };
  try {
    await emailService.sendFromTemplate({ key: 'welcome_user', to: user.email, data: ctx, event: 'welcome', user: user._id, company: companyId });
  } catch (err) {
    // non-blocking
  }
  sendTokenResponse(user, 'user', res, 201);
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user || user.status !== 'active') {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.password || !(await user.matchPassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  user.lastLogin = new Date();
  await user.save();
  auditLogin({ actorType: 'user', actor: user._id, actorName: user.name, company: user.company || null, req, action: 'auth.login' });
  sendTokenResponse(user, 'user', res);
});

exports.ticketAccess = asyncHandler(async (req, res) => {
  const { email, number, company } = req.body;
  const userQuery = { email: (email || '').toLowerCase() };
  if (company) userQuery.company = company;
  const user = await User.findOne(userQuery);
  if (!user) throw new ApiError(404, 'No account or ticket found for the email provided');
  const ticket = await Ticket.findOne({ number: String(number || '').trim().toUpperCase(), user: user._id })
    .populate('dept', 'name')
    .populate('topic', 'topic');
  if (!ticket) throw new ApiError(404, 'No ticket found matching your email and ticket number');
  sendTokenResponse(user, 'user', res);
});

exports.agentLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const agent = await Agent.findOne({ email: (email || '').toLowerCase() }).populate('role');
  if (!agent || !agent.isActive) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!(await agent.matchPassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  agent.lastLogin = new Date();
  await agent.save();
  const token = signToken({ id: agent._id, type: 'agent' });
  res.json({ success: true, token, user: agent });
});

exports.portalLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const norm = String(email || '').toLowerCase().trim();
  if (!norm || !password) throw new ApiError(422, 'Email and password are required');

  const superAdmin = await SuperAdmin.findOne({ email: norm });
  if (superAdmin && superAdmin.isActive && (await superAdmin.matchPassword(password))) {
    if (superAdmin.allowedIps && superAdmin.allowedIps.length) {
      const ip = req.ip || req.connection?.remoteAddress || '';
      if (!superAdmin.allowedIps.includes(ip)) {
        throw new ApiError(403, 'Access denied for this IP address');
      }
    }
    superAdmin.lastLogin = new Date();
    await superAdmin.save();
    const token = signToken({ id: superAdmin._id, type: 'superadmin' });
    // Superadmin: if permissions array is empty, grant wildcard '*' (all permissions)
    const permissions = (superAdmin.permissions && superAdmin.permissions.length > 0) ? superAdmin.permissions : ['*'];
    const moduleKeys = superAdmin.moduleKeys || [];
    return res.json({ success: true, token, user: superAdmin, role: 'superadmin', permissions, moduleKeys });
  }

  const agent = await Agent.findOne({ email: norm }).populate('role');
  if (agent && agent.isActive && (await agent.matchPassword(password))) {
    const isAdmin = agent.isAdmin || (agent.role && agent.role.isAdmin);
    agent.lastLogin = new Date();
    await agent.save();
    auditLogin({ actorType: 'agent', actor: agent._id, actorName: agent.name, company: agent.company || null, req, action: 'auth.portal_login' });
    const token = signToken({ id: agent._id, type: 'agent' });
    const rolePermissions = agent.role?.permissions || [];
    const agentPermissions = agent.permissions || [];
    const permissions = [...new Set([...rolePermissions, ...agentPermissions])];
    // Get activated modules from tenant_modules collection (the source of truth)
    let moduleKeys = [];
    if (agent.company) {
      const mongoose = require('mongoose');
      const tenantModules = await mongoose.connection.db.collection('tenant_modules')
        .find({ tenantId: new mongoose.Types.ObjectId(agent.company), status: 'active' })
        .toArray();
      moduleKeys = tenantModules.map(m => m.moduleKey);
    }
    return res.json({ success: true, token, user: agent, role: isAdmin ? 'admin' : 'agent', permissions, moduleKeys });
  }

  const user = await User.findOne({ email: norm });
  if (user && user.status === 'active' && user.password && (await user.matchPassword(password))) {
    user.lastLogin = new Date();
    await user.save();
    const token = signToken({ id: user._id, type: 'user' });
    const permissions = user.permissions || [];
    // Get activated modules from tenant_modules collection
    let moduleKeys = [];
    if (user.company) {
      const mongoose = require('mongoose');
      const tenantModules = await mongoose.connection.db.collection('tenant_modules')
        .find({ tenantId: new mongoose.Types.ObjectId(user.company), status: 'active' })
        .toArray();
      moduleKeys = tenantModules.map(m => m.moduleKey);
    }
    return res.json({ success: true, token, user, role: 'customer', permissions, moduleKeys });
  }

  throw new ApiError(401, 'Invalid email or password');
});

exports.adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const agent = await Agent.findOne({ email: (email || '').toLowerCase() }).populate('role');
  if (!agent || !agent.isActive) {
    throw new ApiError(401, 'Invalid email or password');
  }
  const isAdminRole = agent.role && agent.role.isAdmin;
  if (!agent.isAdmin && !isAdminRole) {
    throw new ApiError(403, 'This account does not have admin access');
  }
  if (!(await agent.matchPassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  agent.lastLogin = new Date();
  await agent.save();
  auditLogin({ actorType: 'agent', actor: agent._id, actorName: agent.name, company: agent.company || null, req, action: 'auth.admin_login' });
  const token = signToken({ id: agent._id, type: 'agent' });
  // Get activated modules from tenant_modules collection
  let moduleKeys = [];
  if (agent.company) {
    const mongoose = require('mongoose');
    const tenantModules = await mongoose.connection.db.collection('tenant_modules')
      .find({ tenantId: new mongoose.Types.ObjectId(agent.company), status: 'active' })
      .toArray();
    moduleKeys = tenantModules.map(m => m.moduleKey);
  }
  res.json({ success: true, token, user: agent, moduleKeys });
});

exports.confirmEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;
  const user = await User.findOne({ confirmationToken: token, confirmationExpires: { $gt: new Date() } });
  if (!user) throw new ApiError(400, 'Invalid or expired confirmation token');
  user.emailConfirmed = true;
  user.confirmationToken = null;
  user.confirmationExpires = null;
  await user.save();
  sendTokenResponse(user, 'user', res);
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user) {
    return res.json({ success: true, message: 'If an account exists, a reset link was sent.' });
  }
  const token = generateConfirmationToken();
  user.resetToken = token;
  user.resetExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();
  const companyCtx = await emailService.getCompanyContext();
  const ctx = {
    user: { name: user.name, email: user.email, first: user.name?.split(' ')[0] },
    urls: { home: config.urls.client, reset: `${config.urls.client}/reset-password?token=${token}` },
    ...companyCtx,
  };
  await emailService.sendFromTemplate({ key: 'password_reset', to: user.email, data: ctx, event: 'password_reset', user: user._id });
  res.json({ success: true, message: 'If an account exists, a reset link was sent.' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const user = await User.findOne({ resetToken: token, resetExpires: { $gt: new Date() } });
  if (!user) throw new ApiError(400, 'Invalid or expired reset token');
  user.password = password;
  user.resetToken = null;
  user.resetExpires = null;
  await user.save();
  sendTokenResponse(user, 'user', res);
});

exports.getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

exports.getAgentMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.agent });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, password, currentPassword, signature, avatar } = req.body;
  const user = req.user;
  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (avatar !== undefined) user.avatar = avatar;
  if (password) {
    if (currentPassword && !(await user.matchPassword(currentPassword))) {
      throw new ApiError(400, 'Current password is incorrect');
    }
    user.password = password;
  }
  await user.save();
  res.json({ success: true, user });
});

exports.updateAgentProfile = asyncHandler(async (req, res) => {
  const { name, phone, password, currentPassword, signature, avatar, notificationPrefs } = req.body;
  const agent = req.agent;
  if (name) agent.name = name;
  if (phone !== undefined) agent.phone = phone;
  if (signature !== undefined) agent.signature = signature;
  if (avatar !== undefined) agent.avatar = avatar;
  if (notificationPrefs !== undefined && typeof notificationPrefs === 'object') agent.notificationPrefs = notificationPrefs;
  if (password) {
    if (currentPassword && !(await agent.matchPassword(currentPassword))) {
      throw new ApiError(400, 'Current password is incorrect');
    }
    agent.password = password;
  }
  await agent.save();
  res.json({ success: true, user: agent });
});

exports.enableTwoFactor = asyncHandler(async (req, res) => {
  const { userId } = req;
  const { method, phone, totpSecret, backupCodes } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.twoFactorEnabled = true;
  user.twoFactorMethod = method;
  if (method === 'sms') user.twoFactorPhone = phone;
  if (totpSecret) user.twoFactorSecret = totpSecret;
  if (backupCodes) user.twoFactorBackupCodes = backupCodes;
  await user.save();
  res.json({ success: true, message: 'Two-factor authentication enabled' });
});

exports.disableTwoFactor = asyncHandler(async (req, res) => {
  const { userId } = req;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.twoFactorEnabled = false;
  user.twoFactorSecret = '';
  user.twoFactorBackupCodes = [];
  await user.save();
  res.json({ success: true, message: 'Two-factor authentication disabled' });
});
