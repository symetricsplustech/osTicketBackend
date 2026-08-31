const mongoose = require('mongoose');
const config = require('../config/config');

const SuperAdmin = require('../models/SuperAdmin');

const allModules = [
  'helpdesk',
  'crm',
  'csm',
  'itam',
  'itom',
  'projects',
  'hr',
  'field-service',
  'workflow',
  'analytics',
  'ai',
  'settings',
];

const seedSuperAdmin = async () => {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected to MongoDB');

  let superAdmin = await SuperAdmin.findOne({ email: 'superadmin@osticket.local' });

  if (!superAdmin) {
    superAdmin = await SuperAdmin.create({
      name: 'Platform Super Admin',
      email: 'superadmin@osticket.local',
      password: 'SuperAdmin@123',
      role: 'super_admin',
      isActive: true,
      moduleKeys: allModules,
    });
    console.log('Super admin seeded with all modules');
  } else {
    superAdmin.moduleKeys = allModules;
    await superAdmin.save();
    console.log('Super admin moduleKeys updated to all modules');
  }

  console.log(`Super admin email: ${superAdmin.email}`);
  console.log(`Module keys: ${superAdmin.moduleKeys.join(', ')}`);

  await mongoose.disconnect();
};

seedSuperAdmin().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});