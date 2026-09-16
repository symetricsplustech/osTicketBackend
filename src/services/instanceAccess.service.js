const { DEFAULT_REQUESTER_PERMISSIONS } = require("../config/defaultRequesterPermissions");

const isInstancePermission = (value) =>
  typeof value === "string" &&
  /^(?:itsm|tenant|instance|tickets|kb|organization)\.[a-z0-9_.]+$/.test(value);

const permissionsForMembership = (membership) => [
  ...new Set([
    ...DEFAULT_REQUESTER_PERMISSIONS,
    ...(membership?.permissions || []).filter(isInstancePermission),
  ]),
];

const activeMembership = (user, instanceId) =>
  (user.instanceMemberships || []).find((membership) =>
    String(membership.instance) === String(instanceId) && membership.status === "active");

module.exports = { activeMembership, isInstancePermission, permissionsForMembership };
