import { Router } from 'express';
import type { RequestHandler } from 'express';
import { authenticate, authorize, requireTenantMembership, tenantContext, validateRequest } from '../api/middleware';
import { tenantIdParamSchema } from '../validators/saasadmin/tenants.validators';
import { authRouter } from './auth/auth.routes';
import { passwordRouter } from './auth/password.routes';
import { sessionRouter } from './auth/session.routes';
import { mfaRouter } from './auth/mfa.routes';
import { tenantsAdminRouter } from './saasadmin/tenants.routes';
import { tenantDomainsRouter } from './saasadmin/tenant-domains.routes';
import { approvalsAdminRouter } from './saasadmin/approvals.routes';
import { dashboardAdminRouter } from './saasadmin/dashboard.routes';
import { staffAdminRouter } from './saasadmin/staff.routes';
import { rolesAdminRouter } from './saasadmin/roles.routes';
import { permissionsAdminRouter } from './saasadmin/permissions.routes';
import { accessPoliciesAdminRouter } from './saasadmin/access-policies.routes';
import { serviceManagementAdminRouter } from './saasadmin/service-management.routes';
import { slaManagementAdminRouter } from './saasadmin/sla-management.routes';
import { workflowManagementAdminRouter } from './saasadmin/workflow-management.routes';
import { itsmConfigurationAdminRouter } from './saasadmin/itsm-configuration.routes';
import { knowledgeManagementAdminRouter } from './saasadmin/knowledge-management.routes';
import { cmdbAssetsAdminRouter } from './saasadmin/cmdb-assets.routes';
import { emailNotificationsAdminRouter } from './saasadmin/email-notifications.routes';
import { integrationsAdminRouter } from './saasadmin/integrations.routes';
import { apiKeysAdminRouter } from './saasadmin/api-keys.routes';
import { webhooksAdminRouter } from './saasadmin/webhooks.routes';
import { supportAdminRouter } from './saasadmin/support.routes';
import { reportsAdminRouter } from './saasadmin/reports.routes';
import { auditAdminRouter } from './saasadmin/audit.routes';
import { systemAdministrationAdminRouter } from './saasadmin/system-administration.routes';
import { platformSettingsAdminRouter } from './saasadmin/platform-settings.routes';
import { myAccountAdminRouter } from './saasadmin/my-account.routes';
import { organizationTenantRouter } from './tenantadmin/organization.routes';
import { organizationStructureTenantRouter } from './tenantadmin/organizationStructure.routes';
import { rolesTenantRouter } from './tenantadmin/roles.routes';
import { permissionsTenantRouter } from './tenantadmin/permissions.routes';
import { usersTenantRouter } from './tenantadmin/users.routes';
import { departmentsTenantRouter } from './tenantadmin/departments.routes';
import { locationsTenantRouter } from './tenantadmin/locations.routes';
import { costCentersTenantRouter } from './tenantadmin/costCenters.routes';
import { teamsTenantRouter } from './tenantadmin/teams.routes';
import { customersTenantRouter } from './tenantadmin/customers.routes';
import { incidentsItsmRouter } from './itsm/incidents.routes';
import { problemsItsmRouter } from './itsm/problems.routes';
import { changesItsmRouter } from './itsm/changes.routes';
import { requestsItsmRouter } from './itsm/requests.routes';
import { catalogItsmRouter } from './itsm/catalog.routes';
import { knowledgeItsmRouter } from './itsm/knowledge.routes';
import { cmdbItsmRouter } from './itsm/cmdb.routes';
import { assetsItsmRouter } from './itsm/assets.routes';
import { discoveryItsmRouter } from './itsm/discovery.routes';
import { onCallItsmRouter } from './itsm/oncall.routes';
import { releasesItsmRouter } from './itsm/releases.routes';
import { knownErrorsItsmRouter } from './itsm/knownErrors.routes';
import { majorIncidentsItsmRouter } from './itsm/majorIncidents.routes';
import { vendorsItsmRouter } from './itsm/vendors.routes';
import { announcementsItsmRouter } from './itsm/announcements.routes';
import { approvalsItsmRouter } from './itsm/approvals.routes';
import { slaItsmRouter } from './itsm/sla.routes';
import { workflowsItsmRouter } from './itsm/workflows.routes';
import { automationItsmRouter } from './itsm/automation.routes';
import { notificationsItsmRouter } from './itsm/notifications.routes';
import { serviceDeskItsmRouter } from './itsm/servicedesk.routes';
import { integrationsItsmRouter } from './itsm/integrations.routes';
import { apiKeysItsmRouter } from './itsm/apikeys.routes';
import { webhooksItsmRouter } from './itsm/webhooks.routes';
import { attachmentsItsmRouter } from './itsm/attachments.routes';
import { incidentConfigItsmRouter } from './itsm/incidentconfig.routes';
import { problemConfigItsmRouter } from './itsm/problemconfig.routes';
import { changeConfigItsmRouter } from './itsm/changeconfig.routes';
import { changeCalendarItsmRouter } from './itsm/changecalendar.routes';
import { assetConfigItsmRouter } from './itsm/assetconfig.routes';
import { accessPoliciesItsmRouter } from './itsm/accesspolicies.routes';
import { delegationsItsmRouter } from './itsm/delegations.routes';
import { accessReviewsItsmRouter } from './itsm/accessreviews.routes';
import { dashboardItsmRouter } from './itsm/dashboard.routes';
import { auditItsmRouter } from './itsm/audit.routes';
import { securityItsmRouter } from './itsm/security.routes';
import { supportItsmRouter } from './itsm/support.routes';
import { reportsItsmRouter } from './itsm/reports.routes';
import { importsItsmRouter } from './itsm/imports.routes';
import { exportsItsmRouter } from './itsm/exports.routes';
import { settingsItsmRouter } from './itsm/settings.routes';
import { portalItsmRouter } from './itsm/portal.routes';
import { healthRouter } from './health.routes';

