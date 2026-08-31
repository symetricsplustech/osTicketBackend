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
