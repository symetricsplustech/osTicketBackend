const User = require('../models/User');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/email.service');
const { notifyUser } = require('../services/notification.service');
const { USER_PERMISSION_LIST, USER_PERMISSION_LABELS } = require('../utils/userPermissions');
const config = require('../config/config');

const ensureMainCustomer = (req) => {
  if (req.user.createdBy) throw new ApiError(403, 'Only the account owner can manage employees');
};

const sanitizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  return permissions.filter((p) => USER_PERMISSION_LIST.includes(p));
};

exports.listEmployees = asyncHandler(async (req, res) => {
  ensureMainCustomer(req);
  const employees = await User.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, items: employees });
});

exports.createEmployee = asyncHandler(async (req, res) => {
  ensureMainCustomer(req);
  const { name, email, phone, password, permissions } = req.body;
  if (!name || !email) throw new ApiError(422, 'Name and email are required');
  if (!password || password.length < 6) throw new ApiError(422, 'Password must be at least 6 characters');

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new ApiError(409, 'An account with this email already exists');

  const employee = await User.create({
    name,
    email: normalizedEmail,
    phone: phone || '',
    password,
    isRegistered: true,
    emailConfirmed: true,
    status: 'active',
    createdBy: req.user._id,
    permissions: sanitizePermissions(permissions),
    company: req.user.company || null,
  });

  const companyCtx = await emailService.getCompanyContext();
  const ctx = {
    user: { name: employee.name, email: employee.email, first: employee.name?.split(' ')[0] },
    account: { email: employee.email, password },
    urls: { home: config.urls.client, login: `${config.urls.client}/login` },
    createdBy: { name: req.user.name, email: req.user.email },
    ...companyCtx,
  };
  try {
    const sent = await emailService.sendFromTemplate({
      key: 'employee_welcome',
      to: employee.email,
      data: ctx,
      event: 'employee_welcome',
      user: employee._id,
      company: req.user.company || null,
    });
    if (!sent) {
      await emailService.sendMail({
        to: employee.email,
        subject: 'Your support portal account',
        body: `Dear ${employee.name},\n\nAn employee account has been created for you on the ${companyCtx.company?.name || 'Support Center'} portal by ${req.user.name}.\n\nLogin: ${config.urls.client}/login\nEmail: ${employee.email}\nPassword: ${password}\n\nPlease change your password after your first login.\n\nRegards,\n${companyCtx.company?.name || 'Support Center'}`,
        event: 'employee_welcome',
        user: employee._id,
        company: req.user.company || null,
      });
    }
  } catch (err) {
    // non-blocking
  }

  await notifyUser({
    userId: employee._id,
    company: req.user.company || null,
    type: 'account_created',
    message: `Your employee account was created by ${req.user.name}. Login to manage tickets.`,
    link: '/login',
  });

  res.status(201).json({ success: true, user: employee });
});

exports.updateEmployee = asyncHandler(async (req, res) => {
  ensureMainCustomer(req);
  const employee = await User.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!employee) throw new ApiError(404, 'Employee not found');

  const { name, phone, status, password, permissions } = req.body;
  if (name !== undefined) employee.name = name;
  if (phone !== undefined) employee.phone = phone;
  if (status !== undefined) {
    if (!['active', 'disabled'].includes(status)) throw new ApiError(422, 'Invalid status');
    employee.status = status;
  }
  if (permissions !== undefined) employee.permissions = sanitizePermissions(permissions);
  if (password) {
    if (password.length < 6) throw new ApiError(422, 'Password must be at least 6 characters');
    employee.password = password;
  }
  await employee.save();

  if (password) {
    const companyCtx = await emailService.getCompanyContext();
    try {
      await emailService.sendMail({
        to: employee.email,
        subject: 'Your support portal password was updated',
        body: `Dear ${employee.name},\n\nYour password on the ${companyCtx.company?.name || 'Support Center'} portal was updated by ${req.user.name}.\n\nEmail: ${employee.email}\nNew Password: ${password}\n\nPlease change your password after your next login.\n\nRegards,\n${companyCtx.company?.name || 'Support Center'}`,
        event: 'employee_password_updated',
        user: employee._id,
        company: req.user.company || null,
      });
    } catch (err) {
      // non-blocking
    }
  }

  res.json({ success: true, user: employee });
});

