const express = require("express");
const { body, param, query } = require("express-validator");
const validate = require("../middleware/validate");
const { protectTenantPrincipal, requirePermission } = require("../middleware/auth");
const { getTenantModules, activateModules, deactivateModule } = require("../middleware/module");
const ctrl = require("../controllers/instance.controller");
const companies = require("../controllers/instance/companies");
const departments = require("../controllers/instance/departments");
const teams = require("../controllers/instance/teams");
const members = require("../controllers/instance/members");
const hierarchyCtrl = require("../controllers/instance/hierarchy");
const delegationsCtrl = require("../controllers/instance/delegations");
const accessCtrl = require("../controllers/instance/access");
const activityCtrl = require("../controllers/instance/activity");
const ApiError = require("../utils/ApiError");
const organizationUnits = require("../controllers/admin/organizationUnits");
const { allCanonicalKeys } = require("../permissions/itsmCatalog");
const domains = require("../controllers/instance/domains");
const emailChannels = require("../controllers/instance/emailChannels");
const preferences = require("../controllers/instance/preferences");

const router = express.Router();

// All instance routes require authentication
router.use(protectTenantPrincipal);

// Create a new instance
router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Instance name is required"),
    body("domain").notEmpty().withMessage("Domain is required"),
    body("companyName").optional().isString(),
    body("companyEmail").optional().isEmail(),
  ],
  validate,
  ctrl.createInstance
);

// Get current user's instances
router.get("/my-instances", ctrl.getMyInstances);
router.post("/:instanceId/select", ctrl.selectInstance);
router.get("/:instanceId/companies", companies.list);
router.get("/:instanceId/companies/:companyId", companies.get);
router.post("/:instanceId/companies", [
  body("name").isString().trim().notEmpty(),
  body("email").optional({ values: "falsy" }).isEmail(),
  body("domain").optional().isString(),
  body("phone").optional().isString(),
  body("address").optional().isString(),
], validate, companies.create);
router.put("/:instanceId/companies/:companyId", [
  body("name").optional().isString().trim().notEmpty(),
  body("email").optional({ values: "falsy" }).isEmail(),
  body("domain").optional().isString(),
  body("phone").optional().isString(),
  body("address").optional().isString(),
  body("status").optional().isIn(["active", "inactive"]),
], validate, companies.update);

const requireOrganizationAdmin = (req, res, next) => {
  const membership = req.user?.instanceMemberships?.find(
    (item) => String(item.instance) === req.params.instanceId && item.status === "active",
  );
  if (String(req.companyId) !== req.params.instanceId ||
      !["instance_owner", "instance_admin"].includes(membership?.role)) {
    return res.status(403).json({ success: false, message: "Instance admin membership required" });
  }
  next();
};

router.use("/:instanceId/departments", requireOrganizationAdmin);
router.get("/:instanceId/departments", departments.list);
router.get("/:instanceId/departments/:departmentId", departments.get);
router.post("/:instanceId/departments", [
  body("name").isString().trim().notEmpty(),
  body("status").optional().isIn(["active", "inactive"]),
], validate, departments.create);
router.put("/:instanceId/departments/:departmentId", [
  body("name").optional().isString().trim().notEmpty(),
  body("status").optional().isIn(["active", "inactive"]),
], validate, departments.update);
router.delete("/:instanceId/departments/:departmentId", departments.delete);
router.put("/:instanceId/departments/:departmentId/organization-unit", [
  body("organizationUnit").optional({ nullable: true }).isUUID(),
], validate, departments.linkUnit);

router.use("/:instanceId/teams", requireOrganizationAdmin);
router.get("/:instanceId/teams", teams.list);
router.get("/:instanceId/teams/:teamId", teams.get);
router.post("/:instanceId/teams", [
  body("name").isString().trim().notEmpty(),
  body("members").optional().isArray(),
], validate, teams.create);
router.put("/:instanceId/teams/:teamId", [
  body("name").optional().isString().trim().notEmpty(),
  body("members").optional().isArray(),
], validate, teams.update);
router.delete("/:instanceId/teams/:teamId", teams.delete);
router.put("/:instanceId/teams/:teamId/organization-unit", [
  body("organizationUnit").optional({ nullable: true }).isUUID(),
], validate, teams.linkUnit);

