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
const mongoose = require("mongoose");
const crypto = require("crypto");

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

exports.createInstance = asyncHandler(async (req, res) => {
  const { name, domain, companyName, companyEmail } = req.body;
  const user = req.user;

  // Check if user is a platform user (no company) or has platform permissions
  const isPlatformUser = !user.company;
  const isPlatformAdmin = user.role === "superadmin";

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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create the instance (Company with instance flag)
    const company = await Company.create([{
      name,
      domain: domain.toLowerCase(),
      instanceCode,
      email: companyEmail || user.email,
      supportEmail: companyEmail || `support@${domain}`,
      status: "active",
      billingCycle: "monthly",
      planStartedAt: new Date(),
      planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: user._id,
      isInstance: true,
      instanceOwner: user._id,
    }], { session });

    const instance = company[0];

    // Create instance membership for the creator (Instance Owner/Admin)
    const membership = {
      user: user._id,
      instance: instance._id,
      role: "instance_owner",
      status: "active",
      joinedAt: new Date(),
      invitedBy: user._id,
    };
    await User.updateOne(
      { _id: user._id },
      { $addToSet: { instanceMemberships: membership } },
      { session }
    );

    // Add instance to user's instanceMemberships
    user.instanceMemberships = user.instanceMemberships || [];
    user.instanceMemberships.push(membership);

    // Create default roles
    const roles = [];
    for (const r of DEFAULT_ROLES) {
      const role = await Role.create([{
        ...r,
        company: instance._id,
        scope: "instance",
      }], { session });
      roles.push(role[0]);
    }

    // Create default departments
    const departments = [];
    for (const d of DEFAULT_DEPARTMENTS) {
      const dept = await Department.create([{
        ...d,
        company: instance._id,
      }], { session });
      departments.push(dept[0]);
    }

    // Create default SLA plans
    const slaPlans = [];
    for (const s of DEFAULT_SLA_PLANS) {
      const sla = await SlaPlan.create([{
        ...s,
        company: instance._id,
      }], { session });
      slaPlans.push(sla[0]);
    }

    // Create default teams
    const supportTeam = await Team.create([{
      name: "Support Team",
      notes: "Front-line support",
      company: instance._id,
      members: [user._id],
      lead: user._id,
    }], { session });

    const techTeam = await Team.create([{
      name: "Technical Team",
      notes: "Escalation team",
      company: instance._id,
      members: [user._id],
      lead: user._id,
    }], { session });

    // Create default help topics
    const generalTopic = await HelpTopic.create([{
      topic: "General Inquiry",
      category: "Support",
      department: departments.find(d => d.name === "Support")?._id,
      priority: "Normal",
      sla: slaPlans.find(s => s.name === "Business Hours")?._id,
      autoAssignTeam: supportTeam[0]?._id,
      isPublic: true,
      company: instance._id,
    }], { session });

    // Create system settings
    await SystemSetting.setSetting("company.name", name);
    await SystemSetting.setSetting("company.email", companyEmail || user.email);
    await SystemSetting.setSetting("company.url", `https://${domain}`);
    await SystemSetting.setSetting("system.defaultDept", String(departments.find(d => d.name === "Support")?._id));
    await SystemSetting.setSetting("system.defaultSla", String(slaPlans.find(s => s.name === "Business Hours")?._id));
    await SystemSetting.setSetting("system.defaultPriority", "Normal");
    await SystemSetting.setSetting("system.autoLockTickets", true);
    await SystemSetting.setSetting("system.ticketLockMinutes", 5);
    await SystemSetting.setSetting("system.allowTicketReopen", true);
    await SystemSetting.setSetting("system.emailToTicket", config.email.user);
    await SystemSetting.setSetting("tickets.autoResponder", true);
    await SystemSetting.setSetting("tickets.autoAssign", true);
    await SystemSetting.setSetting("tickets.notifyNewTicketToDept", true);
    await SystemSetting.setSetting("autoresponder.enabled", true);
    await SystemSetting.setSetting("autoresponder.subject", "Ticket received - [ticket.number]");
    await SystemSetting.setSetting("alerts.notifyNewTicket", true);
    await SystemSetting.setSetting("alerts.notifyAssignment", true);
    await SystemSetting.setSetting("auth.registrationEnabled", true);
    await SystemSetting.setSetting("auth.allowGuestTickets", true);
    await SystemSetting.setSetting("auth.passwordMinLength", 8);
    await SystemSetting.setSetting("schedules.timezone", "UTC");
    await SystemSetting.setSetting("routing.algorithm", "skill_based");
    await SystemSetting.setSetting("csat.enabled", true);

    // Activate default modules for this instance
    const db = mongoose.connection.db;
    const now = new Date();
    for (const key of DEFAULT_TENANT_MODULES) {
      await db.collection("tenant_modules").updateOne(
        { tenantId: instance._id, moduleKey: key },
        {
          $set: { status: "active", activatedAt: now, updatedAt: now },
          $setOnInsert: { tenantId: instance._id, moduleKey: key, createdAt: now },
        },
        { upsert: true, session },
      );
    }

    await session.commitTransaction();

    // Return instance info
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
      },
      message: "Instance created successfully. You are now the Instance Owner.",
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

exports.getMyInstances = asyncHandler(async (req, res) => {
  const user = req.user;
  const memberships = user.instanceMemberships || [];

  if (!memberships.length) {
    return res.json({ success: true, instances: [] });
  }

  const instanceIds = memberships.map(m => m.instance);
  const instances = await Company.find({ _id: { $in: instanceIds }, isInstance: true })
    .select("name domain instanceCode status createdAt");

  const result = memberships.map(m => {
    const inst = instances.find(i => String(i._id) === String(m.instance));
    return inst ? {
      _id: inst._id,
      name: inst.name,
      domain: inst.domain,
      instanceCode: inst.instanceCode,
      status: inst.status,
      createdAt: inst.createdAt,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    } : null;
  }).filter(Boolean);

  res.json({ success: true, instances: result });
});

exports.getInstance = asyncHandler(async (req, res) => {
  const { instanceId } = req.params;
  const user = req.user;

  // Check if user has membership in this instance
  const membership = (user.instanceMemberships || []).find(
    m => String(m.instance) === instanceId
  );
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

exports.acceptInvitation = asyncHandler(async (req, res) => {
  const { instanceId } = req.params;
  const { role = "agent" } = req.body;
  const user = req.user;

  // Check if already a member
  const existing = (user.instanceMemberships || []).find(
    m => String(m.instance) === instanceId
  );
  if (existing) {
    throw new ApiError(409, "You are already a member of this instance");
  }

  const instance = await Company.findOne({ _id: instanceId, isInstance: true });
  if (!instance) {
    throw new ApiError(404, "Instance not found");
  }

  // Check if invitation exists (could be by email match or explicit invitation)
  // For now, allow any authenticated user to join if they have the link
  // In production, you'd check an explicit invitation token

  const membership = {
    user: user._id,
    instance: instanceId,
    role,
    status: "active",
    joinedAt: new Date(),
  };

  await User.updateOne(
    { _id: user._id },
    { $addToSet: { instanceMemberships: membership } }
  );

  res.json({
    success: true,
    message: "Successfully joined instance",
    instance: {
      _id: instance._id,
      name: instance.name,
      domain: instance.domain,
      role,
    },
  });
});

exports.updateMember = asyncHandler(async (req, res) => {
  const { instanceId, userId } = req.params;
  const { role, permissions } = req.body;
  const currentUser = req.user;

  // Check if current user is instance admin/owner
  const currentMembership = (currentUser.instanceMemberships || []).find(
    m => String(m.instance) === instanceId
  );
  if (!currentMembership || !["instance_owner", "instance_admin"].includes(currentMembership.role)) {
    throw new ApiError(403, "Only instance admins can update members");
  }

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
  const currentMembership = (currentUser.instanceMemberships || []).find(
    m => String(m.instance) === instanceId
  );
  if (!currentMembership || !["instance_owner", "instance_admin"].includes(currentMembership.role)) {
    throw new ApiError(403, "Only instance admins can remove members");
  }

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
  const currentMembership = (currentUser.instanceMemberships || []).find(
    m => String(m.instance) === instanceId
  );
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