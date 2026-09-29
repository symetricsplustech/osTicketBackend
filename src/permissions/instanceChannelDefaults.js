/**
 * Allowed scopes and default roles for the instance email-channel permission
 * family (GRANULAR_PERMISSIONS_FINAL §113-114).
 *
 * Channel administration is an INSTANCE-level (tenant-scoped) activity: the
 * configuration, verification, inbound-action and sender-config permissions
 * never apply "inside" a single ITSM record, department or assignment group.
 * The de facto authorized roles are the instance admin roles granted the
 * TENANT_CORE_PERMISSIONS plane by default.
 */

const INSTANCE_EMAIL_PREFIX = "instance.email.";
const DEFAULT_SCOPE = "TENANT";
const DELEGATABLE_SCOPES = new Set([DEFAULT_SCOPE, "ORGANIZATION", "BUSINESS_UNIT"]);
const DEFAULT_ROLES = ["instance_owner", "instance_admin"];

const isEmailChannelPermission = (permission) =>
  typeof permission === "string" && permission.startsWith(INSTANCE_EMAIL_PREFIX);

/** Allowed scopes for an instance email-channel permission (empty = none). */
const scopesForPermission = (permission) =>
  isEmailChannelPermission(permission) ? [DEFAULT_SCOPE] : [];

/** Default roles authorized for an instance email-channel permission. */
const defaultRolesForPermission = (permission) =>
  isEmailChannelPermission(permission) ? DEFAULT_ROLES : [];

module.exports = {
  INSTANCE_EMAIL_PREFIX,
  DEFAULT_SCOPE,
  DELEGATABLE_SCOPES,
  DEFAULT_ROLES,
  isEmailChannelPermission,
  scopesForPermission,
  defaultRolesForPermission,
};