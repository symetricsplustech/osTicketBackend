/**
 * Allowed scopes and default roles for the instance custom-domain permission
 * family (GRANULAR_PERMISSIONS_FINAL §86-99).
 *
 * Custom-domain administration is an INSTANCE-level (tenant-scoped) activity:
 * domain registration, verification, activation, primary-domain selection,
 * disabling and removal never apply "inside" a single ITSM record, department
 * or assignment group. The de facto authorized roles are the instance admin
 * roles granted the TENANT_CORE_PERMISSIONS plane by default.
 *
 * Record conditions: every operation binds authoritatively to the active
 * instance via the tenantCtx / instance parameter asserted by
 * authorization.service, and all instance-domain data rows are keyed by
 * company_id (instance id). Field policies for the underlying rows are defined
 * in itsmCatalog.FIELD_POLICIES.instance_domain.
 */

const INSTANCE_DOMAIN_PREFIX = "instance.domain.";
const DEFAULT_SCOPE = "TENANT";
const DELEGATABLE_SCOPES = new Set([DEFAULT_SCOPE, "ORGANIZATION", "BUSINESS_UNIT"]);
const DEFAULT_ROLES = ["instance_owner", "instance_admin"];

/** Record-condition predicate that must hold for every authorized operation. */
const RECORD_CONDITION =
  "the custom-domain row's company_id (instance id) must equal the authorized instance";

/** Every custom-domain key, in catalog order. */
const DOMAIN_PERMISSIONS = [
  "instance.domain.read",
  "instance.domain.add",
  "instance.domain.verify",
  "instance.domain.activate",
  "instance.domain.set_primary",
  "instance.domain.disable",
  "instance.domain.delete",
  "instance.domain.view_audit",
];

const isDomainPermission = (permission) =>
  typeof permission === "string" && permission.startsWith(INSTANCE_DOMAIN_PREFIX);

/** Allowed scopes for an instance custom-domain permission (empty = none). */
const scopesForPermission = (permission) =>
  isDomainPermission(permission) ? [DEFAULT_SCOPE] : [];

/** Default roles authorized for an instance custom-domain permission. */
const defaultRolesForPermission = (permission) =>
  isDomainPermission(permission) ? DEFAULT_ROLES : [];

module.exports = {
  INSTANCE_DOMAIN_PREFIX,
  DEFAULT_SCOPE,
  DELEGATABLE_SCOPES,
  DEFAULT_ROLES,
  RECORD_CONDITION,
  DOMAIN_PERMISSIONS,
  isDomainPermission,
  scopesForPermission,
  defaultRolesForPermission,
};