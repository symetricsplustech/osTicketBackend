const SuperAdmin = require('../models/SuperAdmin');
const Company = require('../models/Company');
const Plan = require('../models/Plan');
const Invoice = require('../models/Invoice');
const AuditLog = require('../models/AuditLog');
const Agent = require('../models/Agent');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../middleware/auth');
const { getPagination, getSortObj } = require('../utils/pagination');
const razorpay = require('../services/razorpay.service');
const config = require('../config/config');
const Notification = require('../models/Notification');
const { notifySuperAdmin } = require('../services/notification.service');
const emailService = require('../services/email.service');

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

// ---------------- Dashboard ----------------

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
  if (req.query.action) q.action = req.query.action;
  if (req.query.companyId) q.company = req.query.companyId;
  if (req.query.search) {
    const re = new RegExp(String(req.query.search), 'i');
    q.$or = [{ action: re }, { entityType: re }, { 'details.name': re }];
  }
  const [items, total] = await Promise.all([
    AuditLog.find(q).populate('superAdmin', 'name email').populate('company', 'name').sort(getSortObj(sort)).skip(skip).limit(limit),
    AuditLog.countDocuments(q),
  ]);
  res.json({ success: true, data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// ---------------- Plans ----------------

exports.listPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find().sort({ priceMonthly: 1 });
  res.json({ success: true, data: plans });
});

exports.createPlan = asyncHandler(async (req, res) => {
  const plan = await Plan.create(req.body);
  await log(req, 'plan.created', 'Plan', plan._id, { name: plan.name });
  await notifySA({
    superAdminId: req.superAdmin._id,
    type: 'plan_created',
    message: `Plan "${plan.name}" created`,
    link: '/plans',
  });
  res.status(201).json({ success: true, data: plan });
});

exports.updatePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw new ApiError(404, 'Plan not found');
  Object.assign(plan, req.body);
  await plan.save();
  await log(req, 'plan.updated', 'Plan', plan._id, { name: plan.name });
  await notifySA({
    superAdminId: req.superAdmin._id,
    type: 'plan_updated',
    message: `Plan "${plan.name}" updated`,
    link: '/plans',
  });
  res.json({ success: true, data: plan });
});

exports.deletePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw new ApiError(404, 'Plan not found');
  const companies = await Company.countDocuments({ plan: plan._id });
  if (companies > 0) throw new ApiError(400, 'Plan is assigned to companies and cannot be deleted');
  await plan.deleteOne();
  await log(req, 'plan.deleted', 'Plan', req.params.id, { name: plan.name });
  res.json({ success: true, message: 'Plan deleted' });
});

// ---------------- Companies ----------------

exports.listCompanies = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req);
  const q = {};
  if (req.query.status) q.status = req.query.status;
  if (req.query.search) {
    const re = new RegExp(String(req.query.search), 'i');
    q.$or = [{ name: re }, { email: re }, { domain: re }, { contactPerson: re }];
  }
  const [items, total] = await Promise.all([
    Company.find(q).populate('plan', 'name code').sort(getSortObj(sort)).skip(skip).limit(limit),
    Company.countDocuments(q),
  ]);
  const data = await Promise.all(
    items.map(async (c) => {
      const meta = await getCompanyMeta(c._id);
      return { ...c.toObject(), ...meta };
    })
  );
  res.json({ success: true, data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.getCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id).populate('plan', 'name code priceMonthly');
  if (!company) throw new ApiError(404, 'Company not found');
  const meta = await getCompanyMeta(company._id);
  const invoices = await Invoice.find({ company: company._id }).sort({ createdAt: -1 }).limit(10);
  res.json({ success: true, data: { ...company.toObject(), ...meta, invoices } });
});

