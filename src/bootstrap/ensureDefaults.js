const SuperAdmin = require('../models/SuperAdmin');
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

const ensureDefaults = async () => {
  if (ensured) return;
  await ensureSuperAdmin();
  ensured = true;
};

module.exports = { ensureDefaults, ensureSuperAdmin };