exports.deleteEmployee = asyncHandler(async (req, res) => {
  ensureMainCustomer(req);
  const employee = await User.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
  if (!employee) throw new ApiError(404, 'Employee not found');
  res.json({ success: true, message: 'Employee removed' });
});

exports.getNotifications = asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ recipientType: 'user', recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30),
    Notification.countDocuments({ recipientType: 'user', recipient: req.user._id, read: false }),
  ]);
  res.json({ success: true, items, unread });
});

exports.markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipientType: 'user', recipient: req.user._id, read: false }, { $set: { read: true } });
  res.json({ success: true });
});

exports.markNotificationRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, recipientType: 'user', recipient: req.user._id }, { $set: { read: true } });
  res.json({ success: true });
});

exports.profile = asyncHandler(async (req, res) => {
  const { name, phone, currentPassword, password } = req.body;
  const user = req.user;
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (password) {
    if (!currentPassword || !(await user.matchPassword(currentPassword))) {
      throw new ApiError(400, 'Current password is incorrect');
    }
    user.password = password;
  }
  await user.save();
  res.json({ success: true, user });
});

exports.permissionsMeta = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    permissions: USER_PERMISSION_LIST.map((key) => ({ key, label: USER_PERMISSION_LABELS[key] || key })),
  });
});

// ---- Self-service support-email (email-to-ticket sender address) ----
// The customer mails the hired organisation's support inbox from THIS address
// to create/track tickets without logging in. Changing it keeps the same
// User _id so portal history (My Tickets + progress) stays linked.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.getSupportEmailStatus = asyncHandler(async (req, res) => {
  const user = req.user;
  let supportInbox = '';
  let supportDomain = '';
  let supportCompany = null;
  try {
    const companyId = req.companyId || user.company || null;
    if (companyId) {
      const Company = require('../models/Company');
      const co = await Company.findById(companyId).select('name email supportEmail domain');
      if (co) {
        supportCompany = { _id: co._id, name: co.name };
        supportInbox = co.supportEmail || co.email || '';
        supportDomain = co.domain || '';
      }
    }
    if (!supportInbox) {
      const SystemSetting = require('../models/SystemSetting');
      const settings = await SystemSetting.getSettings();
      supportInbox = settings.system?.emailToTicket || config.email.emailToTicket || '';
    }
  } catch (_) { /* non-blocking */ }
  // The company OWNER configures the inbox (not the platform admin):
  // main customer account (no createdBy) or a company admin agent.
  let canConfigure = false;
  try {
    if (req.agent) {
      canConfigure = !!(req.agent.isAdmin || req.agent.role?.isAdmin);
    } else if (user && !user.createdBy) {
      canConfigure = true;
    }
  } catch (_) { canConfigure = false; }
  res.json({
    success: true,
    currentEmail: user.email || '',
    pendingEmail: user.pendingEmail || '',
    pendingExpires: user.pendingEmailExpires || null,
    verified: !!user.emailConfirmed,
    supportInbox,
    supportDomain,
    supportCompany,
    canConfigure,
  });
});

