/**
 * Tenant-administration canonical permissions (tenant.* layer).
 *
 * These keys live on the TENANT ADMINISTRATION PLANE, not the ITSM business
 * plane. They are the canonical replacement targets for the legacy bundles
 * `users.manage`, `roles.manage`, `groups.manage`, `orgs.manage`.
 * Also includes Instance-level permissions for custom domain and email channel.
 */

const TENANT_CORE_PERMISSIONS = [
  // Users
  "tenant.user.create",
  "tenant.user.read",
  "tenant.user.update",
  "tenant.user.invite",
  "tenant.user.suspend",
  "tenant.user.reactivate",
  "tenant.user.deactivate",
  "tenant.user.archive",
  "tenant.user.restore",
  "tenant.user.reset_mfa",
  "tenant.user.revoke_sessions",
  // Roles
  "tenant.role.create",
  "tenant.role.read",
  "tenant.role.update",
  "tenant.role.delete",
  "tenant.role.assign",
  // Groups / assignment groups
  "tenant.group.create",
  "tenant.group.read",
  "tenant.group.update",
  "tenant.group.delete",
  "tenant.group.assign",
  // Departments / teams / locations (org unit plane)
  "tenant.organization.create",
  "tenant.organization.read",
  "tenant.organization.update",
  "tenant.organization.delete",
  "tenant.department.create",
  "tenant.department.read",
  "tenant.department.update",
  "tenant.department.delete",
  "tenant.team.create",
  "tenant.team.read",
  "tenant.team.update",
  "tenant.team.delete",
  "tenant.location.create",
  "tenant.location.read",
  "tenant.location.update",
  "tenant.location.delete",
  // Permissions / security
  "tenant.permission.read",
  "tenant.permission.grant",
  "tenant.permission.revoke",
  "tenant.security.manage",
  "tenant.security.audit",
  // Modules
  "tenant.module.read",
  "tenant.module.manage",
  // Tenancy
  "tenant.settings.read",
  "tenant.settings.update",
  "tenant.settings.manage",
  // Instance custom domain
  "instance.domain.read",
  "instance.domain.add",
  "instance.domain.verify",
  "instance.domain.activate",
  "instance.domain.set_primary",
  "instance.domain.disable",
  "instance.domain.delete",
  "instance.domain.view_audit",
  // Instance email channel
  "instance.email.channel.read",
  "instance.email.channel.configure",
  "instance.email.channel.verify",
  "instance.email.channel.disable",
  "instance.email.inbound_action.read",
  "instance.email.inbound_action.manage",
  "instance.email.sender.read",
  "instance.email.sender.manage",
  "instance.email.delivery_log.read",
  "instance.email.message_audit.read",
];

module.exports = { TENANT_CORE_PERMISSIONS };
