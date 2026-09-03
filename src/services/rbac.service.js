const AccessAssignment = require('../models/AccessAssignment');

const activeFilter = () => ({ active: true, startsAt: { $lte: new Date() }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });

async function effectiveAccess(principal, principalType) {
  const assignments = await AccessAssignment.find({ principal: principal._id, principalType, ...activeFilter() }).populate('roles');
  const roles = assignments.flatMap((assignment) => assignment.roles || []).filter(Boolean);
  const legacyPermissions = principalType === 'Agent' ? [...(principal.permissions || []), ...(principal.role?.permissions || [])] : [...(principal.permissions || [])];
  const denied = new Set(roles.flatMap((role) => (role.deniedPermissions || []).map((p) => String(p).replace(/^!/, ''))));
  for (const p of legacyPermissions) {
    if (typeof p === 'string' && p.startsWith('!') && p.length > 1) denied.add(p.slice(1));
  }
  const permissions = new Set([...legacyPermissions.filter((p) => !(typeof p === 'string' && p.startsWith('!'))), ...roles.flatMap((role) => role.permissions || [])]);
  for (const d of denied) permissions.delete(d); // explicit DENY wins (MD §22)
  return {
    assignments,
    roles,
    permissions,
    denied,
    modules: new Set(roles.flatMap((role) => role.moduleKeys || []).concat(assignments.flatMap((assignment) => assignment.moduleKeys || []))),
    scopes: assignments.map((assignment) => ({ units: assignment.unitScopes, departments: assignment.departmentScopes, locations: assignment.locationScopes, teams: assignment.teamScopes })),
  };
}

async function canGrant(actor, requestedRoles) {
  if (actor.isAdmin || actor.role?.isAdmin) return true;
  const access = await effectiveAccess(actor, 'Agent');
  if (!access.permissions.has('access.manage')) return false;
  return requestedRoles.every((role) => {
    if (role.category === 'platform' || role.protected) return false;
    return (role.permissions || []).every((permission) => access.permissions.has(permission));
  });
}

module.exports = { activeFilter, effectiveAccess, canGrant };