exports.createCompany = asyncHandler(async (req, res) => {
  const { name, email, domain, plan, billingCycle, trialDays, adminEmail, adminPassword } = req.body;
  if (!name) throw new ApiError(400, 'Company name is required');
  const exists = await Company.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
  if (exists) throw new ApiError(409, 'A company with this name already exists');

  const activePlan = plan ? await Plan.findById(plan) : await Plan.findOne({ isDefault: true, isActive: true });
  const trial = trialDays || activePlan?.trialDays || 14;

  const company = await Company.create({
    name,
    email: email || '',
    domain: domain || '',
    plan: activePlan?._id || null,
    billingCycle: billingCycle || 'monthly',
    status: 'trial',
    planStartedAt: new Date(),
    planExpiresAt: new Date(Date.now() + trial * 24 * 60 * 60 * 1000),
    trialEndsAt: new Date(Date.now() + trial * 24 * 60 * 60 * 1000),
    createdBy: req.superAdmin._id,
  });

  if (activePlan) {
    const paidPlan = await Plan.findById(activePlan._id);
    if (paidPlan) {
      await Invoice.create({
        invoiceNumber: `INV-${Date.now().toString().slice(-8)}`,
        company: company._id,
        plan: activePlan._id,
        description: `Trial subscription for ${name}`,
        amount: 0,
        status: 'paid',
        periodStart: new Date(),
        periodEnd: company.planExpiresAt,
        createdBy: req.superAdmin._id,
      });
    }
  }

  let createdAdmin = null;
  if (adminEmail && adminPassword) {
    createdAdmin = await Agent.create({
      name: 'Company Administrator',
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      company: company._id,
      isAdmin: true,
      isActive: true,
    });
  }

  if (createdAdmin) {
    const ctx = {
      user: { name: createdAdmin.name, email: createdAdmin.email, first: 'Company' },
      account: { email: createdAdmin.email, password: adminPassword },
      urls: { home: config.urls.client, login: config.urls.admin },
      company: { name: company.name, email: createdAdmin.email },
      createdBy: { name: req.superAdmin.name, email: req.superAdmin.email },
    };
    try {
      const sent = await emailService.sendFromTemplate({
        key: 'admin_welcome',
        to: createdAdmin.email,
        data: ctx,
        event: 'admin_welcome',
        company: null,
      });
      if (!sent) {
        await emailService.sendMail({
          to: createdAdmin.email,
          subject: 'Your Administrator account has been created',
          body: `Dear ${createdAdmin.name},\n\nYour company "${company.name}" has been registered and an administrator account has been created for you.\n\nLogin: ${config.urls.admin}\nEmail: ${createdAdmin.email}\nPassword: ${adminPassword}\n\nPlease sign in to the Administrator Panel and change your password after your first login.\n\nRegards,\n${company.name}`,
          event: 'admin_welcome',
          company: null,
        });
      }
      const companyEmail = (email || '').toLowerCase().trim();
      if (companyEmail && companyEmail !== createdAdmin.email) {
        const sentCompany = await emailService.sendFromTemplate({
          key: 'company_admin_created',
          to: companyEmail,
          data: ctx,
          event: 'company_admin_created',
          company: null,
        });
        if (!sentCompany) {
          await emailService.sendMail({
            to: companyEmail,
            subject: 'Your company is ready',
            body: `Dear Administrator,\n\nYour company "${company.name}" has been registered on the support platform. Your administrator login details are below:\n\nLogin: ${config.urls.admin}\nEmail: ${createdAdmin.email}\nPassword: ${adminPassword}\n\nPlease keep these credentials safe and change your password after the first login.\n\nRegards,\n${company.name}`,
            event: 'company_admin_created',
            company: null,
          });
        }
      }
    } catch (err) {
      // non-blocking
    }
  }

  await log(req, 'company.created', 'Company', company._id, { name });
  await notifySA({
    superAdminId: req.superAdmin._id,
    type: 'company_created',
    message: `Company "${name}" created (${activePlan?.name || 'no plan'})`,
    link: `/companies/${company._id}`,
    companyId: company._id,
  });
  res.status(201).json({ success: true, data: company });
});

exports.updateCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) throw new ApiError(404, 'Company not found');
  const allowed = ['name', 'email', 'domain', 'logo', 'address', 'contactPerson', 'phone', 'billingCycle', 'autoRenew', 'settings'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) company[key] = req.body[key];
  }
  await company.save();
  await log(req, 'company.updated', 'Company', company._id, { name: company.name });
  await notifySA({
    superAdminId: req.superAdmin._id,
    type: 'company_updated',
    message: `Company "${company.name}" updated`,
    link: `/companies/${company._id}`,
    companyId: company._id,
  });
  res.json({ success: true, data: company });
});

exports.deleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) throw new ApiError(404, 'Company not found');
  await company.deleteOne();
  await log(req, 'company.deleted', 'Company', req.params.id, { name: company.name });
  await notifyAllSAs({
    type: 'company_deleted',
    message: `Company "${company.name}" deleted`,
    link: '/companies',
  });
  res.json({ success: true, message: 'Company deleted' });
});

exports.changeCompanyStatus = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) throw new ApiError(404, 'Company not found');
  const { status } = req.body;
  if (!['active', 'suspended', 'expired', 'archived', 'trial'].includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }
  company.status = status;
  await company.save();
  await log(req, `company.${status}`, 'Company', company._id, { name: company.name });
  await notifySA({
    superAdminId: req.superAdmin._id,
    type: 'company_status_changed',
    message: `Company "${company.name}" status changed to ${status}`,
    link: `/companies/${company._id}`,
    companyId: company._id,
  });
  res.json({ success: true, data: company });
});

