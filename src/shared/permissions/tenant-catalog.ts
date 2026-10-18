import type { PermissionDefinition } from './catalog';

/**
 * Tenant (Organization Admin) permission catalog.
 *
 * These definitions are the seed source of truth. The authoritative runtime
 * catalog lives in the `permissions` table (scope = TENANT) so tenant-scoped
 * roles can be composed dynamically. Platform permissions continue to live in
 * the static `catalog.ts`; this file only describes tenant capabilities.
 */

function tdef(module: string, code: string, name: string, description: string): PermissionDefinition {
  return { code, name, module, description };
}

export const TENANT_PERMISSION_CATALOG: PermissionDefinition[] = [
  tdef('dashboard', 'dashboard.read', 'View dashboard', 'View organization dashboard summaries, charts, alerts and work queues.'),

  tdef('organization', 'organization.read', 'View organization', 'View organization profile, branding, localization, business hours and numbering.'),
  tdef('organization', 'organization.update', 'Update organization', 'Update permitted organization profile settings.'),
  tdef('organization', 'organization.branding.manage', 'Manage branding', 'Manage organization logo, colors and branding assets.'),
  tdef('organization', 'organization.localization.manage', 'Manage localization', 'Manage organization locale, language, timezone and date formats.'),
  tdef('organization', 'organization.business_hours.manage', 'Manage business hours', 'Manage working hours, holidays and calendars.'),
  tdef('organization', 'organization.custom_fields.manage', 'Manage custom fields', 'Manage organization custom field definitions.'),

  tdef('customers', 'customers.read', 'View customers', 'View customers, contacts, sites and customer ticket history.'),
  tdef('customers', 'customers.manage', 'Create and manage customers', 'Create, update, activate and deactivate customers.'),
  tdef('customers', 'customers.contacts.manage', 'Manage customer contacts', 'Manage customer contacts and authorized access.'),
  tdef('customers', 'customers.sites.manage', 'Manage customer sites', 'Manage customer sites, data center locations and supported services.'),
  tdef('customers', 'customers.portal.manage', 'Manage customer portal access', 'Invite, resend and revoke customer portal access.'),
  tdef('customers', 'customers.export', 'Export customers', 'Export permitted customer information.'),

  tdef('users', 'users.read', 'View users', 'List and view tenant users and memberships.'),
  tdef('users', 'users.invite', 'Invite users', 'Invite new members to the organization.'),
  tdef('users', 'users.update', 'Update users', 'Update authorized user attributes.'),
  tdef('users', 'users.activate', 'Activate users', 'Activate invited or suspended users.'),
  tdef('users', 'users.suspend', 'Suspend users', 'Suspend users within the organization.'),
  tdef('users', 'users.deactivate', 'Deactivate users', 'Deactivate users within the organization.'),
  tdef('users', 'users.reset_password', 'Reset user password', 'Trigger password resets for organization users.'),
  tdef('users', 'users.revoke_sessions', 'Revoke user sessions', 'Revoke active sessions for organization users.'),
  tdef('users', 'users.roles.manage', 'Manage user roles', 'Assign and remove roles for organization users.'),
  tdef('users', 'users.import', 'Import users', 'Bulk import users from files.'),

  tdef('departments', 'departments.read', 'View departments', 'View departments and business units.'),
  tdef('departments', 'departments.manage', 'Manage departments', 'Create, update and delete departments.'),
  tdef('locations', 'locations.read', 'View locations', 'View locations and offices.'),
  tdef('locations', 'locations.manage', 'Manage locations', 'Create, update and delete locations.'),
  tdef('cost-centers', 'cost_centers.read', 'View cost centers', 'View cost centers.'),
  tdef('cost-centers', 'cost_centers.manage', 'Manage cost centers', 'Create, update and delete cost centers.'),
  tdef('organization-structure', 'organization_structure.read', 'View organization structure', 'View the organization reporting structure.'),
  tdef('organization-structure', 'organization_structure.manage', 'Manage organization structure', 'Update the organization reporting structure.'),
  tdef('access-reviews', 'access_reviews.read', 'View access reviews', 'View access review campaigns and items.'),
  tdef('access-reviews', 'access_reviews.manage', 'Manage access reviews', 'Create and complete access review campaigns and decisions.'),

  tdef('roles', 'roles.read', 'View roles', 'View tenant roles and their permission sets.'),
  tdef('roles', 'roles.create', 'Create roles', 'Create custom tenant roles.'),
  tdef('roles', 'roles.update', 'Update roles', 'Update tenant roles.'),
  tdef('roles', 'roles.delete', 'Delete roles', 'Delete custom tenant roles.'),
  tdef('roles', 'roles.permissions.manage', 'Manage role permissions', 'Assign permitted tenant permissions to roles.'),
  tdef('roles', 'roles.members.manage', 'Manage role members', 'Assign members to tenant roles.'),
  tdef('permissions', 'permissions.read', 'View permissions', 'View the tenant permission catalog.'),

  tdef('access-policies', 'access_policies.read', 'View access policies', 'View tenant access policies and assignments.'),
  tdef('access-policies', 'access_policies.manage', 'Manage access policies', 'Create, update, enable and disable tenant access policies.'),
  tdef('delegations', 'delegations.read', 'View delegations', 'View delegated administration assignments.'),
  tdef('delegations', 'delegations.manage', 'Manage delegations', 'Create and revoke delegated administration assignments.'),

  tdef('teams', 'teams.read', 'View teams', 'View teams, members, queues and workload.'),
  tdef('teams', 'teams.manage', 'Manage teams', 'Create, update and delete teams and team leads.'),
  tdef('teams', 'teams.members.manage', 'Manage team members', 'Add and remove team members and availability.'),
  tdef('teams', 'teams.queues.manage', 'Manage team queues', 'Assign queues to teams.'),

  tdef('service-desk', 'service_desk.read', 'View service desk', 'View service desk queues, routing and configuration.'),
  tdef('service-desk', 'service_desk.manage', 'Manage service desk', 'Manage queues, categories and operating hours.'),
  tdef('service-desk', 'service_desk.routing.manage', 'Manage routing rules', 'Create, test and enable ticket routing rules.'),

  tdef('incidents', 'incidents.read', 'View incidents', 'Read authorized incidents.'),
  tdef('incidents', 'incidents.create', 'Create incidents', 'Create incidents.'),
  tdef('incidents', 'incidents.update', 'Update incidents', 'Edit permitted incident fields.'),
  tdef('incidents', 'incidents.assign', 'Assign incidents', 'Assign and reassign incidents.'),
  tdef('incidents', 'incidents.escalate', 'Escalate incidents', 'Escalate incidents.'),
  tdef('incidents', 'incidents.resolve', 'Resolve incidents', 'Resolve and close incidents.'),
  tdef('incidents', 'incidents.reopen', 'Reopen incidents', 'Reopen resolved or closed incidents.'),
  tdef('incident-configuration', 'incident_configuration.read', 'View incident configuration', 'View incident categories, priority matrix, templates and resolution codes.'),
  tdef('incident-configuration', 'incident_configuration.manage', 'Manage incident configuration', 'Manage incident categories, priority matrix, templates and resolution codes.'),
  tdef('major-incidents', 'major_incidents.read', 'View major incidents', 'View major incidents and timelines.'),
  tdef('major-incidents', 'major_incidents.manage', 'Manage major incidents', 'Declare, manage and resolve major incidents.'),

  tdef('problems', 'problems.read', 'View problems', 'Read problems and their history.'),
  tdef('problems', 'problems.create', 'Create problems', 'Create problems.'),
  tdef('problems', 'problems.update', 'Update problems', 'Update and assign problems and investigations.'),
  tdef('problems', 'problems.resolve', 'Resolve problems', 'Resolve, close and review problems.'),
  tdef('known-errors', 'known_errors.read', 'View known errors', 'View known errors and workarounds.'),
  tdef('known-errors', 'known_errors.manage', 'Manage known errors', 'Create, publish and retire known errors.'),
  tdef('problem-configuration', 'problem_configuration.read', 'View problem configuration', 'View problem categories and root cause categories.'),
  tdef('problem-configuration', 'problem_configuration.manage', 'Manage problem configuration', 'Manage problem categories and root cause categories.'),

  tdef('changes', 'changes.read', 'View changes', 'Read change requests.'),
  tdef('changes', 'changes.create', 'Create changes', 'Create change requests.'),
  tdef('changes', 'changes.update', 'Update changes', 'Update and schedule change requests.'),
  tdef('changes', 'changes.approve', 'Approve changes', 'Approve or reject changes when authorized.'),
  tdef('changes', 'changes.implement', 'Implement changes', 'Start, implement, roll back and close changes.'),
  tdef('change-configuration', 'change_configuration.read', 'View change configuration', 'View change types, templates and CAB configuration.'),
  tdef('change-configuration', 'change_configuration.manage', 'Manage change configuration', 'Manage change types, templates and CAB configuration.'),
  tdef('change-calendar', 'change_calendar.read', 'View change calendar', 'View the change calendar, maintenance windows and blackout periods.'),
  tdef('change-calendar', 'change_calendar.manage', 'Manage change calendar', 'Manage maintenance windows and blackout periods.'),

  tdef('requests', 'requests.read', 'View requests', 'Read service requests.'),
  tdef('requests', 'requests.create', 'Create requests', 'Create service requests.'),
  tdef('requests', 'requests.update', 'Update requests', 'Update and assign service requests.'),
  tdef('requests', 'requests.approve', 'Approve requests', 'Approve or reject service requests.'),
  tdef('requests', 'requests.fulfill', 'Fulfill requests', 'Fulfill, cancel and close service requests.'),

  tdef('catalog', 'catalog.read', 'View catalog', 'View catalog categories, items and versions.'),
  tdef('catalog', 'catalog.manage', 'Manage catalog', 'Create and edit catalog categories, items and form schemas.'),
  tdef('catalog', 'catalog.publish', 'Publish catalog', 'Publish and retire catalog item versions.'),

  tdef('knowledge', 'knowledge.read', 'View knowledge', 'View knowledge bases, categories and articles.'),
  tdef('knowledge', 'knowledge.create', 'Create knowledge', 'Create and edit knowledge articles.'),
  tdef('knowledge', 'knowledge.review', 'Review knowledge', 'Submit, approve or reject knowledge articles for review.'),
  tdef('knowledge', 'knowledge.publish', 'Publish knowledge', 'Publish, archive and retire knowledge articles.'),
  tdef('knowledge', 'knowledge.settings.manage', 'Manage knowledge settings', 'Manage knowledge governance settings.'),

  tdef('sla', 'sla.read', 'View SLA', 'View SLA policies, calendars, records and performance.'),
  tdef('sla', 'sla.manage', 'Manage SLA', 'Configure tenant SLA policies, calendars and escalation rules.'),

  tdef('workflows', 'workflows.read', 'View workflows', 'View workflow definitions, versions and runs.'),
  tdef('workflows', 'workflows.manage', 'Manage workflows', 'Create, validate, publish and retire workflows and automation rules.'),
  tdef('automation', 'automation.read', 'View automation', 'View automation rules, runs and failures.'),
  tdef('automation', 'automation.manage', 'Manage automation', 'Create, test, enable and disable automation rules, and retry runs.'),

  tdef('cmdb', 'cmdb.read', 'View CMDB', 'View configuration items, relationships and business services.'),
  tdef('cmdb', 'cmdb.manage', 'Manage CMDB', 'Manage authorized CI records, types, relationships and reconciliation.'),

  tdef('assets', 'assets.read', 'View assets', 'View assets, models and assignments.'),
  tdef('assets', 'assets.manage', 'Manage assets', 'Manage tenant assets, assignments, maintenance and lifecycle.'),
  tdef('asset-configuration', 'asset_configuration.read', 'View asset configuration', 'View asset categories, models and licenses.'),
  tdef('asset-configuration', 'asset_configuration.manage', 'Manage asset configuration', 'Manage asset categories, models and licenses.'),

  tdef('discovery', 'discovery.read', 'View discovery', 'View discovery profiles, schedules, jobs and results.'),
  tdef('discovery', 'discovery.manage', 'Manage discovery', 'Manage discovery profiles, schedules, credentials and runs.'),

  tdef('on-call', 'on_call.read', 'View on-call', 'View on-call schedules, rotations and coverage.'),
  tdef('on-call', 'on_call.manage', 'Manage on-call', 'Manage on-call schedules, rotations, overrides and escalation policies.'),

  tdef('releases', 'releases.read', 'View releases', 'Read releases and release plans.'),
  tdef('releases', 'releases.manage', 'Manage releases', 'Create, schedule, approve and complete releases.'),

  tdef('notifications', 'notifications.read', 'View notifications', 'View notification templates, rules, preferences and delivery logs.'),
  tdef('notifications', 'notifications.manage', 'Manage notifications', 'Manage notification templates, rules and preferences.'),
  tdef('announcements', 'announcements.read', 'View announcements', 'View organization announcements.'),
  tdef('announcements', 'announcements.manage', 'Manage announcements', 'Create, publish and archive announcements.'),

  tdef('integrations', 'integrations.read', 'View integrations', 'View tenant integrations and logs.'),
  tdef('integrations', 'integrations.manage', 'Manage integrations', 'Configure, test, enable and disable tenant integrations.'),
  tdef('api-keys', 'api_keys.read', 'View API keys', 'View tenant API key metadata and usage.'),
  tdef('api-keys', 'api_keys.manage', 'Manage API keys', 'Create, rotate and revoke tenant API keys.'),
  tdef('webhooks', 'webhooks.read', 'View webhooks', 'View webhook endpoints and deliveries.'),
  tdef('webhooks', 'webhooks.manage', 'Manage webhooks', 'Create, test, enable and disable webhooks and rotate secrets.'),

  tdef('vendors', 'vendors.read', 'View vendors', 'View vendors, contracts and performance.'),
  tdef('vendors', 'vendors.manage', 'Manage vendors', 'Create and update vendors, contracts, services and reviews.'),

  tdef('reports', 'reports.read', 'View reports', 'View the report catalog and prior runs.'),
  tdef('reports', 'reports.run', 'Run reports', 'Run authorized reports and view results.'),
  tdef('reports', 'reports.export', 'Export reports', 'Export authorized report data.'),

  tdef('audit', 'audit.read', 'View audit', 'View authorized tenant audit, security and login events.'),
  tdef('audit', 'audit.export', 'Export audit', 'Request authorized audit log exports.'),

  tdef('security', 'security.read', 'View security', 'View security overview, sessions, alerts and policy status.'),
  tdef('security', 'security.sessions.revoke', 'Revoke sessions', 'Revoke permitted tenant sessions.'),
  tdef('security', 'security.manage', 'Manage security', 'Manage permitted tenant security settings and policies.'),

  tdef('imports', 'imports.read', 'View imports', 'View import jobs and errors.'),
  tdef('imports', 'imports.manage', 'Manage imports', 'Run, cancel and retry import jobs.'),
  tdef('exports', 'exports.read', 'View exports', 'View export jobs.'),
  tdef('exports', 'exports.manage', 'Manage exports', 'Run and cancel export jobs.'),
  tdef('attachments', 'attachments.read', 'View attachments', 'View and download authorized attachments.'),
  tdef('attachments', 'attachments.upload', 'Upload attachments', 'Upload attachments.'),
  tdef('attachments', 'attachments.delete', 'Delete attachments', 'Delete attachments.'),

  tdef('portal', 'portal.read', 'View portal', 'View employee portal configuration and forms.'),
  tdef('portal', 'portal.manage', 'Manage portal', 'Manage employee portal configuration and forms.'),

  tdef('support', 'support.read', 'View support', 'View support tickets raised with the platform operator.'),
  tdef('support', 'support.manage', 'Manage support', 'Create, reply to and reopen support tickets raised with the platform operator.'),

  tdef('approvals', 'approvals.read', 'View approvals', 'View approval policies, requests and history.'),
  tdef('approvals', 'approvals.manage', 'Manage approvals', 'Create and update approval policies and delegations.'),
  tdef('approvals', 'approvals.decide', 'Decide approvals', 'Approve or reject assigned approval requests.'),

  tdef('settings', 'settings.read', 'View settings', 'View allowed organization configuration.'),
  tdef('settings', 'settings.manage', 'Manage settings', 'Manage allowed organization configuration and feature availability.'),
];

