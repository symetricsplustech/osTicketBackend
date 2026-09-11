/* eslint-disable no-console */
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/config');
const Company = require('../src/models/Company');
const Agent = require('../src/models/Agent');
const CI = require('../src/models/enterprise/CI');
const AuditEvent = require('../src/models/AuditEvent');

const port = 5121; const base = `http://127.0.0.1:${port}/api/v1`;
const assert = (value, message) => { if (!value) throw new Error(message); console.log(`PASS ${message}`); };
const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
};

(async () => {
  let server; const companies = []; const suffix = Date.now();
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 }); server = app.listen(port);
    const [a, b] = await Promise.all([Company.create({ name: `CRUD A ${suffix}`, status: 'active' }), Company.create({ name: `CRUD B ${suffix}`, status: 'active' })]);
    companies.push(a._id, b._id); const now = new Date();
    await Promise.all([a, b].map((company) => mongoose.connection.db.collection('tenant_modules').updateOne({ tenantId: company._id, moduleKey: 'helpdesk' }, { $set: { status: 'active', activatedAt: now }, $setOnInsert: { moduleKey: 'helpdesk', createdAt: now } }, { upsert: true })));
    const [adminA, deniedA, adminB] = await Promise.all([
      Agent.create({ name: 'CRUD admin A', email: `crud-admin-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.create', 'records.update', 'records.delete'] }),
      Agent.create({ name: 'CRUD denied A', email: `crud-denied-a-${suffix}@osticket.local`, password: 'Pass@1234', company: a._id, isActive: true }),
      Agent.create({ name: 'CRUD admin B', email: `crud-admin-b-${suffix}@osticket.local`, password: 'Pass@1234', company: b._id, isAdmin: true, isActive: true, permissions: ['records.view', 'records.create', 'records.update', 'records.delete'] }),
    ]);
    const login = async (email) => (await request('POST', '/auth/agent/login', { body: { email, password: 'Pass@1234' } })).data.token;
    const [aToken, deniedToken, bToken] = await Promise.all([login(adminA.email), login(deniedA.email), login(adminB.email)]);
    assert((await request('POST', '/enterprise/cmdb/cis', { body: { name: 'Anonymous CI' } })).status === 401, 'anonymous generic CRUD write is denied');
    assert((await request('POST', '/enterprise/cmdb/cis', { token: deniedToken, body: { name: 'Denied CI' } })).status === 403, 'agent without records.create cannot use generic CRUD');
    assert((await request('POST', '/enterprise/cmdb/cis', { token: aToken, body: { name: 'Invalid CI', unsupportedField: true } })).status === 422, 'CMDB CI create rejects unknown fields');
    assert((await request('POST', '/enterprise/cmdb/cis', { token: aToken, body: { name: 'Invalid owner CI', owner: adminB._id } })).status === 422, 'CMDB CI create rejects a cross-tenant owner');
    const created = await request('POST', '/enterprise/cmdb/cis', { token: aToken, body: { name: 'Verified CI', ciClass: 'server' } });
    assert(created.status === 201, 'authorized agent can create a CMDB CI through generic CRUD');
    const ci = await CI.findById(created.data._id);
    assert(String(ci.tenantId) === String(a._id), 'generic CRUD forces the authenticated tenant ID');
    const listed = await request('GET', '/enterprise/cmdb/cis', { token: aToken });
    assert(listed.status === 200 && listed.data.some((row) => String(row._id) === String(ci._id)), 'authorized tenant-scoped agent can list its CMDB CI');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'enterprise.cmdb_cis.created', entityId: ci._id }), 'generic CRUD creation has mandatory audit evidence');
    assert([403, 404].includes((await request('PUT', `/enterprise/cmdb/cis/${ci._id}`, { token: bToken, body: { name: 'Cross tenant' } })).status), 'cross-tenant generic CRUD update is denied');
    assert((await request('PUT', `/enterprise/cmdb/cis/${ci._id}`, { token: deniedToken, body: { name: 'Denied update' } })).status === 403, 'agent without records.update cannot update generic CRUD record');
    assert((await request('PUT', `/enterprise/cmdb/cis/${ci._id}`, { token: aToken, body: { name: 'Updated CI', tenantId: b._id } })).status === 422, 'CMDB CI update rejects tenant-ID mass assignment');
    assert((await request('PUT', `/enterprise/cmdb/cis/${ci._id}`, { token: aToken, body: { name: 'Updated CI' } })).status === 200, 'authorized agent can update a generic CRUD record');
    const updated = await CI.findById(ci._id);
    assert(String(updated.tenantId) === String(a._id), 'generic CRUD ignores caller tenant-ID overwrite');
    assert((await request('PUT', `/enterprise/cmdb/cis/${ci._id}`, { token: aToken, body: { relationships: [] } })).status === 422, 'CMDB CI update rejects relationship mass assignment');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'enterprise.cmdb_cis.updated', entityId: ci._id }), 'generic CRUD update has mandatory audit evidence');
    const target = await request('POST', '/enterprise/cmdb/cis', { token: aToken, body: { name: 'Relationship target' } });
    assert(target.status === 201, 'authorized agent can create a same-tenant relationship target');
    assert((await request('POST', `/enterprise/cmdb/cis/${ci._id}/relate`, { body: { targetCiId: target.data._id } })).status === 401, 'anonymous CI relationship write is denied');
    assert((await request('POST', `/enterprise/cmdb/cis/${ci._id}/relate`, { token: deniedToken, body: { targetCiId: target.data._id } })).status === 403, 'agent without records.update cannot create a CI relationship');
    assert([403, 404].includes((await request('POST', `/enterprise/cmdb/cis/${ci._id}/relate`, { token: bToken, body: { targetCiId: target.data._id } })).status), 'cross-tenant CI relationship write is denied');
    assert((await request('POST', `/enterprise/cmdb/cis/${ci._id}/relate`, { token: aToken, body: { targetCiId: target.data._id, type: 'depends_on' } })).status === 201, 'authorized agent can create a same-tenant CI relationship');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'cmdb.ci.relationship_created', entityId: ci._id }), 'CI relationship creation has mandatory audit evidence');
    assert((await request('GET', `/enterprise/cmdb/cis/${ci._id}/impact`, { token: deniedToken })).status === 403, 'agent without records.view cannot run CI impact analysis');
    assert((await request('POST', '/enterprise/cmdb/services/health/recompute', { token: deniedToken })).status === 403, 'agent without records.update cannot recompute service health');
    assert((await request('POST', '/enterprise/cmdb/services/health/recompute', { token: aToken })).status === 200, 'authorized tenant-scoped agent can recompute service health');
    assert(await AuditEvent.exists({ company: a._id, actor: adminA._id, action: 'cmdb.service_health.recomputed' }), 'service-health recompute has mandatory audit evidence');
    console.log('ENTERPRISE CRUD SECURITY TESTS PASSED');
  } catch (error) { console.error('ENTERPRISE CRUD SECURITY TEST FAILED:', error.message); process.exitCode = 1; }
  finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (companies.length) { await AuditEvent.deleteMany({ company: { $in: companies } }); await CI.deleteMany({ tenantId: { $in: companies } }); await Agent.deleteMany({ company: { $in: companies } }); await mongoose.connection.db.collection('tenant_modules').deleteMany({ tenantId: { $in: companies } }); await Company.deleteMany({ _id: { $in: companies } }); }
    await mongoose.disconnect();
  }
})();
