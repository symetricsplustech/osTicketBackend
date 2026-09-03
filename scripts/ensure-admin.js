/* eslint-disable no-console */
// Creates or updates a SUPERADMIN (platform operator) for login/testing.
//
// Usage:
//   node scripts/ensure-admin.js --email=root@platform.local --password='ChooseAStrongOne123'
//   SUPERADMIN_PASSWORD='...' node scripts/ensure-admin.js --email=root@platform.local
//   node scripts/ensure-admin.js --email=support@platform.local --password='...' --platform-role=platform_support_administrator
//
// What it does:
//   1. Finds the SuperAdmin by email (case-insensitive) or creates it.
//   2. Resets the password (bcrypt-hashed by the model pre-save hook),
//      name, role, platformRole and reactivates the account.
//   3. Applies the permission set for the platformRole (explicit grants;
//      override with --permissions=a,b,c). No tenant/company is touched —
//      superadmins live outside tenants by design.
// Never hardcodes credentials: password must come from --password or env,
// and is never printed.
const mongoose = require('mongoose');
const config = require('../src/config/config');
const SuperAdmin = require('../src/models/SuperAdmin');

const PLATFORM_ROLES = [
  'platform_owner',
  'platform_administrator',
  'platform_support_administrator',
  'platform_security_administrator',
  'platform_auditor',
];

const VIEW = [
  'platform.view_dashboard',
  'platform.view_tenants',
  'platform.view_plans',
  'platform.view_modules',
  'platform.view_operations',
  'platform.view_audit',
  'platform.view_security',
  'platform.view_superadmins',
  'platform.view_platform',
  'platform.view_invoices',
];

// Default permission grants per platform role (frontend gates + separation
// of duties: only owners manage operators; auditors are read-only).
const ROLE_PERMISSIONS = {
  platform_owner: [
    ...VIEW,
    'platform.manage_dashboard',
    'platform.manage_tenants',
    'platform.manage_plans',
    'platform.manage_modules',
    'platform.manage_operations',
    'platform.manage_audit',
    'platform.manage_security',
    'platform.manage_superadmins',
    'platform.manage_platform',
    'platform.manage_invoices',
    'platform.manage_payments',
    'platform.impersonate',
  ],
  platform_administrator: [
    ...VIEW,
    'platform.manage_dashboard',
    'platform.manage_tenants',
    'platform.manage_plans',
    'platform.manage_modules',
    'platform.manage_operations',
    'platform.manage_platform',
    'platform.manage_invoices',
  ],
  platform_support_administrator: [...VIEW, 'platform.impersonate'],
  platform_security_administrator: [...VIEW, 'platform.manage_security'],
  platform_auditor: [...VIEW],
};

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

const run = async () => {
  const email = (arg('email', 'root@platform.local') || '').toLowerCase().trim();
  const password = arg('password', process.env.SUPERADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '');
  const name = arg('name', 'Platform Owner');
  const platformRole = arg('platform-role', 'platform_owner');
  const explicitPerms = arg('permissions', '');

  if (!email || !password) {
    console.error('Usage: node scripts/ensure-admin.js --email=<email> --password=<password> [--platform-role=<role>] [--permissions=a,b]');
    process.exit(2);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(2);
  }
  if (!PLATFORM_ROLES.includes(platformRole)) {
    console.error(`Invalid --platform-role. Choose: ${PLATFORM_ROLES.join(', ')}`);
    process.exit(2);
  }

  const permissions = explicitPerms
    ? explicitPerms.split(',').map((p) => p.trim()).filter(Boolean)
    : ROLE_PERMISSIONS[platformRole];

  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });

  let admin = await SuperAdmin.findOne({ email });
  if (admin) {
    admin.name = name || admin.name;
    admin.password = password; // re-hashed by pre-save hook
    admin.role = 'super_admin';
    admin.platformRole = platformRole;
    admin.permissions = permissions;
    admin.isActive = true;
    await admin.save();
    console.log(`Updated superadmin: ${email}`);
  } else {
    admin = await SuperAdmin.create({
      name,
      email,
      password,
      role: 'super_admin',
      platformRole,
      permissions,
      isActive: true,
    });
    console.log(`Created superadmin: ${email}`);
  }

  console.log(`  role:          ${admin.role}`);
  console.log(`  platformRole:  ${admin.platformRole}`);
  console.log(`  active:        ${admin.isActive}`);
  console.log(`  permissions:   ${admin.permissions.length} granted`);
  console.log(`\nLogin at the frontend with:\n  email:    ${email}\n  password: (the one you just set)`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => { console.error(e.message || e); process.exit(1); });