const agents = require("../controllers/instance/agents");
router.use("/:instanceId/agents", requireOrganizationAdmin);
router.get("/:instanceId/agents", agents.list);
router.get("/:instanceId/agents/:agentId", agents.get);
router.post("/:instanceId/agents", [
  body("name").isString().trim().notEmpty(),
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  body("isAdmin").optional().isBoolean(),
  body("isActive").optional().isBoolean(),
], validate, agents.create);
router.put("/:instanceId/agents/:agentId", [
  body("name").optional().isString().trim().notEmpty(),
  body("email").optional().isEmail(),
  body("isAdmin").optional().isBoolean(),
  body("isActive").optional().isBoolean(),
], validate, agents.update);
router.delete("/:instanceId/agents/:agentId", agents.delete);

const roles = require("../controllers/instance/roles");
router.use("/:instanceId/roles", requireOrganizationAdmin);
router.get("/:instanceId/roles", roles.list);
router.get("/:instanceId/roles/:roleId", roles.get);
router.post("/:instanceId/roles", [
  body("name").isString().trim().notEmpty(),
  body("permissions").optional().isArray(),
  body("description").optional().isString(),
  body("isActive").optional().isBoolean(),
], validate, roles.create);
router.put("/:instanceId/roles/:roleId", [
  body("name").optional().isString().trim().notEmpty(),
  body("description").optional().isString(),
  body("permissions").optional().isArray(),
  body("isActive").optional().isBoolean(),
], validate, roles.update);
router.delete("/:instanceId/roles/:roleId", roles.delete);
router.use("/:instanceId/organization-unit-types", requireOrganizationAdmin);
router.get("/:instanceId/organization-unit-types", organizationUnits.listTypes);
router.post("/:instanceId/organization-unit-types", organizationUnits.createType);
router.delete("/:instanceId/organization-unit-types/:type", organizationUnits.removeType);
router.use("/:instanceId/organization-units", requireOrganizationAdmin);
router.get("/:instanceId/organization-units", organizationUnits.list);
router.post("/:instanceId/organization-units", organizationUnits.create);
router.put("/:instanceId/organization-units/:id", organizationUnits.update);
router.delete("/:instanceId/organization-units/:id", organizationUnits.remove);
router.get("/:instanceId/permission-options", requireOrganizationAdmin, (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();
  const items = query.length < 2 ? [] : allCanonicalKeys().filter((key) => key.includes(query)).slice(0, 30);
  res.json({ success: true, items });
});
router.use("/:instanceId/members", requireOrganizationAdmin);
router.get("/:instanceId/members", members.list);
router.put("/:instanceId/members/:userId/organization-unit", [
  body("organizationUnit").optional({ nullable: true }).isUUID(),
], validate, members.place);

// ─── User hierarchy: directory, reporting line, engineer profile ──────
const requireInstanceScope = (req, res, next) => {
  if (req.superAdmin) return next();
  if (String(req.companyId) !== String(req.params.instanceId)) {
    return next(new ApiError(403, "Instance scope mismatch"));
  }
  next();
};

router.get(
  "/:instanceId/directory",
  requireInstanceScope,
  requirePermission("tenant.user.read"),
  accessCtrl.directory,
);

router.get(
  "/:instanceId/me/effective-access",
  requireInstanceScope,
  accessCtrl.myEffectiveAccess,
);
router.get(
  "/:instanceId/users/:userId/effective-access",
  requireInstanceScope,
  requirePermission("tenant.permission.read"),
  accessCtrl.effectiveAccessForUser,
);