exports.changeCompanyPlan = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) throw new ApiError(404, 'Company not found');
  const { plan, billingCycle, autoRenew } = req.body;
  const planDoc = plan ? await Plan.findById(plan) : null;
  if (plan && !planDoc) throw new ApiError(404, 'Plan not found');
  if (planDoc) {
    company.plan = planDoc._id;
    company.planStartedAt = new Date();
    company.planExpiresAt = new Date(
      Date.now() + (billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000
    );
    if (company.status === 'expired' || company.status === 'suspended') company.status = 'active';
  }
  if (billingCycle) company.billingCycle = billingCycle;
  if (autoRenew !== undefined) company.autoRenew = autoRenew;
  await company.save();
  await log(req, 'company.plan_changed', 'Company', company._id, {
    name: company.name,
    plan: planDoc?.name || null,
  });
  await notifySA({
    superAdminId: req.superAdmin._id,
    type: 'company_plan_changed',
    message: `Company "${company.name}" switched to ${planDoc?.name || 'no plan'}`,
    link: `/companies/${company._id}`,
    companyId: company._id,
  });
  res.json({ success: true, data: company });
});

// ---------------- Subscriptions & Payments ----------------

exports.listInvoices = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = getPagination(req);
  const q = {};
  if (req.query.status) q.status = req.query.status;
  if (req.query.companyId) q.company = req.query.companyId;
  const [items, total] = await Promise.all([
    Invoice.find(q).populate('company', 'name').populate('plan', 'name').sort(getSortObj(sort)).skip(skip).limit(limit),
    Invoice.countDocuments(q),
  ]);
  res.json({ success: true, data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

exports.createCheckoutOrder = asyncHandler(async (req, res) => {
  const { companyId, planId, billingCycle } = req.body;
  if (!config.razorpay.enabled) throw new ApiError(400, 'Razorpay is not configured');
  const company = await Company.findById(companyId);
  if (!company) throw new ApiError(404, 'Company not found');
  const plan = await Plan.findById(planId);
  if (!plan) throw new ApiError(404, 'Plan not found');
  const cycle = billingCycle || company.billingCycle || 'monthly';
  const amount = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const periodEnd = new Date(Date.now() + (cycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);

  if (!amount) {
    const invoice = await Invoice.create({
      invoiceNumber: `INV-${Date.now().toString().slice(-10)}`,
      company: company._id,
      plan: plan._id,
      description: `${plan.name} plan (${cycle}) for ${company.name}`,
      amount: 0,
      status: 'paid',
      paymentMethod: 'offline',
      periodStart: new Date(),
      periodEnd,
      paidAt: new Date(),
      createdBy: req.superAdmin._id,
    });
    company.plan = plan._id;
    company.status = 'active';
    company.planStartedAt = new Date();
    company.planExpiresAt = periodEnd;
    company.trialEndsAt = null;
    await company.save();
    await log(req, 'payment.verified', 'Invoice', invoice._id, { amount: 0 });
    return res.json({
      success: true,
      data: {
        orderId: '',
        amount: 0,
        currency: 'INR',
        keyId: config.razorpay.keyId,
        invoiceId: invoice._id,
        company,
        plan,
      },
    });
  }

  const order = await razorpay.createOrder({
    amount,
    currency: 'INR',
    receipt: `sub_${company._id.toString().slice(-8)}_${Date.now().toString().slice(-6)}`,
    notes: { companyId: String(company._id), planId: String(plan._id), billingCycle: cycle },
  });

  const invoice = await Invoice.create({
    invoiceNumber: `INV-${order.receipt}`,
    company: company._id,
    plan: plan._id,
    description: `${plan.name} plan (${cycle}) for ${company.name}`,
    amount,
    status: 'pending',
    periodStart: new Date(),
    periodEnd,
    razorpayOrderId: order.id,
    createdBy: req.superAdmin._id,
  });

  res.json({
    success: true,
    data: {
      orderId: order.id,
      amount,
      currency: 'INR',
      keyId: config.razorpay.keyId,
      invoiceId: invoice._id,
      company,
      plan,
    },
  });
});

exports.verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, paymentId, signature, invoiceId } = req.body;
  if (!razorpay.verifyPayment({ orderId, paymentId, signature })) {
    throw new ApiError(400, 'Payment verification failed');
  }
  const invoice = invoiceId ? await Invoice.findById(invoiceId) : await Invoice.findOne({ razorpayOrderId: orderId });
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  invoice.status = 'paid';
  invoice.razorpayPaymentId = paymentId;
  invoice.razorpaySignature = signature;
  invoice.paidAt = new Date();
  await invoice.save();

  const company = await Company.findById(invoice.company);
  if (company) {
    company.plan = invoice.plan || company.plan;
    company.status = 'active';
    company.planStartedAt = new Date();
    company.planExpiresAt = new Date(Date.now() + (company.billingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);
    company.trialEndsAt = null;
    await company.save();
  }

  await log(req, 'payment.verified', 'Invoice', invoice._id, { orderId, paymentId });
  await notifyAllSAs({
    type: 'payment_received',
    message: `Payment received for ${company?.name || 'a company'} (INR ${invoice.amount})`,
    link: '/invoices',
    companyId: company?._id,
  });
  res.json({ success: true, data: invoice });
});

exports.razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.get('x-razorpay-signature') || '';
  const raw = req.rawBody || JSON.stringify(req.body);
  if (!raw || !razorpay.verifyWebhookSignature(raw, signature)) {
    throw new ApiError(400, 'Invalid webhook signature');
  }
  const event = req.body.event;
  if (event === 'payment.captured' || event === 'order.paid') {
    const payload = req.body.payload?.payment?.entity || req.body.payload?.order?.entity || {};
    const orderId = payload.order_id || payload.id || '';
    const paymentId = payload.id || '';
    const invoice = await Invoice.findOne({ razorpayOrderId: orderId });
    if (invoice && invoice.status !== 'paid') {
      invoice.status = 'paid';
      invoice.razorpayPaymentId = paymentId;
      invoice.paidAt = new Date();
      await invoice.save();
      const company = await Company.findById(invoice.company);
      if (company) {
        company.status = 'active';
        company.trialEndsAt = null;
        await company.save();
      }
      await notifyAllSAs({
        type: 'payment_received',
        message: `Payment received via Razorpay for ${company?.name || 'a company'} (INR ${invoice.amount})`,
        link: '/invoices',
        companyId: company?._id,
      });
    }
  }
  res.json({ success: true, received: true });
});

