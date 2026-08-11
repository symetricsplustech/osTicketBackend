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
