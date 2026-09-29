const Company = require("../models/Company");
const User = require("../models/User");
const Agent = require("../models/Agent");
const Role = require("../models/Role");
const Organization = require("../models/Organization");
const Department = require("../models/Department");
const Team = require("../models/Team");
const SlaPlan = require("../models/SlaPlan");
const HelpTopic = require("../models/HelpTopic");
const EmailTemplate = require("../models/EmailTemplate");
const SystemSetting = require("../models/SystemSetting");
const { nextTicketNumber } = require("../services/numbering.service");
const { computeDueDate } = require("../services/sla.service");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { signToken } = require("../middleware/auth");
const crypto = require("crypto");
const config = require("../config/config");
const InstanceInvitation = require("../models/InstanceInvitation");
const InstanceCompany = require("../models/InstanceCompany");
const { runWithTenant } = require("../middleware/tenantScope");
const { nameKey } = require("../services/companyHierarchy.service");
const { isInstancePermission, permissionsForMembership } = require("../services/instanceAccess.service");
const { assertActiveUnit } = require("../services/instancePlacement.service");
const { isCanonicalKey } = require("../permissions/itsmCatalog");

const membershipFor = (user, instanceId) =>
  (user.instanceMemberships || []).find(
    (membership) => String(membership.instance) === String(instanceId) && membership.status === "active",
  );
const requireInstanceAdmin = (user, instanceId) => {
  const membership = membershipFor(user, instanceId);
  if (!membership || !["instance_owner", "instance_admin"].includes(membership.role))
    throw new ApiError(403, "Active instance admin membership required");
  return membership;
};

const DEFAULT_TENANT_MODULES = ["helpdesk", "settings"];

// Generate a unique instance code from name
const generateInstanceCode = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 30);
};

// Default roles for new instance
const DEFAULT_ROLES = [
  {
    name: "Instance Admin",
    isAdmin: true,
    permissions: [
      "admin.manage",
      "access.manage",
      "roles.manage",
      "users.manage",
      "tickets.view",
      "tickets.create",
      "tickets.edit",
      "tickets.assign",
      "tickets.transfer",
      "tickets.close",
      "tickets.delete",
      "tickets.reply",
      "tickets.note",
      "tickets.tasks",
      "kb.manage",
      "canned.manage",
      "orgs.manage",
      "escalations.manage",
      "reports.manage",
      "audit.view",
      "modules.manage",
      "organization.manage",
      "organization.units.manage",
    ],
  },
  {
    name: "Support Agent",
    isAdmin: false,
    permissions: [
      "tickets.view",
      "tickets.create",
      "tickets.edit",
      "tickets.assign",
      "tickets.transfer",
      "tickets.close",
      "tickets.reply",
      "tickets.note",
      "tickets.tasks",
      "users.manage",
      "canned.manage",
      "kb.manage",
    ],
  },
  {
    name: "Technician",
    isAdmin: false,
    permissions: [
      "tickets.view",
      "tickets.reply",
      "tickets.note",
      "tickets.assign",
      "tickets.close",
      "tickets.tasks",
    ],
  },
];

// Default departments
const DEFAULT_DEPARTMENTS = [
  { name: "Support", isPublic: true, notes: "General customer support" },
  { name: "Billing", isPublic: true, notes: "Billing and invoicing" },
  { name: "Technical", isPublic: true, notes: "Deep technical issues" },
];

// Default SLA plans
const DEFAULT_SLA_PLANS = [
  { name: "24/7 Response", gracePeriod: 24, schedule: "24/7", notes: "First response within 24 hours, around the clock" },
  { name: "Business Hours", gracePeriod: 8, schedule: "Business Hours", notes: "First response within 8 business hours" },
  { name: "Critical Response", gracePeriod: 4, schedule: "24/7", notes: "Emergency response within 4 hours" },
];