// ---------------- Impersonation ----------------

exports.impersonateCompanyAdmin = asyncHandler(async (req, res) => {
  const { companyId } = req.body;
  const company = await Company.findById(companyId);
  if (!company) throw new ApiError(404, 'Company not found');
  const admin = await Agent.findOne({ company: companyId, isAdmin: true, isActive: true }).sort({ createdAt: 1 });
  if (!admin) throw new ApiError(404, 'No admin agent found for this company');
  const token = signToken({ id: admin._id, type: 'agent' });
  await log(req, 'impersonation.company_admin', 'Company', companyId, { agent: admin.email });
  res.json({ success: true, token, user: admin });
});

exports.listCompanyAdmins = asyncHandler(async (req, res) => {
  const agents = await Agent.find({ company: req.params.id, isAdmin: true })
    .select('name email isActive lastLogin')
    .sort({ createdAt: 1 });
  res.json({ success: true, data: agents });
});

// ---------------- Super Admin management ----------------

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

// ---------------- Global settings ----------------

exports.getSettings = asyncHandler(async (req, res) => {
  const SystemSetting = require('../models/SystemSetting');
  const settings = await SystemSetting.getSettings();
  res.json({ success: true, data: settings });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const SystemSetting = require('../models/SystemSetting');
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

// ---------------- Notifications ----------------

exports.notifications = asyncHandler(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find({ recipientType: 'superadmin', recipient: req.superAdmin._id })
      .populate('company', 'name')
      .sort({ createdAt: -1 })
      .limit(50),
    Notification.countDocuments({ recipientType: 'superadmin', recipient: req.superAdmin._id, read: false }),
  ]);
  res.json({ success: true, items, unread });
});

exports.markNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipientType: 'superadmin', recipient: req.superAdmin._id, read: false },
    { $set: { read: true } }
  );
  res.json({ success: true, message: 'Notifications marked as read' });
});

exports.markNotificationRead = asyncHandler(async (req, res) => {
  await Notification.updateOne(
    { _id: req.params.id, recipientType: 'superadmin', recipient: req.superAdmin._id },
    { $set: { read: true } }
  );
  res.json({ success: true, message: 'Notification marked as read' });
});

exports.globalStats = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  const base = companyId ? { company: companyId } : {};
  const [totalTickets, openTickets, closedTickets, users, agents] = await Promise.all([
    Ticket.countDocuments(base),
    Ticket.countDocuments({ ...base, status: { $in: ['open', 'assigned', 'overdue'] } }),
    Ticket.countDocuments({ ...base, status: { $in: ['closed', 'archived'] } }),
    User.countDocuments(companyId ? base : {}),
    Agent.countDocuments(companyId ? base : {}),
  ]);
  res.json({ success: true, data: { totalTickets, openTickets, closedTickets, users, agents } });
});
