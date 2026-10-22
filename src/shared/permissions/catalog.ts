export interface PermissionDefinition {
  code: string;
  name: string;
  module: string;
  description: string;
}

function def(
  module: string,
  code: string,
  name: string,
  description: string,
): PermissionDefinition {
  return { code, name, module, description };
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  def(
    "dashboard",
    "admin.dashboard.read",
    "View dashboard",
    "View platform dashboard summaries, charts, alerts and work queue.",
  ),

  def(
    "tenants",
    "admin.tenants.read",
    "View tenants",
    "View tenant lists, details, users, activity and health.",
  ),
  def(
    "tenants",
    "admin.tenants.create",
    "Create tenants",
    "Create new tenant organizations and trigger provisioning.",
  ),
  def(
    "tenants",
    "admin.tenants.update",
    "Update tenants",
    "Update tenant profile, contact details, timezone and metadata.",
  ),
  def(
    "tenants",
    "admin.tenants.suspend",
    "Suspend tenants",
    "Suspend, reactivate and archive tenants.",
  ),
  def(
    "tenants",
    "admin.tenants.provision",
    "Provision tenants",
    "Start or retry tenant provisioning.",
  ),
  def(
    "tenants",
    "admin.tenants.impersonate",
    "Request support access",
    "Request audited, time-limited support access to a tenant.",
  ),
  def(
    "tenants",
    "admin.tenants.domains.read",
    "View tenant domains",
    "View custom domains and verification status.",
  ),
  def(
    "tenants",
    "admin.tenants.domains.manage",
    "Manage tenant domains",
    "Add, verify, activate, disable and remove tenant domains.",
  ),

  def(
    "staff",
    "admin.staff.read",
    "View staff",
    "View internal platform staff directory and activity.",
  ),
  def(
    "staff",
    "admin.staff.manage",
    "Manage staff",
    "Invite, activate, suspend, deactivate staff and revoke sessions.",
  ),
  def(
    "staff",
    "admin.staff.privileged",
    "Manage privileged roles",
    "Assign or remove highly privileged platform roles.",
  ),

  def(
    "roles",
    "admin.roles.read",
    "View roles",
    "View platform roles and their permission sets.",
  ),
  def(
    "roles",
    "admin.roles.manage",
    "Manage roles",
    "Create, update and delete platform roles and role permissions.",
  ),
  def(
    "permissions",
    "admin.permissions.read",
    "View permissions",
    "View the platform permission catalog.",
  ),

  def(
    "access-policies",
    "admin.access-policies.read",
    "View access policies",
    "View access policies and assignments.",
  ),
  def(
    "access-policies",
    "admin.access-policies.manage",
    "Manage access policies",
    "Create, update, enable and disable access policies.",
  ),

  def(
    "approvals",
    "admin.approvals.read",
    "View approvals",
    "View approval policies, requests and histories.",
  ),
  def(
    "approvals",
    "admin.approvals.manage",
    "Manage approval policies",
    "Create and update approval policies.",
  ),
  def(
    "approvals",
    "admin.approvals.act",
    "Act on approvals",
    "Approve, reject or cancel approval requests.",
  ),

  def(
    "service-management",
    "admin.service-management.read",
    "View service management",
    "View service definitions, categories, templates and assignments.",
  ),
  def(
    "service-management",
    "admin.service-management.manage",
    "Manage service management",
    "Create and publish services, categories and templates, and assign tenant services.",
  ),

  def(
    "sla-management",
    "admin.sla-management.read",
    "View SLA management",
    "View SLA policies, calendars, escalation rules and assignments.",
  ),
  def(
    "sla-management",
    "admin.sla-management.manage",
    "Manage SLA management",
    "Create and update SLA policies, business calendars and escalation rules.",
  ),

  def(
    "workflow-management",
    "admin.workflow-management.read",
    "View workflow management",
    "View workflow templates, versions, runs and assignments.",
  ),
  def(
    "workflow-management",
    "admin.workflow-management.manage",
    "Manage workflow management",
    "Create, validate, publish and retire workflow templates and assign tenant workflows.",
  ),

  def(
    "itsm-configuration",
    "admin.itsm-configuration.read",
    "View ITSM configuration",
    "View modules, priorities, statuses, categories, numbering rules and tenant overrides.",
  ),
  def(
    "itsm-configuration",
    "admin.itsm-configuration.manage",
    "Manage ITSM configuration",
    "Update global ITSM defaults and tenant overrides.",
  ),

  def(
    "knowledge-management",
    "admin.knowledge-management.read",
    "View knowledge management",
    "View knowledge policies, categories, templates and review rules.",
  ),
  def(
    "knowledge-management",
    "admin.knowledge-management.manage",
    "Manage knowledge management",
    "Manage knowledge governance configuration and tenant settings.",
  ),

  def(
    "cmdb-assets",
    "admin.cmdb-assets.read",
    "View CMDB & asset configuration",
    "View CI types, relationship types, asset categories and discovery profiles.",
  ),
  def(
    "cmdb-assets",
    "admin.cmdb-assets.manage",
    "Manage CMDB & asset configuration",
    "Create and update CMDB schemas, asset categories and discovery profiles.",
  ),

  def(
    "email-notifications",
    "admin.email-notifications.read",
    "View email & notifications",
    "View providers, templates, rules and delivery logs.",
  ),
  def(
    "email-notifications",
    "admin.email-notifications.manage",
    "Manage email & notifications",
    "Configure providers, templates and notification rules.",
  ),
  def(
    "email-notifications",
    "admin.email-notifications.test",
    "Test email delivery",
    "Send test messages and verify provider connections.",
  ),

  def(
    "integrations",
    "admin.integrations.read",
    "View integrations",
    "View integration configurations and logs.",
  ),
  def(
    "integrations",
    "admin.integrations.manage",
    "Manage integrations",
    "Create, update, test, enable and disable integrations.",
  ),

  def(
    "api-keys",
    "admin.api-keys.read",
    "View API keys",
    "View API key metadata and usage.",
  ),
  def(
    "api-keys",
    "admin.api-keys.manage",
    "Manage API keys",
    "Create, rotate and revoke API keys and reveal secrets once.",
  ),

  def(
    "webhooks",
    "admin.webhooks.read",
    "View webhooks",
    "View webhook endpoints and delivery logs.",
  ),
  def(
    "webhooks",
    "admin.webhooks.manage",
    "Manage webhooks",
    "Create, update, test, enable and disable webhooks and rotate secrets.",
  ),

  def(
    "support",
    "admin.support.read",
    "View support",
    "View platform support tickets, queues and histories.",
  ),
  def(
    "support",
    "admin.support.manage",
    "Manage support",
    "Create, assign, reply, resolve and reopen support tickets and manage queues.",
  ),

  def(
    "reports",
    "admin.reports.read",
    "View reports",
    "View the report catalog, previous runs and aggregate analytics.",
  ),
  def(
    "reports",
    "admin.reports.run",
    "Run reports",
    "Run authorized reports and view results.",
  ),
  def(
    "reports",
    "admin.reports.export",
    "Export reports",
    "Request exports and download completed report files.",
  ),

  def(
    "audit",
    "admin.audit.read",
    "View audit & security logs",
    "Search audit, security and login events.",
  ),
  def(
    "audit",
    "admin.audit.export",
    "Export audit logs",
    "Request authorized audit log exports.",
  ),

  def(
    "system-administration",
    "admin.system-administration.read",
    "View system administration",
    "View service health, queues, jobs and version information.",
  ),
  def(
    "system-administration",
    "admin.system-administration.manage",
    "Manage system administration",
    "Retry or cancel jobs and manage maintenance mode.",
  ),

  def(
    "platform-settings",
    "admin.settings.read",
    "View platform settings",
    "View platform settings, branding, localization, security and retention configuration.",
  ),
  def(
    "platform-settings",
    "admin.settings.manage",
    "Manage platform settings",
    "Update platform settings, branding, security policy, retention and feature flags.",
  ),
];