router.get(
  "/:instanceId/reporting-lines/direct-reports",
  requireInstanceScope,
  requirePermission("tenant.user.read"),
  hierarchyCtrl.listDirectReports,
);
router.get(
  "/:instanceId/users/:userId/reporting-line",
  requireInstanceScope,
  requirePermission("tenant.user.read"),
  hierarchyCtrl.getReportingLine,
);
router.put(
  "/:instanceId/users/:userId/reporting-line",
  requireInstanceScope,
  requirePermission("tenant.user.update"),
  [
    body("managerUserId").optional({ nullable: true }).isUUID(),
    body("teamLeadUserId").optional({ nullable: true }).isUUID(),
    body("delegatedManagerUserId").optional({ nullable: true }).isUUID(),
    body("effectiveFrom").optional({ nullable: true }).isISO8601(),
    body("effectiveTo").optional({ nullable: true }).isISO8601(),
    body("notes").optional({ nullable: true }).isString(),
  ],
  validate,
  hierarchyCtrl.setReportingLine,
);
router.delete(
  "/:instanceId/users/:userId/reporting-line",
  requireInstanceScope,
  requirePermission("tenant.user.update"),
  hierarchyCtrl.clearReportingLine,
);
router.get(
  "/:instanceId/users/:userId/reporting-chain",
  requireInstanceScope,
  requirePermission("tenant.user.read"),
  hierarchyCtrl.getReportingChain,
);

router.get(
  "/:instanceId/users/:userId/engineer-profile",
  requireInstanceScope,
  requirePermission("tenant.user.read"),
  hierarchyCtrl.getEngineerProfile,
);
router.put(
  "/:instanceId/users/:userId/engineer-profile",
  requireInstanceScope,
  requirePermission("tenant.user.update"),
  [
    body("availability").optional().isObject(),
    body("skills").optional().isArray(),
    body("territories").optional().isArray(),
    body("schedule").optional().isObject(),
    body("notes").optional({ nullable: true }).isString(),
  ],
  validate,
  hierarchyCtrl.upsertEngineerProfile,
);

// ─── Delegated access ─────────────────────────────────────────────────
router.get(
  "/:instanceId/delegations",
  requireInstanceScope,
  requirePermission("tenant.permission.read"),
  delegationsCtrl.list,
);
router.post(
  "/:instanceId/delegations",
  requireInstanceScope,
  requirePermission("tenant.permission.grant"),
  [
    body("delegatorUserId").optional({ nullable: true }).isUUID(),
    body("delegateUserId").isUUID(),
    body("permissions").optional().isArray(),
    body("roleIds").optional().isArray(),
    body("scope").optional().isObject(),
    body("reason").optional({ nullable: true }).isString(),
    body("startsAt").optional({ nullable: true }).isISO8601(),
    body("expiresAt").optional({ nullable: true }).isISO8601(),
  ],
  validate,
  delegationsCtrl.create,
);
router.delete(
  "/:instanceId/delegations/:delegationId",
  requireInstanceScope,
  requirePermission("tenant.permission.revoke"),
  delegationsCtrl.revoke,
);

// ─── Assigned work, work history and sessions / MFA ───────────────────
router.get(
  "/:instanceId/users/:userId/assigned-work",
  requireInstanceScope,
  requirePermission("tenant.user.read"),
  activityCtrl.assignedWork,
);
router.get(
  "/:instanceId/users/:userId/work-history",
  requireInstanceScope,
  requirePermission("tenant.user.read"),
  activityCtrl.workHistory,
);
router.get(
  "/:instanceId/users/:userId/sessions",
  requireInstanceScope,
  requirePermission("tenant.user.read"),
  activityCtrl.sessions,
);
router.delete(
  "/:instanceId/users/:userId/sessions/:sessionId",
  requireInstanceScope,
  requirePermission("tenant.user.update"),
  activityCtrl.revokeSession,
);

// Get instance details
router.get("/:instanceId", ctrl.getInstance);

// Accept instance invitation
router.post(
  "/:instanceId/invitations",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("role").isIn(["instance_admin", "agent", "requester"]),
    body("organizationUnit").optional({ nullable: true }).isUUID(),
    body("permissions").optional().isArray({ max: 200 }),
  ],
  validate,
  ctrl.createInvitation
);

