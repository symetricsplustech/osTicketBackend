const USER_PERMISSIONS = {
  TICKET_CREATE: 'ticket_create',
  TICKET_VIEW: 'ticket_view',
  TICKET_REPLY: 'ticket_reply',
  TICKET_DELETE: 'ticket_delete',
};

const USER_PERMISSION_LIST = Object.values(USER_PERMISSIONS);

const USER_PERMISSION_LABELS = {
  [USER_PERMISSIONS.TICKET_CREATE]: 'Create tickets',
  [USER_PERMISSIONS.TICKET_VIEW]: 'View all tickets',
  [USER_PERMISSIONS.TICKET_REPLY]: 'Reply to tickets',
  [USER_PERMISSIONS.TICKET_DELETE]: 'Delete tickets',
};

const isEmployee = (user) => Boolean(user && user.createdBy);

const getOrgOwner = (user) => (isEmployee(user) ? user.createdBy : user ? user._id : null);

const hasPermission = (user, perm) => !isEmployee(user) || (user.permissions || []).includes(perm);

module.exports = {
  USER_PERMISSIONS,
  USER_PERMISSION_LIST,
  USER_PERMISSION_LABELS,
  isEmployee,
  getOrgOwner,
  hasPermission,
};
