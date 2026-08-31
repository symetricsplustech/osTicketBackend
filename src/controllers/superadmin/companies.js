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
exports.getCompanyStructure = asyncHandler(async (req, res) => {
  const Department = require('../../models/Department');
  const Team = require('../../models/Team');
  const Role = require('../../models/Role');
  const Organization = require('../../models/Organization');
  const { ObjectId } = require('mongoose');

  const company = await Company.findById(req.params.id).populate('plan', 'name code');
  if (!company) throw new ApiError(404, 'Company not found');
  const comp = { company: company._id };

  // Get activated modules for this tenant
  const mongoose2 = require('mongoose');
  const tenantModules = await mongoose2.connection.db.collection('tenant_modules')
    .find({ tenantId: new mongoose2.Types.ObjectId(company._id) })
    .toArray();
  const activeModules = tenantModules.filter(m => m.status === 'active').map(m => m.moduleKey);

  const [departments, teams, roles, agents, users, orgs] = await Promise.all([
    Department.find(comp).populate('manager', 'name email').populate('autoAssignAgent', 'name').sort({ name: 1 }),
    Team.find(comp).populate('lead', 'name email').populate('members', 'name email').sort({ name: 1 }),
    Role.find(comp).sort({ name: 1 }),
    Agent.find(comp).populate('role', 'name isAdmin').populate('departments.department', 'name').populate('teams', 'name').populate('skills', 'name').sort({ name: 1 }),
    User.find(comp).populate('organization', 'name').sort({ name: 1 }),
    Organization.find(comp).sort({ name: 1 }),
  ]);

  const agentIds = agents.map((a) => a._id);
  const userIds = users.map((u) => u._id);

  const [agentTicketCounts, userTicketCounts, openAgentTickets] = await Promise.all([
    Ticket.aggregate([
      { $match: { agent: { $in: agentIds }, company: company._id } },
      { $group: { _id: '$agent', total: { $sum: 1 } } },
    ]),
    Ticket.aggregate([
      { $match: { user: { $in: userIds }, company: company._id } },
      { $group: { _id: '$user', total: { $sum: 1 }, open: { $sum: { $cond: [{ $in: ['$status', ['open', 'assigned', 'overdue']] }, 1, 0] } } } },
    ]),
    Ticket.aggregate([
      { $match: { agent: { $in: agentIds }, status: { $in: ['open', 'assigned', 'overdue'] }, company: company._id } },
      { $group: { _id: '$agent', total: { $sum: 1 } } },
    ]),
  ]);
  const agentTickets = Object.fromEntries(agentTicketCounts.map((x) => [String(x._id), x.total]));
  const agentOpen = Object.fromEntries(openAgentTickets.map((x) => [String(x._id), x.total]));
  const userTickets = Object.fromEntries(userTicketCounts.map((x) => [String(x._id), { total: x.total, open: x.open }]));

  res.json({
    success: true,
    data: {
      company: { _id: company._id, name: company.name, domain: company.domain, status: company.status, plan: company.plan?.name || null },
      activeModules,
      counts: {
        departments: departments.length,
        teams: teams.length,
        roles: roles.length,
        agents: agents.length,
        customers: users.length,
        organizations: orgs.length,
        openTickets: Object.values(userTickets).reduce((s, x) => s + x.open, 0),
        tickets: Object.values(userTickets).reduce((s, x) => s + x.total, 0),
      },
      departments: departments.map((d) => ({
        _id: d._id, name: d.name, parent: d.parent || null, isPublic: d.isPublic,
        manager: d.manager ? { _id: d.manager._id, name: d.manager.name } : null,
        autoAssignAgent: d.autoAssignAgent ? { _id: d.autoAssignAgent._id, name: d.autoAssignAgent.name } : null,
      })),
      teams: teams.map((t) => ({
        _id: t._id, name: t.name, notes: t.notes,
        lead: t.lead ? { _id: t.lead._id, name: t.lead.name } : null,
        members: (t.members || []).map((m) => ({ _id: m._id, name: m.name })),
      })),
      roles: roles.map((r) => ({
        _id: r._id, name: r.name, isAdmin: r.isAdmin, permissionCount: (r.permissions || []).length,
      })),
      agents: agents.map((a) => ({
        _id: a._id, name: a.name, email: a.email, isAdmin: a.isAdmin, isActive: a.isActive,
        role: a.role ? { _id: a.role._id, name: a.role.name } : null,
        departments: (a.departments || [])
          .filter((d) => d.department)
          .map((d) => ({ _id: d.department._id, name: d.department.name, isPrimary: !!d.isPrimary })),
        teams: (a.teams || []).map((t) => ({ _id: t._id, name: t.name })),
        skills: (a.skills || []).map((s) => s.name),
        tickets: agentTickets[String(a._id)] || 0,
        openTickets: agentOpen[String(a._id)] || 0,
      })),
      users: users.map((u) => ({
        _id: u._id, name: u.name, email: u.email, phone: u.phone || '', status: u.status,
        isRegistered: u.isRegistered, emailConfirmed: u.emailConfirmed, lastLogin: u.lastLogin || null,
        organization: u.organization ? { _id: u.organization._id, name: u.organization.name } : null,
        tickets: userTickets[String(u._id)]?.total || 0,
        openTickets: userTickets[String(u._id)]?.open || 0,
      })),
      organizations: orgs.map((o) => ({
        _id: o._id, name: o.name, domain: o.domain || '', customers: users.filter((u) => String(u.organization?._id) === String(o._id)).length,
      })),
    },
  });
});
exports.createCompany = asyncHandler(async (req, res) => {
  const { name, email, domain, plan, billingCycle, trialDays, adminEmail, adminPassword, modules } = req.body;
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
  const finalAdminEmail = adminEmail || `admin@${(name || 'company').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
  const finalAdminPassword = adminPassword || require('crypto').randomBytes(12).toString('base64url');
  createdAdmin = await Agent.create({
    name: 'Company Administrator',
    email: finalAdminEmail.toLowerCase(),
    password: finalAdminPassword,
    company: company._id,
    isAdmin: true,
    isActive: true,
    permissions: ['admin.manage', 'access.manage', 'tickets.manage', 'users.manage', 'settings.manage', 'reports.manage'],
  });

  if (createdAdmin) {
    const ctx = {
      user: { name: createdAdmin.name, email: createdAdmin.email, first: 'Company' },
      account: { email: createdAdmin.email, password: finalAdminPassword },
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
          body: `Dear ${createdAdmin.name},\n\nYour company "${company.name}" has been registered and an administrator account has been created for you.\n\nLogin: ${config.urls.admin}\nEmail: ${createdAdmin.email}\nPassword: ${finalAdminPassword}\n\nPlease sign in to the Administrator Panel and change your password after your first login.\n\nRegards,\n${company.name}`,
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

  // Activate selected modules for the tenant
  const moduleKeys = Array.isArray(modules) && modules.length > 0 ? modules : (activePlan?.moduleKeys || []);
  if (moduleKeys.length > 0) {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const tenantObjectId = new mongoose.Types.ObjectId(company._id);
    const now = new Date();
    for (const key of moduleKeys) {
      await db.collection('tenant_modules').updateOne(
        { tenantId: tenantObjectId, moduleKey: key },
        { $set: { status: 'active', activatedAt: now, updatedAt: now }, $setOnInsert: { tenantId: tenantObjectId, moduleKey: key, createdAt: now } },
        { upsert: true }
      );
    }
  }

  await log(req, 'company.created', 'Company', company._id, { name, modules: moduleKeys });
  await notifySA({
    superAdminId: req.superAdmin._id,
    type: 'company_created',
    message: `Company "${name}" created (${activePlan?.name || 'no plan'})`,
    link: `/companies/${company._id}`,
    companyId: company._id,
  });
  res.status(201).json({
    success: true,
    data: {
      ...company.toObject(),
      admin: createdAdmin ? { email: createdAdmin.email, password: finalAdminPassword } : null,
    },
  });
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

  const companyId = company._id;
  const mongoose = require('mongoose');
  const db = mongoose.connection.db;

  // Clean up all tenant-related data
  const Agent = require('../../models/Agent');
  const User = require('../../models/User');
  const Department = require('../../models/Department');
  const Team = require('../../models/Team');
  const Role = require('../../models/Role');
  const Organization = require('../../models/Organization');
  const Ticket = require('../../models/Ticket');
  const Notification = require('../../models/Notification');
  const Invoice = require('../../models/Invoice');

  await Promise.all([
    Agent.deleteMany({ company: companyId }),
    User.deleteMany({ company: companyId }),
    Department.deleteMany({ company: companyId }),
    Team.deleteMany({ company: companyId }),
    Role.deleteMany({ company: companyId }),
    Organization.deleteMany({ company: companyId }),
    Ticket.deleteMany({ company: companyId }),
    Notification.deleteMany({ company: companyId }),
    Invoice.deleteMany({ company: companyId }),
    db.collection('tenant_modules').deleteMany({ tenantId: new mongoose.Types.ObjectId(companyId) }),
    db.collection('audit_events').deleteMany({ companyId: new mongoose.Types.ObjectId(companyId) }),
  ]);

  await company.deleteOne();
  await log(req, 'company.deleted', 'Company', companyId, { name: company.name });
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

exports.listCompanyAdmins = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) throw new ApiError(404, 'Company not found');
  const admins = await Agent.find({ company: company._id, isAdmin: true, isActive: true })
    .populate('role', 'name isAdmin')
    .select('name email isAdmin isActive role lastLogin')
    .sort({ name: 1 });
  res.json({ success: true, data: admins });
});

exports.updateCompanyModules = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) throw new ApiError(404, 'Company not found');

  const { modules } = req.body;
  if (!Array.isArray(modules)) throw new ApiError(400, 'modules must be an array');

  const VALID_MODULES = [
    'helpdesk', 'crm', 'csm', 'itam', 'itom', 'projects', 'hr', 'field-service',
    'workflow', 'analytics', 'ai', 'settings', 'cmdb', 'secops', 'grc',
    'workplace', 'legal', 'procurement', 'finance', 'esg',
  ];

  const mongoose = require('mongoose');
  const db = mongoose.connection.db;
  const tenantObjectId = new mongoose.Types.ObjectId(company._id);
  const now = new Date();

  // Deactivate all existing modules first
  await db.collection('tenant_modules').updateMany(
    { tenantId: tenantObjectId },
    { $set: { status: 'inactive', updatedAt: now } }
  );

  // Activate selected modules
  const activated = [];
  for (const key of modules) {
    if (!VALID_MODULES.includes(key)) continue;
    await db.collection('tenant_modules').updateOne(
      { tenantId: tenantObjectId, moduleKey: key },
      { $set: { status: 'active', activatedAt: now, updatedAt: now }, $setOnInsert: { tenantId: tenantObjectId, moduleKey: key, createdAt: now } },
      { upsert: true }
    );
    activated.push(key);
  }

  await log(req, 'company.modules_updated', 'Company', company._id, { name: company.name, modules: activated });

  res.json({ success: true, data: { companyId: company._id, modules: activated } });
});