router.post(
  "/:instanceId/accept-invitation",
  [
    body("token").isHexadecimal().isLength({ min: 64, max: 64 }),
  ],
  validate,
  ctrl.acceptInvitation
);

// Update instance membership (for instance admins)
router.put(
  "/:instanceId/members/:userId",
  [
    body("role").notEmpty().withMessage("Role is required"),
    body("permissions").optional().isArray(),
  ],
  validate,
  ctrl.updateMember
);

// Remove member from instance
router.delete(
  "/:instanceId/members/:userId",
  ctrl.removeMember
);

// Update instance settings
router.put(
  "/:instanceId",
  [
    body("name").optional().isString(),
    body("domain").optional().isString(),
    body("status").optional().isIn(["active", "inactive", "suspended"]),
  ],
  validate,
  ctrl.updateInstance
);

// ─── User Preferences ─────────────────────────────────────────────────
// Per-user, so these are available to any signed-in principal rather than
// being gated behind the organization-admin middleware used by the other
// instance sub-resources.
router.get("/:instanceId/preferences", preferences.list);
router.put(
  "/:instanceId/preferences",
  [
    body("locale").optional({ nullable: true }).isString(),
    body("timezone").optional({ nullable: true }).isString(),
  ],
  validate,
  preferences.update,
);
router.get("/:instanceId/preferences/locales", preferences.locales);

// Activate/deactivate modules for instance
router.get("/:instanceId/modules", getTenantModules);
router.post("/:instanceId/modules", activateModules);
router.delete("/:instanceId/modules/:moduleKey", deactivateModule);

// ─── Custom Domain Routes ──────────────────────────────────────────────
router.use("/:instanceId/domains", requireOrganizationAdmin);
router.get("/:instanceId/domains", requirePermission("instance.domain.read"), domains.listDomains);
router.post("/:instanceId/domains", [
  body("hostname").isFQDN().withMessage("Valid hostname required"),
  body("verification_method").optional().isIn(["txt", "cname"]),
], validate, requirePermission("instance.domain.add"), domains.addDomain);
router.get("/:instanceId/domains/:domainId", [
  param("domainId").isUUID(),
], validate, requirePermission("instance.domain.read"), domains.getDomain);
router.post("/:instanceId/domains/:domainId/verify", [
  param("domainId").isUUID(),
], validate, requirePermission("instance.domain.verify"), domains.verifyDomain);
router.post("/:instanceId/domains/:domainId/activate", [
  param("domainId").isUUID(),
  body("is_primary").optional().isBoolean(),
], validate, requirePermission("instance.domain.activate"), domains.activateDomain);
router.post("/:instanceId/domains/:domainId/set-primary", [
  param("domainId").isUUID(),
], validate, requirePermission("instance.domain.set_primary"), domains.setPrimaryDomain);
router.post("/:instanceId/domains/:domainId/disable", [
  param("domainId").isUUID(),
], validate, requirePermission("instance.domain.disable"), domains.disableDomain);
router.delete("/:instanceId/domains/:domainId", [
  param("domainId").isUUID(),
], validate, requirePermission("instance.domain.delete"), domains.deleteDomain);

// ─── Email Channel Routes ──────────────────────────────────────────────
router.use("/:instanceId/email-channels", requireOrganizationAdmin);
router.get("/:instanceId/email-channels", requirePermission("instance.email.channel.read"), emailChannels.listChannels);
router.post("/:instanceId/email-channels", [
  body("name").notEmpty().withMessage("Channel name required"),
  body("inbound_address").isEmail().withMessage("Valid inbound email address required"),
  body("type").optional().isIn(["platform_managed", "customer_owned"]),
  body("verification_method").optional().isIn(["txt", "cname"]),
], validate, requirePermission("instance.email.channel.configure"), emailChannels.createChannel);
router.get("/:instanceId/email-channels/:channelId", [
  param("channelId").isUUID(),
], validate, requirePermission("instance.email.channel.read"), emailChannels.getChannel);
router.put("/:instanceId/email-channels/:channelId", [
  param("channelId").isUUID(),
], validate, requirePermission("instance.email.channel.configure"), emailChannels.updateChannel);
router.post("/:instanceId/email-channels/:channelId/verify", [
  param("channelId").isUUID(),
], validate, requirePermission("instance.email.channel.verify"), emailChannels.verifyChannel);
router.post("/:instanceId/email-channels/:channelId/activate", [
  param("channelId").isUUID(),
], validate, requirePermission("instance.email.channel.configure"), emailChannels.activateChannel);
router.post("/:instanceId/email-channels/:channelId/disable", [
  param("channelId").isUUID(),
], validate, requirePermission("instance.email.channel.disable"), emailChannels.disableChannel);
router.delete("/:instanceId/email-channels/:channelId", [
  param("channelId").isUUID(),
], validate, requirePermission("instance.email.channel.configure"), emailChannels.deleteChannel);