export const ALL_TENANT_PERMISSION_CODES: string[] = TENANT_PERMISSION_CATALOG.map((permission) => permission.code);

const tenantCatalogIndex = new Map(TENANT_PERMISSION_CATALOG.map((permission) => [permission.code, permission]));

export function isKnownTenantPermission(code: string): boolean {
  return tenantCatalogIndex.has(code);
}

export function getTenantPermission(code: string): PermissionDefinition | undefined {
  return tenantCatalogIndex.get(code);
}

export function tenantPermissionsByModule(): Record<string, PermissionDefinition[]> {
  const grouped: Record<string, PermissionDefinition[]> = {};
  for (const permission of TENANT_PERMISSION_CATALOG) {
    grouped[permission.module] = grouped[permission.module] ?? [];
    grouped[permission.module]!.push(permission);
  }
  return grouped;
}

export interface TenantSystemRoleTemplate {
  key: string;
  name: string;
  description: string;
  permissions: string[] | '*';
}

const readCodes = TENANT_PERMISSION_CATALOG.filter((permission) => permission.code.endsWith('.read')).map(
  (permission) => permission.code,
);

const operationalManageCodes = TENANT_PERMISSION_CATALOG.filter(
  (permission) =>
    /^(incidents|problems|changes|requests|catalog|knowledge|sla|workflows|automation|cmdb|assets|discovery|on_call|releases|teams|service_desk)\./.test(
      permission.code,
    ) && !permission.code.endsWith('.read'),
).map((permission) => permission.code);

