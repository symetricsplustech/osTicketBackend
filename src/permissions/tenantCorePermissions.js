/**
 * Tenant-administration canonical permissions (tenant.* layer).
 *
 * These keys live on the TENANT ADMINISTRATION PLANE, not the ITSM business
 * plane. They are the canonical replacement targets for the legacy bundles
 * `users.manage`, `roles.manage`, `groups.manage`, `orgs.manage`.
 */

const TENANT_CORE_PERMISSIONS = [
  // Users
  'tenant.user.create', 'tenant.user.read', 'tenant.user.update',
  'tenant.user.invite', 'tenant.user.suspend', 'tenant.user.reactivate',
  'tenant.user.deactivate', 'tenant.user.archive', 'tenant.user.restore',
  'tenant.user.reset_mfa', 'tenant.user.revoke_sessions',
  // Roles
  'tenant.role.create', 'tenant.role.read', 'tenant.role.update',
  'tenant.role.delete', 'tenant.role.assign',
  // Groups / assignment groups
  'tenant.group.create', 'tenant.group.read', 'tenant.group.update',
  'tenant.group.delete', 'tenant.group.assign',
  // Departments / teams / locations (org unit plane)
  'tenant.organization.create', 'tenant.organization.read', 'tenant.organization.update',
  'tenant.department.create', 'tenant.department.update',
  'tenant.team.create', 'tenant.team.update',
  'tenant.location.create', 'tenant.location.update',
  // Permissions / security
  'tenant.permission.read', 'tenant.permission.grant', 'tenant.permission.revoke',
  'tenant.security.manage', 'tenant.security.audit',
  // Modules
  'tenant.module.read', 'tenant.module.manage',
  // Tenancy
  'tenant.settings.read', 'tenant.settings.manage',
];

module.exports = { TENANT_CORE_PERMISSIONS };