export const ALL_PERMISSION_CODES: string[] = PERMISSION_CATALOG.map(
  (permission) => permission.code,
);

const catalogIndex = new Map(
  PERMISSION_CATALOG.map((permission) => [permission.code, permission]),
);

export function isKnownPermission(code: string): boolean {
  return catalogIndex.has(code);
}

export function permissionsByModule(): Record<string, PermissionDefinition[]> {
  const grouped: Record<string, PermissionDefinition[]> = {};
  for (const permission of PERMISSION_CATALOG) {
    grouped[permission.module] = grouped[permission.module] ?? [];
    grouped[permission.module]!.push(permission);
  }
  return grouped;
}

export interface SystemRoleTemplate {
  key: string;
  name: string;
  description: string;
  permissions: string[] | "*";
}

const readOnly = PERMISSION_CATALOG.filter(
  (permission) =>
    permission.code.endsWith(".read") || permission.code.endsWith(".run"),
).map((permission) => permission.code);

export const SYSTEM_ROLE_TEMPLATES: SystemRoleTemplate[] = [
  {
    key: "platform-owner",
    name: "Platform Owner",
    description:
      "Full control over the platform, including privileged staff and platform settings.",
    permissions: "*",
  },
  {
    key: "platform-admin",
    name: "Platform Administrator",
    description:
      "Administrative control of tenants, staff and configuration, excluding owner-only privileges.",
    permissions: ALL_PERMISSION_CODES.filter(
      (code) => code !== "admin.staff.privileged",
    ),
  },
  {
    key: "security-auditor",
    name: "Security Auditor",
    description:
      "Read-only access to security, audit and administrative reporting surfaces.",
    permissions: [
      "admin.audit.read",
      "admin.audit.export",
      "admin.dashboard.read",
      "admin.staff.read",
      "admin.roles.read",
      "admin.permissions.read",
      "admin.access-policies.read",
      "admin.settings.read",
      "admin.system-administration.read",
      "admin.reports.read",
      "admin.reports.run",
      "admin.reports.export",
    ],
  },
  {
    key: "support-manager",
    name: "Support Manager",
    description:
      "Manages platform support tickets and has read access to tenant operations.",
    permissions: [
      "admin.dashboard.read",
      "admin.support.read",
      "admin.support.manage",
      "admin.tenants.read",
      "admin.tenants.impersonate",
      "admin.reports.read",
      "admin.reports.run",
    ],
  },
  {
    key: "read-only-analyst",
    name: "Read-only Analyst",
    description:
      "Read-only visibility across the platform administration surface.",
    permissions: readOnly,
  },
];
