/* eslint-disable no-console */
// Creates (or repairs) a tenant admin agent for local login/testing.
//
// Usage:
//   node scripts/ensure-admin.js --email=admin@osticket.local --password='ChooseAStrongOne123'
//   ADMIN_PASSWORD='...' node scripts/ensure-admin.js --email=admin@osticket.local
//
// What it does:
//   1. Uses the first active Company, or creates "Default Tenant".
//   2. Upserts an active admin Agent (isAdmin) with the given password.
//   3. Activates core modules (helpdesk, crm, itam, itom, projects, hr,
//      field-service, workflow, analytics, settings) for that tenant, so the
//      sidebar actually opens instead of bouncing to Dashboard.
// Never hardcodes credentials: password must come from --password or env.
const mongoose = require('mongoose');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');

const CORE_MODULES = [
  'helpdesk', 'crm', 'csm', 'itam', 'itom', 'projects', 'hr',
  'field-service', 'workflow', 'analytics', 'settings',
];

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
};

const run = async () => {
  const email = (arg('email', 'admin@osticket.local') || '').toLowerCase().trim();
  const password = arg('password', process.env.ADMIN_PASSWORD || '');
  if (!email || !password) {
    console.error('Usage: node scripts/ensure-admin.js --email=<email> --password=<password>  (or ADMIN_PASSWORD env)');
    process.exit(2);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(2);
  }

  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });

  let company = await Company.findOne({ status: 'active' }).sort({ createdAt: 1 });
  if (!company) {
    company = await Company.create({ name: 'Default Tenant', status: 'active' });
    console.log(`Created company: ${company.name} (${company._id})`);
  } else {
    console.log(`Using company: ${company.name} (${company._id})`);
  }

  let agent = await Agent.findOne({ email });
  if (agent) {
    agent.name = agent.name || 'Tenant Admin';
    agent.company = company._id;
    agent.isAdmin = true;
    agent.isActive = true;
    agent.password = password;
    await agent.save();
    console.log(`Updated admin agent: ${email}`);
  } else {
    agent = await Agent.create({
      name: 'Tenant Admin',
      email,
      password,
      company: company._id,
      isAdmin: true,
      isActive: true,
    });
    console.log(`Created admin agent: ${email}`);
  }

  const db = mongoose.connection.db;
  const now = new Date();
  for (const moduleKey of CORE_MODULES) {
    await db.collection('tenant_modules').updateOne(
      { tenantId: company._id, moduleKey },
      {
        $set: { status: 'active', activatedAt: now, updatedAt: now },
        $setOnInsert: { tenantId: company._id, moduleKey, createdAt: now },
      },
      { upsert: true }
    );
  }
  console.log(`Activated modules: ${CORE_MODULES.join(', ')}`);
  console.log(`\nLogin at the frontend with:\n  email:    ${email}\n  password: (the one you just set)`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((e) => { console.error(e.message || e); process.exit(1); });