exports.createInstance = asyncHandler(async (req, res) => runWithTenant(null, async () => {
  const { name, domain, companyName, companyEmail } = req.body;
  const user = req.user;

  // Check if user is a platform user (no company) or has platform permissions
  // Validate domain format
  if (!domain.includes(".")) {
    throw new ApiError(422, "Domain must be a valid domain (e.g., company.example.com)");
  }

  // Check if domain is already taken
  const existingCompany = await Company.findOne({ domain: domain.toLowerCase() });
  if (existingCompany) {
    throw new ApiError(409, "This domain is already in use");
  }

  const instanceCode = generateInstanceCode(name);

  // Check if instance code is unique
  const existingCode = await Company.findOne({ instanceCode });
  if (existingCode) {
    throw new ApiError(409, "An instance with a similar name already exists");
  }

  let instance;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { getDB } = require("../config/db");
    try {
      await getDB().transaction(async (trx) => {
    // Create the instance (Company with instance flag)
    const [instanceId] = await trx.insert({
      name,
      domain: domain.toLowerCase(),
      instance_code: instanceCode,
      email: companyEmail || user.email,
      support_email: companyEmail || `support@${domain}`,
      status: "active",
      billing_cycle: "monthly",
      plan_started_at: new Date(),
      plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      created_by_user: user._id,
      is_instance: true,
      instance_owner: user._id,
    }).into("companies").returning("*");

    instance = { ...instanceId, _id: instanceId.id, instanceCode: instanceId.instance_code, createdAt: instanceId.created_at };

    const primaryCompany = await trx.insert({
      tenant_id: instance._id,
      name: String(companyName || name).trim(),
      name_key: nameKey(companyName || name),
      domain: domain.toLowerCase(),
      email: companyEmail || user.email,
      is_primary: true,
      owner_user: user._id,
    }).into("instance_companies").returning("*");
    instance.primaryCompany = primaryCompany[0].id;
    await trx("companies").where({ id: instance._id }).update({ primary_company: instance.primaryCompany });

    // Create instance membership for the creator (Instance Owner/Admin)
    const membership = {
      instance: instance._id,
      role: "instance_owner",
      status: "active",
      joinedAt: new Date(),
      invitedBy: user._id,
    };
    await trx("users").where({ id: user._id }).update({
      instance_memberships: JSON.stringify([...(user.instanceMemberships || []), membership]),
    });

    // Create default roles
    const roles = [];
    for (const r of DEFAULT_ROLES) {
      const [role] = await trx("roles").insert({
        name: r.name, is_admin: r.isAdmin, permissions: JSON.stringify(r.permissions),
        company_id: instance._id, scope: "tenant",
      }).returning("*");
      roles.push({ ...role, _id: role.id });
    }

    // Create default departments
    const departments = [];
    for (const d of DEFAULT_DEPARTMENTS) {
      const [dept] = await trx("departments").insert({
        name: d.name, is_public: d.isPublic, notes: d.notes, company_id: instance._id,
      }).returning("*");
      departments.push({ ...dept, _id: dept.id });
    }

    // Create default SLA plans
    const slaPlans = [];
    for (const s of DEFAULT_SLA_PLANS) {
      const [sla] = await trx("sla_plans").insert({
        name: s.name, grace_period: s.gracePeriod, schedule: s.schedule,
        notes: s.notes, company_id: instance._id,
      }).returning("*");
      slaPlans.push({ ...sla, _id: sla.id });
    }

    // Create default teams
    const supportTeam = await trx("teams").insert({
      name: "Support Team", notes: "Front-line support", company_id: instance._id,
    }).returning("*");

    await trx("teams").insert({
      name: "Technical Team", notes: "Escalation team", company_id: instance._id,
    });

    // Create default help topics
    await trx("help_topics").insert({
      name: "General Inquiry",
      category: "Support",
      department_id: departments.find(d => d.name === "Support")?._id,
      priority: "Normal",
      sla_id: slaPlans.find(s => s.name === "Business Hours")?._id,
      auto_assign_team_id: supportTeam[0]?.id,
      is_public: true,
      company_id: instance._id,
    });

    // Instance defaults must not overwrite the global SystemSetting document.
    instance.settings = {
      system: {
        defaultDept: String(departments.find(d => d.name === "Support")?._id || ""),
        defaultSla: String(slaPlans.find(s => s.name === "Business Hours")?._id || ""),
        defaultPriority: "Normal",
      },
      auth: { passwordMinLength: 8 },
      schedules: { timezone: "UTC" },
    };
    await trx("companies").where({ id: instance._id }).update({ settings: JSON.stringify(instance.settings) });

    // Activate default modules for this instance
    const now = new Date();
    for (const key of DEFAULT_TENANT_MODULES) {
      await trx("tenant_modules").insert({
        tenant_id: instance._id,
        module_key: key,
        status: "active",
        activated_at: now,
        updated_at: now,
        created_at: now,
      }).onConflict(["tenant_id", "module_key"]).merge({
        status: "active",
        activated_at: now,
        updated_at: now,
      });
    }

      });
      break;
    } catch (err) {
      if (!err.hasErrorLabel?.("TransientTransactionError") || attempt === 2) throw err;
    }
  }

  res.status(201).json({
      success: true,
      instance: {
        _id: instance._id,
        name: instance.name,
        domain: instance.domain,
        instanceCode: instance.instanceCode,
        status: instance.status,
        createdAt: instance.createdAt,
        role: "instance_owner",
        primaryCompany: instance.primaryCompany,
      },
      message: "Instance created successfully. You are now the Instance Owner.",
  });
}));