// Inbound Actions
router.get("/:instanceId/email-channels/:channelId/inbound-actions", [
  param("channelId").isUUID(),
], validate, requirePermission("instance.email.inbound_action.read"), emailChannels.listInboundActions);
router.post("/:instanceId/email-channels/:channelId/inbound-actions", [
  param("channelId").isUUID(),
  body("name").notEmpty(),
  body("trigger").optional().isIn(["new_ticket", "reply", "forward", "all"]),
  body("action_type").optional().isIn(["create_incident", "create_request", "create_task", "update_record", "run_workflow"]),
], validate, requirePermission("instance.email.inbound_action.manage"), emailChannels.createInboundAction);
router.put("/:instanceId/email-channels/:channelId/inbound-actions/:actionId", [
  param("channelId").isUUID(),
  param("actionId").isUUID(),
], validate, requirePermission("instance.email.inbound_action.manage"), emailChannels.updateInboundAction);
router.delete("/:instanceId/email-channels/:channelId/inbound-actions/:actionId", [
  param("channelId").isUUID(),
  param("actionId").isUUID(),
], validate, requirePermission("instance.email.inbound_action.manage"), emailChannels.deleteInboundAction);

// Sender Configs
router.get("/:instanceId/email-channels/:channelId/sender-configs", [
  param("channelId").isUUID(),
], validate, requirePermission("instance.email.sender.read"), emailChannels.listSenderConfigs);
router.post("/:instanceId/email-channels/:channelId/sender-configs", [
  param("channelId").isUUID(),
  body("name").notEmpty(),
  body("from_address").isEmail(),
], validate, requirePermission("instance.email.sender.manage"), emailChannels.createSenderConfig);
router.put("/:instanceId/email-channels/:channelId/sender-configs/:configId", [
  param("channelId").isUUID(),
  param("configId").isUUID(),
], validate, requirePermission("instance.email.sender.manage"), emailChannels.updateSenderConfig);
router.delete("/:instanceId/email-channels/:channelId/sender-configs/:configId", [
  param("channelId").isUUID(),
  param("configId").isUUID(),
], validate, requirePermission("instance.email.sender.manage"), emailChannels.deleteSenderConfig);

// Delivery Logs
router.get("/:instanceId/email-channels/:channelId/delivery-logs", [
  param("channelId").isUUID(),
  query("status").optional().isIn(["sent", "delivered", "bounced", "complained", "failed", "deferred"]),
  query("limit").optional().isInt({ min: 1, max: 200 }),
  query("offset").optional().isInt({ min: 0 }),
], validate, requirePermission("instance.email.delivery_log.read"), emailChannels.listDeliveryLogs);

// Message Audit
router.get("/:instanceId/email-channels/:channelId/message-audit", [
  param("channelId").isUUID(),
  query("action").optional().isIn(["created_ticket", "updated_ticket", "created_request", "updated_request", "skipped", "bounced", "error"]),
  query("limit").optional().isInt({ min: 1, max: 200 }),
  query("offset").optional().isInt({ min: 0 }),
], validate, requirePermission("instance.email.message_audit.read"), emailChannels.listMessageAudit);

module.exports = router;
