const SuperAdmin = require('../models/SuperAdmin');
const Role = require('../models/Role');
const logger = require('../utils/logger');

let ensured = false;

const ensureSuperAdmin = async () => {
  const email = (process.env.SUPERADMIN_EMAIL || 'superadmin@osticket.local').toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
  const name = process.env.SUPERADMIN_NAME || 'Platform Super Admin';

  const existing = await SuperAdmin.findOne({ email });
  if (existing) return existing;

  const created = await SuperAdmin.create({
    name,
    email,
    password,
    role: 'super_admin',
    isActive: true,
  });
  logger.info(`Auto-created default superadmin: ${created.email}`);
  return created;
};

const ensureRoleScopes = async () => {
  const legacyRoles = await Role.find({ scope: { $exists: false } });
  for (const role of legacyRoles) {
    role.scope = role.company ? 'tenant' : 'platform';
    if (role.scope === 'platform') role.category = 'platform';
    await role.save();
  }
};

const ensureDefaults = async () => {
  if (ensured) return;
  await ensureRoleScopes();
  await ensureSuperAdmin();
  ensured = true;
};

module.exports = { ensureDefaults, ensureSuperAdmin, ensureRoleScopes };