// ---- Company-owner inbox configuration (NOT platform admin) ----
// The owner of the hired organisation sets the ONE support address their
// customers mail to create tickets. Tenant-scoped: owners can only touch
// their own company (req.companyId).
exports.updateSupportInbox = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.company || null;
  if (!companyId) throw new ApiError(404, 'No company is associated with your account');
  const isAgentAdmin = !!(req.agent && (req.agent.isAdmin || req.agent.role?.isAdmin));
  const isOwner = !!(req.user && !req.user.createdBy && !req.agent);
  if (!isAgentAdmin && !isOwner) {
    throw new ApiError(403, 'Only the company owner can configure the support inbox');
  }
  const { supportEmail, domain } = req.body;
  const inbox = String(supportEmail || '').toLowerCase().trim();
  if (!EMAIL_RE.test(inbox)) throw new ApiError(422, 'Valid supportEmail is required');
  if (domain !== undefined && String(domain).trim() && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(domain).trim())) {
    throw new ApiError(422, 'Domain is invalid');
  }
  const Company = require('../models/Company');
  const co = await Company.findById(companyId);
  if (!co) throw new ApiError(404, 'Company not found');
  co.supportEmail = inbox;
  if (domain !== undefined) co.domain = String(domain || '').toLowerCase().trim();
  await co.save();
  res.json({
    success: true,
    message: `Support inbox set to ${inbox}. Customers mailing this address auto-create tickets in ${co.name}.`,
    company: { _id: co._id, name: co.name, supportEmail: co.supportEmail, email: co.email, domain: co.domain },
  });
});

exports.requestEmailChange = asyncHandler(async (req, res) => {
  if (req.agent) throw new ApiError(403, 'Agents update email via the agent profile, not here');
  const { email } = req.body;
  const next = String(email || '').toLowerCase().trim();
  if (!EMAIL_RE.test(next)) throw new ApiError(422, 'Valid email is required');
  if (next === req.user.email) throw new ApiError(422, 'This is already your support email');
  const taken = await User.findOne({ email: next, _id: { $ne: req.user._id } }).select('_id');
  if (taken) throw new ApiError(409, 'This email is already used by another account');
  const { generateConfirmationToken } = require('../utils/generators');
  const token = generateConfirmationToken();
  req.user.pendingEmail = next;
  req.user.pendingEmailToken = token;
  req.user.pendingEmailExpires = new Date(Date.now() + 30 * 60 * 1000);
  await req.user.save();
  const verifyUrl = `${config.urls.client}/support-email?token=${token}`;
  try {
    await emailService.sendMail({
      to: next,
      subject: 'Confirm your support email',
      body: `Dear ${req.user.name},\n\nConfirm ${next} as your support email so tickets you mail to your hired organisation appear in your portal.\n\nConfirm: ${verifyUrl}\nToken: ${token}\n\nThis link expires in 30 minutes. Your existing tickets stay linked to this same account.\n\nRegards,\nSupport Team`,
      event: 'support_email_verify',
      user: req.user._id,
      company: req.user.company || null,
    });
  } catch (_) { /* non-blocking: verification stays usable via token */ }
  res.json({
    success: true,
    message: 'Verification sent to your new address. Confirm within 30 minutes.',
    pendingEmail: next,
    // Exposed only when SMTP is off (dev) so the flow stays testable locally.
    ...(config.email.enabled ? {} : { debugToken: token, verifyUrl }),
  });
});

exports.confirmEmailChange = asyncHandler(async (req, res) => {
  if (req.agent) throw new ApiError(403, 'Agents update email via the agent profile, not here');
  const { token } = req.body;
  if (!token) throw new ApiError(422, 'Token is required');
  const user = await User.findOne({
    _id: req.user._id,
    pendingEmailToken: String(token),
    pendingEmailExpires: { $gt: new Date() },
  });
  if (!user || !user.pendingEmail) throw new ApiError(400, 'Invalid or expired token');
  const next = String(user.pendingEmail).toLowerCase().trim();
  const taken = await User.findOne({ email: next, _id: { $ne: user._id } }).select('_id');
  if (taken) throw new ApiError(409, 'This email was just taken by another account');
  user.email = next;
  user.emailConfirmed = true;
  user.pendingEmail = '';
  user.pendingEmailToken = null;
  user.pendingEmailExpires = null;
  await user.save();
  res.json({ success: true, message: 'Support email updated. Mail from the new address to create tickets.', user });
});
