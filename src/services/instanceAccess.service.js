const { DEFAULT_REQUESTER_PERMISSIONS } = require("../config/defaultRequesterPermissions");
const { TENANT_CORE_PERMISSIONS } = require("../permissions/tenantCorePermissions");

const isInstancePermission = (value) =>
  typeof value === "string" &&
  /^(?:itsm|tenant|instance|tickets|kb|organization)\.[a-z0-9_.]+$/.test(value);

// Instance owners and admins hold the full tenant-administration plane by
// default (tenant.* + instance.*, including custom-domain and email-channel
// permissions). Members without an admin role only get the requester defaults
// plus whatever explicit membership grants were assigned.
const ADMIN_MEMBERSHIP_ROLES = ["instance_owner", "instance_admin"];

const permissionsForMembership = (membership) => [
  ...new Set([
    ...DEFAULT_REQUESTER_PERMISSIONS,
    ...(ADMIN_MEMBERSHIP_ROLES.includes(membership?.role)
      ? TENANT_CORE_PERMISSIONS
      : []),
    ...(membership?.permissions || []).filter(isInstancePermission),
  ]),
];

const activeMembership = (user, instanceId) =>
  (user.instanceMemberships || []).find((membership) =>
    String(membership.instance) === String(instanceId) && membership.status === "active");

module.exports = { activeMembership, isInstancePermission, permissionsForMembership };