exports.getMyInstances = asyncHandler(async (req, res) => {
  const user = req.user;
  const memberships = user.instanceMemberships || [];

  if (!memberships.length) {
    return res.json({ success: true, instances: [] });
  }

  const instanceIds = memberships.map(m => m.instance);
  const instances = await runWithTenant(null, async () =>
    Company.find({ _id: { $in: instanceIds }, isInstance: true })
      .select("name domain instanceCode status createdAt").exec(),
  );

  const result = memberships.map(m => {
    const inst = instances.find(i => String(i._id) === String(m.instance));
    return inst ? {
      _id: inst._id,
      name: inst.name,
      domain: inst.domain,
      instanceCode: inst.instanceCode,
        instanceStatus: inst.status,
        createdAt: inst.createdAt,
        role: m.role,
        membershipStatus: m.status,
      joinedAt: m.joinedAt,
    } : null;
  }).filter(Boolean);

  res.json({ success: true, instances: result });
});

exports.selectInstance = asyncHandler(async (req, res) => {
  if (!req.user || req.agent || req.superAdmin)
    throw new ApiError(403, "Platform user membership required");
  const membership = membershipFor(req.user, req.params.instanceId);
  if (!membership) throw new ApiError(403, "Active instance membership required");
  const instance = await runWithTenant(null, async () =>
    Company.findOne({ _id: req.params.instanceId, isInstance: true }).exec(),
  );
  if (!instance || !instance.isActive())
    throw new ApiError(403, "Instance is not active");
  const token = signToken({
    id: req.user._id, type: "user", tid: instance._id,
    sv: Number(req.user.sessionVersion || 0),
  });
  const { getDB: getDB2 } = require("../config/db");
  const moduleDocs = await getDB2()("tenant_modules")
    .where({ tenant_id: instance._id, status: "active" });
  res.json({
    success: true, token,
    instance: { _id: instance._id, name: instance.name, status: instance.status },
    role: membership.role,
    permissions: permissionsForMembership(membership),
    moduleKeys: moduleDocs.map((item) => item.module_key),
  });
});

exports.getInstance = asyncHandler(async (req, res) => {
  const { instanceId } = req.params;
  const user = req.user;

  // Check if user has membership in this instance
  const membership = membershipFor(user, instanceId);
  if (!membership) {
    throw new ApiError(403, "You are not a member of this instance");
  }

  const instance = await Company.findOne({ _id: instanceId, isInstance: true });
  if (!instance) {
    throw new ApiError(404, "Instance not found");
  }

  // Get members
  const members = await User.find({ "instanceMemberships.instance": instanceId })
    .select("name email instanceMemberships")
    .lean();

  const memberList = members.map(m => {
    const mem = (m.instanceMemberships || []).find(mi => String(mi.instance) === instanceId);
    return {
      _id: m._id,
      name: m.name,
      email: m.email,
      role: mem?.role,
      status: mem?.status,
      joinedAt: mem?.joinedAt,
    };
  });

  res.json({
    success: true,
    instance: {
      _id: instance._id,
      name: instance.name,
      domain: instance.domain,
      instanceCode: instance.instanceCode,
      status: instance.status,
      createdAt: instance.createdAt,
      email: instance.email,
      supportEmail: instance.supportEmail,
    },
    members: memberList,
    yourRole: membership.role,
  });
});

exports.createInvitation = asyncHandler(async (req, res) => {
  const { instanceId } = req.params;
  requireInstanceAdmin(req.user, instanceId);
  const instance = await Company.findOne({ _id: instanceId, isInstance: true });
  if (!instance || !instance.isActive()) throw new ApiError(404, "Active instance not found");
  const email = String(req.body.email || "").trim().toLowerCase();
  const role = req.body.role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !["instance_admin", "agent", "requester"].includes(role))
    throw new ApiError(422, "Valid email and assignable role are required");
  const permissions = req.body.permissions || [];
  if (!Array.isArray(permissions) || permissions.length > 200 ||
      !permissions.every((key) => isCanonicalKey(key)))
    throw new ApiError(422, "Choose valid Instance permission keys");
  const organizationUnit = await assertActiveUnit(instanceId, req.body.organizationUnit || null);
  const token = crypto.randomBytes(32).toString("hex");
  const invitation = await InstanceInvitation.create({
    instance: instance._id, email, role, permissions: [...new Set(permissions)], organizationUnit,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    invitedBy: req.user._id,
  });
  const invitationUrl = `${config.urls.client}/platform/invitations/${instanceId}?token=${token}`;
  const delivery = await require("../services/email.service").sendMail({
    to: email, subject: `Invitation to ${instance.name}`,
    body: `Accept your invitation within 7 days: ${invitationUrl}`,
    event: "instance_invitation", user: req.user._id, company: instance._id,
  });
  res.status(201).json({
    success: true, invitationId: invitation._id,
    ...(config.env !== "production" && delivery?.dev ? { invitationUrl } : {}),
  });
});