export interface RouteMountChild {
  path: string;
  router: Router;
  children?: RouteMountChild[];
}

export interface RouteMount {
  basePath: string;
  router: Router;
  tag: string;
  description: string;
  public?: boolean;
  middleware?: RequestHandler[];
  children?: RouteMountChild[];
}

export const API_MOUNTS: RouteMount[] = [
  {
    basePath: '/health',
    router: healthRouter,
    tag: 'Health',
    description: 'Liveness and readiness checks. Detailed diagnostics are restricted to authorized administrators.',
    public: true,
  },
  {
    basePath: '/auth',
    router: authRouter,
    tag: 'Authentication',
    description: 'Sign-in, token refresh, current user, invitations.',
    public: true,
  },
  {
    basePath: '/auth',
    router: passwordRouter,
    tag: 'Authentication',
    description: 'Password reset and change flows.',
    public: true,
  },
  {
    basePath: '/auth/sessions',
    router: sessionRouter,
    tag: 'Authentication',
    description: 'Active session management for the signed-in user.',
  },
  {
    basePath: '/auth/mfa',
    router: mfaRouter,
    tag: 'Authentication',
    description: 'Multi-factor authentication enrollment and verification.',
    public: true,
  },
  {
    basePath: '/admin/dashboard',
    router: dashboardAdminRouter,
    tag: 'Admin · Dashboard',
    description: 'Platform dashboard summaries, charts, alerts and work queue.',
  },
  {
    basePath: '/admin/tenants',
    router: tenantsAdminRouter,
    tag: 'Admin · Tenants',
    description: 'Tenant lifecycle management, provisioning, support access.',
    children: [
      {
        path: '/:tenantId/domains',
        router: tenantDomainsRouter,
      },
    ],
  },
  {
    basePath: '/admin/staff',
    router: staffAdminRouter,
    tag: 'Admin · Staff',
    description: 'Internal platform staff and access management.',
  },
  {
    basePath: '/admin/roles',
    router: rolesAdminRouter,
    tag: 'Admin · Roles',
    description: 'Platform roles and permission assignments.',
  },
  {
    basePath: '/admin/permissions',
    router: permissionsAdminRouter,
    tag: 'Admin · Permissions',
    description: 'Platform permission catalog.',
  },
  {
    basePath: '/admin/access-policies',
    router: accessPoliciesAdminRouter,
    tag: 'Admin · Access Policies',
    description: 'Access policy configuration and assignment.',
  },
  {
    basePath: '/admin/approvals',
    router: approvalsAdminRouter,
    tag: 'Admin · Approvals',
    description: 'Platform-level approval policies and requests.',
  },
  {
    basePath: '/admin/service-management',
    router: serviceManagementAdminRouter,
    tag: 'Admin · Service Management',
    description: 'Reusable service definitions, categories and templates.',
  },
  {
    basePath: '/admin/sla-management',
    router: slaManagementAdminRouter,
    tag: 'Admin · SLA Management',
    description: 'SLA policy templates, calendars and escalation rules.',
  },
  {
    basePath: '/admin/workflow-management',
    router: workflowManagementAdminRouter,
    tag: 'Admin · Workflow Management',
    description: 'Workflow templates, versions, runs and tenant assignments.',
  },
  {
    basePath: '/admin/itsm-configuration',
    router: itsmConfigurationAdminRouter,
    tag: 'Admin · ITSM Configuration',
    description: 'Global ITSM modules, priorities, statuses, categories and numbering.',
  },
  {
    basePath: '/admin/knowledge-management',
    router: knowledgeManagementAdminRouter,
    tag: 'Admin · Knowledge Management',
    description: 'Knowledge governance policies, categories, templates and review rules.',
  },
  {
    basePath: '/admin/cmdb-assets',
    router: cmdbAssetsAdminRouter,
    tag: 'Admin · CMDB & Assets',
    description: 'CI types, relationship types, asset categories and discovery profiles.',
  },
  {
    basePath: '/admin/email-notifications',
    router: emailNotificationsAdminRouter,
    tag: 'Admin · Email & Notifications',
    description: 'Email providers, notification templates, rules and delivery logs.',
  },
  {
    basePath: '/admin/integrations',
    router: integrationsAdminRouter,
    tag: 'Admin · Integrations',
    description: 'Integration configuration, connectivity testing and logs.',
  },
  {
    basePath: '/admin/api-keys',
    router: apiKeysAdminRouter,
    tag: 'Admin · API Keys',
    description: 'Scoped API key creation, rotation, revocation and usage.',
  },
  {
    basePath: '/admin/webhooks',
    router: webhooksAdminRouter,
    tag: 'Admin · Webhooks',
    description: 'Webhook endpoints, signing secrets and delivery attempts.',
  },
  {
    basePath: '/admin/support',
    router: supportAdminRouter,
    tag: 'Admin · Support',
    description: 'Platform support tickets and queues.',
  },
  {
    basePath: '/admin/reports',
    router: reportsAdminRouter,
    tag: 'Admin · Reports',
    description: 'Report catalog, runs, exports and aggregate analytics.',
  },
  {
    basePath: '/admin/audit',
    router: auditAdminRouter,
    tag: 'Admin · Audit',
    description: 'Audit, security and login event search and export.',
  },
  {
    basePath: '/admin/system-administration',
    router: systemAdministrationAdminRouter,
    tag: 'Admin · System Administration',
    description: 'Service health, queues, jobs, maintenance and version information.',
  },
  {
    basePath: '/admin/platform-settings',
    router: platformSettingsAdminRouter,
    tag: 'Admin · Platform Settings',
    description: 'Platform settings, branding, localization, security, retention and feature flags.',
  },
  {
    basePath: '/admin/my-account',
    router: myAccountAdminRouter,
    tag: 'Admin · My Account',
    description: 'Personal profile, preferences, sessions and security settings.',
  },
  {
    basePath: '/tenant-admin/organization',
    router: organizationTenantRouter,
    tag: 'Tenant Admin · Organization',
    description: 'Organization profile, branding, localization and business settings for the active organization.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/tenant-admin/organization-structure',
    router: organizationStructureTenantRouter,
    tag: 'Tenant Admin · Organization Structure',
    description: 'Reporting structure across departments, teams and managers for the active organization.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/tenant-admin/roles',
    router: rolesTenantRouter,
    tag: 'Tenant Admin · Roles',
    description: 'Organization roles and their tenant-scoped permission assignments.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/tenant-admin/permissions',
    router: permissionsTenantRouter,
    tag: 'Tenant Admin · Permissions',
    description: 'Tenant-scoped permission catalog available to organization roles.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/tenant-admin/users',
    router: usersTenantRouter,
    tag: 'Tenant Admin · Users',
    description: 'Organization membership lifecycle, invitations, roles and session management.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/tenant-admin/departments',
    router: departmentsTenantRouter,
    tag: 'Tenant Admin · Departments',
    description: 'Organization departments and business units.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/tenant-admin/locations',
    router: locationsTenantRouter,
    tag: 'Tenant Admin · Locations',
    description: 'Organization locations, offices and sites.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/tenant-admin/cost-centers',
    router: costCentersTenantRouter,
    tag: 'Tenant Admin · Cost Centers',
    description: 'Organization cost centers.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/tenant-admin/teams',
    router: teamsTenantRouter,
    tag: 'Tenant Admin · Teams',
    description: 'Organization teams, leads and membership.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/tenant-admin/customers',
    router: customersTenantRouter,
    tag: 'Tenant Admin · Customers',
    description: 'Customer directory, contacts, sites, portal access and ticket history.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/incidents',
    router: incidentsItsmRouter,
    tag: 'ITSM · Incidents',
    description: 'Incident records, assignment, escalation, resolution and comments.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/problems',
    router: problemsItsmRouter,
    tag: 'ITSM · Problems',
    description: 'Problem records, root cause analysis, known errors, resolution and comments.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/changes',
    router: changesItsmRouter,
    tag: 'ITSM · Changes',
    description: 'Change requests, approvals, scheduling, implementation and rollback.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/requests',
    router: requestsItsmRouter,
    tag: 'ITSM · Service Requests',
    description: 'Service requests, approvals, assignment and fulfilment.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/catalog',
    router: catalogItsmRouter,
    tag: 'ITSM · Service Catalog',
    description: 'Tenant service catalog categories, items and published versions.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/knowledge',
    router: knowledgeItsmRouter,
    tag: 'ITSM · Knowledge',
    description: 'Knowledge categories, articles, review workflow and comments.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/cmdb',
    router: cmdbItsmRouter,
    tag: 'ITSM · CMDB',
    description: 'Configuration items and relationships.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/assets',
    router: assetsItsmRouter,
    tag: 'ITSM · Assets',
    description: 'Assets, assignment, lifecycle and maintenance records.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/discovery',
    router: discoveryItsmRouter,
    tag: 'ITSM · Discovery',
    description: 'Discovery runs and results.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/on-call',
    router: onCallItsmRouter,
    tag: 'ITSM · On-call',
    description: 'On-call schedules, shifts and overrides.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/releases',
    router: releasesItsmRouter,
    tag: 'ITSM · Releases',
    description: 'Release records, planning, deployment and completion.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/known-errors',
    router: knownErrorsItsmRouter,
    tag: 'ITSM · Known Errors',
    description: 'Known errors, root causes and workarounds.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/major-incidents',
    router: majorIncidentsItsmRouter,
    tag: 'ITSM · Major Incidents',
    description: 'Major incident declarations, command and resolution.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/vendors',
    router: vendorsItsmRouter,
    tag: 'ITSM · Vendors',
    description: 'Vendor directory, contacts and lifecycle.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/announcements',
    router: announcementsItsmRouter,
    tag: 'ITSM · Announcements',
    description: 'Organization announcements and publishing.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/approvals',
    router: approvalsItsmRouter,
    tag: 'ITSM · Approvals',
    description: 'Tenant approval policies, requests and decisions.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/sla',
    router: slaItsmRouter,
    tag: 'ITSM · SLA',
    description: 'Tenant SLA policies, escalation rules and business calendars.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/workflows',
    router: workflowsItsmRouter,
    tag: 'ITSM · Workflows',
    description: 'Tenant workflow definitions, versions and runs.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/automation',
    router: automationItsmRouter,
    tag: 'ITSM · Automation',
    description: 'Tenant automation rules and runs.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/notifications',
    router: notificationsItsmRouter,
    tag: 'ITSM · Notifications',
    description: 'Tenant notification templates, rules and delivery logs.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/service-desk',
    router: serviceDeskItsmRouter,
    tag: 'ITSM · Service Desk',
    description: 'Tenant service desk queues, routing rules and operating hours.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/integrations',
    router: integrationsItsmRouter,
    tag: 'ITSM · Integrations',
    description: 'Tenant integrations and integration logs.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/api-keys',
    router: apiKeysItsmRouter,
    tag: 'ITSM · API Keys',
    description: 'Tenant API keys and usage.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/webhooks',
    router: webhooksItsmRouter,
    tag: 'ITSM · Webhooks',
    description: 'Tenant webhooks, secrets and deliveries.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/attachments',
    router: attachmentsItsmRouter,
    tag: 'ITSM · Attachments',
    description: 'Tenant attachments metadata.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/dashboard',
    router: dashboardItsmRouter,
    tag: 'ITSM · Dashboard',
    description: 'Organization dashboard overview, incident summaries, workload, trends and activity.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/incident-config',
    router: incidentConfigItsmRouter,
    tag: 'ITSM · Incident Configuration',
    description: 'Tenant incident categories, priorities and resolution codes.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/problem-config',
    router: problemConfigItsmRouter,
    tag: 'ITSM · Problem Configuration',
    description: 'Tenant problem categories and root cause categories.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/change-config',
    router: changeConfigItsmRouter,
    tag: 'ITSM · Change Configuration',
    description: 'Tenant change types and change templates.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/change-calendar',
    router: changeCalendarItsmRouter,
    tag: 'ITSM · Change Calendar',
    description: 'Tenant change calendar maintenance windows and blackout periods.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/asset-config',
    router: assetConfigItsmRouter,
    tag: 'ITSM · Asset Configuration',
    description: 'Tenant asset models and software licenses.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/access-policies',
    router: accessPoliciesItsmRouter,
    tag: 'ITSM · Access Policies',
    description: 'Tenant access policies and subject assignments.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/delegations',
    router: delegationsItsmRouter,
    tag: 'ITSM · Delegations',
    description: 'Tenant delegated administration assignments.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/access-reviews',
    router: accessReviewsItsmRouter,
    tag: 'ITSM · Access Reviews',
    description: 'Tenant access review campaigns, items and decisions.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/audit',
    router: auditItsmRouter,
    tag: 'ITSM · Audit',
    description: 'Tenant audit and security event search, actors and export.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/security',
    router: securityItsmRouter,
    tag: 'ITSM · Security',
    description: 'Tenant security overview, events and session revocation.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/support',
    router: supportItsmRouter,
    tag: 'ITSM · Support',
    description: 'Support tickets raised with the platform operator.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/reports',
    router: reportsItsmRouter,
    tag: 'ITSM · Reports',
    description: 'Tenant report catalog, runs and export requests.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/imports',
    router: importsItsmRouter,
    tag: 'ITSM · Imports',
    description: 'Tenant data import jobs.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/exports',
    router: exportsItsmRouter,
    tag: 'ITSM · Exports',
    description: 'Tenant data export jobs.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/settings',
    router: settingsItsmRouter,
    tag: 'ITSM · Settings',
    description: 'Tenant configuration settings and custom field definitions.',
    middleware: [requireTenantMembership],
  },
  {
    basePath: '/itsm/portal',
    router: portalItsmRouter,
    tag: 'ITSM · Portal',
    description: 'Employee portal configuration and forms.',
    middleware: [requireTenantMembership],
  },
];

export const apiRouter = Router();

for (const mount of API_MOUNTS) {
  const handlers: RequestHandler[] = [];
  if (!mount.public) handlers.push(authenticate);
  if (mount.middleware) handlers.push(...mount.middleware);
  apiRouter.use(mount.basePath, handlers, mount.router);
}

export { authorize, tenantContext, validateRequest, tenantIdParamSchema };