const agentCodes = TENANT_PERMISSION_CATALOG.filter((permission) =>
  /^(incidents|problems|requests|service_desk|knowledge)\./.test(permission.code),
).map((permission) => permission.code);

export const TENANT_SYSTEM_ROLE_TEMPLATES: TenantSystemRoleTemplate[] = [
  {
    key: 'org-admin',
    name: 'Organization Admin',
    description: 'Full control over the organization, its users, roles and ITSM configuration.',
    permissions: '*',
  },
  {
    key: 'itsm-admin',
    name: 'ITSM Admin',
    description: 'Administrative control of ITSM configuration and operations, excluding organization access control.',
    permissions: ALL_TENANT_PERMISSION_CODES.filter(
      (code) => !/^(roles|permissions|security|integrations|api_keys|webhooks|settings)\./.test(code) && !code.startsWith('users.roles'),
    ),
  },
  {
    key: 'itsm-manager',
    name: 'ITSM Manager',
    description: 'Manages ITSM operations, assignments, approvals and reporting.',
    permissions: Array.from(
      new Set([
        ...readCodes,
        ...operationalManageCodes,
        'approvals.decide',
        'approvals.read',
        'reports.run',
        'dashboard.read',
        'users.read',
        'teams.read',
      ]),
    ),
  },
  {
    key: 'itsm-agent',
    name: 'ITSM Agent',
    description: 'Works incidents, problems, requests and knowledge assigned to them.',
    permissions: Array.from(
      new Set([
        ...agentCodes.filter((code) => !code.endsWith('.read')),
        ...agentCodes.filter((code) => code.endsWith('.read')),
        'dashboard.read',
        'teams.read',
        'knowledge.create',
      ]),
    ),
  },
  {
    key: 'approver',
    name: 'Approver',
    description: 'Approves or rejects assigned approval requests and service requests.',
    permissions: [
      'dashboard.read',
      'approvals.read',
      'approvals.decide',
      'requests.read',
      'requests.approve',
      'changes.read',
    ],
  },
  {
    key: 'employee',
    name: 'Employee / Requester',
    description: 'Submits and tracks their own requests and reads published knowledge.',
    permissions: ['dashboard.read', 'requests.read', 'requests.create', 'knowledge.read', 'portal.read', 'announcements.read'],
  },
];

export const TENANT_SYSTEM_ROLE_KEYS: string[] = TENANT_SYSTEM_ROLE_TEMPLATES.map((template) => template.key);

export function isProtectedTenantRole(role: { isSystem: boolean; key: string }): boolean {
  return role.isSystem || TENANT_SYSTEM_ROLE_KEYS.includes(role.key);
}
