/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const User = require('../src/models/User');
const Asset = require('../src/models/Asset');
const AuditEvent = require('../src/models/AuditEvent');

const port = 5120;
const base = `http://127.0.0.1:${port}/api/v1`;
const assert = (value, message) => { if (!value) throw new Error(message); console.log(`PASS ${message}`); };
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};

(async () => {
  let server; const companies = []; const suffix = Date.now();
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
    server = app.listen(port);
    const [a, b] = await Promise.all([Company.create({ name: `Asset A ${suffix}`, status: 'active' }), Company.create({ name: `Asset B ${suffix}`, status: 'active' })]);
    companies.push(a._id, b._id);
    const now = new Date();
    await Promise.all([a, b].map((company) => mongoose.connection.db.collection('tenant_modules').updateOne(
      { tenantId: company._id, moduleKey: 'helpdesk' }, { $set: { status: 'active', activatedAt: now }, $setOnInsert: { moduleKey: 'helpdesk', createdAt: now } }, { upsert: true },
    )));
    const [adminA, deniedA, adminB, ownerB] = await Promise.all([
      Agent.create({ name: 'Asset admin A', email: `asset-admin-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.create', 'records.update'] }),
      Agent.create({ name: 'Asset denied A', email: `asset-denied-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isActive: true }),
      Agent.create({ name: 'Asset admin B', email: `asset-admin-b-${suffix}@osticket.local`, password: 'Pass@1234', company: b._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.create', 'records.update'] }),
      User.create({ name: 'Foreign asset owner', email: `asset-owner-b-${suffix}@osticket.local`, password: 'Pass@1234', company: b._id }),
    ]);
    const login = async (email) => (await request('POST', '/auth/agent/login', { body: { email, password: 'Pass@1234' } })).data.token;
    const [aToken, deniedToken, bToken] = await Promise.all([login(adminA.email), login(deniedA.email), login(adminB.email)]);
    assert((await request('POST', '/enterprise/assets', { body: { name: 'Anonymous asset' } })).status === 401, 'anonymous asset creation is denied');
    assert((await request('POST', '/enterprise/assets', { token: deniedToken, body: { name: 'Denied asset' } })).status === 403, 'agent without records.create cannot create an asset');
    assert((await request('POST', '/enterprise/assets', { token: aToken, body: { name: 'Foreign owner asset', owner: ownerB._id } })).status === 404, 'cross-tenant asset owner is rejected');
    const created = await request('POST', '/enterprise/assets', { token: aToken, body: { name: 'Verified laptop', type: 'laptop', serial: `SER-${suffix}` } });
    assert(created.status === 201, 'authorized agent can create a tenant asset');
    const asset = await Asset.findById(created.data.asset._id);
    assert(String(asset.company) === String(a._id) && String(asset.createdBy) === String(adminA._id), 'asset records its tenant and creating agent');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'asset.created', entityId: asset._id }), 'asset creation has mandatory audit evidence');
    assert([403, 404].includes((await request('GET', `/enterprise/assets/${asset._id}`, { token: bToken })).status), 'cross-tenant agent cannot read an asset');
    assert((await request('PUT', `/enterprise/assets/${asset._id}`, { token: deniedToken, body: { status: 'retired' } })).status === 403, 'agent without records.update cannot update an asset');
    assert((await request('PUT', `/enterprise/assets/${asset._id}`, { token: aToken, body: { status: 'maintenance' } })).status === 200, 'authorized agent can update a tenant asset');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'asset.updated', entityId: asset._id }), 'asset update has mandatory audit evidence');
    console.log('ITSM-13 ASSET SECURITY TESTS PASSED');
  } catch (error) {
    console.error('ITSM-13 ASSET SECURITY TEST FAILED:', error.message); process.exitCode = 1;
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companies.length) {
      await mongoose.connection.db.collection('tenant_modules').deleteMany({ tenantId: { $in: companies } });
      await AuditEvent.deleteMany({ company: { $in: companies } });
      await Asset.deleteMany({ company: { $in: companies } });
      await User.deleteMany({ company: { $in: companies } });
      await Agent.deleteMany({ company: { $in: companies } });
      await Company.deleteMany({ _id: { $in: companies } });
    }
    await mongoose.disconnect();
  }
})();