exports.acceptInvitation = asyncHandler(async (req, res) => runWithTenant(null, async () => {
  const { instanceId } = req.params;
  const user = req.user;
  const existing = membershipFor(user, instanceId);
  if (existing) {
    throw new ApiError(409, "You are already a member of this instance");
  }

  const instance = await Company.findOne({ _id: instanceId, isInstance: true });
  if (!instance) {
    throw new ApiError(404, "Instance not found");
  }

  const token = String(req.body.token || "");
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError(422, "Invitation token is required");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invitation = await InstanceInvitation.findOne({
    instance: instanceId, email: user.email, tokenHash,
    acceptedAt: null, expiresAt: { $gt: new Date() },
  });
  if (!invitation) throw new ApiError(403, "Invitation is invalid or expired");
  await assertActiveUnit(instanceId, invitation.organizationUnit);
  const membership = {
    instance: instanceId,
    role: invitation.role,
    permissions: invitation.permissions,
    status: "active",
    joinedAt: new Date(),
    invitedBy: invitation.invitedBy,
    organizationUnit: invitation.organizationUnit,
  };
  const updated = await User.updateOne(
    { _id: user._id, "instanceMemberships.instance": { $ne: instance._id } },
    { $push: { instanceMemberships: membership } },
  );
  if (!updated.modifiedCount) throw new ApiError(409, "You are already a member of this instance");
  invitation.acceptedAt = new Date();
  await invitation.save();

  res.json({
    success: true,
    message: "Successfully joined instance",
    instance: {
      _id: instance._id,
      name: instance.name,
      domain: instance.domain,
      role: invitation.role,
    },
  });
}));

exports.updateMember = asyncHandler(async (req, res) => {
  const { instanceId, userId } = req.params;
  const { role, permissions } = req.body;
  const currentUser = req.user;

  // Check if current user is instance admin/owner
  requireInstanceAdmin(currentUser, instanceId);
  if (!["instance_admin", "agent", "requester"].includes(role))
    throw new ApiError(422, "Invalid assignable role");
  if (permissions && (!Array.isArray(permissions) || !permissions.every(isInstancePermission)))
    throw new ApiError(422, "Only instance-scoped permissions can be assigned");

  // Can't change own role
  if (String(currentUser._id) === userId) {
    throw new ApiError(400, "Cannot change your own role");
  }

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  // Check if target is a member of this instance
  const targetMembership = (targetUser.instanceMemberships || []).find(
    m => String(m.instance) === instanceId
  );
  if (!targetMembership) {
    throw new ApiError(400, "User is not a member of this instance");
  }

  // Update membership
  targetMembership.role = role;
  if (permissions) targetMembership.permissions = permissions;
  await targetUser.save();

  res.json({ success: true, message: "Member updated", role });
});

exports.removeMember = asyncHandler(async (req, res) => {
  const { instanceId, userId } = req.params;
  const currentUser = req.user;

  // Check if current user is instance admin/owner
  const currentMembership = requireInstanceAdmin(currentUser, instanceId);

  // Can't remove yourself if you're the owner
  if (String(currentUser._id) === userId && currentMembership.role === "instance_owner") {
    throw new ApiError(400, "Instance owner cannot remove themselves. Transfer ownership first.");
  }

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  // Remove membership
  targetUser.instanceMemberships = (targetUser.instanceMemberships || []).filter(
    m => String(m.instance) !== instanceId
  );
  await targetUser.save();

  res.json({ success: true, message: "Member removed from instance" });
});

exports.updateInstance = asyncHandler(async (req, res) => {
  const { instanceId } = req.params;
  const { name, domain, status } = req.body;
  const currentUser = req.user;

  // Check if current user is instance owner
  const currentMembership = membershipFor(currentUser, instanceId);
  if (!currentMembership || currentMembership.role !== "instance_owner") {
    throw new ApiError(403, "Only instance owner can update instance settings");
  }

  const instance = await Company.findOne({ _id: instanceId, isInstance: true });
  if (!instance) {
    throw new ApiError(404, "Instance not found");
  }

  if (name) instance.name = name;
  if (domain) {
    // Check if new domain is available
    const existing = await Company.findOne({ domain: domain.toLowerCase(), _id: { $ne: instanceId } });
    if (existing) throw new ApiError(409, "Domain already in use");
    instance.domain = domain.toLowerCase();
  }
  if (status) instance.status = status;

  await instance.save();

  res.json({ success: true, instance, message: "Instance updated" });
});
