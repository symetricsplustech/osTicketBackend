const User = require('../models/User');
const Agent = require('../models/Agent');
const Ticket = require('../models/Ticket');
const SystemSetting = require('../models/SystemSetting');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../middleware/auth');
const { findOrCreateUser, buildTicketContext } = require('../services/ticket.service');
const emailService = require('../services/email.service');
const { generateConfirmationToken } = require('../utils/generators');
const config = require('../config/config');

const sendTokenResponse = (user, type, res, status = 200) => {
  const token = signToken({ id: user._id, type });
  return res.status(status).json({
    success: true,
    token,
    user,
  });
};

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  let user = await User.findOne({ email: (email || '').toLowerCase() });
  if (user && user.isRegistered) {
    throw new ApiError(409, 'An account with this email already exists. Please login.');
  }
  user = await findOrCreateUser({
    name,
    email,
    phone,
    registerPassword: password,
  });
  user.isRegistered = true;
  user.emailConfirmed = true;
  user.status = 'active';
  await user.save();

  const companyCtx = await emailService.getCompanyContext();
  const ctx = { user: { name: user.name, email: user.email, first: user.name?.split(' ')[0] }, urls: { home: config.urls.client }, ...companyCtx };
  try {
    await emailService.sendFromTemplate({ key: 'welcome_user', to: user.email, data: ctx, event: 'welcome', user: user._id });
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
  sendTokenResponse(user, 'user', res);
});

exports.ticketAccess = asyncHandler(async (req, res) => {
  const { email, number } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
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
  const token = signToken({ id: agent._id, type: 'agent' });
  res.json({ success: true, token, user: agent });
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
  const { name, phone, password, currentPassword, signature, avatar } = req.body;
  const agent = req.agent;
  if (name) agent.name = name;
  if (phone !== undefined) agent.phone = phone;
  if (signature !== undefined) agent.signature = signature;
  if (avatar !== undefined) agent.avatar = avatar;
  if (password) {
    if (currentPassword && !(await agent.matchPassword(currentPassword))) {
      throw new ApiError(400, 'Current password is incorrect');
    }
    agent.password = password;
  }
  await agent.save();
  res.json({ success: true, user: agent });
});
